export default async function handler(req, res) {
  const GENSHIN_MOBILE_APK_URL = "https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/android_default";
  const GENSHIN_PC_URL = "https://ys-api.mihoyo.com/event/download_porter/link/ys_cn/official/pc_default";

  function isMobileUserAgent(userAgent) {
    if (!userAgent) {
      return false;
    }
    return /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);
  }

  function getLastUserMessage(messages) {
    if (!Array.isArray(messages)) {
      return "";
    }

    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message && message.role === "user" && typeof message.content === "string") {
        return message.content;
      }
    }

    return "";
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const lastUserMessage = getLastUserMessage(req.body && req.body.messages);
  if (lastUserMessage.includes("原神")) {
    const ua = req.headers["user-agent"] || "";
    const mobile = isMobileUserAgent(ua);
    const downloadUrl = mobile ? GENSHIN_MOBILE_APK_URL : GENSHIN_PC_URL;
    const reply = mobile
      ? "检测到你提到了“原神”，已为你准备手机版 APK 下载。"
      : "检测到你提到了“原神”，已为你准备电脑版下载。";

    return res.status(200).json({
      reply,
      downloadUrl
    });
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: req.body.messages
      })
    });

    const data = await response.json();

    res.status(200).json({
      reply: data.choices[0].message.content
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
