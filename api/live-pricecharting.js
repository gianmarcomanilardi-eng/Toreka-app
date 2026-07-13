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
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ html_length: html.length, fetchedAt: new Date().toISOString(), note: "parsing HTML da completare, verifica prima che la richiesta stessa funzioni dal vivo" });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
