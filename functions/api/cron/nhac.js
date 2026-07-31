// Cloudflare Pages Function - /api/cron/nhac
// Goi moi 30 phut boi GitHub Actions. Neu con khach chua goi (trang_thai=moi)
// thi nhac qua Telegram; neu khong con thi thoi, khong gui gi ca.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (!env.CRON_SECRET || key !== env.CRON_SECRET) {
    return json({ ok: false, error: "Khong co quyen." }, 401);
  }
  if (!env.LEADS) {
    return json({ ok: false, error: "Chua gan kho luu tru LEADS." }, 500);
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

  if (!pending.length) {
    return json({ ok: true, sent: false, count: 0 });
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const lines = pending
      .slice(0, 15)
      .map(function (r) { return "- " + r.ho_ten + " - " + r.sdt; })
      .join("\n");
    const more = pending.length > 15 ? "\n... va " + (pending.length - 15) + " khach khac" : "";
    const text =
      "Nhac viec: con " + pending.length + " khach chua goi:\n" + lines + more;

    try {
      await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      });
    } catch (e) {}
  }

  return json({ ok: true, sent: true, count: pending.length });
}
