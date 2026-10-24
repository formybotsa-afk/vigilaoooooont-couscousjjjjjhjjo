import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'CHANGE_ME_2025';
const GAME = 'pubg';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status: true,
      message: 'License Server Online ✅',
      time: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    const p = new URLSearchParams(body);
    body = Object.fromEntries(p);
  }

  // ═══ Admin Actions ═══
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
      return res.status(200).json({
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
      return res.status(200).json({ status: true, message: '🚫 Blocked' });
    }

    if (action === 'delete') {
      await redis.del(`key:${upperKey}`);
      return res.status(200).json({ status: true, message: '🗑️ Deleted' });
    }

    if (action === 'reset') {
      const s = await redis.get(`key:${upperKey}`);
      if (!s) return res.status(404).json({ status: false, reason: 'NOT_FOUND' });
      const r = typeof s === 'string' ? JSON.parse(s) : s;
      r.device = null;
      await redis.set(`key:${upperKey}`, JSON.stringify(r));
      return res.status(200).json({ status: true, message: '🔄 Device reset' });
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
      return res.status(200).json({ status: true, count: result.length, keys: result });
    }

    return res.status(400).json({ status: false, reason: 'UNKNOWN_ACTION' });
  }

  // ═══ Login from game ═══
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

    return res.status(200).json({
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
}
