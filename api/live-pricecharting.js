// Ricerca dal vivo su PriceCharting — copre sia i set occidentali che
// quelli specificamente giapponesi ("Pokemon Japanese ..."), scoperti
// stanotte. Stesso schema di lettura già provato sulle pagine console.
export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca il parametro q" });

  try {
    const resp = await fetch(
      `https://www.pricecharting.com/search-products?q=${encodeURIComponent(searchTerm)}&type=prices`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `PriceCharting ha risposto ${resp.status}` });
    const html = await resp.text();

    const results = [];
    const pattern = /\[([^\]]+)\]\((https:\/\/www\.pricecharting\.com\/game\/[^\s")]+)[^)]*\)\s*(?:\[[^\]]+\]\([^)]+\)\s*)*?\[([^\]]+)\]\(https:\/\/www\.pricecharting\.com\/console\//g;
    let m;
    while ((m = pattern.exec(html)) !== null && results.length < 8) {
      results.push({ name: m[1], set: m[3], url: m[2] });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ results, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
