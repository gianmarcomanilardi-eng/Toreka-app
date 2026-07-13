// Netoff dal vivo — confermato che la richiesta funziona (verificato
// con 68.000 caratteri di contenuto reale). Estrazione basata sullo
// stesso schema già testato e riuscito su Colab (874+4.613 carte).
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

    const results = [];
    const h3Regex = /<h3[^>]*>([^<]+)<\/h3>/g;
    let match;
    while ((match = h3Regex.exec(html)) !== null) {
      const name = match[1].trim();
      // cerca il prezzo nei ~500 caratteri subito dopo il titolo trovato
      const nearby = html.slice(match.index, match.index + 500);
      const priceMatch = nearby.match(/([\d,]+)\s*円/);
      if (name && priceMatch) {
        results.push({ name, price_jpy: parseInt(priceMatch[1].replace(/,/g, ""), 10) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ results, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
