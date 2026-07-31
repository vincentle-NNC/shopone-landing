// Cloudflare Pages Function - /api/cron/goiy
// Goi luc 7h sang moi ngay (gio Vietnam) boi GitHub Actions.
// Goi y viec nen lam hom nay: danh sach khach con ton dong chua goi.

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

  let text;
  if (!pending.length) {
    text = "Chao buoi sang! Hien khong con khach nao ton dong can goi. Chuc mot ngay lam viec tot!";
  } else {
    const lines = pending
      .slice(0, 15)
      .map(function (r) { return "- " + r.ho_ten + " - " + r.sdt; })
      .join("\n");
    const more = pending.length > 15 ? "\n... va " + (pending.length - 15) + " khach khac" : "";
    text =
      "Chao buoi sang! Viec nen lam hom nay: goi cho " + pending.length + " khach dang cho:\n" +
      lines + more;
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      });
    } catch (e) {}
  }

  return json({ ok: true, count: pending.length });
}
