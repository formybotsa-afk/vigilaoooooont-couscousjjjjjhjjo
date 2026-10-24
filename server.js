const express = require('express');
const { Redis } = require('@upstash/redis');
const app = express();

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'CHANGE_ME_2025';
const GAME = 'pubg';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: true, message: 'License Server Online ✅', time: new Date().toISOString() });
});

// Login + Admin
app.post('/login', async (req, res) => {
  let body = req.body;

  if (typeof body === 'string') {
    const p = new URLSearchParams(body);
    body = Object.fromEntries(p);
  }

  // Admin actions
  if (body.action) {
    const { action, adminPassword, key, name, days } = body;

    if (adminPassword !== ADMIN_PASS) {
      return res.status(401).json({ status: false, reason: 'UNAUTHORIZED' });
    }

    const upperKey = (key || '').toUpperCase().trim();

    if (action === 'create') {
      if (!/^[A-Z0-9\-]{4,64}$/.test(upperKey)) {
        return res.status(400).json({ status: false, reason: 'INVALID_KEY_FORMAT' });
      }
      const expires = Math.floor(Date.now() / 1000) + ((parseInt(days) || 365) * 86400);
      const record = {
        name: name || 'User',
        type: 'universal',
        expires,
        device: null,
        blocked: false,
        createdAt: Math.floor(Date.now() / 1000),
      };
      await redis.set(`key:${upperKey}`, JSON.stringify(record));
      return res.json({
        status: true,
        message: '✅ Key created',
        key: upperKey,
        name: record.name,
        expires,
        expiresHuman: new Date(expires * 1000).toISOString(),
      });
    }

    if (action === 'block') {
      const s = await redis.get(`key:${upperKey}`);
      if (!s) return res.status(404).json({ status: false, reason: 'NOT_FOUND' });
      const r = typeof s === 'string' ? JSON.parse(s) : s;
      r.blocked = true;
      await redis.set(`key:${upperKey}`, JSON.stringify(r));
      return res.json({ status: true, message: '🚫 Blocked' });
    }

    if (action === 'delete') {
      await redis.del(`key:${upperKey}`);
      return res.json({ status: true, message: '🗑️ Deleted' });
    }

    if (action === 'reset') {
      const s = await redis.get(`key:${upperKey}`);
      if (!s) return res.status(404).json({ status: false, reason: 'NOT_FOUND' });
      const r = typeof s === 'string' ? JSON.parse(s) : s;
      r.device = null;
      await redis.set(`key:${upperKey}`, JSON.stringify(r));
      return res.json({ status: true, message: '🔄 Device reset' });
    }

    if (action === 'list') {
      const keys = await redis.keys('key:*');
      const result = [];
      for (const k of keys) {
        const v = await redis.get(k);
        const r = typeof v === 'string' ? JSON.parse(v) : v;
        result.push({
          key: k.replace('key:', ''),
          name: r.name,
          expires: r.expires,
          expiresHuman: r.expires ? new Date(r.expires * 1000).toISOString() : null,
          device: r.device ? r.device.substring(0, 12) + '...' : null,
          blocked: r.blocked === true,
        });
      }
      return res.json({ status: true, count: result.length, keys: result });
    }

    return res.status(400).json({ status: false, reason: 'UNKNOWN_ACTION' });
  }

  // Login from game
  try {
    const game   = body.game || '';
    const key    = (body.user_key || '').toUpperCase().trim();
    const serial = body.serial || '';

    if (game !== GAME) return res.status(400).json({ status: false, reason: 'INVALID_GAME' });
    if (!/^[A-Z0-9\-]{4,64}$/.test(key)) return res.status(400).json({ status: false, reason: 'INVALID_FORMAT' });
    if (!serial || serial.length < 8) return res.status(400).json({ status: false, reason: 'INVALID_SERIAL' });

    const s = await redis.get(`key:${key}`);
    if (!s) return res.status(404).json({ status: false, reason: 'NOT_REGISTERED' });

    const record = typeof s === 'string' ? JSON.parse(s) : s;

    if (record.blocked === true) return res.status(403).json({ status: false, reason: 'BLOCKED' });

    const now = Math.floor(Date.now() / 1000);
    if (record.expires && now > record.expires) {
      return res.status(403).json({ status: false, reason: 'EXPIRED' });
    }
    if (record.device && record.device !== serial) {
      return res.status(403).json({ status: false, reason: 'MAX_DEVICES_REACHED' });
    }
    if (!record.device) {
      record.device = serial;
      record.firstLogin = now;
      await redis.set(`key:${key}`, JSON.stringify(record));
    }

    return res.json({
      status: true,
      data: {
        key,
        name: record.name || 'User',
        type: record.type || 'universal',
        expires: record.expires || null,
      },
    });
  } catch (e) {
    return res.status(500).json({ status: false, reason: 'SERVER_ERROR: ' + e.message });
  }
});

