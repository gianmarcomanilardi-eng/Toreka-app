// Funzione live: l'app la chiama quando l'utente cerca una carta.
// Questa gira sul server di Supabase (non nel browser dell'utente),
// quindi non ha il problema CORS che ha bloccato Fanatics stanotte —
// può leggere PokeTrace dal vivo, ogni volta, senza passare da un
// database pre-riempito.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const POKETRACE_KEY = "pc_c2bac2819bc44d77a61ed309bcf9157c61177b832b2a3a40";

Deno.serve(async (req) => {
  const { searchTerm } = await req.json();

  if (!searchTerm) {
    return new Response(JSON.stringify({ error: "manca searchTerm" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resp = await fetch(
    `https://api.poketrace.com/v1/cards?search=${encodeURIComponent(searchTerm)}&market=US&limit=10`,
    { headers: { "X-API-Key": POKETRACE_KEY } }
  );

  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `PokeTrace ha risposto ${resp.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await resp.json();

  // struttura pulita per l'app: solo vendite confermate, non stime
  const results = (data.data || []).map((card: any) => {
    const confirmedSales: any[] = [];
    for (const [source, tiers] of Object.entries(card.prices || {})) {
      if (source !== "ebay") continue; // solo eBay è marcato "confermato" nella nostra logica
      for (const [gradeTier, stats] of Object.entries(tiers as any)) {
        if ((stats as any)?.avg) {
          confirmedSales.push({ source, gradeTier, price: (stats as any).avg, currency: card.currency });
        }
      }
    }
    return {
      name: card.name,
      set: card.set?.name,
      cardNumber: card.cardNumber,
      image: card.image,
      confirmedSales,
    };
  });

  return new Response(JSON.stringify({ results, fetchedAt: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
