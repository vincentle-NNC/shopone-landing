const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }
  const list = await env.LEADS.list();
  if (!list.keys.length) {
    return json({ ok: true, khach: null });
  }
  let newestKey = null;
  let newestTime = -1;
  for (const k of list.keys) {
    const parts = k.name.split(":");
    const t = parseInt(parts[1], 10) || 0;
    if (t > newestTime) {
      newestTime = t;
      newestKey = k.name;
    }
  }
  const v = await env.LEADS.get(newestKey);
  const khach = v ? JSON.parse(v) : null;
  return json({ ok: true, khach });
}
