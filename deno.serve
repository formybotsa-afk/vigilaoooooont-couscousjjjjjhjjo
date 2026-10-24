// ═══════════════════════════════════════════════════════
// License Server - Deno Deploy
// ═══════════════════════════════════════════════════════

const UPSTASH_URL   = Deno.env.get("UPSTASH_URL")   || "";
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_TOKEN") || "";
const ADMIN_PASS    = Deno.env.get("ADMIN_PASS")    || "CHANGE_ME_2025";
const GAME          = "pubg";

// ═══ Redis Helper (REST API مباشرة) ═══
async function redis(command) {
  const res = await fetch(`${UPSTASH_URL}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const data = await res.json();
  return data.result;
}

async function redisGet(key) {
  const v = await redis(["GET", key]);
  if (!v) return null;
  try { return JSON.parse(v); } catch { return null; }
}

async function redisSet(key, value) {
  return await redis(["SET", key, JSON.stringify(value)]);
}

async function redisDel(key) {
  return await redis(["DEL", key]);
}

async function redisKeys(pattern) {
  return await redis(["KEYS", pattern]) || [];
}

// ═══ Response Helpers ═══
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function html(content) {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ═══ Admin Panel HTML ═══
const ADMIN_HTML = `<!DOCTYPE html>
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
  const out  = document.getElementById('out');
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
    const r = await fetch('/admin', {
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
</body></html>`;

// ═══ MAIN SERVER ═══
Deno.serve(async (req) => {
  const url  = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // ═══ Health Check ═══
  if (path === "/" && req.method === "GET") {
    return json({
      status: true,
      message: "License Server Online ✅",
      time: new Date().toISOString(),
    });
  }

  // ═══ Admin Panel ═══
  if (path === "/admin" && req.method === "GET") {
    return html(ADMIN_HTML);
  }

  // ═══ Admin API ═══
  if (path === "/admin" && req.method === "POST") {
    try {
      const body = await req.json();
      const { action, adminPassword, key, name, days } = body;

      if (adminPassword !== ADMIN_PASS) {
        return json({ status: false, reason: "UNAUTHORIZED" }, 401);
      }

      const upperKey = (key || "").toUpperCase().trim();

      if (action === "create") {
        if (!/^[A-Z0-9\-]{4,64}$/.test(upperKey)) {
          return json({ status: false, reason: "INVALID_KEY_FORMAT" });
        }
        const expires = Math.floor(Date.now() / 1000) + ((parseInt(days) || 365) * 86400);
        const record = {
          name: name || "User",
          type: "universal",
          expires,
          device: null,
          blocked: false,
          createdAt: Math.floor(Date.now() / 1000),
        };
        await redisSet(`key:${upperKey}`, record);
        return json({
          status: true,
          message: "✅ Key created",
          key: upperKey,
          name: record.name,
          expires,
          expiresHuman: new Date(expires * 1000).toISOString(),
        });
      }

      if (action === "block") {
        const r = await redisGet(`key:${upperKey}`);
        if (!r) return json({ status: false, reason: "NOT_FOUND" }, 404);
        r.blocked = true;
        await redisSet(`key:${upperKey}`, r);
        return json({ status: true, message: "🚫 Blocked" });
      }

      if (action === "delete") {
        await redisDel(`key:${upperKey}`);
        return json({ status: true, message: "🗑️ Deleted" });
      }

      if (action === "reset") {
        const r = await redisGet(`key:${upperKey}`);
        if (!r) return json({ status: false, reason: "NOT_FOUND" }, 404);
        r.device = null;
        await redisSet(`key:${upperKey}`, r);
        return json({ status: true, message: "🔄 Device reset" });
      }

      if (action === "list") {
        const keys = await redisKeys("key:*");
        const result = [];
        for (const k of keys) {
          const r = await redisGet(k);
          if (!r) continue;
          result.push({
            key: k.replace("key:", ""),
            name: r.name,
            expires: r.expires,
            expiresHuman: r.expires ? new Date(r.expires * 1000).toISOString() : null,
            device: r.device ? r.device.substring(0, 12) + "..." : null,
            blocked: r.blocked === true,
          });
        }
        return json({ status: true, count: result.length, keys: result });
      }

      return json({ status: false, reason: "UNKNOWN_ACTION" }, 400);
    } catch (e) {
      return json({ status: false, reason: "ERROR: " + e.message }, 500);
    }
  }

  // ═══ Login (from game) ═══
  if (path === "/login" && req.method === "POST") {
    try {
      const contentType = req.headers.get("content-type") || "";
      let body;

      if (contentType.includes("application/json")) {
        body = await req.json();
      } else {
        const text = await req.text();
        const p = new URLSearchParams(text);
        body = Object.fromEntries(p);
      }

      const game   = body.game || "";
      const key    = (body.user_key || "").toUpperCase().trim();
      const serial = body.serial || "";

      if (game !== GAME) return json({ status: false, reason: "INVALID_GAME" }, 400);
      if (!/^[A-Z0-9\-]{4,64}$/.test(key)) return json({ status: false, reason: "INVALID_FORMAT" }, 400);
      if (!serial || serial.length < 8) return json({ status: false, reason: "INVALID_SERIAL" }, 400);

      const record = await redisGet(`key:${key}`);
      if (!record) return json({ status: false, reason: "NOT_REGISTERED" }, 404);

      if (record.blocked === true) return json({ status: false, reason: "BLOCKED" }, 403);

      const now = Math.floor(Date.now() / 1000);
      if (record.expires && now > record.expires) {
        return json({ status: false, reason: "EXPIRED" }, 403);
      }
      if (record.device && record.device !== serial) {
        return json({ status: false, reason: "MAX_DEVICES_REACHED" }, 403);
      }
      if (!record.device) {
        record.device = serial;
        record.firstLogin = now;
        await redisSet(`key:${key}`, record);
      }

      return json({
        status: true,
        data: {
          key,
          name: record.name || "User",
          type: record.type || "universal",
          expires: record.expires || null,
        },
      });
    } catch (e) {
      return json({ status: false, reason: "SERVER_ERROR: " + e.message }, 500);
    }
  }

  return json({ status: false, reason: "NOT_FOUND" }, 404);
});

console.log("🚀 License Server running on Deno Deploy");
