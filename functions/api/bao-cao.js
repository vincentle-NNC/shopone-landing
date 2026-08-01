// Cloudflare Pages Function - /api/bao-cao
// GET: CONG KHAI, khong yeu cau dang nhap. Tra ve so lieu THANG HIEN TAI
// (gio Vietnam), tinh bang phep dem/cong thuan tuy - KHONG dung AI, KHONG
// tra ve danh sach ten/SDT khach hang (bao ve du lieu ca nhan).
// Cac truong tra ve: ky, ma_tot_nghiep, tong_lead, so_chot, doanh_so, chi_tiet_nguon

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

function vnMonthKey(isoString) {
  const d = new Date(new Date(isoString).getTime() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 7);
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }

  const thisMonth = vnMonthKey(new Date().toISOString());

  const list = await env.LEADS.list({ prefix: "khach:" });

  let tong_lead = 0;
  let so_chot = 0;
  let doanh_so = 0;
  const chi_tiet_nguon = {};

  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (!v) continue;
    const r = JSON.parse(v);
    if (vnMonthKey(r.createdAt) !== thisMonth) continue;

    tong_lead++;
    const nguon = r.nguon || "Khac";
    chi_tiet_nguon[nguon] = (chi_tiet_nguon[nguon] || 0) + 1;

    if (r.trang_thai === "chot") {
      so_chot++;
      doanh_so += Number(r.so_tien) || 0;
    }
  }

  return json({
    ok: true,
    ky: thisMonth,
    ma_tot_nghiep: env.NV_MA_TOT_NGHIEP || null,
    tong_lead,
    so_chot,
    doanh_so,
    chi_tiet_nguon,
  });
}
