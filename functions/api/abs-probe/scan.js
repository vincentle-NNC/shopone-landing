// Cloudflare Pages Function - /api/abs-probe/scan
// Chay dong bo (KHONG dung waitUntil): kiem tra khach chua goi, dung Cloudflare
// Workers AI de viet 1 cau nhac ngan, gui Telegram, va tra ve trong JSON de kiem tra.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function scan(env) {
  if (!env.LEADS) {
    return { ok: false, error: "Chua gan kho luu tru LEADS." };
  }

  const list = await env.LEADS.list();
  const pending = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const r = JSON.parse(v);
      if (r.trang_thai === "moi") pending.push(r);
    }
  }

  if (!pending.length) {
    return { ok: true, count: 0, message: null };
  }

  const first = pending[0];
  let aiText = null;

  if (env.AI) {
    try {
      const prompt =
        "Viet mot cau nhac nho ngan gon (duoi 30 tu), than thien, bang tieng Viet, " +
        "danh cho nhan vien sale, nhac goi dien cho khach ten '" + first.ho_ten +
        "' so dien thoai " + first.sdt + " vi khach nay chua duoc goi. Chi tra ve dung 1 cau, khong giai thich them.";

      const aiResp = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [{ role: "user", content: prompt }],
      });
      aiText = (aiResp && (aiResp.response || aiResp.result || "")).toString().trim() || null;
    } catch (e) {
      aiText = null;
    }
  }

  const fallback =
    "Nhac viec: con " + pending.length + " khach chua goi, dau tien la " +
    first.ho_ten + " - " + first.sdt;
  const finalText = aiText || fallback;

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: finalText }),
      });
    } catch (e) {}
  }

  return { ok: true, count: pending.length, message: finalText, ai_used: !!aiText };
}

export async function onRequestGet(context) {
  const result = await scan(context.env);
  return json(result);
}

export async function onRequestPost(context) {
  const result = await scan(context.env);
  return json(result);
}
