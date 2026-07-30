// Cloudflare Pages Function - /api/khach/moi-nhat
// GET: tra thang JSON cua khach (khong boc trong {ok, khach}).
// Mac dinh: khach moi nhat. Neu co ?token=xxx: uu tien tim khach co field
// "token" khop dung "xxx"; neu khong, tim theo ho_ten/ghi_chu/email co chua "xxx".

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
    return json({ error: "Chua gan kho luu tru LEADS." }, 500);
  }

  const url = new URL(request.url);
  const tok = (url.searchParams.get("token") || "").trim();
  const tokLower = tok.toLowerCase();

  const list = await env.LEADS.list();
  if (!list.keys.length) {
    return json(null);
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

  if (tok) {
    const exact = records.find(function (item) { return (item.record.token || "") === tok; });
    if (exact) return json(exact.record);

    const found = records.find(function (item) {
      const r = item.record;
      const hay = (r.ho_ten || "") + " " + (r.ghi_chu || "") + " " + (r.email || "");
      return hay.toLowerCase().includes(tokLower);
    });
    return json(found ? found.record : null);
  }

  return json(records[0].record);
}
