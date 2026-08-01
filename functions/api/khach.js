// Cloudflare Pages Function - /api/khach
// POST: nhan du lieu khach quan tam - ho tro CA 2 kieu: JSON hoac form thuong
// Co bat CORS de cho phep gui tu domain khac (khong phai chinh trang nay)
// Luu them field trang_thai (moi/da_goi/chot/mat), nguon, so_tien (deal da chot)
// Sau khi luu thanh cong, tu dong bao qua Telegram kem nut "Da goi" / "Mat"
// (Chot don co nhap so tien lam o trang bao cao, khong lam qua Telegram)
// GET: tra ve danh sach khach quan tam (khong yeu cau mat khau), kem id de quan ly

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function plain(text, status) {
  return new Response(text, {
    status: status || 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

async function parseBody(request) {
  const contentType = request.headers.get("content-type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    const data = {};
    for (const [key, value] of form.entries()) {
      data[key] = typeof value === "string" ? value : "";
    }
    return { data, isJson: false };
  }

  try {
    const data = await request.json();
    return { data, isJson: true };
  } catch (e) {
    return { data: {}, isJson: contentType.includes("application/json") };
  }
}

async function notifyTelegram(env, record, id) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const text =
    "Khach moi tu ShopOne!\n" +
    "Ho ten: " + record.ho_ten + "\n" +
    "SDT: " + record.sdt +
    (record.nguon ? "\nNguon: " + record.nguon : "") +
    (record.email ? "\nEmail: " + record.email : "") +
    (record.ghi_chu ? "\nGhi chu: " + record.ghi_chu : "");

  try {
    await fetch(
      "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          reply_markup: {
            inline_keyboard: [[
              { text: "Da goi", callback_data: "da_goi:" + id },
              { text: "Mat", callback_data: "mat:" + id },
            ]],
          },
        }),
      }
    );
  } catch (e) {
    // Khong de loi Telegram lam hong viec luu khach
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS trong Cloudflare." }, 500);
  }

  let data, isJson;
  try {
    ({ data, isJson } = await parseBody(request));
  } catch (e) {
    return json({ ok: false, error: "Du lieu gui len khong hop le." }, 400);
  }

  const ho_ten = (data.ho_ten || data.name || "").toString().trim();
  const sdt = (data.sdt || data.phone || "").toString().trim();
  const email = (data.email || "").toString().trim();
  const ghi_chu = (data.ghi_chu || data.note || "").toString().trim();
  const token = (data.token || data.ma || "").toString().trim();
  const nguon = (data.nguon || data.source || "Website").toString().trim() || "Website";

  if (!ho_ten || !sdt) {
    const msg = "Vui long nhap du ho_ten va sdt.";
    if (isJson) return json({ ok: false, error: msg }, 400);
    return plain(msg, 400);
  }

  const id = "khach:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
  const record = {
    ho_ten,
    sdt,
    email,
    ghi_chu,
    token,
    nguon,
    trang_thai: "moi",
    so_tien: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    await env.LEADS.put(id, JSON.stringify(record));
  } catch (e) {
    const msg = "Khong luu duoc, thu lai sau.";
    if (isJson) return json({ ok: false, error: msg }, 500);
    return plain(msg, 500);
  }

  context.waitUntil(notifyTelegram(env, record, id));

  if (isJson) {
    return json({ ok: true });
  }

  const url = new URL(request.url);
  return Response.redirect(url.origin + "/?sent=1#dang-ky", 303);
}

export async function onRequestGet(context) {
  const { env } = context;

  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS trong Cloudflare." }, 500);
  }

  const list = await env.LEADS.list({ prefix: "khach:" });
  const items = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const record = JSON.parse(v);
      items.push({ id: k.name, ...record });
    }
  }
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return json({ ok: true, count: items.length, khach: items });
}