// Admin UI
app.get('/admin', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>License Admin</title>
<style>
  *{box-sizing:border-box}
  body{background:#0a0e1a;color:#e0e0e0;font-family:monospace;padding:16px;margin:0;max-width:100%}
  h1{color:#00d4ff;font-size:22px;text-align:center;margin:10px 0}
  h3{color:#00d4ff;font-size:15px;margin:12px 0 6px}
  .box{background:#1a1f2e;padding:14px;border-left:4px solid #00d4ff;margin:10px 0;border-radius:4px}
  input,button{padding:10px;margin:4px 0;background:#0a0e1a;color:#e0e0e0;border:1px solid #00d4ff;border-radius:4px;font-family:monospace;font-size:14px;width:100%}
  button{background:#00d4ff;color:#000;cursor:pointer;font-weight:bold;margin-top:6px}
  button:active{background:#00a8cc}
  .btn-red{background:#ff4444;color:#fff}
  .btn-yellow{background:#ffaa00;color:#000}
  .btn-grey{background:#666;color:#fff}
  pre{background:#000;padding:10px;overflow:auto;border-radius:4px;font-size:11px;max-height:300px}
  .ok{color:#00ff88}
  .err{color:#ff4444}
</style>
</head><body>

<h1>🔑 License Admin</h1>

<div class="box">
  <input id="pass" placeholder="🔒 Admin Password" type="password">
</div>

<div class="box">
  <h3>➕ Create Key</h3>
  <input id="newKey" placeholder="KEY-NAME (مثل SA-ALONE)">
  <input id="newName" placeholder="Customer Name">
  <input id="newDays" type="number" value="365" placeholder="Days">
  <button onclick="act('create')">➕ إنشاء</button>
</div>

<div class="box">
  <h3>🔧 Manage Key</h3>
  <input id="mKey" placeholder="KEY-NAME">
  <button onclick="act('list')" class="btn-grey">📋 عرض الكل</button>
  <button onclick="act('reset')" class="btn-yellow">🔄 فك جهاز</button>
  <button onclick="act('block')" class="btn-red">🚫 حظر</button>
  <button onclick="act('delete')" class="btn-red">🗑️ حذف</button>
</div>

<pre id="out">جاهز...</pre>

<script>
async function act(type){
  const pass = document.getElementById('pass').value;
  const out = document.getElementById('out');
  const body = { action: type, adminPassword: pass };

  if (type === 'create') {
    body.key  = document.getElementById('newKey').value;
    body.name = document.getElementById('newName').value;
    body.days = parseInt(document.getElementById('newDays').value) || 365;
  } else if (type !== 'list') {
    body.key = document.getElementById('mKey').value;
  }

  out.textContent = '⏳ جاري...';
  try {
    const r = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    out.innerHTML = '<span class="' + (d.status ? 'ok' : 'err') + '">' + JSON.stringify(d, null, 2) + '</span>';
  } catch (e) {
    out.innerHTML = '<span class="err">❌ ' + e.message + '</span>';
  }
}
</script>
</body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
