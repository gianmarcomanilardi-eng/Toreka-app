import { createClient } from '@supabase/supabase-js';

// Questa chiave ("publishable"/"anon") è pensata per stare nel codice
// del browser — Supabase la considera sicura da esporre, a differenza
// della chiave "secret"/"service_role" che non va mai messa qui.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Legge tutto quello che c'è nel database così com'è — nessuna
// trasformazione per ora, serve solo a controllare che il collegamento
// funzioni davvero prima di costruire qualcosa sopra.
export async function fetchRawCards() {
  const { data: cards, error: cardsError } = await supabase.from('cards').select('*');
  if (cardsError) throw cardsError;

  const { data: prices, error: pricesError } = await supabase
    .from('price_observations')
    .select('*')
    .order('observed_at', { ascending: false });
  if (pricesError) throw pricesError;

  return { cards, prices };
}
