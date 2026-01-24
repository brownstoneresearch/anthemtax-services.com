function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

// Helpful: visiting /api/lead in browser won't error
export async function onRequestGet() {
  return json({ ok: false, error: "Use POST" }, 200);
}

export async function onRequestPost({ request, env }) {
  // ✅ Add these in Cloudflare Pages → Settings → Environment variables
  const BOT = env.TG_BOT_TOKEN;
  const CHAT = env.TG_CHAT_ID;

  if (!BOT || !CHAT) {
    return json({ ok: false, error: "Missing TG_BOT_TOKEN or TG_CHAT_ID env vars" }, 500);
  }

  let fd;
  try {
    fd = await request.formData();
  } catch {
    return json({ ok: false, error: "Expected formData" }, 400);
  }

  // Honeypot
  const hp = (fd.get("input_30") || "").toString().trim();
  if (hp) return json({ ok: true, skipped: true }, 200);

  const get = (k) => (fd.get(k) || "").toString().trim();

  const first = get("input_3");
  const last = get("input_5");
  const email = get("input_6");
  const phone = get("input_28");
  const amount = get("input_8");
  const source = get("source_url") || request.headers.get("referer") || "";
  const formId = get("form_id") || "unknown";

  const text = [
    "📩 New Lead",
    `Form: ${formId}`,
    `Name: ${(first + " " + last).trim() || "-"}`,
    `Email: ${email || "-"}`,
    `Phone: ${phone || "-"}`,
    `Tax Owed: ${amount || "-"}`,
    `Source: ${source || "-"}`,
  ].join("\n");

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT,
      text,
      disable_web_page_preview: true,
    }),
  });

  const tgJson = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || tgJson?.ok === false) {
    return json({ ok: false, error: "Telegram send failed", telegram: tgJson }, 502);
  }

  return json({ ok: true }, 200);
}
