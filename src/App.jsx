import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, ChevronLeft, Home, User, Wallet, TrendingUp, TrendingDown,
  CheckCircle2, ScanLine, Youtube, Quote, ArrowRight, Sparkles, Plus, Check, Clock, Globe2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { fetchRawCards, searchRealCards, fetchCardPrices, fetchFeaturedRealCards, fetchCardsByIds } from './supabaseClient.js';

/* ---------------------------------------------------------
   Design tokens
---------------------------------------------------------- */
const C = {
  ink: '#161310', ink2: '#211D18', ink3: '#2C2620', line: '#4A4136',
  vermillion: '#FF4732', gold: '#E8B84B', jade: '#2ED573', teal: '#35C4B8',
  paper: '#F7F2E7', mist: '#A89D8C',
};
const PANEL = { background: C.ink2, border: `1px solid ${C.line}`, boxShadow: '0 6px 18px rgba(0,0,0,0.28)' };
function topAccent(color) { return { borderTop: `3px solid ${color}` }; }

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
    .tk-display { font-family: 'Space Grotesk', sans-serif; }
    .tk-body { font-family: 'Inter', sans-serif; }
    .tk-mono { font-family: 'Space Mono', monospace; }
    .tk-scroll::-webkit-scrollbar { display: none; }
    .tk-scroll { -ms-overflow-style: none; scrollbar-width: none; }
    .tk-hscroll::-webkit-scrollbar { display: none; }
    @keyframes tkRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .tk-rise { animation: tkRise 0.3s ease both; }
  `}</style>
);

/* ---------------------------------------------------------
   Grading scales
---------------------------------------------------------- */
const GRADE_SCALES = {
  PSA: [{ g: 10, label: '10' }, { g: 9, label: '9' }, { g: 8, label: '8' }, { g: 7, label: '7' }],
  BGS: [{ g: 10.5, label: '10 BL' }, { g: 10, label: '10' }, { g: 9.5, label: '9.5' }, { g: 9, label: '9' }, { g: 8.5, label: '8.5' }, { g: 8, label: '8' }],
  CGC: [{ g: 10, label: '10' }, { g: 9.5, label: '9.5' }, { g: 9, label: '9' }, { g: 8.5, label: '8.5' }, { g: 8, label: '8' }],
  TAG: [{ g: 10.5, label: '10 P' }, { g: 10, label: '10 GM' }, { g: 9, label: '9' }, { g: 8.5, label: '8.5' }, { g: 8, label: '8' }],
};
const MULT = {
  PSA: { 10: 1, 9: 0.42, 8: 0.22, 7: 0.11 },
  BGS: { 10.5: 1.25, 10: 1.05, 9.5: 0.82, 9: 0.4, 8.5: 0.24, 8: 0.14 },
  CGC: { 10: 0.88, 9.5: 0.68, 9: 0.36, 8.5: 0.22, 8: 0.13 },
  TAG: { 10.5: 1.1, 10: 0.95, 9: 0.38, 8.5: 0.23, 8: 0.13 },
};
const RATES = { JPY: 1, USD: 1 / 155.2, EUR: 1 / 168.4, CNY: 1 / 21.6 };
const SYMBOLS = { JPY: '¥', USD: '$', EUR: '€', CNY: 'CN¥' };
function fmt(jpy, currency) { const v = jpy * RATES[currency]; if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`; return `${SYMBOLS[currency]}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; }
function fmtConverted(v, currency) { if (currency === 'JPY') return `¥${Math.round(v).toLocaleString('ja-JP')}`; return `${SYMBOLS[currency]}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`; }
function fmtFrom(amount, fromCurrency, toCurrency) {
  const jpy = amount / (RATES[fromCurrency] ?? 1);
  return fmtConverted(jpy * RATES[toCurrency], toCurrency);
}
const MONTHS_IT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
function fmtDate(d, withYear = false) { if (!d) return ''; const s = `${d.getDate()} ${MONTHS_IT[d.getMonth()]}`; return withYear ? `${s} '${String(d.getFullYear()).slice(2)}` : s; }
function seededRand(seed) { let s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const TODAY = new Date(2026, 6, 11);
function buildSeries(basePrice, driftFraction, seed, days = 420) {
  const rand = seededRand(seed); const dailyDrift = driftFraction / days; let v = basePrice / (1 + driftFraction); const out = [];
  for (let i = days; i >= 0; i--) { const d = new Date(TODAY); d.setDate(d.getDate() - i); if (i !== days) v = v * (1 + dailyDrift + (rand() - 0.5) * 0.032); out.push({ date: d, price: v }); }
  out[out.length - 1].price = basePrice; return out;
}
// seed now depends on card id AND language, so JP/EN editions get different-looking (but still stable) curves
function seedFor(id, lang) { const langSeed = lang.split('').reduce((a, c) => a + c.charCodeAt(0), 0); return id * 7919 + langSeed * 131 + 104729; }

const LANG_LABEL = { JP: '\u65E5\u672C\u8A9E', EN: 'English' };

/* ---------------------------------------------------------
   Mock data. Each card is a design that may have been printed
   in more than one language/region — same character, different
   set, number, name and price per printing (this is exactly what
   Cardmarket calls out as a separate "Language" attribute).
---------------------------------------------------------- */
const CARDS = [
  { id: 1, rarity: 'SAR',
    editions: [
      { lang: 'JP', name: 'リザードンex', gloss: 'Charizard ex', set: 'Terastal Festival ex', setCode: 'SV8a', num: '201/187', basePrice: 187000, drift: 0.42,
        sales: [{ pf: 'SNKRDUNK', co: 'PSA', g: 10, price: 195000, date: '10 lug' }, { pf: 'Yuyu-tei', co: 'PSA', g: 10, price: 182000, date: '9 lug' },
          { pf: 'Fanatics Collect', co: 'BGS', g: 9.5, price: 158000, date: '6 lug' }, { pf: 'Mercari JP', co: 'CGC', g: 9, price: 65000, date: '4 lug' },
          { pf: 'Yuyu-tei', co: 'TAG', g: 10, price: 180000, date: '1 lug' }] },
    ] }, // High Class Pack esclusivo — nessuna ristampa nota fuori dal Giappone
  { id: 2, rarity: 'SAR',
    editions: [
      { lang: 'JP', name: 'ミュウex', gloss: 'Mew ex', set: 'Pokémon Card 151', setCode: 'SV2a', num: '227/165', basePrice: 74000, drift: 0.28,
        sales: [{ pf: 'Yuyu-tei', co: 'PSA', g: 10, price: 71500, date: '10 lug' }, { pf: 'SNKRDUNK', co: 'PSA', g: 10, price: 76000, date: '8 lug' },
          { pf: 'eBay', co: 'CGC', g: 9.5, price: 49000, date: '5 lug' }, { pf: 'Yuyu-tei', co: 'PSA', g: 9, price: 30500, date: '2 lug' },
          { pf: 'Fanatics Collect', co: 'BGS', g: 10.5, price: 95000, date: '30 giu' }] },
      { lang: 'EN', name: 'Mew ex', set: 'Scarlet & Violet—151', setCode: 'MEW', num: '227/165', basePrice: 61000, drift: 0.15,
        imageUrl: 'https://cdn.poketrace.com/cards/96b13860dec8d94b.webp',
        sales: [{ pf: 'eBay', co: 'PSA', g: 10, price: 59000, date: '9 lug' }, { pf: 'Fanatics Collect', co: 'PSA', g: 10, price: 63500, date: '5 lug' },
          { pf: 'eBay', co: 'CGC', g: 9.5, price: 41000, date: '1 lug' }] },
    ] },
  { id: 3, rarity: 'AR',
    editions: [
      { lang: 'JP', name: 'ピカチュウVMAX', gloss: 'Pikachu VMAX', set: 'Amazing Volt Tackle', setCode: 'S4a', num: '100/100', basePrice: 156000, drift: 0.22,
        sales: [{ pf: 'Mercari JP', co: 'CGC', g: 9.5, price: 108000, date: '9 lug' }, { pf: 'Yuyu-tei', co: 'BGS', g: 9, price: 61000, date: '7 lug' },
          { pf: 'SNKRDUNK', co: 'PSA', g: 10, price: 161000, date: '5 lug' }, { pf: 'Yuyu-tei', co: 'TAG', g: 8.5, price: 35000, date: '30 giu' }] },
    ] }, // High Class Pack esclusivo — nessuna ristampa nota fuori dal Giappone
  { id: 4, rarity: 'AR',
    editions: [
      { lang: 'JP', name: 'ブラッキーVMAX', gloss: 'Umbreon VMAX', set: 'Evolving Skies', setCode: 'S6a', num: '415/203', basePrice: 178000, drift: -0.08,
        sales: [{ pf: 'Yuyu-tei', co: 'PSA', g: 10, price: 172000, date: '9 lug' }, { pf: 'SNKRDUNK', co: 'CGC', g: 9.5, price: 121000, date: '6 lug' },
          { pf: 'Mercari JP', co: 'BGS', g: 9, price: 69000, date: '3 lug' }, { pf: 'Ptcgtw.shop', co: 'CGC', g: 9, price: 63000, date: '29 giu' }] },
      { lang: 'EN', name: 'Umbreon VMAX', set: 'Evolving Skies', setCode: 'SWSH7', num: '215/203', basePrice: 165000, drift: 0.05,
        sales: [{ pf: 'eBay', co: 'PSA', g: 10, price: 171000, date: '8 lug' }, { pf: 'Fanatics Collect', co: 'PSA', g: 10, price: 179000, date: '4 lug' },
          { pf: 'eBay', co: 'BGS', g: 9.5, price: 143000, date: '30 giu' }] },
    ] },
  { id: 5, rarity: 'AR',
    editions: [
      { lang: 'JP', name: 'レックウザVMAX', gloss: 'Rayquaza VMAX', set: 'Evolving Skies', setCode: 'S6a', num: '409/203', basePrice: 162000, drift: 0.18,
        sales: [{ pf: 'Fanatics Collect', co: 'BGS', g: 9.5, price: 136000, date: '9 lug' }, { pf: 'Yuyu-tei', co: 'PSA', g: 10, price: 166000, date: '6 lug' },
          { pf: 'SNKRDUNK', co: 'TAG', g: 10, price: 155000, date: '1 lug' }] },
      { lang: 'EN', name: 'Rayquaza VMAX', set: 'Evolving Skies', setCode: 'SWSH7', num: '218/203', basePrice: 148000, drift: 0.10,
        sales: [{ pf: 'eBay', co: 'PSA', g: 10, price: 151000, date: '7 lug' }, { pf: 'Fanatics Collect', co: 'BGS', g: 9.5, price: 129000, date: '2 lug' }] },
    ] },
  { id: 6, rarity: 'AR',
    editions: [
      { lang: 'JP', name: 'ルギア', gloss: 'Lugia', set: 'Silver Tempest', setCode: 'S11', num: '186/172', basePrice: 96000, drift: 0.35,
        sales: [{ pf: 'Yuyu-tei', co: 'PSA', g: 10, price: 99500, date: '10 lug' }, { pf: 'Mercari JP', co: 'CGC', g: 9.5, price: 64000, date: '7 lug' },
          { pf: 'SNKRDUNK', co: 'PSA', g: 10, price: 101000, date: '3 lug' }, { pf: 'Yuyu-tei', co: 'BGS', g: 9, price: 37500, date: '29 giu' }] },
      { lang: 'EN', name: 'Lugia', set: 'Silver Tempest', setCode: 'SWSH12', num: '179/195', basePrice: 71000, drift: 0.20,
        sales: [{ pf: 'eBay', co: 'PSA', g: 10, price: 73000, date: '8 lug' }, { pf: 'eBay', co: 'CGC', g: 9.5, price: 47000, date: '3 lug' }] },
    ] },
];
const RANGES = [{ k: 7, l: '7G' }, { k: 30, l: '30G' }, { k: 90, l: '90G' }, { k: 365, l: '1A' }, { k: 'all', l: 'Tutto' }];
const INTERVIEWS = [
  { id: 1, name: 'Marco Corsi', handle: 'Grail Radar', tag: 'YouTuber · carte rare', hue: 18,
    title: 'Il grail non si compra, si conquista',
    teaser: 'Per Marco ogni ricerca di una carta introvabile è una caccia — e il mercato giapponese è dove succede davvero.',
    qa: [
      { q: 'Da dove nasce la tua passione per le carte giapponesi?', a: 'Ho iniziato come tutti, con le buste italiane comprate all\u2019edicola. Ma appena ho visto una carta giapponese dal vivo — la carta più spessa, certi promo che qui non arriveranno mai — non sono più tornato indietro.' },
      { q: 'Il pezzo a cui sei più legato nella tua collezione?', a: 'Un Lugia Alt Art di Silver Tempest preso a Yuyu-tei tre anni fa, prima che esplodesse. Non la venderei nemmeno per il triplo di quanto vale oggi.' },
      { q: 'Quanto ti fidi dei prezzi che trovi online per le carte giapponesi?', a: 'Poco, sinceramente. La maggior parte degli strumenti che uso per lo storico prezzi guarda solo eBay o TCGplayer — per le carte giapponesi quei numeri dicono poco. Il mercato vero si muove su Yuyu-tei, Mercari, SNKRDUNK. Se non guardi lì, stai vedendo un prezzo sbagliato.', pull: true },
      { q: 'Un consiglio per chi vuole iniziare a collezionare in giapponese?', a: 'Impara a riconoscere le edizioni e non fidarti solo della foto — grading e provenienza contano più del nome della carta. E segui il mercato giapponese direttamente, non la sua eco occidentale.' },
    ] },
  { id: 2, comingSoon: true, teaser: 'Prossima intervista in arrivo' },
  { id: 3, comingSoon: true, teaser: 'Prossima intervista in arrivo' },
];

/* ---------------------------------------------------------
   Small pieces
---------------------------------------------------------- */
function GradeSlab({ co, label, size = 'sm' }) {
  const big = size === 'lg';
  return (
    <div className="tk-mono" style={{ display: 'inline-flex', border: `1px solid ${C.gold}`, borderRadius: 4, overflow: 'hidden', height: big ? 30 : 22 }}>
      <div style={{ background: C.ink3, color: C.mist, fontSize: big ? 11 : 9, fontWeight: 700, padding: big ? '0 8px' : '0 6px', display: 'flex', alignItems: 'center', letterSpacing: 1 }}>{co}</div>
      <div style={{ background: C.gold, color: C.ink, fontSize: big ? 14 : 10.5, fontWeight: 700, padding: big ? '0 10px' : '0 7px', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}
function PlatformPill({ name }) { return <span className="tk-body" style={{ fontSize: 10.5, color: C.mist, border: `1px solid ${C.line}`, borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap' }}>{name}</span>; }
function ConfirmedSeal() { return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.gold, fontSize: 10.5 }}><CheckCircle2 size={12} strokeWidth={2.5} /><span className="tk-body" style={{ fontWeight: 600 }}>confermato</span></span>; }
function CardArt({ hue = 0, label, round = false, imageUrl = null }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = imageUrl && !imgFailed;
  return (
    <div style={{
      width: '100%', aspectRatio: round ? '1 / 1' : '5 / 7', borderRadius: round ? '50%' : 12,
      boxShadow: '0 10px 22px rgba(0,0,0,0.38), 0 3px 8px rgba(0,0,0,0.3)', position: 'relative',
    }}>
      <div style={{
        width: '100%', height: '100%', borderRadius: round ? '50%' : 12,
        background: showImage ? C.ink3 : `linear-gradient(155deg, hsl(${hue},48%,24%), ${C.ink3} 75%)`,
        border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {showImage ? (
          <img
            src={imageUrl}
            alt={label}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <>
            {!round && <div style={{ position: 'absolute', inset: 6, border: `1.5px solid ${C.gold}66`, borderRadius: 8 }} />}
            <span className="tk-display" style={{ color: `${C.paper}77`, fontSize: round ? 20 : 13, fontWeight: 600, textAlign: 'center', padding: 10 }}>{label}</span>
          </>
        )}
      </div>
    </div>
  );
}
function Disclaimer() {
  return (
    <div className="tk-body" style={{ color: C.mist, fontSize: 9.5, textAlign: 'center', lineHeight: 1.5, padding: '18px 20px 4px', opacity: 0.7 }}>
      Toreka non è affiliata con Nintendo, The Pokémon Company, Creatures Inc., PSA, BGS, CGC o TAG.
      Nomi e loghi Pokémon sono marchi dei rispettivi proprietari, usati solo a scopo di identificazione e consultazione prezzi.
    </div>
  );
}
function Chip({ active, onClick, children }) {
  return <button onClick={onClick} className="tk-mono" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', flexShrink: 0, fontWeight: 700, border: `1px solid ${active ? C.gold : C.line}`, background: active ? C.gold : 'transparent', color: active ? C.ink : C.mist }}>{children}</button>;
}
function GridTexture() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `linear-gradient(${C.line}26 1px, transparent 1px), linear-gradient(90deg, ${C.line}26 1px, transparent 1px)`,
      backgroundSize: '26px 26px',
      maskImage: 'linear-gradient(to bottom, black, black 65%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, black, black 65%, transparent 100%)' }} />
  );
}
function TopBar({ title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div>
        <div className="tk-display" style={{ color: C.paper, fontSize: 23, fontWeight: 700, letterSpacing: -0.5 }}>{title}</div>
        <div className="tk-body" style={{ color: C.mist, fontSize: 11, letterSpacing: 0.5 }}>{subtitle}</div>
      </div>
      <span className="tk-mono" style={{ fontSize: 9.5, color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 3, padding: '2px 6px' }}>BETA</span>
    </div>
  );
}
function quickChange30d(edition, id) { const s = buildSeries(edition.basePrice, edition.drift, seedFor(id, edition.lang)).slice(-31); return ((s[s.length - 1].price - s[0].price) / s[0].price) * 100; }

/* ---------------------------------------------------------
   Views
---------------------------------------------------------- */
function HomeView({ onOpenCard, onOpenArticle, onGoBrowse, onOpenRealCard }) {
  const [real, setReal] = useState({ status: 'loading', cards: [] });
  useEffect(() => {
    fetchFeaturedRealCards(6)
      .then((cards) => setReal({ status: 'ok', cards }))
      .catch((error) => setReal({ status: 'error', cards: [], error: error.message || String(error) }));
  }, []);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <TopBar title="Toreka" subtitle="トレカ ・ mercato JP / CN" />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
          <span className="tk-mono" style={{ color: C.gold, fontSize: 10.5, letterSpacing: 1.5 }}>LE PIÙ QUOTATE ORA</span>
          <span onClick={onGoBrowse} className="tk-body" style={{ color: C.mist, fontSize: 10.5, cursor: 'pointer' }}>tutte le carte →</span>
        </div>
        {real.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12, textAlign: 'center', padding: 20 }}>Carico dal database...</div>}
        {real.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 10, padding: 12 }}>{real.error}</div>}
        {real.status === 'ok' && real.cards.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Nessuna carta ancora nel database.</div>}
        {real.status === 'ok' && (
          <div className="tk-rise" style={{ ...PANEL, ...topAccent(C.gold), borderRadius: 14, overflow: 'hidden' }}>
            {real.cards.map((c, i) => (
              <div key={c.tcgdex_id} onClick={() => onOpenRealCard(c)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: 12, cursor: 'pointer',
                borderTop: i === 0 ? 'none' : `1px solid ${C.line}`,
              }}>
                <div style={{ width: 38 }}><CardArt hue={(c.tcgdex_id.length * 37) % 360} label={(c.name_en || c.name || '?').slice(0, 2)} imageUrl={c.image_url} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tk-body" style={{ color: C.paper, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name_en || c.name}</div>
                  <div className="tk-body" style={{ color: C.mist, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.set_name || c.set_code}</div>
                </div>
                <ArrowRight size={14} color={C.mist} />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
          <span className="tk-mono" style={{ color: C.teal, fontSize: 10.5, letterSpacing: 1.5 }}>DALLA COMMUNITY</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {INTERVIEWS.map((it) => it.comingSoon ? (
            <div key={it.id} style={{ border: `1px dashed ${C.line}`, borderRadius: 14, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: C.ink3, border: `1px solid ${C.line}` }} />
              <span className="tk-body" style={{ color: C.mist, fontSize: 11.5, fontStyle: 'italic' }}>{it.teaser}</span>
            </div>
          ) : (
            <div key={it.id} onClick={() => onOpenArticle(it)} className="tk-rise" style={{ ...PANEL, ...topAccent(C.teal), borderRadius: 14, padding: 14, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 42 }}><CardArt hue={it.hue} label={it.name.split(' ')[0][0]} round /></div>
                <div style={{ flex: 1 }}><div className="tk-body" style={{ color: C.paper, fontSize: 13, fontWeight: 700 }}>{it.name}</div><div className="tk-body" style={{ color: C.mist, fontSize: 10 }}>{it.tag}</div></div>
                <Youtube size={16} color={C.teal} />
              </div>
              <div className="tk-display" style={{ color: C.paper, fontSize: 14.5, fontWeight: 700, marginTop: 10 }}>{it.title}</div>
              <div className="tk-body" style={{ color: C.mist, fontSize: 11.5, marginTop: 4, lineHeight: 1.4 }}>{it.teaser}</div>
            </div>
          ))}
        </div>
        <Disclaimer />
      </div>
    </div>
  );
}

function ArticleView({ item, onBack }) {
  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div className="tk-rise" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56 }}><CardArt hue={item.hue} label={item.name.split(' ')[0][0]} round /></div>
            <div><div className="tk-body" style={{ color: C.paper, fontSize: 15, fontWeight: 700 }}>{item.name}</div><div className="tk-body" style={{ color: C.mist, fontSize: 11 }}>{item.tag} · {item.handle}</div></div>
          </div>
          <div className="tk-display" style={{ color: C.paper, fontSize: 21, fontWeight: 700, marginTop: 18, lineHeight: 1.3 }}>{item.title}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 18 }}>
            {item.qa.map((pair, i) => pair.pull ? (
              <div key={i} style={{ background: C.ink3, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 10, padding: 16 }}>
                <Quote size={16} color={C.gold} />
                <div className="tk-display" style={{ color: C.paper, fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, marginTop: 6 }}>{pair.a}</div>
              </div>
            ) : (
              <div key={i}>
                <div className="tk-body" style={{ color: C.teal, fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>{pair.q}</div>
                <div className="tk-body" style={{ color: C.paper, fontSize: 13, lineHeight: 1.55, opacity: 0.9 }}>{pair.a}</div>
              </div>
            ))}
          </div>
          <div className="tk-body" style={{ color: C.mist, fontSize: 9.5, marginTop: 24, borderTop: `1px solid ${C.line}`, paddingTop: 10, fontStyle: 'italic' }}>Intervista di esempio, scritta per la demo — {item.name} è un personaggio inventato, non una persona reale.</div>
        </div>
      </div>
    </div>
  );
}

