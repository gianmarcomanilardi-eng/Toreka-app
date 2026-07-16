// Diagnostica Cardmarket — il mio strumento diretto è stato bloccato,
// verifico se un server Vercel si comporta diversamente, come successo
// per alcune fonti stanotte (Netoff/PriceCharting sì, Heritage/130Point no).
export default async function handler(req, res) {
  try {
    const resp = await fetch("https://www.cardmarket.com/en/Pokemon/Cards/Computer-Search", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ status_ricevuto: resp.status, html_length: html.length, sample: html.slice(0, 400), fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
