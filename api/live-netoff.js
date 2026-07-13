// Versione diagnostica: mostra un pezzo vero della pagina (dove
// compare "円", il simbolo dello yen) invece di indovinare lo schema
// una terza volta. Da qui costruisco la lettura vera, corretta.
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
    const idx = html.indexOf("円");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      html_length: html.length,
      sample_around_price: idx > -1 ? html.slice(Math.max(0, idx - 400), idx + 100) : "nessun simbolo yen trovato nella pagina",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
