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
    const bodyStart = html.indexOf("<body");
    const bodyHtml = bodyStart > -1 ? html.slice(bodyStart) : html;
    const lower = bodyHtml.toLowerCase();
    const term = searchTerm.toLowerCase();

    let pos = 0, found = null;
    while ((pos = lower.indexOf(term, pos)) !== -1) {
      const window = bodyHtml.slice(pos, pos + 400);
      if (/\$[\d,]+\.\d{2}/.test(window)) { found = pos; break; }
      pos += term.length;
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      html_length: html.length,
      found_near_price: found !== null,
      sample: found !== null ? bodyHtml.slice(Math.max(0, found - 300), found + 500) : "nessuna occorrenza vicina a un prezzo",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
