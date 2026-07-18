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
// Dizionario di partenza inglese -> giapponese per i nomi dei set più
// noti che non hanno un equivalente inglese salvato nel database (i
// set esclusivi giapponesi). Non è completo, cresce nel tempo quando
// ne scopriamo altri — è un punto di partenza, non la fine.
// Le voci sotto sono incrociate tra due fonti indipendenti che
// concordano (Pokellector per il nome inglese, ricerca storica
// giapponese per il nome originale), non indovinate.
const JP_SET_NAME_MAP = {
  'mysterious mountains': '神秘なる山',
  'split earth': '裂けた大地',
  'challenge from the darkness': '闇からの挑戦',
  "leader's stadium": 'リーダーズスタジアム',
  'rocket gang': 'ロケット団',
  'mystery of the fossils': '化石の秘密',
  'pokemon jungle': 'ポケモンジャングル',
  'darkness and to light': '闇、そして光へ',
  'gold, silver, to a new world': '金、銀、新世界へ',
};

export async function searchRealCards(query, limit = 40) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  const term = query.trim();
  let data = [];

  if (term) {
    // provo prima la ricerca per somiglianza (tollerante a refusi e nomi
    // incompleti) — richiede la funzione SQL creata una volta sola su
    // Supabase; se non esiste ancora, passo al metodo precedente
    const fuzzy = await supabase.rpc('search_cards_fuzzy', { search_term: term, result_limit: limit });
    if (!fuzzy.error && fuzzy.data) {
      data = fuzzy.data;
    } else {
      // di riserva: ogni parola della ricerca deve trovarsi da qualche
      // parte (nome O nome inglese O nome set), non l'intera frase in
      // un campo solo
      const words = term.split(/\s+/).filter(Boolean);
      let q = supabase.from('cards').select('*').limit(limit);
      for (const word of words) {
        q = q.or(`name.ilike.%${word}%,name_en.ilike.%${word}%,set_name.ilike.%${word}%`);
      }
      const fallback = await q;
      if (fallback.error) throw fallback.error;
      data = fallback.data || [];
    }
  } else {
    const { data: allData, error } = await supabase.from('cards').select('*').order('name_en', { ascending: true, nullsFirst: false }).limit(limit);
    if (error) throw error;
    data = allData || [];
  }

  // se la ricerca (o una sua parte) corrisponde a un nome inglese noto
  // di un set esclusivo giapponese, cerco ANCHE con l'equivalente
  // giapponese e unisco i risultati, senza duplicati
  if (term) {
    const lower = term.toLowerCase();
    const jpEquivalent = Object.entries(JP_SET_NAME_MAP).find(([en]) => lower.includes(en))?.[1];
    if (jpEquivalent) {
      const { data: jpData } = await supabase.from('cards').select('*')
        .or(`name.ilike.%${jpEquivalent}%,set_name.ilike.%${jpEquivalent}%`).limit(limit);
      const seen = new Set((data || []).map((c) => c.tcgdex_id));
      for (const c of jpData || []) {
        if (!seen.has(c.tcgdex_id)) { data.push(c); seen.add(c.tcgdex_id); }
      }
    }
  }

  // una sola riga per carta fisica, non una per ogni fonte che la
  // copre — preferisco quella con un'immagine, se ce n'è una
  const groups = new Map();
  for (const c of data) {
    const key = `${normalizeForMatch(c.name_en || c.name)}|${normalizeForMatch(c.set_name)}`;
    const existing = groups.get(key);
    if (!existing || (!existing.image_url && c.image_url)) groups.set(key, c);
  }
  return Array.from(groups.values());
}

