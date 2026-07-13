// Funzione live su Vercel — stesso posto dove già pubblichi il resto
// dell'app, nessun programma nuovo da installare. Gira sul server di
// Vercel (non nel telefono dell'utente), quindi legge PokeTrace dal
// vivo senza il problema CORS che ha bloccato Fanatics stanotte.

const POKETRACE_KEY = "pc_c2bac2819bc44d77a61ed309bcf9157c61177b832b2a3a40";

export default async function handler(req, res) {
  const searchTerm = req.query.q;
  if (!searchTerm) {
    return res.status(400).json({ error: "manca il parametro q" });
  }

  try {
    const resp = await fetch(
      `https://api.poketrace.com/v1/cards?search=${encodeURIComponent(searchTerm)}&market=US&limit=10`,
      { headers: { "X-API-Key": POKETRACE_KEY } }
    );
    if (!resp.ok) {
      return res.status(502).json({ error: `PokeTrace ha risposto ${resp.status}` });
    }
    const data = await resp.json();

    const results = (data.data || []).map((card) => {
      const confirmedSales = [];
      for (const [source, tiers] of Object.entries(card.prices || {})) {
        if (source !== "ebay") continue; // solo eBay è confermato nella nostra logica
        for (const [gradeTier, stats] of Object.entries(tiers)) {
          if (stats?.avg) confirmedSales.push({ source, gradeTier, price: stats.avg, currency: card.currency });
        }
      }
      return { name: card.name, set: card.set?.name, cardNumber: card.cardNumber, image: card.image, confirmedSales };
    });

    res.setHeader("Cache-Control", "no-store"); // niente cache: deve essere sempre dal vivo
    return res.status(200).json({ results, fetchedAt: new Date().toISOString() });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
