// Cloudflare Pages Function - /api/cron/tongket
// Goi luc 18h moi ngay (gio Vietnam) boi GitHub Actions.
// Tong ket so khach moi / da goi / con / chot trong ngay hom nay.

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function vnDateKey(isoString) {
  const d = new Date(new Date(isoString).getTime() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
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

  const todayKey = vnDateKey(new Date().toISOString());

  const list = await env.LEADS.list({ prefix: "khach:" });
  let moi = 0, daGoi = 0, chot = 0, tong = 0;

  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (!v) continue;
    const r = JSON.parse(v);
    if (vnDateKey(r.createdAt) !== todayKey) continue;

    tong++;
    if (r.trang_thai === "chot") chot++;
    else if (r.trang_thai === "da_goi") daGoi++;
    else moi++;
  }

  const con = tong - chot;

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const text =
      "Tong ket hom nay (" + todayKey + "):\n" +
      "- Khach moi: " + moi + "\n" +
      "- Da goi: " + daGoi + "\n" +
      "- Con lai (chua chot): " + con + "\n" +
      "- Da chot: " + chot + "\n" +
      "Tong cong: " + tong + " khach";

    try {
      await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
      });
    } catch (e) {}
  }

  return json({ ok: true, moi, daGoi, con, chot, tong });
}