// riduce un nome/set al minimo per confrontarli tra fonti diverse
// (minuscolo, senza punteggiatura, spazi ripetuti compressi)
function normalizeForMatch(s) {
  return (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

// Tutti i prezzi osservati per una carta — raccolti da OGNI riga che
// rappresenta la stessa carta fisica (stesso nome, stesso set), non
// solo dalla singola riga della fonte su cui l'utente ha cliccato.
// Prima ogni fonte (Netoff, Pokellector, PriceCharting, Fanatics...)
// restava separata con il suo pezzo isolato di storia — questo le unisce.
export async function fetchCardPrices(tcgdexId) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  const { data: thisCard, error: cardError } = await supabase.from('cards').select('name, name_en, set_name').eq('tcgdex_id', tcgdexId).single();
  if (cardError) throw cardError;

  const targetName = normalizeForMatch(thisCard.name_en || thisCard.name);
  const targetSet = normalizeForMatch(thisCard.set_name);

  // prendo un campione ampio di carte con nome simile (per parola
  // chiave), poi filtro con precisione lato client sul nome+set
  // normalizzati — evita di dover indicizzare una funzione SQL apposta
  const keyword = targetName.split(' ').filter(Boolean)[0] || targetName;
  const { data: candidates, error: candError } = await supabase.from('cards').select('tcgdex_id, name, name_en, set_name')
    .or(`name.ilike.%${keyword}%,name_en.ilike.%${keyword}%`).limit(500);
  if (candError) throw candError;

  const matchingIds = (candidates || [])
    .filter((c) => normalizeForMatch(c.name_en || c.name) === targetName && normalizeForMatch(c.set_name) === targetSet)
    .map((c) => c.tcgdex_id);
  if (!matchingIds.includes(tcgdexId)) matchingIds.push(tcgdexId);

  const { data, error } = await supabase
    .from('price_observations').select('*')
    .in('tcgdex_id', matchingIds)
    .order('observed_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Per la Home — carte vere, non finte. Con dati ancora spesso a una sola
// osservazione per carta non ha senso calcolare una "variazione 30gg"
// sintetica: mostriamo le più costose osservate di recente, che è un
// segnale reale con i dati che abbiamo oggi.
// Tassi solo per METTERE IN ORDINE le carte per valore reale — non per
// mostrare prezzi all'utente (quello lo fa fmtFrom in App.jsx). Senza
// questo, una carta da 2.000.000¥ batteva sempre una da $9.000 solo
// perché lo yen ha numeri più grandi per lo stesso valore reale.
const RANKING_RATES_TO_USD = { JPY: 1 / 155.2, USD: 1, EUR: 168.4 / 155.2, CNY: 1 / 21.6 };

export async function fetchFeaturedRealCards(limit = 6) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  // una query per valuta, non una sola per tutte insieme — così le
  // carte in yen (numeri grandi per lo stesso valore reale) non
  // possono escludere le vere migliori di un'altra valuta solo
  // arrivando prima nell'ordine grezzo.
  const currencies = Object.keys(RANKING_RATES_TO_USD);
  const candidatePoolSize = Math.max(limit * 7, 40); // margine ampio, per poter poi preferire quelle con immagine senza perdere le carte di vero valore
  const perCurrency = await Promise.all(currencies.map((cur) =>
    supabase.from('price_observations').select('tcgdex_id, price, currency, observed_at')
      .eq('currency', cur).order('price', { ascending: false }).limit(candidatePoolSize)
  ));
  const seen = new Set();
  const withUsdValue = [];
  for (const result of perCurrency) {
    if (result.error) throw result.error;
    for (const row of result.data) {
      if (seen.has(row.tcgdex_id)) continue;
      seen.add(row.tcgdex_id);
      const rate = RANKING_RATES_TO_USD[row.currency] ?? RANKING_RATES_TO_USD.USD;
      withUsdValue.push({ tcgdex_id: row.tcgdex_id, usdValue: row.price * rate });
    }
  }
  withUsdValue.sort((a, b) => b.usdValue - a.usdValue);
  const candidateIds = withUsdValue.slice(0, candidatePoolSize).map((r) => r.tcgdex_id);
  if (!candidateIds.length) return [];
  const { data: candidateCards, error: cardsError } = await supabase.from('cards').select('*').in('tcgdex_id', candidateIds);
  if (cardsError) throw cardsError;

  // tra le carte di alto valore, quelle CON immagine vengono prima —
  // la Home altrimenti mostra sempre le stesse rare senza foto, che
  // vincono il confronto per prezzo ma danno l'impressione di un
  // catalogo incompleto quando in realtà è quasi tutto a posto
  const valueById = new Map(withUsdValue.map((r) => [r.tcgdex_id, r.usdValue]));
  const ranked = candidateCards
    .filter((c) => valueById.has(c.tcgdex_id))
    .sort((a, b) => {
      const imgDiff = (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0);
      if (imgDiff !== 0) return imgDiff;
      return valueById.get(b.tcgdex_id) - valueById.get(a.tcgdex_id);
    });
  return ranked.slice(0, limit);
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

// Storico completo dei prezzi (venduti confermati) per le carte del
// Portfolio — serve per il grafico del valore totale nel tempo, non
// solo l'ultimo prezzo. Modello: come fanno Collectr/CardLadder,
// "valore al prezzo più recente conosciuto per ogni giorno".
export async function fetchPortfolioHistory(tcgdexIds) {
  if (supabaseConfigError) throw new Error(supabaseConfigError);
  if (!tcgdexIds.length) return [];
  const { data, error } = await supabase
    .from('price_observations').select('tcgdex_id, price, currency, observed_at')
    .in('tcgdex_id', tcgdexIds).eq('confirmed', true)
    .not('observed_at', 'is', null)
    .order('observed_at', { ascending: true });
  if (error) throw error;
  return data;
}