function ComingSoonView({ label }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, textAlign: 'center' }}>
      <span className="tk-mono" style={{ color: C.gold, fontSize: 10, letterSpacing: 1.5 }}>IN ARRIVO</span>
      <span className="tk-body" style={{ color: C.mist, fontSize: 12.5 }}>{label} non è ancora nel prototipo.</span>
    </div>
  );
}

// Vista temporanea, solo per controllare che il database vero sia
// collegato — mostra i dati grezzi così come arrivano, senza vestirli
// con la grafica delle altre schermate (quelle restano sui dati finti
// finché non decidiamo insieme come unire le due cose).
// Quali case hanno davvero un codice leggibile dalla fotocamera, e quante
// cifre aspettarsi nel numero certificato — verificato guardando come fa
// un'app vera dello stesso tipo (CertCheck), non inventato.
const CERT_INFO = {
  PSA: { hasCode: true, digits: [7, 9], hint: 'Il numero è davanti, in un angolo. Il codice a barre/QR è di solito sul RETRO — girala. Solo le slab dal 2020 in poi hanno il QR: se è più vecchia, niente scansione, solo il numero a mano.' },
  CGC: { hasCode: true, digits: [8, 10], hint: 'Numero e QR sono di solito entrambi sull\u2019etichetta davanti.' },
  BGS: { hasCode: true, digits: [10, 10], hint: 'Numero e codice sono di solito entrambi sull\u2019etichetta davanti, vicino ai voti. Fondo argentato: più difficile da leggere, prova buona luce diretta senza riflessi.' },
  TAG: { hasCode: true, digits: [6, 10], hint: 'Ha un QR code E un numero seriale verticale con anche lettere, vicino al QR. Se il QR non basta, prova "Numero a mano" per il seriale.', defaultBarcode: true, alphanumeric: true },
};

