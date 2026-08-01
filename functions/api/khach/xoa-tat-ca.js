// Cloudflare Pages Function - /api/khach/xoa-tat-ca
// POST ?key=<ADMIN_KEY>: xoa toan bo du lieu khach (khach:) va log nhac viec
// (nhacviec:) trong kho LEADS, de lam sach va bat dau lai tu dau.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ ok: false, error: "Khong co quyen." }, 401);
  }
  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }

  let deleted = 0;

  for (const prefix of ["khach:", "nhacviec:"]) {
    let cursor;
    do {
      const list = await env.LEADS.list({ prefix, cursor });
      for (const k of list.keys) {
        await env.LEADS.delete(k.name);
        deleted++;
      }
      cursor = list.cursor;
    } while (cursor);
  }

  return json({ ok: true, deleted });
}
