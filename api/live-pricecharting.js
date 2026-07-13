export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca q" });
  try {
    const resp = await fetch(
      `https://www.pricecharting.com/search-products?q=${encodeURIComponent(searchTerm)}&type=prices`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `PriceCharting ha risposto ${resp.status}` });
    const html = await resp.text();
    const idx = html.search(/\/game\//);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      html_length: html.length,
      sample_around_link: idx > -1 ? html.slice(Math.max(0, idx - 200), idx + 400) : "nessun link /game/ trovato",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
