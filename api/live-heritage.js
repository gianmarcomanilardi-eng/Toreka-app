export default async function handler(req, res) {
  try {
    const resp = await fetch(
      "https://comics.ha.com/heritage-auctions-press-releases-and-news/sealed-pokemon-set-key-magic-the-gathering-cards-auctioned-for-nearly-300-000.s?releaseId=3601",
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }
    );
    if (!resp.ok) return res.status(502).json({ error: `Heritage ha risposto ${resp.status}`, blocked: resp.status === 403 });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ html_length: html.length, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
