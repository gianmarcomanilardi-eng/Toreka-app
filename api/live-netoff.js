export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca q" });
  try {
    const resp = await fetch(
      `https://www.netoff.co.jp/figure/purchase/?ky=${encodeURIComponent(searchTerm)}&ct=トレカ&mk=ポケモンカードゲーム`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `Netoff ha risposto ${resp.status}` });
    const html = await resp.text();
    const bodyStart = html.indexOf("<body");
    const bodyHtml = bodyStart > -1 ? html.slice(bodyStart) : html;
    const lower = bodyHtml.toLowerCase();
    const term = searchTerm.toLowerCase();

    // cerco OGNI punto dove compare il nome della carta, e prendo il
    // primo che ha un prezzo (円) entro 400 caratteri di distanza —
    // le intestazioni non hanno un prezzo vicino, i prodotti sì
    let pos = 0, found = null;
    while ((pos = lower.indexOf(term, pos)) !== -1) {
      const window = bodyHtml.slice(pos, pos + 400);
      if (window.includes("円")) { found = pos; break; }
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
