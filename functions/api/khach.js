// Cloudflare Pages Function — /api/khach
// POST: lưu thông tin khách quan tâm vào Workers KV (namespace binding: LEADS)
// Yêu cầu Bài 11: nhận JSON { ho_ten, sdt } (tên cột tiếng Việt)
// GET:  xem lại danh sách khách quan tâm, cần đúng ?key=<ADMIN_KEY> (env var tự đặt trong Cloudflare)

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.LEADS) {
    return json({ ok: false, error: "Chưa gắn kho lưu trữ LEADS trong Cloudflare." }, 500);
  }

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Dữ liệu gửi lên không hợp lệ." }, 400);
  }

  const ho_ten = (data.ho_ten || "").toString().trim();
  const sdt = (data.sdt || "").toString().trim();
  const email = (data.email || "").toString().trim();
  const ghi_chu = (data.ghi_chu || data.note || "").toString().trim();

  if (!ho_ten || !sdt) {
    return json({ ok: false, error: "Vui lòng nhập đủ họ tên (ho_ten) và số điện thoại (sdt)." }, 400);
  }

  const id = `khach:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const record = { ho_ten, sdt, email, ghi_chu, createdAt: new Date().toISOString() };

  try {
    await env.LEADS.put(id, JSON.stringify(record));
  } catch (e) {
    return json({ ok: false, error: "Không lưu được, thử lại sau." }, 500);
  }

  return json({ ok: true });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ ok: false, error: "Không có quyền xem." }, 401);
  }
  if (!env.LEADS) {
    return json({ ok: false, error: "Chưa gắn kho lưu trữ LEADS trong Cloudflare." }, 500);
  }

  const list = await env.LEADS.list();
  const items = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) items.push(JSON.parse(v));
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ ok: true, count: items.length, khach: items });
}
