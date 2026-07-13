// pmtcgo.com (Cina) — il mio strumento diretto dava sempre errore 400,
// verifico se un server Vercel (client HTTP diverso) si comporta
// diversamente, prima di scartarlo di nuovo.
export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca q" });
  try {
    const resp = await fetch(
      `https://www.pmtcgo.com/search?keyword=${encodeURIComponent(searchTerm)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept-Language": "zh-CN,zh;q=0.9" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `pmtcgo ha risposto ${resp.status}` });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ html_length: html.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
