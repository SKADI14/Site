export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
        messages: req.body.messages,
        frequency_penalty: 0.5,
        max_tokens: 1024,
        presence_penalty: 0.5,
        temperature: 1.3,
        top_p: 1
      })
    });

    const data = await response.json();

    // 只返回核心内容
    res.status(200).json({
      reply: data.choices[0].message.content,
      usage: data.usage
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
