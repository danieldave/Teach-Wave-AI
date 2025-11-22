// backend/api/generate.js
// CommonJS style — works with Vercel Node runtime

const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

module.exports = async (req, res) => {
  // Allow CORS (your frontend on GitHub Pages)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, language } = req.body || {};
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Use chat completions with a modern model
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // replace with model you want; change if necessary
      messages: [
        { role: "system", content: `You are an expert educator. Answer in ${language || "English"}.` },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1600
    });

    const output = (response?.choices?.[0]?.message?.content) ?? response?.choices?.[0]?.text ?? "";

    return res.json({ output });
  } catch (err) {
    console.error("AI ERROR:", err);
    const msg = (err && err.message) ? err.message : "AI request failed";
    return res.status(500).json({ error: msg });
  }
};
