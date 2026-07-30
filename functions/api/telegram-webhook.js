// Cloudflare Pages Function - /api/telegram-webhook
// Nhan cac su kien tu Telegram (khi bam nut inline "Da goi").
// Cap nhat trang_thai cua khach thanh "da_goi" trong kho LEADS.

async function answerCallback(env, callbackQueryId, text) {
  try {
    await fetch(
      "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/answerCallbackQuery",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      }
    );
  } catch (e) {}
}

async function editReplyMarkup(env, chatId, messageId, text) {
  try {
    await fetch(
      "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/editMessageReplyMarkup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: { inline_keyboard: [[{ text: text, callback_data: "done" }]] },
        }),
      }
    );
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
  if (cq && cq.data && cq.data.startsWith("da_goi:")) {
    const id = cq.data.slice("da_goi:".length);

    if (env.LEADS) {
      try {
        const v = await env.LEADS.get(id);
        if (v) {
          const record = JSON.parse(v);
          record.trang_thai = "da_goi";
          await env.LEADS.put(id, JSON.stringify(record));
        }
      } catch (e) {}
    }

    await answerCallback(env, cq.id, "Da cap nhat: Da goi");
    if (cq.message) {
      await editReplyMarkup(env, cq.message.chat.id, cq.message.message_id, "Da goi (xong)");
    }
  }

  return new Response("ok");
}
