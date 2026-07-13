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
    // salto oltre <body>, così non trovo più il titolo della pagina
    // ma i prodotti veri più giù
    const bodyStart = html.indexOf("<body");
    const bodyHtml = bodyStart > -1 ? html.slice(bodyStart) : html;
    const idx = bodyHtml.toLowerCase().indexOf(searchTerm.toLowerCase());
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      html_length: html.length,
      found_in_body: idx > -1,
      sample_around_term: idx > -1 ? bodyHtml.slice(Math.max(0, idx - 300), idx + 600) : "termine non trovato nel corpo della pagina",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
