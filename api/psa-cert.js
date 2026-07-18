// Verifica certificato PSA — dato il numero letto dalla fotocamera
// (quella non viene toccata per niente qui), trova a quale carta
// corrisponde E le vendite vere comparabili da più piattaforme insieme
// (eBay, Heritage Auctions, ecc.), tutto dalla stessa pagina ufficiale
// PSA. Schema di lettura testato contro un caso vero prima di scriverlo.
export default async function handler(req, res) {
  const cert = req.query.cert;
  if (!cert) return res.status(400).json({ error: "manca il parametro cert" });

  try {
    const resp = await fetch(`https://www.psacard.com/cert/${encodeURIComponent(cert)}/psa`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" },
    });
    if (!resp.ok) return res.status(502).json({ error: `PSA ha risposto ${resp.status}`, notFound: resp.status === 404 });
    const html = await resp.text();

    // testo semplice, senza tag, per leggere sia il titolo che le
    // vendite con lo stesso schema testato contro un caso vero
    const flat = html.replace(/<[^>]+>/g, "\n").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");

    const titleMatch = flat.match(/requested certification number is defined as the following:\s*\n+\s*#?\d*\s*\n+\s*([^\n]+)/i);
    const gradeMatch = flat.match(/Item Grade\s*\n+\s*([A-Z][A-Z\-]*\s*\d+(?:\.\d+)?)/);

    const sales = [];
    const pattern = /\$([\d,]+\.\d{2})\s*\n+\s*(\d{2}\/\d{2}\/\d{2})\s*\n+\s*([A-Za-z][A-Za-z\s]*?)\s*\n+\s*(FixedPrice|Auction|BestOffer)\s*\n+\s*(PSA\s*\d+(?:\.\d+)?)/g;
    let m;
    while ((m = pattern.exec(flat)) !== null) {
      sales.push({
        price: parseFloat(m[1].replace(/,/g, "")),
        date: m[2],
        platform: m[3].trim(),
        saleType: m[4],
        grade: m[5].trim(),
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      cert,
      cardName: titleMatch ? titleMatch[1].trim() : null,
      grade: gradeMatch ? gradeMatch[1].trim() : null,
      sales: sales.slice(0, 10),
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
