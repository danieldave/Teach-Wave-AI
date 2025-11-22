// backend/api/cover.js
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { subject = "Topic", topic = "Lesson", style = "modern" } = req.body || {};

    // Minimal SVG cover generator – returns data URI
    const svg = `
      <svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'>
        <defs>
          <linearGradient id='g' x1='0' x2='1'>
            <stop offset='0' stop-color='#6c00ff' />
            <stop offset='1' stop-color='#00d4ff' />
          </linearGradient>
        </defs>
        <rect width='100%' height='100%' fill='url(#g)' />
        <text x='50%' y='42%' text-anchor='middle' font-size='48' font-family='Inter, Arial' fill='#fff'>${escapeHtml(topic)}</text>
        <text x='50%' y='58%' text-anchor='middle' font-size='24' font-family='Inter, Arial' fill='rgba(255,255,255,0.9)'>${escapeHtml(subject)}</text>
      </svg>
    `.trim();

    const dataUrl = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
    res.json({ dataUrl });
  } catch (err) {
    console.error("cover error", err);
    res.status(500).json({ error: "cover generation failed" });
  }
};

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}
