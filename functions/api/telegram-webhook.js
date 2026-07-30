// Cloudflare Pages Function - /api/telegram-webhook
// Nhan cac su kien tu Telegram (khi bam nut inline "Da goi" / "Chot don").
// Cap nhat trang_thai cua khach trong kho LEADS.

async function tgCall(env, method, payload) {
  try {
    await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/" + method, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {}
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let update;
  try {
    update = await request.json();
  } catch (e) {
    return new Response("ok");
  }

  const cq = update.callback_query;
  if (!cq || !cq.data) return new Response("ok");

  let newStatus = null;
  let id = null;
  let label = null;

  if (cq.data.startsWith("da_goi:")) {
    id = cq.data.slice("da_goi:".length);
    newStatus = "da_goi";
    label = "Da goi (xong)";
  } else if (cq.data.startsWith("chot:")) {
    id = cq.data.slice("chot:".length);
    newStatus = "chot";
    label = "Da chot don!";
  }

  if (newStatus && id && env.LEADS) {
    try {
      const v = await env.LEADS.get(id);
      if (v) {
        const record = JSON.parse(v);
        record.trang_thai = newStatus;
        await env.LEADS.put(id, JSON.stringify(record));
      }
    } catch (e) {}

    await tgCall(env, "answerCallbackQuery", {
      callback_query_id: cq.id,
      text: label,
    });

    if (cq.message) {
      await tgCall(env, "editMessageReplyMarkup", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        reply_markup: { inline_keyboard: [[{ text: label, callback_data: "done" }]] },
      });
    }
  }

  return new Response("ok");
}
