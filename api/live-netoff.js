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
    // cerco il NOME della carta stesso, non un simbolo generico che
    // può comparire ovunque nella pagina (script, meta tag, ecc.)
    const idx = html.toLowerCase().indexOf(searchTerm.toLowerCase());
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      html_length: html.length,
      found_search_term: idx > -1,
      sample_around_term: idx > -1 ? html.slice(Math.max(0, idx - 200), idx + 500) : "termine di ricerca non trovato nella pagina",
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
