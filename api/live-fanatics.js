export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) return res.status(400).json({ error: "manca q" });
  try {
    const resp = await fetch(
      `https://sales-history-api.services.fanaticscollect.com/api/v1/pub/sales?title=${encodeURIComponent(searchTerm)}&marketplaceSource=bo&page=0&size=10`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Referer": "https://sales-history.fanaticscollect.com/",
          "Origin": "https://sales-history.fanaticscollect.com",
        },
      }
    );
    if (!resp.ok) return res.status(502).json({ error: `Fanatics ha risposto ${resp.status}`, blocked: resp.status === 403 });
    const data = await resp.json();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ raw: data, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
