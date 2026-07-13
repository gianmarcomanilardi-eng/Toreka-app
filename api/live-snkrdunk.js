export default async function handler(req, res) {
  try {
    const resp = await fetch(
      "https://snkrdunk.com/en/magazine/2026/01/08/pokemon-tcg-monthly-market-report-the-top-100-most-traded-cards/",
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `SNKRDUNK ha risposto ${resp.status}`, blocked: resp.status === 403 });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ html_length: html.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
