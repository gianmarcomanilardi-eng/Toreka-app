// PriceCharting dal vivo — confermato che la richiesta funziona
// (476.000 caratteri di contenuto reale). Cerca i link alle singole
// carte (/game/set/nome-carta) e il prezzo subito vicino.
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

    const results = [];
    const linkRegex = /<a[^>]*href="(\/game\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    const seen = new Set();
    while ((match = linkRegex.exec(html)) !== null) {
      const [, href, name] = match;
      if (seen.has(href) || !name.trim()) continue;
      seen.add(href);
      const nearby = html.slice(match.index, match.index + 800);
      const priceMatch = nearby.match(/\$([\d,]+\.\d{2})/);
      if (priceMatch) {
        results.push({ name: name.trim(), url: href, price_usd: parseFloat(priceMatch[1].replace(/,/g, "")) });
      }
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ results: results.slice(0, 20), fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