function ScanView({ onBack, onDetected }) {
  const [company, setCompany] = useState(null);
  const [mode, setMode] = useState(null); // barcode | text
  const [hintOpen, setHintOpen] = useState(true);

  if (!company) {
    return (
      <div style={{ height: '100%', background: C.ink, position: 'relative' }}>
        <GridTexture />
        <div style={{ position: 'relative', padding: '18px 16px' }}>
          <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
          <div className="tk-display" style={{ color: C.paper, fontSize: 18, fontWeight: 700, marginTop: 20 }}>Che casa di gradazione?</div>
          <div className="tk-body" style={{ color: C.mist, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
            Solo PSA e CGC mettono un codice leggibile dalla fotocamera sulla slab — le altre no, lo verifica anche CertCheck, un'app dello stesso tipo. Selezionando la casa, ti porto dritto al metodo giusto invece di farti provare a caso.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
            {Object.keys(CERT_INFO).map((co) => (
              <button key={co} onClick={() => { setCompany(co); setMode(CERT_INFO[co].defaultBarcode ? 'barcode' : 'text'); }} className="tk-body" style={{
                ...PANEL, borderRadius: 12, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.paper, fontSize: 14, fontWeight: 600,
              }}>
                {co}
                <span className="tk-mono" style={{ color: C.mist, fontSize: 10.5, fontWeight: 400 }}>{CERT_INFO[co].digits[0]}-{CERT_INFO[co].digits[1]} cifre</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const info = CERT_INFO[company];
  return (
    <div style={{ height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 16px', zIndex: 3, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setCompany(null)} style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div style={{ display: 'flex', gap: 6 }}>
          <Chip active={mode === 'barcode'} onClick={() => setMode('barcode')}>Codice a barre</Chip>
          <Chip active={mode === 'text'} onClick={() => setMode('text')}>Numero a mano</Chip>
        </div>
      </div>
      {hintOpen && (
        <div onClick={() => setHintOpen(false)} style={{ position: 'absolute', top: 62, left: 16, right: 16, zIndex: 3, background: 'rgba(0,0,0,0.75)', border: `1px solid ${C.gold}`, borderRadius: 10, padding: 12, cursor: 'pointer' }}>
          <div className="tk-body" style={{ color: C.paper, fontSize: 11.5, lineHeight: 1.5 }}>{company}: {info.hint}</div>
          <div className="tk-body" style={{ color: C.mist, fontSize: 9.5, marginTop: 4 }}>tocca per chiudere</div>
        </div>
      )}
      {mode === 'barcode' ? <BarcodeScanMode onDetected={onDetected} /> : <TextScanMode onDetected={onDetected} certInfo={info} />}
    </div>
  );
}

function BarcodeScanMode({ onDetected }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | scanning | error
  const [error, setError] = useState('');
  const [restartTick, setRestartTick] = useState(0);

  useEffect(() => {
    let active = true;
    const reader = new BrowserMultiFormatReader();
    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoRef.current,
      (result) => {
        if (!active || !result) return;
        active = false;
        onDetected(result.getText());
      }
    ).then(() => { if (active) setStatus('scanning'); })
      .catch((e) => { if (active) { setStatus('error'); setError(e.message || String(e)); } });
    return () => { active = false; try { reader.reset(); } catch (e) {} };
  }, [restartTick, onDetected]);

  return (
    <>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {status === 'starting' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="tk-body" style={{ color: C.paper, fontSize: 13 }}>Avvio fotocamera...</span></div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="tk-body" style={{ color: C.paper, fontSize: 12.5, textAlign: 'center', lineHeight: 1.6 }}>Non riesco ad accedere alla fotocamera.<br /><span style={{ color: C.mist, fontSize: 11 }}>{error}</span></div>
        </div>
      )}
      {status === 'scanning' && (
        <>
          <div style={{ position: 'absolute', top: '32%', left: '15%', right: '15%', bottom: '42%', border: `2px solid ${C.gold}`, borderRadius: 12, boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
          <div style={{ position: 'absolute', bottom: 110, left: 0, right: 0, textAlign: 'center' }}><span className="tk-mono" style={{ color: C.gold, fontSize: 11, background: 'rgba(0,0,0,0.6)', padding: '5px 14px', borderRadius: 20 }}>● lettura attiva — cerca in automatico</span></div>
          <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => setRestartTick((t) => t + 1)} style={{ width: 72, height: 72, borderRadius: '50%', background: C.vermillion, border: `4px solid ${C.paper}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Riavvia se bloccata"><ScanLine size={26} color={C.paper} /></button>
          </div>
        </>
      )}
    </>
  );
}

function TextScanMode({ onDetected, certInfo }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | ready | error
  const [error, setError] = useState('');
  const [ocr, setOcr] = useState({ phase: 'idle', text: '', candidates: [] }); // idle | working | done

  useEffect(() => {
    let active = true;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        return videoRef.current.play();
      })
      .then(() => { if (active) setStatus('ready'); })
      .catch((e) => { if (active) { setStatus('error'); setError(e.message || String(e)); } });
    return () => { active = false; if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); };
  }, []);

  function toGrayscaleVariant(baseCanvas, threshold) {
    // parte sempre dalla STESSA foto, cambia solo come viene preparata:
    // threshold=null lascia i grigi naturali; un numero applica una
    // soglia bianco/nero diversa — livelli diversi di contrasto possono
    // far leggere meglio o peggio la stessa identica immagine.
    const canvas = document.createElement('canvas');
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseCanvas, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const gray = img.data[i] * 0.3 + img.data[i + 1] * 0.59 + img.data[i + 2] * 0.11;
      const val = threshold === null ? gray : (gray > threshold ? 255 : 0);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  async function readFromCanvas(canvas) {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    await worker.setParameters({ tessedit_char_whitelist: '0123456789 .', tessedit_pageseg_mode: '11' });
    const { data } = await worker.recognize(canvas);
    await worker.terminate();
    const groups = (data.text || '').split(/[^0-9]+/).filter(Boolean);
    const [minLen, maxLen] = certInfo ? certInfo.digits : [0, 99];
    const goodMatch = groups.find((g) => g.length >= minLen && g.length <= maxLen);
    return goodMatch || groups.sort((a, b) => b.length - a.length)[0] || '';
  }

  async function readWithOcrSpace(base64Image) {
    const key = 'K84416916188957'; // chiave OCR.space
    if (!key) return null;
    const form = new FormData();
    form.append('apikey', key);
    form.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
    form.append('OCREngine', '3'); // il più adatto a cifre singole e sfondi difficili (es. l'argentato BGS)
    form.append('scale', 'true'); // ingrandimento interno, utile su foto piccole
    form.append('detectOrientation', 'true'); // ruota da sola il testo in verticale (serve per TAG)
    const resp = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
    const json = await resp.json();
    return json?.ParsedResults?.[0]?.ParsedText || '';
  }

  async function readWithGoogleVision(base64Image) {
    const key = ''; // <- incolla qui la tua chiave Google Cloud Vision, quando l'hai
    if (!key) return null; // nessuna chiave configurata: si passa a Tesseract sotto
    const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: base64Image }, features: [{ type: 'TEXT_DETECTION' }] }] }),
    });
    const json = await resp.json();
    return json?.responses?.[0]?.fullTextAnnotation?.text || '';
  }

  function extractBestDigitGroup(rawText) {
    // TAG ha un seriale con anche lettere — per le altre case restano solo
    // cifre, come prima. Il separatore tra gruppi resta lo spazio/a-capo,
    // così non si incollano insieme testi vicini ma diversi come già
    // successo con voto+certificato.
    const pattern = certInfo && certInfo.alphanumeric ? /[^A-Za-z0-9]+/ : /[^0-9]+/;
    const groups = (rawText || '').split(pattern).filter(Boolean);
    const [minLen, maxLen] = certInfo ? certInfo.digits : [0, 99];
    const goodMatch = groups.find((g) => g.length >= minLen && g.length <= maxLen);
    return goodMatch || groups.sort((a, b) => b.length - a.length)[0] || '';
  }

  async function captureAndRead() {
    setOcr({ phase: 'working', text: '', candidates: [] });
    const video = videoRef.current;
    const scale = 2;
    const base = document.createElement('canvas');
    base.width = video.videoWidth * scale;
    base.height = video.videoHeight * scale;
    base.getContext('2d').drawImage(video, 0, 0, base.width, base.height);

    // Prova prima OCR.space (gratis, nessuna carta, pensato apposta per
    // sfondi difficili come quello argentato delle BGS). Se non è
    // configurata una chiave, prova Google Vision. Se nessuna delle due
    // chiavi è impostata, si passa a Tesseract più sotto — sempre gratis.
    try {
      const base64 = base.toDataURL('image/jpeg', 0.9).split(',')[1];
      const ocrSpaceText = await readWithOcrSpace(base64);
      if (ocrSpaceText !== null) {
        setOcr({ phase: 'done', text: extractBestDigitGroup(ocrSpaceText), candidates: [] });
        return;
      }
      const googleText = await readWithGoogleVision(base64);
      if (googleText !== null) {
        setOcr({ phase: 'done', text: extractBestDigitGroup(googleText), candidates: [] });
        return;
      }
    } catch (e) { /* se il motore online fallisce per qualunque motivo, prosegue con Tesseract sotto */ }

    // Tesseract, con le quattro varianti di prima — resta il piano B
    // gratuito, sempre disponibile senza nessuna chiave.
    const variants = [120, 140, 165, null].map((t) => toGrayscaleVariant(base, t));
    const results = [];
    try {
      for (const v of variants) results.push(await readFromCanvas(v));
    } catch (e) { /* prosegue con quello che è riuscito a leggere finora */ }

    const counts = {};
    for (const r of results) if (r) counts[r] = (counts[r] || 0) + 1;
    const majority = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];

    if (majority && counts[majority] >= 2) {
      setOcr({ phase: 'done', text: majority, candidates: [] });
    } else {
      const unique = [...new Set(results.filter(Boolean))];
      setOcr({ phase: 'done', text: unique[0] || '', candidates: unique });
    }
  }

  const lenOk = !certInfo || (ocr.text.length >= certInfo.digits[0] && ocr.text.length <= certInfo.digits[1]);

  return (
    <>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {status === 'starting' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="tk-body" style={{ color: C.paper, fontSize: 13 }}>Avvio fotocamera...</span></div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="tk-body" style={{ color: C.paper, fontSize: 12.5, textAlign: 'center', lineHeight: 1.6 }}>Non riesco ad accedere alla fotocamera.<br /><span style={{ color: C.mist, fontSize: 11 }}>{error}</span></div>
        </div>
      )}
      {status === 'ready' && (
        <>
          <div style={{ position: 'absolute', top: '38%', left: '10%', right: '10%', height: 70, border: `2px dashed ${C.gold}88`, borderRadius: 10 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.75)', padding: '16px 20px calc(24px + env(safe-area-inset-bottom))' }}>
            {ocr.phase === 'idle' && (
              <button onClick={captureAndRead} className="tk-body" style={{ width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', background: C.vermillion, color: C.paper, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Fotografa e leggi il numero</button>
            )}
            {ocr.phase === 'working' && (
              <div className="tk-body" style={{ color: C.paper, fontSize: 13, textAlign: 'center', padding: '13px 0' }}>Analizzo la foto in più modi...</div>
            )}
            {ocr.phase === 'done' && (
              <div>
                <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginBottom: 6 }}>
                  {ocr.candidates.length > 1
                    ? 'Letture diverse tra loro, non sono sicuro — tocca quella giusta o correggi a mano:'
                    : !ocr.text ? 'Non sono riuscito a leggere nulla — scrivilo tu:'
                    : lenOk ? 'Più letture della stessa foto coincidevano — controlla e conferma:'
                    : `Ha letto ${ocr.text.length} cifre, ma ${certInfo ? `di solito sono ${certInfo.digits[0]}-${certInfo.digits[1]}` : 'sembrano poche'} — probabile lettura sbagliata, correggi prima di confermare:`}
                </div>
                {ocr.candidates.length > 1 && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    {ocr.candidates.map((c) => (
                      <button key={c} onClick={() => setOcr({ ...ocr, text: c })} className="tk-mono" style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${C.line}`, background: c === ocr.text ? C.gold : C.ink2, color: c === ocr.text ? C.ink : C.paper, fontSize: 13, cursor: 'pointer' }}>{c}</button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={ocr.text} onChange={(e) => setOcr({ ...ocr, text: (certInfo && certInfo.alphanumeric ? e.target.value.replace(/[^A-Za-z0-9]/g, '') : e.target.value.replace(/[^0-9]/g, '')) })} inputMode={certInfo && certInfo.alphanumeric ? 'text' : 'numeric'} pattern={certInfo && certInfo.alphanumeric ? undefined : '[0-9]*'} className="tk-mono"
                    style={{ flex: 1, background: C.ink2, border: `1px solid ${lenOk ? C.gold : C.vermillion}`, borderRadius: 10, padding: '10px 12px', color: C.paper, fontSize: 14, outline: 'none' }} />
                  <button onClick={() => ocr.text.trim() && onDetected(ocr.text.trim())} className="tk-body" style={{ padding: '0 18px', borderRadius: 10, border: 'none', background: C.gold, color: C.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Conferma</button>
                </div>
                <div onClick={() => setOcr({ phase: 'idle', text: '', candidates: [] })} className="tk-body" style={{ color: C.mist, fontSize: 11, marginTop: 10, textAlign: 'center', cursor: 'pointer', textDecoration: 'underline' }}>riprova la foto</div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
function ScanResultView({ code, onBack, onScanAgain }) {
  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div style={{ marginTop: 30, textAlign: 'center' }}>
          <CheckCircle2 size={40} color={C.jade} />
          <div className="tk-display" style={{ color: C.paper, fontSize: 18, fontWeight: 700, marginTop: 12 }}>Codice letto</div>
          <div className="tk-mono" style={{ color: C.gold, fontSize: 18, fontWeight: 700, marginTop: 10, wordBreak: 'break-all' }}>{code}</div>
        </div>
        <div style={{ ...PANEL, borderRadius: 12, padding: 16, marginTop: 26 }}>
          <div className="tk-body" style={{ color: C.mist, fontSize: 12, lineHeight: 1.6 }}>
            La lettura funziona davvero — questo è il codice vero appena letto dalla fotocamera.
            Il collegamento automatico a PSA/BGS/CGC per capire a quale carta corrisponde non è ancora
            costruito — è il prossimo pezzo separato di cui parlavamo.
          </div>
        </div>
        <button onClick={onScanAgain} className="tk-body" style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 10, cursor: 'pointer', border: `1px solid ${C.gold}`, background: `${C.gold}22`, color: C.gold, fontWeight: 600, fontSize: 13 }}>
          Scansiona un'altra carta
        </button>
      </div>
    </div>
  );
}

function RealCardRow({ card, onOpen }) {
  return (
    <div onClick={() => onOpen(card)} className="tk-rise" style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10 }}>
      <div style={{ width: 46 }}><CardArt hue={(card.tcgdex_id.length * 37) % 360} label={(card.name_en || card.name || '?').slice(0, 2)} imageUrl={card.image_url} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tk-body" style={{ color: C.paper, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name_en || card.name}</div>
        <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.set_name || card.set_code} {card.rarity ? `· ${card.rarity}` : ''}</div>
      </div>
      {!card.tcgdex_id.startsWith('yuyu-') && <span title="Abbinata a catalogo" style={{ flexShrink: 0 }}><CheckCircle2 size={14} color={C.jade} /></span>}
    </div>
  );
}

function RealBrowseView({ onOpenCard, onScan, onManualCode }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'loading', cards: [], error: null });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');

  useEffect(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(() => {
      searchRealCards(query)
        .then((cards) => setState({ status: 'ok', cards, error: null }))
        .catch((error) => setState({ status: 'error', cards: [], error: error.message || String(error) }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 8px' }}>
        <TopBar title="Toreka" subtitle="トレカ ・ catalogo reale" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px' }}>
            <Search size={15} color={C.mist} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca tra le carte vere..." className="tk-body"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: C.paper, fontSize: 13.5, width: '100%' }} />
          </div>
          <button onClick={onScan} style={{ width: 38, height: 38, borderRadius: 10, background: C.vermillion, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} title="Scansiona una carta gradata"><ScanLine size={17} color={C.paper} /></button>
        </div>
        {!manualOpen ? (
          <div onClick={() => setManualOpen(true)} className="tk-body" style={{ color: C.mist, fontSize: 11, marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }}>
            oppure inserisci il numero certificato a mano
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Numero certificato (es. 0018299244)" className="tk-mono"
              style={{ flex: 1, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px', color: C.paper, fontSize: 13, outline: 'none' }} />
            <button onClick={() => { if (manualValue.trim()) { onManualCode(manualValue.trim()); setManualValue(''); setManualOpen(false); } }} className="tk-body" style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: C.gold, color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Vai</button>
          </div>
        )}
      </div>
      <div style={{ position: 'relative', padding: '10px 16px 90px' }}>
        {state.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 20 }}>Cerco...</div>}
        {state.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 10, padding: 12 }}>{state.error}</div>}
        {state.status === 'ok' && (
          <>
            <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginBottom: 8 }}>{state.cards.length} risultati {!query && '(ultime aggiunte — scrivi per cercare tra tutte)'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {state.cards.map((c) => <RealCardRow key={c.tcgdex_id} card={c} onOpen={onOpenCard} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RealCardDetail({ card, onBack, currency, collection = [], toggleCollection }) {
  const [state, setState] = useState({ status: 'loading', prices: [], error: null });
  useEffect(() => {
    fetchCardPrices(card.tcgdex_id)
      .then((prices) => setState({ status: 'ok', prices, error: null }))
      .catch((error) => setState({ status: 'error', prices: [], error: error.message || String(error) }));
  }, [card.tcgdex_id]);
  const inColl = collection.includes(card.tcgdex_id);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div className="tk-body" style={{ color: C.mist, fontSize: 11.5 }}>{card.set_name || card.set_code} {card.local_id ? `· ${card.local_id}` : ''}</div>
      </div>
      <div className="tk-rise" style={{ position: 'relative', padding: '10px 16px 0' }}>
        <div style={{ width: 130, margin: '0 auto' }}><CardArt hue={(card.tcgdex_id.length * 37) % 360} label={(card.name_en || card.name || '?').slice(0, 2)} imageUrl={card.image_url} /></div>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="tk-display" style={{ color: C.paper, fontSize: 19, fontWeight: 700 }}>{card.name_en || card.name}</div>
          {card.name_en && card.name !== card.name_en && <div className="tk-body" style={{ color: C.mist, fontSize: 12, marginTop: 2 }}>{card.name}</div>}
          {card.tcgdex_id.startsWith('yuyu-') && (
            <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 8, fontStyle: 'italic' }}>Non ancora abbinata a un catalogo — nome originale dalla fonte.</div>
          )}
        </div>
        <button onClick={() => toggleCollection(card.tcgdex_id)} className="tk-body" style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${inColl ? C.jade : C.line}`, background: inColl ? `${C.jade}1A` : C.ink2, color: inColl ? C.jade : C.paper }}>
          {inColl ? <Check size={15} /> : <Plus size={15} />}<span style={{ fontWeight: 600, fontSize: 13 }}>{inColl ? 'Nella tua collezione' : 'Aggiungi alla collezione'}</span>
        </button>
        <div style={{ marginTop: 22, marginBottom: 90 }}>
          <div className="tk-mono" style={{ color: C.gold, fontSize: 10.5, letterSpacing: 1.5, marginBottom: 8, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>PREZZI OSSERVATI</div>
          {state.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Carico...</div>}
          {state.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12 }}>{state.error}</div>}
          {state.status === 'ok' && state.prices.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Nessun prezzo registrato per questa carta.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.prices.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <PlatformPill name={p.source} />
                    <span className="tk-mono" style={{ color: C.mist, fontSize: 10 }}>{p.grade_company ? `${p.grade_company} ${p.grade}` : 'raw'}</span>
                    <span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{new Date(p.observed_at).toLocaleDateString('it-IT')}</span>
                  </div>
                  <div style={{ marginTop: 4 }}>{p.confirmed ? <ConfirmedSeal /> : <span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>prezzo di listino</span>}</div>
                </div>
                <span className="tk-mono" style={{ color: C.paper, fontSize: 14, fontWeight: 700 }}>{fmtFrom(p.price, p.currency, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DbTestView() {
  const [state, setState] = useState({ status: 'loading', cards: [], prices: [], cardsCount: 0, pricesCount: 0, error: null });
  useEffect(() => {
    fetchRawCards()
      .then(({ cards, prices, cardsCount, pricesCount }) => setState({ status: 'ok', cards, prices, cardsCount, pricesCount, error: null }))
      .catch((error) => setState({ status: 'error', cards: [], prices: [], cardsCount: 0, pricesCount: 0, error: error.message || String(error) }));
  }, []);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <TopBar title="Test database" subtitle="dati reali, non ancora vestiti" />
        {state.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 13, marginTop: 30, textAlign: 'center' }}>Sto leggendo dal database...</div>}
        {state.status === 'error' && (
          <div className="tk-body" style={{ color: C.vermillion, fontSize: 12.5, marginTop: 30, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 10, padding: 14, lineHeight: 1.5 }}>
            Qualcosa non ha funzionato: <br /><span className="tk-mono" style={{ fontSize: 11 }}>{state.error}</span>
          </div>
        )}
        {state.status === 'ok' && (
          <div style={{ marginTop: 16 }}>
            <div className="tk-body" style={{ color: C.jade, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              Collegato! {state.cardsCount.toLocaleString('it-IT')} carte totali, {state.pricesCount.toLocaleString('it-IT')} prezzi totali nel database.
            </div>
            <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginBottom: 12 }}>
              Qui sotto solo un campione di {state.cards.length} — mostrarle tutte in un elenco non sarebbe comunque leggibile.
            </div>
            {state.cardsCount === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Il database risponde ma è vuoto — manca ancora l'INSERT di prova (o i dati veri).</div>}
            {state.cards.map((c) => (
              <div key={c.tcgdex_id} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div className="tk-body" style={{ color: C.paper, fontWeight: 600, fontSize: 13 }}>{c.name} {c.name_en && `(${c.name_en})`}</div>
                <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginTop: 2 }}>{c.set_name} · {c.rarity} · {c.lang}</div>
                {state.prices.filter((p) => p.tcgdex_id === c.tcgdex_id).map((p) => (
                  <div key={p.id} className="tk-mono" style={{ color: C.gold, fontSize: 12, marginTop: 6 }}>
                    {p.source} · {p.grade_company ?? 'raw'} {p.grade ?? ''} · {p.price} {p.currency}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioView({ collection, onRemove, onOpenCard, currency }) {
  const [state, setState] = useState({ status: 'loading', cards: [] });
  useEffect(() => {
    if (!collection.length) { setState({ status: 'ok', cards: [] }); return; }
    setState((s) => ({ ...s, status: 'loading' }));
    fetchCardsByIds(collection)
      .then((cards) => setState({ status: 'ok', cards }))
      .catch((error) => setState({ status: 'error', cards: [], error: error.message || String(error) }));
  }, [collection]);

  const total = state.cards.reduce((sum, c) => sum + (c.latestPrice ? c.latestPrice.price / (RATES[c.latestPrice.currency] ?? 1) : 0), 0);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <TopBar title="Portfolio" subtitle="la tua collezione" />
        <div className="tk-rise" style={{ ...PANEL, ...topAccent(C.gold), borderRadius: 14, padding: 16, marginTop: 16 }}>
          <span className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1.5 }}>VALORE TOTALE</span>
          <div className="tk-mono" style={{ color: C.paper, fontSize: 28, fontWeight: 700, marginTop: 4 }}>{fmtConverted(total * RATES[currency], currency)}</div>
          <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginTop: 2 }}>{collection.length} {collection.length === 1 ? 'carta' : 'carte'} in collezione · valore in base all'ultimo prezzo osservato</div>
        </div>
        {state.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, marginTop: 16 }}>{state.error}</div>}
        {state.status === 'ok' && collection.length === 0 && (
          <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 60, lineHeight: 1.6 }}>La tua collezione è vuota.<br />Aggiungi una carta dalla sua scheda.</div>
        )}
        {state.status === 'ok' && collection.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {state.cards.map((c) => (
              <div key={c.tcgdex_id} onClick={() => onOpenCard(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10, cursor: 'pointer' }}>
                <div style={{ width: 44 }}><CardArt hue={(c.tcgdex_id.length * 37) % 360} label={(c.name_en || c.name || '?').slice(0, 2)} imageUrl={c.image_url} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tk-body" style={{ color: C.paper, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name_en || c.name}</div>
                  <div className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{c.latestPrice ? `${c.latestPrice.grade_company ? c.latestPrice.grade_company + ' ' + c.latestPrice.grade : 'raw'} · ${c.latestPrice.source}` : 'nessun prezzo osservato'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tk-mono" style={{ color: C.paper, fontSize: 13, fontWeight: 700 }}>{c.latestPrice ? fmtFrom(c.latestPrice.price, c.latestPrice.currency, currency) : '—'}</div>
                  <button onClick={(ev) => { ev.stopPropagation(); onRemove(c.tcgdex_id); }} className="tk-body" style={{ background: 'none', border: 'none', color: C.vermillion, fontSize: 10, cursor: 'pointer', marginTop: 3, padding: 0 }}>rimuovi</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PriceChart({ cardId, edition, company, grade, mult, currency, range, setRange, setCurrency }) {
  const fullSeries = useMemo(() => buildSeries(edition.basePrice, edition.drift, seedFor(cardId, edition.lang)), [cardId, edition]);
  const sliced = useMemo(() => (range === 'all' ? fullSeries : fullSeries.slice(-(range + 1))), [fullSeries, range]);
  const spansYears = sliced[0]?.date.getFullYear() !== sliced[sliced.length - 1]?.date.getFullYear();
  const chartData = sliced.map((pt, i) => ({ i, date: pt.date, price: pt.price * mult * RATES[currency] }));
  const rangeChangePct = ((chartData[chartData.length - 1].price - chartData[0].price) / chartData[0].price) * 100;
  const tickEvery = Math.max(1, Math.floor(chartData.length / 5));
  return (
    <div style={{ background: C.ink2, border: `1px solid ${C.gold}88`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ background: C.ink3, padding: '6px 14px', display: 'flex', justifyContent: 'space-between' }}>
        <span className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1.5 }}>PREZZO · {company} {GRADE_SCALES[company].find(x => x.g === grade)?.label}</span>
        <span className="tk-mono" style={{ color: rangeChangePct >= 0 ? C.jade : C.vermillion, fontSize: 10.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>{rangeChangePct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{Math.abs(rangeChangePct).toFixed(1)}%</span>
      </div>
      <div style={{ padding: '10px 14px 4px' }} className="tk-mono"><span style={{ color: C.paper, fontSize: 26, fontWeight: 700 }}>{fmtConverted(chartData[chartData.length - 1].price, currency)}</span></div>
      <div style={{ height: 128, padding: '0 4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 6, right: 12, bottom: 4, left: 0 }}>
            <XAxis dataKey="i" tickLine={false} axisLine={{ stroke: C.line }} interval={tickEvery - 1} tick={{ fill: C.mist, fontSize: 9.5, fontFamily: 'Space Mono' }} tickFormatter={(i) => fmtDate(chartData[i]?.date, spansYears)} />
            <YAxis hide domain={[(dataMin) => dataMin - Math.abs(dataMin) * 0.04, (dataMax) => dataMax + Math.abs(dataMax) * 0.04]} />
            <Tooltip cursor={{ stroke: C.gold, strokeWidth: 1, strokeDasharray: '3 3' }} contentStyle={{ background: C.ink3, border: `1px solid ${C.line}`, borderRadius: 8, fontSize: 11 }} labelFormatter={(i) => fmtDate(chartData[i]?.date, true)} formatter={(v) => [fmtConverted(v, currency), `${company} ${grade}`]} />
            <Line type="monotone" dataKey="price" stroke={rangeChangePct >= 0 ? C.jade : C.vermillion} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="tk-hscroll" style={{ display: 'flex', gap: 6, padding: '6px 14px 2px', overflowX: 'auto' }}>{RANGES.map((r) => <Chip key={r.k} active={r.k === range} onClick={() => setRange(r.k)}>{r.l}</Chip>)}</div>
      <div className="tk-hscroll" style={{ display: 'flex', gap: 6, padding: '2px 14px 10px', overflowX: 'auto' }}>{Object.keys(SYMBOLS).map((cur) => <Chip key={cur} active={cur === currency} onClick={() => setCurrency(cur)}>{cur}</Chip>)}</div>
      <div className="tk-body" style={{ color: C.mist, fontSize: 9.5, padding: '0 14px 10px', borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>Stima per {company} {GRADE_SCALES[company].find(x => x.g === grade)?.label}, calcolata dal prezzo di riferimento — non un prezzo osservato direttamente per ogni grado e ogni giorno.</div>
    </div>
  );
}

function DetailView({ card, onBack, currency, setCurrency, collection, toggleCollection }) {
  const [editionLang, setEditionLang] = useState(card.editions[0].lang);
  const [company, setCompany] = useState('PSA');
  const [grade, setGrade] = useState(10);
  const [range, setRange] = useState(90);
  const edition = card.editions.find((e) => e.lang === editionLang) || card.editions[0];
  const mult = MULT[company][grade] ?? 1;
  const gradeLabel = GRADE_SCALES[company].find((x) => x.g === grade)?.label ?? String(grade);
  const exactSales = edition.sales.filter((s) => s.co === company && s.g === grade);
  const showFallback = exactSales.length === 0;
  const salesToShow = showFallback ? edition.sales : exactSales;
  const inColl = collection.some((e) => e.cardId === card.id && e.lang === editionLang && e.company === company && e.grade === grade);

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div className="tk-body" style={{ color: C.mist, fontSize: 11.5 }}>{edition.set} · {edition.num}</div>
      </div>
      <div className="tk-rise" style={{ position: 'relative', padding: '10px 16px 0' }}>
        <div style={{ width: 130, margin: '0 auto', position: 'relative' }}>
          <CardArt hue={(card.id * 47) % 360} label={edition.name} imageUrl={edition.imageUrl} />
        </div>

        {/* Ristampe / lingue — stile Cardmarket: stessa carta, edizioni diverse */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {card.editions.map((e) => (
            <button key={e.lang} onClick={() => setEditionLang(e.lang)} className="tk-body" style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, padding: '5px 11px', borderRadius: 20, cursor: 'pointer', fontWeight: 600,
              border: `1px solid ${e.lang === editionLang ? C.teal : C.line}`,
              background: e.lang === editionLang ? `${C.teal}22` : C.ink2,
              color: e.lang === editionLang ? C.teal : C.mist,
            }}>
              <Globe2 size={12} /> {e.lang} · {LANG_LABEL[e.lang]}
            </button>
          ))}
        </div>
        {card.editions.length === 1 && (
          <div className="tk-body" style={{ textAlign: 'center', color: C.mist, fontSize: 10.5, marginTop: 6, fontStyle: 'italic' }}>
            Nessuna ristampa nota in altre lingue — pare essere un'esclusiva {LANG_LABEL[card.editions[0].lang]}.
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="tk-display" style={{ color: C.paper, fontSize: 19, fontWeight: 700 }}>{edition.name}</div>
          {edition.gloss && <div className="tk-body" style={{ color: C.mist, fontSize: 12, marginTop: 2 }}>{edition.gloss} · {card.rarity}</div>}
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center' }}><GradeSlab co={company} label={gradeLabel} size="lg" /></div>
        </div>

        <button onClick={() => toggleCollection(card.id, editionLang, company, grade)} className="tk-body" style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${inColl ? C.jade : C.line}`, background: inColl ? `${C.jade}1A` : C.ink2, color: inColl ? C.jade : C.paper }}>
          {inColl ? <Check size={15} /> : <Plus size={15} />}<span style={{ fontWeight: 600, fontSize: 13 }}>{inColl ? 'Nella tua collezione' : 'Aggiungi alla collezione'}</span>
        </button>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>{Object.keys(GRADE_SCALES).map((co) => (
            <button key={co} onClick={() => { setCompany(co); setGrade(GRADE_SCALES[co][0].g); }} className="tk-mono" style={{ flex: 1, fontSize: 11.5, padding: '7px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700, border: `1px solid ${co === company ? C.gold : C.line}`, background: co === company ? C.ink3 : C.ink2, color: co === company ? C.gold : C.mist }}>{co}</button>
          ))}</div>
          <div className="tk-hscroll" style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>{GRADE_SCALES[company].map((gr) => <Chip key={gr.g} active={gr.g === grade} onClick={() => setGrade(gr.g)}>{gr.label}</Chip>)}</div>
        </div>
        <div style={{ marginTop: 14 }}><PriceChart cardId={card.id} edition={edition} company={company} grade={grade} mult={mult} currency={currency} setCurrency={setCurrency} range={range} setRange={setRange} /></div>
        <div style={{ marginTop: 22, marginBottom: 90 }}>
          <div className="tk-mono" style={{ color: C.gold, fontSize: 10.5, letterSpacing: 1.5, marginBottom: 8, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>ULTIMI VENDUTI CONFERMATI</div>
          {showFallback && <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginBottom: 8, fontStyle: 'italic' }}>Nessuna vendita confermata registrata per {company} {gradeLabel} su questa carta — ecco le vendite recenti agli altri gradi.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {salesToShow.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px' }}>
                <div><div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><PlatformPill name={s.pf} /><span className="tk-mono" style={{ color: C.mist, fontSize: 10 }}>{s.co} {GRADE_SCALES[s.co].find(x => x.g === s.g)?.label ?? s.g}</span><span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{s.date}</span></div><div style={{ marginTop: 4 }}><ConfirmedSeal /></div></div>
                <span className="tk-mono" style={{ color: C.paper, fontSize: 14, fontWeight: 700 }}>{fmt(s.price, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BottomNav({ view, onNav }) {
  const items = [{ k: 'home', icon: Home, label: 'Home' }, { k: 'browse', icon: Search, label: 'Cerca' }, { k: 'portfolio', icon: Wallet, label: 'Portfolio' }, { k: 'profile', icon: User, label: 'Test DB' }];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.ink, borderTop: `1px solid ${C.line}`, display: 'flex', padding: '10px 6px 14px' }}>
      {items.map((it) => { const active = view === it.k; return (
        <div key={it.k} onClick={() => onNav(it.k)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
          <it.icon size={19} color={active ? C.gold : C.mist} strokeWidth={active ? 2.4 : 1.8} />
          <span className="tk-body" style={{ fontSize: 9.5, color: active ? C.gold : C.mist }}>{it.label}</span>
        </div>
      ); })}
    </div>
  );
}

/* ---------------------------------------------------------
   App
---------------------------------------------------------- */
export default function TorekaPrototype() {
  const [view, setView] = useState('home');
  const [navKey, setNavKey] = useState('home');
  const [selected, setSelected] = useState(null);
  const [selectedReal, setSelectedReal] = useState(null);
  const [scannedCode, setScannedCode] = useState(null);
  const [article, setArticle] = useState(null);
  const [currency, setCurrency] = useState('JPY');
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    try { const saved = localStorage.getItem('toreka_collection'); setCollection(saved ? JSON.parse(saved) : []); } catch (e) { setCollection([]); }
    try { const saved = localStorage.getItem('toreka_recent_searches'); setRecentSearches(saved ? JSON.parse(saved) : []); } catch (e) { setRecentSearches([]); }
  }, []);

  function persistCollection(next) { setCollection(next); try { localStorage.setItem('toreka_collection', JSON.stringify(next)); } catch (e) {} }
  function persistRecent(next) { setRecentSearches(next); try { localStorage.setItem('toreka_recent_searches', JSON.stringify(next)); } catch (e) {} }
  function toggleCollection(tcgdexId) {
    const exists = collection.includes(tcgdexId);
    const next = exists ? collection.filter((id) => id !== tcgdexId) : [...collection, tcgdexId];
    persistCollection(next);
  }
  function commitSearch(q) { const term = q.trim(); if (!term) return; const next = [term, ...recentSearches.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 6); persistRecent(next); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CARDS;
    return CARDS.filter((c) => c.editions.some((e) =>
      e.name.toLowerCase().includes(q) || (e.gloss || '').toLowerCase().includes(q) || e.set.toLowerCase().includes(q)
    ));
  }, [query]);

  function nav(k) { setNavKey(k); setView(k); }
  function openCard(c) { setSelected(c); setView('detail'); }
  function openRealCard(c) { setSelectedReal(c); setView('realdetail'); }
  function openArticle(a) { setArticle(a); setView('article'); }

  let screen;
  if (view === 'home') screen = <HomeView onOpenCard={openCard} onOpenArticle={openArticle} onGoBrowse={() => nav('browse')} onOpenRealCard={openRealCard} />;
  else if (view === 'browse') screen = <RealBrowseView onOpenCard={openRealCard} onScan={() => setView('scan')} onManualCode={(code) => { setScannedCode(code); setView('scanresult'); }} />;
  else if (view === 'scan') screen = <ScanView onBack={() => setView(navKey)} onDetected={(code) => { setScannedCode(code); setView('scanresult'); }} />;
  else if (view === 'scanresult') screen = <ScanResultView code={scannedCode} onBack={() => setView(navKey)} onScanAgain={() => setView('scan')} />;
  else if (view === 'realdetail') screen = <RealCardDetail key={selectedReal?.tcgdex_id} card={selectedReal} onBack={() => setView(navKey)} currency={currency} collection={collection} toggleCollection={toggleCollection} />;
  else if (view === 'detail') screen = <DetailView key={selected?.id} card={selected} onBack={() => setView(navKey)} currency={currency} setCurrency={setCurrency} collection={collection} toggleCollection={toggleCollection} />;
  else if (view === 'article') screen = <ArticleView key={article?.id} item={article} onBack={() => setView(navKey)} />;
  else if (view === 'portfolio') screen = <PortfolioView collection={collection} onRemove={(id) => toggleCollection(id)} onOpenCard={openRealCard} currency={currency} />;
  else screen = <DbTestView />;

  return (
    <div className="tk-body" style={{ minHeight: '100vh', background: '#0B0A08', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 12px' }}>
      {FONTS}
      <div style={{ width: 390, height: 760, background: C.ink, borderRadius: 34, border: `10px solid #050403`, position: 'relative', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{screen}</div>
          <BottomNav view={navKey} onNav={nav} />
        </div>
      </div>
    </div>
  );
}
