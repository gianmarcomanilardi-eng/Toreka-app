import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Se queste due righe mancano (es. il file .env non è arrivato su
// GitHub — capita facilmente su Mac, dove i file che iniziano con il
// punto sono nascosti), NON blocchiamo tutta l'app con un errore che la
// fa restare bianca: continuiamo, e lo diciamo chiaramente nella
// schermata "Test DB" invece.
export const supabaseConfigError = (!url || !key)
  ? 'Mancano VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY — controlla che il file .env sia stato caricato su GitHub.'
  : null;

// Questa chiave ("publishable"/"anon") è pensata per stare nel codice
// del browser — Supabase la considera sicura da esporre, a differenza
// della chiave "secret"/"service_role" che non va mai messa qui.
export const supabase = supabaseConfigError ? null : createClient(url, key);

// Legge un vero conteggio totale (non limitato dalle 1000 righe di
// default) più un campione di carte reali — mostrare tutte le migliaia
// di righe in un elenco piatto non sarebbe comunque utile da leggere.
export async function fetchRawCards(sampleSize = 20) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);

  const { count: cardsCount, error: cardsCountError } = await supabase
    .from('cards').select('*', { count: 'exact', head: true });
  if (cardsCountError) throw cardsCountError;

  const { count: pricesCount, error: pricesCountError } = await supabase
    .from('price_observations').select('*', { count: 'exact', head: true });
  if (pricesCountError) throw pricesCountError;

  const { data: cards, error: cardsError } = await supabase
    .from('cards').select('*').limit(sampleSize);
  if (cardsError) throw cardsError;

  const ids = cards.map((c) => c.tcgdex_id);
  const { data: prices, error: pricesError } = ids.length
    ? await supabase.from('price_observations').select('*').in('tcgdex_id', ids).order('observed_at', { ascending: false })
    : { data: [], error: null };
  if (pricesError) throw pricesError;

  return { cards, prices, cardsCount, pricesCount, sampleSize };
}

// Cerca per davvero nel database — non un filtro su un elenco già
// scaricato, ma una richiesta vera che gira sul database, l'unico modo
// che regge con decine di migliaia di carte.
export async function searchRealCards(query, limit = 40) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  let q = supabase.from('cards').select('*').order('name_en', { ascending: true, nullsFirst: false }).limit(limit);
  const term = query.trim();
  if (term) {
    q = supabase.from('cards').select('*')
      .or(`name.ilike.%${term}%,name_en.ilike.%${term}%,set_name.ilike.%${term}%`)
      .limit(limit);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Tutti i prezzi osservati per una carta — la "storia" reale, non un
// grafico sintetico: quello che c'è è quello che abbiamo davvero letto.
export async function fetchCardPrices(tcgdexId) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  const { data, error } = await supabase
    .from('price_observations').select('*')
    .eq('tcgdex_id', tcgdexId)
    .order('observed_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Per la Home — carte vere, non finte. Con dati ancora spesso a una sola
// osservazione per carta non ha senso calcolare una "variazione 30gg"
// sintetica: mostriamo le più costose osservate di recente, che è un
// segnale reale con i dati che abbiamo oggi.
export async function fetchFeaturedRealCards(limit = 6) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  const { data, error } = await supabase
    .from('price_observations').select('tcgdex_id, price, currency, observed_at')
    .order('price', { ascending: false }).limit(50);
  if (error) throw error;
  const seen = new Set();
  const topIds = [];
  for (const row of data) {
    if (seen.has(row.tcgdex_id)) continue;
    seen.add(row.tcgdex_id);
    topIds.push(row.tcgdex_id);
    if (topIds.length >= limit) break;
  }
  if (!topIds.length) return [];
  const { data: cards, error: cardsError } = await supabase.from('cards').select('*').in('tcgdex_id', topIds);
  if (cardsError) throw cardsError;
  return topIds.map((id) => cards.find((c) => c.tcgdex_id === id)).filter(Boolean);
}

// Carte vere per il Portfolio, prese a partire dagli id salvati nella
// collezione — il prezzo mostrato è sempre quello più recente osservato,
// non un valore congelato al momento in cui l'hai aggiunta.
export async function fetchCardsByIds(tcgdexIds) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  if (!tcgdexIds.length) return [];
  const { data: cards, error } = await supabase.from('cards').select('*').in('tcgdex_id', tcgdexIds);
  if (error) throw error;
  const { data: prices, error: pricesError } = await supabase
    .from('price_observations').select('*').in('tcgdex_id', tcgdexIds).order('observed_at', { ascending: false });
  if (pricesError) throw pricesError;
  return cards.map((c) => ({ ...c, latestPrice: prices.find((p) => p.tcgdex_id === c.tcgdex_id) || null }));
}
