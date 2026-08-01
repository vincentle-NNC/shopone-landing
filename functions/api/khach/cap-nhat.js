// Cloudflare Pages Function - /api/khach/cap-nhat
// POST ?key=<ADMIN_KEY>, body: { id, trang_thai, so_tien }
// Cap nhat trang thai (moi/da_goi/chot/mat) va so tien deal (khi chot) cho 1 khach.
// Doc thang tu kho, khong dung AI.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
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

const VALID_STATUS = ["moi", "da_goi", "chot", "mat"];

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

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Du lieu gui len khong hop le." }, 400);
  }

  const id = (data.id || "").toString();
  const trang_thai = (data.trang_thai || "").toString();

  if (!id || !id.startsWith("khach:")) {
    return json({ ok: false, error: "Thieu hoac sai id khach." }, 400);
  }
  if (!VALID_STATUS.includes(trang_thai)) {
    return json({ ok: false, error: "trang_thai khong hop le." }, 400);
  }
  if (trang_thai === "chot") {
    const soTien = Number(data.so_tien);
    if (!Number.isFinite(soTien) || soTien < 0) {
      return json({ ok: false, error: "Can nhap so tien hop le khi chot don." }, 400);
    }
  }

  const raw = await env.LEADS.get(id);
  if (!raw) {
    return json({ ok: false, error: "Khong tim thay khach." }, 404);
  }

  const record = JSON.parse(raw);
  record.trang_thai = trang_thai;
  if (trang_thai === "chot") {
    record.so_tien = Number(data.so_tien);
  }

  await env.LEADS.put(id, JSON.stringify(record));

  return json({ ok: true, id, khach: record });
}
