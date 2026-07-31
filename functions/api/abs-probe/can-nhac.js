// Cloudflare Pages Function - /api/abs-probe/can-nhac
// GET ?token=<nonce>: tra ve MANG JSON cac ban ghi nhac_viec co probe_nonce
// trung voi token. Moi ban ghi gom: probe_nonce, so_khach_chua_goi, noi_dung_ai.
// Neu khong co token, tra ve toan bo (moi nhat truoc).

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.LEADS) {
    return json([]);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || url.searchParams.get("probe_nonce") || url.searchParams.get("nonce");

  const list = await env.LEADS.list({ prefix: "nhacviec:" });
  const records = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const r = JSON.parse(v);
      const parts = k.name.split(":");
      const t = parseInt(parts[1], 10) || 0;
      records.push({
        t,
        item: {
          probe_nonce: r.probe_nonce || null,
          so_khach_chua_goi: typeof r.count === "number" ? r.count : 0,
          noi_dung_ai: r.message || null,
        },
      });
    }
  }
  records.sort((a, b) => b.t - a.t);

  let out = records.map(function (x) { return x.item; });
  if (token) {
    out = out.filter(function (item) { return item.probe_nonce === token; });
  }

  return json(out);
}
