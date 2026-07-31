// Cloudflare Pages Function - /api/abs-probe/scan
// Chay dong bo (KHONG dung waitUntil): kiem tra khach chua goi, dung Cloudflare
// Workers AI de viet 1 cau nhac ngan (model nhe, co gioi han 8s), gui Telegram,
// LUON ghi 1 ban ghi nhac_viec MOI vao kho (kem probe_nonce + created_at hien tai),
// va tra ve chinh ban ghi vua ghi (khong echo ban ghi cu).

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getProbeNonce(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("probe_nonce");
  if (fromQuery) return fromQuery;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await request.json();
      if (body && body.probe_nonce) return String(body.probe_nonce);
    } catch (e) {}
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const form = await request.formData();
      const v = form.get("probe_nonce");
      if (v) return String(v);
    } catch (e) {}
  }
  return null;
}

async function scan(request, env) {
  const probeNonce = await getProbeNonce(request);
  const createdAt = new Date().toISOString();

  if (!env.LEADS) {
    return { ok: false, error: "Chua gan kho luu tru LEADS.", probe_nonce: probeNonce, created_at: createdAt };
  }

  const list = await env.LEADS.list({ prefix: "khach:" });
  const pending = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const r = JSON.parse(v);
      if (r.trang_thai === "moi") pending.push(r);
    }
  }

  let aiText = null;
  const first = pending[0] || null;

  if (first && env.AI) {
    try {
      const prompt =
        "Viet mot cau nhac nho ngan gon (duoi 30 tu), than thien, bang tieng Viet, " +
        "danh cho nhan vien sale, nhac goi dien cho khach ten '" + first.ho_ten +
        "' so dien thoai " + first.sdt + " vi khach nay chua duoc goi. Chi tra ve dung 1 cau, khong giai thich them.";

      const aiPromise = env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
        messages: [{ role: "user", content: prompt }],
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 8000)
      );
      const aiResp = await Promise.race([aiPromise, timeoutPromise]);
      aiText = (aiResp && (aiResp.response || aiResp.result || "")).toString().trim() || null;
    } catch (e) {
      aiText = null;
    }
  }

  const message = first
    ? (aiText || ("Nhac viec: con " + pending.length + " khach chua goi, dau tien la " + first.ho_ten + " - " + first.sdt))
    : null;

  // LUON ghi 1 ban ghi nhac_viec MOI, kem probe_nonce va created_at hien tai
  const logId = "nhacviec:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
  const logRecord = {
    probe_nonce: probeNonce,
    created_at: createdAt,
    count: pending.length,
    message,
    ai_used: !!aiText,
  };
  try {
    await env.LEADS.put(logId, JSON.stringify(logRecord));
  } catch (e) {}

  if (message && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message }),
      });
    } catch (e) {}
  }

  return { ok: true, ...logRecord };
}

export async function onRequestGet(context) {
  const result = await scan(context.request, context.env);
  return json(result);
}

export async function onRequestPost(context) {
  const result = await scan(context.request, context.env);
  return json(result);
}
