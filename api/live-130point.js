export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca q" });
  try {
    const resp = await fetch(
      `https://130point.com/api/search/html?q=${encodeURIComponent(searchTerm)}&sort=recent&mp=all`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Referer": "https://130point.com/search" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `130Point ha risposto ${resp.status}`, blocked: resp.status === 403 });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ html_length: html.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
