// Cloudflare Pages Function - /api/abs-probe/scan
// Chay dong bo (KHONG dung waitUntil): kiem tra khach chua goi, dung Cloudflare
// Workers AI de viet 1 cau nhac ngan, gui Telegram, LUON ghi 1 ban ghi nhac_viec
// MOI vao kho (kem probe_nonce lay tu request + created_at la thoi diem hien tai),
// va tra ve chinh ban ghi vua ghi (khong echo ban ghi cu).

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "CDN-Cache-Control": "no-store",
    },
  });
}

async function getProbeNonce(request) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("probe_nonce");
  if (fromQuery) return fromQuery;

  try {
    const raw = await request.text();
    if (raw) {
      try {
        const body = JSON.parse(raw);
        if (body && body.probe_nonce) return String(body.probe_nonce);
      } catch (e) {}
      try {
        const params = new URLSearchParams(raw);
        const v = params.get("probe_nonce");
        if (v) return v;
      } catch (e) {}
    }
  } catch (e) {}

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
        "Ban la tro ly ban hang. Hay viet dung 1 cau nhac nho ngan gon (duoi 20 tu), " +
        "than thien, bang tieng Viet, de nhac nhan vien sale goi dien cho khach hang ten '" +
        first.ho_ten + "' vi khach nay chua duoc lien he. Chi tra loi dung 1 cau, khong giai thich, khong dua so dien thoai vao.";

      const aiPromise = env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [{ role: "user", content: prompt }],
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI timeout")), 8000)
      );
      const aiResp = await Promise.race([aiPromise, timeoutPromise]);
      aiText = (aiResp && (aiResp.response || aiResp.result || "")).toString().trim() || null;
      if (aiText) {
        const lower = aiText.toLowerCase();
        const looksLikeRefusal =
          lower.includes("xin loi") || lower.includes("xin lỗi") ||
          lower.includes("khong the") || lower.includes("không thể") ||
          lower.includes("i cannot") || lower.includes("i'm sorry") ||
          lower.includes("i am sorry");
        if (looksLikeRefusal) aiText = null;
      }
    } catch (e) {
      aiText = null;
    }
  }

  const message = first
    ? (aiText
        ? (aiText + " (SDT: " + first.sdt + ")")
        : ("Nhac viec: con " + pending.length + " khach chua goi, dau tien la " + first.ho_ten + " - " + first.sdt))
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

async function readLatest(request, env) {
  if (!env.LEADS) {
    return { ok: false, error: "Chua gan kho luu tru LEADS." };
  }

  const url = new URL(request.url);
  const wantNonce = url.searchParams.get("probe_nonce");

  const list = await env.LEADS.list({ prefix: "nhacviec:" });
  if (!list.keys.length) {
    return { ok: true, probe_nonce: null, created_at: null, message: null, count: 0 };
  }

  const records = [];
  for (const k of list.keys) {
    const v = await env.LEADS.get(k.name);
    if (v) {
      const parts = k.name.split(":");
      const t = parseInt(parts[1], 10) || 0;
      records.push({ t, record: JSON.parse(v) });
    }
  }
  records.sort((a, b) => b.t - a.t);

  if (wantNonce) {
    const found = records.find(function (item) { return item.record.probe_nonce === wantNonce; });
    return { ok: true, ...(found ? found.record : { probe_nonce: null, created_at: null, message: null, count: 0 }) };
  }

  return { ok: true, ...records[0].record };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const hasNonceToWrite = url.searchParams.get("probe_nonce");
  const result = hasNonceToWrite
    ? await scan(context.request, context.env)
    : await readLatest(context.request, context.env);
  return json(result);
}

export async function onRequestPost(context) {
  const result = await scan(context.request, context.env);
  return json(result);
}
