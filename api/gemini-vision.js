// Chiamata a Gemini dal server (Vercel), non dal telefono dell'utente —
// così la chiave non è mai visibile a chi apre l'app o guarda il
// codice su GitHub. La chiave vera si mette su Vercel, non qui.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'solo POST' });
  const { image, prompt } = req.body || {};
  if (!image || !prompt) return res.status(400).json({ error: 'servono image e prompt' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY non impostata su Vercel' });

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: prompt }] }],
      }),
    });
    if (!resp.ok) return res.status(502).json({ error: `Gemini ha risposto ${resp.status}` });
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.status(200).json({ text: typeof text === 'string' ? text : null });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
