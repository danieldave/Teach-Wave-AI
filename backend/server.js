// server.js — Express backend proxy for OpenAI + cover generator + basic rate limiting
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// basic in-memory rate limiting (per IP)
const RATE_LIMIT_WINDOW = 60 * 1000; // 60s
const MAX_PER_WINDOW = 20;
const rateMap = new Map();

function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_LIMIT_WINDOW) {
    entry.count = 1;
    entry.start = now;
  } else {
    entry.count++;
  }
  rateMap.set(ip, entry);
  return entry.count <= MAX_PER_WINDOW;
}

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not found in environment - set it in backend/.env");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/generate
app.post("/api/generate", async (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRate(ip)) return res.status(429).json({ error: "Rate limit exceeded" });

  const { prompt, language } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const system = {
      role: "system",
      content: `You are an expert educator. Respond only in ${language}. Keep headings and bullet lists when possible.`
    };
    const user = { role: "user", content: prompt };

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [system, user],
      temperature: 0.7,
      max_tokens: 1500
    });

    const output = completion.choices?.[0]?.message?.content ?? "";
    res.json({ output });
  } catch (err) {
    console.error("OpenAI error:", err);
    res.status(500).json({ error: "AI failed" });
  }
});

// POST /api/cover
// returns a simple SVG data URL cover generated from subject/topic
app.post("/api/cover", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRate(ip)) return res.status(429).json({ error: "Rate limit exceeded" });

  const { subject = "Subject", topic = "Topic", style = "modern" } = req.body;

  // sanitize (very small)
  const safe = (s) => String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const colors = {
    Math: ["#4b00ff", "#00d4ff"],
    Science: ["#00b894", "#2d98da"],
    English: ["#6c5ce7", "#a29bfe"],
    History: ["#fdcb6e", "#e17055"],
    Art: ["#ff7675", "#fd79a8"]
  };

  const palette = colors[subject] || ["#6c00ff", "#00d4ff"];
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">
    <defs>
      <linearGradient id="g" x1="0" x2="1">
        <stop offset="0" stop-color="${palette[0]}" />
        <stop offset="1" stop-color="${palette[1]}" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="16" stdDeviation="30" flood-color="#000" flood-opacity="0.15"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <g filter="url(#shadow)">
      <rect x="60" y="60" width="1080" height="480" rx="30" fill="white" opacity="0.06"/>
    </g>
    <g>
      <text x="120" y="200" font-size="60" font-family="Inter, Arial" fill="white" font-weight="700">${safe(topic)}</text>
      <text x="120" y="280" font-size="28" font-family="Inter, Arial" fill="white" opacity="0.9">${safe(subject)} • ${new Date().getFullYear()}</text>
    </g>
    <g transform="translate(820,340)">
      <circle cx="0" cy="0" r="68" fill="white" opacity="0.14"></circle>
      <text x="-40" y="12" font-size="24" font-family="Inter, Arial" fill="white">TeachWave</text>
    </g>
  </svg>`;

  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  res.json({ dataUrl });
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend listening on ${PORT}`));
