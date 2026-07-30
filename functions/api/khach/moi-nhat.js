// Cloudflare Pages Function - /api/khach/moi-nhat
// GET: mac dinh tra ve khach moi nhat. Neu co ?token=xxx thi tim khach co
// ho_ten hoac ghi_chu chua dung "xxx" (khong phan biet hoa/thuong).

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
  const { request, env } = context;

  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }

  const url = new URL(request.url);
  const token = (url.searchParams.get("token") || "").trim().toLowerCase();

  const list = await env.LEADS.list();
  if (!list.keys.length) {
    return json({ ok: true, khach: null });
  }

  const records = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const parts = k.name.split(":");
      const t = parseInt(parts[1], 10) || 0;
      records.push({ t, record: JSON.parse(v) });
    }
  }
  records.sort((a, b) => b.t - a.t);

  if (token) {
    const found = records.find(({ record }) => {
      const hay = `${record.ho_ten || ""} ${record.ghi_chu || ""} ${record.email || ""}`.toLowerCase();
      return hay.includes(token);
    });
    return json({ ok: true, khach: found ? found.record : null });
  }

  return json({ ok: true, khach: records[0].record });
}
