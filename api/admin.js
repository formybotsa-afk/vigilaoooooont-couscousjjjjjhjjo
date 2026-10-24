export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
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
    const r = await fetch('/api/login', {
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
}
