// Cloudflare Pages Function - /api/bao-cao
// GET ?key=<ADMIN_KEY>: tra ve so lieu bao cao THANG HIEN TAI (gio Vietnam),
// tinh bang phep dem/cong thuan tuy tu du lieu trong kho - KHONG dung AI.
// - tong_khach_thang: tong so khach tao trong thang nay
// - theo_nguon: so khach trong thang nay, gom theo nguon
// - so_da_chot: so khach da chot trong thang nay
// - tong_doanh_so: tong so_tien cua cac khach da chot trong thang nay
// Kem toan bo danh sach khach (moi thoi diem) de hien thi bang quan ly.

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
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ ok: false, error: "Khong co quyen." }, 401);
  }
  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
  }

  const thisMonth = vnMonthKey(new Date().toISOString());

  const list = await env.LEADS.list({ prefix: "khach:" });
  const allKhach = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) allKhach.push({ id: k.name, ...JSON.parse(v) });
  }
  allKhach.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const thangNay = allKhach.filter(function (k) { return vnMonthKey(k.createdAt) === thisMonth; });

  let tong_khach_thang = thangNay.length;
  let so_da_chot = 0;
  let tong_doanh_so = 0;
  const theo_nguon = {};

  for (const k of thangNay) {
    const nguon = k.nguon || "Khac";
    theo_nguon[nguon] = (theo_nguon[nguon] || 0) + 1;
    if (k.trang_thai === "chot") {
      so_da_chot++;
      tong_doanh_so += Number(k.so_tien) || 0;
    }
  }

  return json({
    ok: true,
    thang: thisMonth,
    tong_khach_thang,
    theo_nguon,
    so_da_chot,
    tong_doanh_so,
    khach: allKhach,
  });
}
