export default async function handler(req, res) {
  try {
    // prima la base del sito, per capire se il dominio risponde
    // normalmente, prima di indovinare ancora un indirizzo preciso
    const resp = await fetch("https://www.pmtcgo.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    const html = await resp.text();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      status_ricevuto: resp.status,
      html_length: html.length,
      sample: html.slice(0, 500),
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
