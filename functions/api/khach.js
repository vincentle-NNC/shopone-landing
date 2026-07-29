// Cloudflare Pages Function - /api/khach
// POST: luu thong tin khach quan tam vao Workers KV (namespace binding: LEADS)
// GET:  tra ve danh sach khach quan tam (khong yeu cau mat khau)

function json(data, status) {
    return new Response(JSON.stringify(data), {
          status: status || 200,
          headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

export async function onRequestPost(context) {
    const { request, env } = context;

  if (!env.LEADS) {
        return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }

  let data;
    try {
          data = await request.json();
    } catch (e) {
          return json({ ok: false, error: "Du lieu gui len khong hop le." }, 400);
    }

  const ho_ten = (data.ho_ten || "").toString().trim();
    const sdt = (data.sdt || "").toString().trim();
    const email = (data.email || "").toString().trim();
    const ghi_chu = (data.ghi_chu || data.note || "").toString().trim();

  if (!ho_ten || !sdt) {
        return json({ ok: false, error: "Vui long nhap du ho_ten va sdt." }, 400);
  }

  const id = `khach:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const record = { ho_ten, sdt, email, ghi_chu, createdAt: new Date().toISOString() };

  try {
        await env.LEADS.put(id, JSON.stringify(record));
  } catch (e) {
        return json({ ok: false, error: "Khong luu duoc, thu lai sau." }, 500);
  }

  return json({ ok: true });
}

export async function onRequestGet(context) {
    const { env } = context;

  if (!env.LEADS) {
        return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
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
