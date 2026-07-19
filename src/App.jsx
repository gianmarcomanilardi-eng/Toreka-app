import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search, ChevronLeft, Home, User, Wallet, TrendingUp, TrendingDown,
  CheckCircle2, ScanLine, Youtube, Quote, ArrowRight, Sparkles, Plus, Check, Clock, Globe2, X, Star
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { fetchRawCards, searchRealCards, fetchCardPrices, fetchFeaturedRealCards, fetchCardsByIds, fetchPortfolioHistory, fetchAllSets, fetchCardsBySet } from './supabaseClient.js';

/* ---------------------------------------------------------
   Design tokens
---------------------------------------------------------- */
const C = {
  ink: '#1D1E22', ink2: '#292B31', ink3: '#34363E', line: '#3A3D45',
  vermillion: '#FF4732', gold: '#E8B84B', jade: '#2ED573', teal: '#35C4B8',
  paper: '#F7F2E7', mist: '#A89D8C',
};
const PANEL = { background: C.ink2, border: `1px solid ${C.line}55`, boxShadow: '0 10px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)' };
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
const RATES = { JPY: 1, USD: 1 / 155.2, EUR: 1 / 168.4, CNY: 1 / 21.6, HKD: 1 / 20.0 };
const SYMBOLS = { JPY: '¥', USD: '$', EUR: '€', CNY: 'CN¥', HKD: 'HK$' };

// nomi delle SPECIE Pokemon (non delle carte — quelli sono troppi,
// questi sono un numero fisso, circa 1000 in tutto). Serve per cercare
// su eBay/PokeTrace anche le carte salvate solo in giapponese, che
// altrimenti non troverebbero mai nulla (eBay è scritto in inglese).
// Copertura onesta: Generazione 1 completa + leggendari principali di
// tutte le generazioni — non ancora tutte le ~1000 specie esistenti.
const JP_POKEMON_SPECIES = {
  'フシギダネ': 'Bulbasaur',
  'フシギソウ': 'Ivysaur',
  'フシギバナ': 'Venusaur',
  'ヒトカゲ': 'Charmander',
  'リザード': 'Charmeleon',
  'リザードン': 'Charizard',
  'ゼニガメ': 'Squirtle',
  'カメール': 'Wartortle',
  'カメックス': 'Blastoise',
  'キャタピー': 'Caterpie',
  'トランセル': 'Metapod',
  'バタフリー': 'Butterfree',
  'ビードル': 'Weedle',
  'コクーン': 'Kakuna',
  'スピアー': 'Beedrill',
  'ポッポ': 'Pidgey',
  'ピジョン': 'Pidgeotto',
  'ピジョット': 'Pidgeot',
  'コラッタ': 'Rattata',
  'ラッタ': 'Raticate',
  'オニスズメ': 'Spearow',
  'オニドリル': 'Fearow',
  'アーボ': 'Ekans',
  'アーボック': 'Arbok',
  'ピカチュウ': 'Pikachu',
  'ライチュウ': 'Raichu',
  'サンド': 'Sandshrew',
  'サンドパン': 'Sandslash',
  'ニドラン♀': 'Nidoran-F',
  'ニドリーナ': 'Nidorina',
  'ニドクイン': 'Nidoqueen',
  'ニドラン♂': 'Nidoran-M',
  'ニドリーノ': 'Nidorino',
  'ニドキング': 'Nidoking',
  'ピッピ': 'Clefairy',
  'ピクシー': 'Clefable',
  'ロコン': 'Vulpix',
  'キュウコン': 'Ninetales',
  'プリン': 'Jigglypuff',
  'プクリン': 'Wigglytuff',
  'ズバット': 'Zubat',
  'ゴルバット': 'Golbat',
  'ナゾノクサ': 'Oddish',
  'クサイハナ': 'Gloom',
  'ラフレシア': 'Vileplume',
  'パラス': 'Paras',
  'パラセクト': 'Parasect',
  'コンパン': 'Venonat',
  'モルフォン': 'Venomoth',
  'ディグダ': 'Diglett',
  'ダグトリオ': 'Dugtrio',
  'ニャース': 'Meowth',
  'ペルシアン': 'Persian',
  'コダック': 'Psyduck',
  'ゴルダック': 'Golduck',
  'マンキー': 'Mankey',
  'オコリザル': 'Primeape',
  'ガーディ': 'Growlithe',
  'ウインディ': 'Arcanine',
  'ニョロモ': 'Poliwag',
  'ニョロゾ': 'Poliwhirl',
  'ニョロボン': 'Poliwrath',
  'ケーシィ': 'Abra',
  'ユンゲラー': 'Kadabra',
  'フーディン': 'Alakazam',
  'ワンリキー': 'Machop',
  'ゴーリキー': 'Machoke',
  'カイリキー': 'Machamp',
  'マダツボミ': 'Bellsprout',
  'ウツドン': 'Weepinbell',
  'ウツボット': 'Victreebel',
  'メノクラゲ': 'Tentacool',
  'ドククラゲ': 'Tentacruel',
  'イシツブテ': 'Geodude',
  'ゴローン': 'Graveler',
  'ゴローニャ': 'Golem',
  'ポニータ': 'Ponyta',
  'ギャロップ': 'Rapidash',
  'ヤドン': 'Slowpoke',
  'ヤドラン': 'Slowbro',
  'コイル': 'Magnemite',
  'レアコイル': 'Magneton',
  'カモネギ': "Farfetch'd",
  'ドードー': 'Doduo',
  'ドードリオ': 'Dodrio',
  'パウワウ': 'Seel',
  'ジュゴン': 'Dewgong',
  'ベトベター': 'Grimer',
  'ベトベトン': 'Muk',
  'シェルダー': 'Shellder',
  'パルシェン': 'Cloyster',
  'ゴース': 'Gastly',
  'ゴースト': 'Haunter',
  'ゲンガー': 'Gengar',
  'イワーク': 'Onix',
  'スリープ': 'Drowzee',
  'スリーパー': 'Hypno',
  'クラブ': 'Krabby',
  'キングラー': 'Kingler',
  'ビリリダマ': 'Voltorb',
  'マルマイン': 'Electrode',
  'タマタマ': 'Exeggcute',
  'ナッシー': 'Exeggutor',
  'カラカラ': 'Cubone',
  'ガラガラ': 'Marowak',
  'サワムラー': 'Hitmonlee',
  'エビワラー': 'Hitmonchan',
  'ベロリンガ': 'Lickitung',
  'ドガース': 'Koffing',
  'マタドガス': 'Weezing',
  'サイホーン': 'Rhyhorn',
  'サイドン': 'Rhydon',
  'ラッキー': 'Chansey',
  'モンジャラ': 'Tangela',
  'ガルーラ': 'Kangaskhan',
  'タッツー': 'Horsea',
  'シードラ': 'Seadra',
  'トサキント': 'Goldeen',
  'アズマオウ': 'Seaking',
  'ヒトデマン': 'Staryu',
  'スターミー': 'Starmie',
  'バリヤード': 'Mr. Mime',
  'ストライク': 'Scyther',
  'ルージュラ': 'Jynx',
  'エレブー': 'Electabuzz',
  'ブーバー': 'Magmar',
  'カイロス': 'Pinsir',
  'ケンタロス': 'Tauros',
  'コイキング': 'Magikarp',
  'ギャラドス': 'Gyarados',
  'ラプラス': 'Lapras',
  'メタモン': 'Ditto',
  'イーブイ': 'Eevee',
  'シャワーズ': 'Vaporeon',
  'サンダース': 'Jolteon',
  'ブースター': 'Flareon',
  'ポリゴン': 'Porygon',
  'オムナイト': 'Omanyte',
  'オムスター': 'Omastar',
  'カブト': 'Kabuto',
  'カブトプス': 'Kabutops',
  'プテラ': 'Aerodactyl',
  'カビゴン': 'Snorlax',
  'フリーザー': 'Articuno',
  'サンダー': 'Zapdos',
  'ファイヤー': 'Moltres',
  'ミニリュウ': 'Dratini',
  'ハクリュー': 'Dragonair',
  'カイリュー': 'Dragonite',
  'ミュウツー': 'Mewtwo',
  'ミュウ': 'Mew',
  'ホウオウ': 'Ho-Oh',
  'ルギア': 'Lugia',
  'セレビィ': 'Celebi',
  'ジラーチ': 'Jirachi',
  'デオキシス': 'Deoxys',
  'レックウザ': 'Rayquaza',
  'カイオーガ': 'Kyogre',
  'グラードン': 'Groudon',
  'ディアルガ': 'Dialga',
  'パルキア': 'Palkia',
  'ギラティナ': 'Giratina',
  'アルセウス': 'Arceus',
  'ダークライ': 'Darkrai',
  'ゼクロム': 'Zekrom',
  'レシラム': 'Reshiram',
  'キュレム': 'Kyurem',
  'ゼルネアス': 'Xerneas',
  'イベルタル': 'Yveltal',
  'チコリータ': 'Chikorita',
  'ベイリーフ': 'Bayleef',
  'メガニウム': 'Meganium',
  'ヒノアラシ': 'Cyndaquil',
  'マグマラシ': 'Quilava',
  'バクフーン': 'Typhlosion',
  'ワニノコ': 'Totodile',
  'アリゲイツ': 'Croconaw',
  'オーダイル': 'Feraligatr',
  'オタチ': 'Sentret',
  'オオタチ': 'Furret',
  'ホーホー': 'Hoothoot',
  'ヨルノズク': 'Noctowl',
  'レディバ': 'Ledyba',
  'レディアン': 'Ledian',
  'イトマル': 'Spinarak',
  'アリアドス': 'Ariados',
  'クロバット': 'Crobat',
  'チョンチー': 'Chinchou',
  'ランターン': 'Lanturn',
  'ピチュー': 'Pichu',
  'ピィ': 'Cleffa',
  'ププリン': 'Igglybuff',
  'トゲピー': 'Togepi',
  'トゲチック': 'Togetic',
  'ネイティ': 'Natu',
  'ネイティオ': 'Xatu',
  'メリープ': 'Mareep',
  'モココ': 'Flaaffy',
  'デンリュウ': 'Ampharos',
  'キレイハナ': 'Bellossom',
  'マリル': 'Marill',
  'マリルリ': 'Azumarill',
  'ウソッキー': 'Sudowoodo',
  'ニョロトノ': 'Politoed',
  'ハネッコ': 'Hoppip',
  'ポポッコ': 'Skiploom',
  'ワタッコ': 'Jumpluff',
  'エイパム': 'Aipom',
  'ヒマナッツ': 'Sunkern',
  'キマワリ': 'Sunflora',
  'ヤンヤンマ': 'Yanma',
  'ウパー': 'Wooper',
  'ヌオー': 'Quagsire',
  'エーフィ': 'Espeon',
  'ブラッキー': 'Umbreon',
  'ヤミカラス': 'Murkrow',
  'ヤドキング': 'Slowking',
  'ムウマ': 'Misdreavus',
  'アンノーン': 'Unown',
  'ソーナンス': 'Wobbuffet',
  'キリンリキ': 'Girafarig',
  'クヌギダマ': 'Pineco',
  'フォレトス': 'Forretress',
  'ノコッチ': 'Dunsparce',
  'グライガー': 'Gligar',
  'ハガネール': 'Steelix',
  'ブルー': 'Snubbull',
  'グランブル': 'Granbull',
  'ハリーセン': 'Qwilfish',
  'ハッサム': 'Scizor',
  'ツボツボ': 'Shuckle',
  'ヘラクロス': 'Heracross',
  'ニューラ': 'Sneasel',
  'ヒメグマ': 'Teddiursa',
  'リングマ': 'Ursaring',
  'マグマッグ': 'Slugma',
  'マグカルゴ': 'Magcargo',
  'ウリムー': 'Swinub',
  'イノムー': 'Piloswine',
  'サニーゴ': 'Corsola',
  'テッポウオ': 'Remoraid',
  'オクタン': 'Octillery',
  'デリバード': 'Delibird',
  'マンタイン': 'Mantine',
  'エアームド': 'Skarmory',
  'デルビル': 'Houndour',
  'ヘルガー': 'Houndoom',
  'キングドラ': 'Kingdra',
  'ゴマゾウ': 'Phanpy',
  'ドンファン': 'Donphan',
  'ポリゴン2': 'Porygon2',
  'オドシシ': 'Stantler',
  'ドーブル': 'Smeargle',
  'バルキー': 'Tyrogue',
  'カポエラー': 'Hitmontop',
  'ムチュール': 'Smoochum',
  'エレキッド': 'Elekid',
  'ブビィ': 'Magby',
  'ミルタンク': 'Miltank',
  'ハピナス': 'Blissey',
  'ライコウ': 'Raikou',
  'エンテイ': 'Entei',
  'スイクン': 'Suicune',
  'ヨーギラス': 'Larvitar',
  'サナギラス': 'Pupitar',
  'バンギラス': 'Tyranitar',
  'キモリ': 'Treecko',
  'ジュプトル': 'Grovyle',
  'ジュカイン': 'Sceptile',
  'アチャモ': 'Torchic',
  'ワカシャモ': 'Combusken',
  'バシャーモ': 'Blaziken',
  'ミズゴロウ': 'Mudkip',
  'ヌマクロー': 'Marshtomp',
  'ラグラージ': 'Swampert',
  'ジグザグマ': 'Zigzagoon',
  'マッスグマ': 'Linoone',
  'ケムッソ': 'Wurmple',
  'カラサリス': 'Silcoon',
  'アゲハント': 'Beautifly',
  'マユルド': 'Cascoon',
  'ドクケイル': 'Dustox',
  'ハスボー': 'Lotad',
  'ハスブレロ': 'Lombre',
  'ルンパッパ': 'Ludicolo',
  'タネボー': 'Seedot',
  'コノハナ': 'Nuzleaf',
  'ダーテング': 'Shiftry',
  'スバメ': 'Taillow',
  'オオスバメ': 'Swellow',
  'キャモメ': 'Wingull',
  'ペリッパー': 'Pelipper',
  'ラルトス': 'Ralts',
  'キルリア': 'Kirlia',
  'サーナイト': 'Gardevoir',
  'アメタマ': 'Surskit',
  'アメモース': 'Masquerain',
  'キノココ': 'Shroomish',
  'キノガッサ': 'Breloom',
  'ナマケロ': 'Slakoth',
  'ヤルキモノ': 'Vigoroth',
  'ケッキング': 'Slaking',
  'ツチニン': 'Nincada',
  'テッカニン': 'Ninjask',
  'ヌケニン': 'Shedinja',
  'ゴニョニョ': 'Whismur',
  'ドゴーム': 'Loudred',
  'バクオング': 'Exploud',
  'マクノシタ': 'Makuhita',
  'ハリテヤマ': 'Hariyama',
  'ルリリ': 'Azurill',
  'ノズパス': 'Nosepass',
  'エネコ': 'Skitty',
  'エネコロロ': 'Delcatty',
  'ヤミラミ': 'Sableye',
  'クチート': 'Mawile',
  'ココドラ': 'Aron',
  'コドラ': 'Lairon',
  'ボスゴドラ': 'Aggron',
  'アサナン': 'Meditite',
  'チャーレム': 'Medicham',
  'ラクライ': 'Electrike',
  'ライボルト': 'Manectric',
  'プラスル': 'Plusle',
  'マイナン': 'Minun',
  'バルビート': 'Volbeat',
  'イルミーゼ': 'Illumise',
  'ロゼリア': 'Roselia',
  'ゴクリン': 'Gulpin',
  'マルノーム': 'Swalot',
  'キバニア': 'Carvanha',
  'サメハダー': 'Sharpedo',
  'ホエルコ': 'Wailmer',
  'ホエルオー': 'Wailord',
  'ドンメル': 'Numel',
  'バクーダ': 'Camerupt',
  'コータス': 'Torkoal',
  'バネブー': 'Spoink',
  'ブーピッグ': 'Grumpig',
  'パッチール': 'Spinda',
  'ナックラー': 'Trapinch',
  'ビブラーバ': 'Vibrava',
  'フライゴン': 'Flygon',
  'サボネア': 'Cacnea',
  'ノクタス': 'Cacturne',
  'チルット': 'Swablu',
  'チルタリス': 'Altaria',
  'ザングース': 'Zangoose',
  'ハブネーク': 'Seviper',
  'ルナトーン': 'Lunatone',
  'ソルロック': 'Solrock',
  'ドジョッチ': 'Barboach',
  'ナマズン': 'Whiscash',
  'ヘイガニ': 'Corphish',
  'シザリガー': 'Crawdaunt',
  'ヤジロン': 'Baltoy',
  'ネンドール': 'Claydol',
  'リリーラ': 'Lileep',
  'ユレイドル': 'Cradily',
  'アノプス': 'Anorith',
  'アーマルド': 'Armaldo',
  'ヒンバス': 'Feebas',
  'ミロカロス': 'Milotic',
  'ポワルン': 'Castform',
  'カクレオン': 'Kecleon',
  'カゲボウズ': 'Duskull',
  'ジュペッタ': 'Banette',
  'ヨマワル': 'Duskull',
  'サマヨール': 'Dusclops',
  'トロピウス': 'Tropius',
  'ミナモ': 'Chimecho',
  'チリーン': 'Chingling',
  'アブソル': 'Absol',
  'ソーナノ': 'Wynaut',
  'ユキワラシ': 'Snorunt',
  'オニゴーリ': 'Glalie',
  'タマザラシ': 'Spheal',
  'トドグラー': 'Sealeo',
  'トドゼルガ': 'Walrein',
  'パールル': 'Clamperl',
  'ハンテール': 'Huntail',
  'サクラビス': 'Gorebyss',
  'ジーランス': 'Relicanth',
  'ラブカス': 'Luvdisc',
  'タツベイ': 'Bagon',
  'コモルー': 'Shelgon',
  'ボーマンダ': 'Salamence',
  'ダンバル': 'Beldum',
  'メタング': 'Metang',
  'メタグロス': 'Metagross',
  'レジロック': 'Regirock',
  'レジアイス': 'Regice',
  'レジスチル': 'Registeel',
  'ラティアス': 'Latias',
  'ラティオス': 'Latios',
  'ナエトル': 'Turtwig',
  'ハヤシガメ': 'Grotle',
  'ドダイトス': 'Torterra',
  'ヒコザル': 'Chimchar',
  'モウカザル': 'Monferno',
  'ゴウカザル': 'Infernape',
  'ポッチャマ': 'Piplup',
  'ポッタイシ': 'Prinplup',
  'エンペルト': 'Empoleon',
  'ムックル': 'Starly',
  'ムクバード': 'Staravia',
  'ムクホーク': 'Staraptor',
  'ビッパ': 'Bidoof',
  'ビーダル': 'Bibarel',
  'コロボーシ': 'Kricketot',
  'コロトック': 'Kricketune',
  'コリンク': 'Shinx',
  'ルクシオ': 'Luxio',
  'レントラー': 'Luxray',
  'スボミー': 'Budew',
  'ロズレイド': 'Roserade',
  'ズガイドス': 'Cranidos',
  'トリデプス': 'Rampardos',
  'タテトプス': 'Shieldon',
  'ヒポポタス': 'Hippopotas',
  'カバルドン': 'Hippowdon',
  'スカンプー': 'Skorupi',
  'スコルピ': 'Skorupi',
  'ドラピオン': 'Drapion',
  'グレッグル': 'Croagunk',
  'ドクロッグ': 'Toxicroak',
  'マスキッパ': 'Carnivine',
  'ケイコウオ': 'Finneon',
  'ネオラント': 'Lumineon',
  'チェリンボ': 'Cherubi',
  'チェリム': 'Cherrim',
  'カラナクシ': 'Shellos',
  'トリトドン': 'Gastrodon',
  'エテボース': 'Ambipom',
  'フワンテ': 'Drifloon',
  'フワライド': 'Drifblim',
  'ミミロル': 'Buneary',
  'ミミロップ': 'Lopunny',
  'ムウマージ': 'Mismagius',
  'ドンカラス': 'Honchkrow',
  'ニャルマー': 'Glameow',
  'ブニャット': 'Purugly',
  'リーシャン': 'Chingling',
  'スカタンク': 'Stunky',
  'タブンネ': 'Audino',
  'ドーミラー': 'Duosion',
  'ドータクン': 'Bronzong',
  'ウソハチ': 'Munchlax',
  'マニューラ': 'Weavile',
  'ジバコイル': 'Magnezone',
  'ベロベルト': 'Lickilicky',
  'ドサイドン': 'Rhyperior',
  'モジャンボ': 'Tangrowth',
  'エレキブル': 'Electivire',
  'ブーバーン': 'Magmortar',
  'トゲキッス': 'Togekiss',
  'メガヤンマ': 'Yanmega',
  'リーフィア': 'Leafeon',
  'グレイシア': 'Glaceon',
  'グライオン': 'Gliscor',
  'マンムー': 'Mamoswine',
  'ポリゴンZ': 'Porygon-Z',
  'エルレイド': 'Gallade',
  'ダイノーズ': 'Probopass',
  'ヨノワール': 'Dusknoir',
  'ユキメノコ': 'Froslass',
  'ロトム': 'Rotom',
  'ユクシー': 'Uxie',
  'エムリット': 'Mesprit',
  'アグノム': 'Azelf',
  'ヒードラン': 'Heatran',
  'レジギガス': 'Regigigas',
  'クレセリア': 'Cresselia',
  'フィオネ': 'Phione',
  'マナフィ': 'Manaphy',
  'シェイミ': 'Shaymin',
  'ツタージャ': 'Snivy',
  'ジャノビー': 'Servine',
  'ジャローダ': 'Serperior',
  'ポカブ': 'Tepig',
  'チャオブー': 'Pignite',
  'エンブオー': 'Emboar',
  'ミジュマル': 'Oshawott',
  'フタチマル': 'Dewott',
  'ダイケンキ': 'Samurott',
  'ミネズミ': 'Patrat',
  'ミルホッグ': 'Watchog',
  'ヨーテリー': 'Lillipup',
  'ハーデリア': 'Herdier',
  'ムーランド': 'Stoutland',
  'チョロネコ': 'Purrloin',
  'レパルダス': 'Liepard',
  'ヤナップ': 'Pansage',
  'ヤナッキー': 'Simisage',
  'バオップ': 'Pansear',
  'バオッキー': 'Simisear',
  'ヒヤップ': 'Panpour',
  'ヒヤッキー': 'Simipour',
  'ムンナ': 'Munna',
  'ムシャーナ': 'Musharna',
  'マメパト': 'Pidove',
  'ハトーボー': 'Tranquill',
  'ケンホロウ': 'Unfezant',
  'シママ': 'Blitzle',
  'ゼブライカ': 'Zebstrika',
  'ダンゴロ': 'Roggenrola',
  'ガントル': 'Boldore',
  'ギガイアス': 'Gigalith',
  'コロモリ': 'Woobat',
  'ココロモリ': 'Swoobat',
  'モグリュー': 'Drilbur',
  'ドリュウズ': 'Excadrill',
  'ドッコラー': 'Timburr',
  'ドテッコツ': 'Gurdurr',
  'ローブシン': 'Conkeldurr',
  'オタマロ': 'Tympole',
  'ガマガル': 'Palpitoad',
  'ガマゲロゲ': 'Seismitoad',
  'ナゲキ': 'Throh',
  'ダゲキ': 'Sawk',
  'クルミル': 'Sewaddle',
  'クルマユ': 'Swadloon',
  'ハハコモリ': 'Leavanny',
  'フシデ': 'Venipede',
  'ホイーガ': 'Whirlipede',
  'ペンドラー': 'Scolipede',
  'モンメン': 'Cottonee',
  'エルフーン': 'Whimsicott',
  'チュリネ': 'Petilil',
  'ドレディア': 'Lilligant',
  'バスラオ': 'Basculin',
  'メグロコ': 'Sandile',
  'ワルビル': 'Krokorok',
  'ワルビアル': 'Krookodile',
  'ダルマッカ': 'Darumaka',
  'ヒヒダルマ': 'Darmanitan',
  'マラカッチ': 'Maractus',
  'イシズマイ': 'Dwebble',
  'イワパレス': 'Crustle',
  'ズルッグ': 'Scraggy',
  'ズルズキン': 'Scrafty',
  'シンボラー': 'Sigilyph',
  'デスマス': 'Yamask',
  'デスカーン': 'Cofagrigus',
  'プロトーガ': 'Tirtouga',
  'アバゴーラ': 'Carracosta',
  'アーケン': 'Archen',
  'アーケオス': 'Archeops',
  'ヤブクロン': 'Trubbish',
  'ダストダス': 'Garbodor',
  'ゾロア': 'Zorua',
  'ゾロアーク': 'Zoroark',
  'チラーミィ': 'Minccino',
  'チラチーノ': 'Cinccino',
  'ゴチム': 'Gothita',
  'ゴチミル': 'Gothorita',
  'ゴチルゼル': 'Gothitelle',
  'ユニラン': 'Solosis',
  'ダブラン': 'Duosion',
  'ランクルス': 'Reuniclus',
  'コアルヒー': 'Ducklett',
  'スワンナ': 'Swanna',
  'バニプッチ': 'Vanillite',
  'バニリッチ': 'Vanillish',
  'バイバニラ': 'Vanilluxe',
  'シキジカ': 'Deerling',
  'メブキジカ': 'Sawsbuck',
  'エモンガ': 'Emolga',
  'カブルモ': 'Karrablast',
  'シュバルゴ': 'Escavalier',
  'タマゲタケ': 'Foongus',
  'モロバレル': 'Amoonguss',
  'アイアント': 'Durant',
  'バチュル': 'Joltik',
  'デンチュラ': 'Galvantula',
  'テッシード': 'Ferroseed',
  'ナットレイ': 'Ferrothorn',
  'ギアル': 'Klink',
  'ギギアル': 'Klang',
  'ギギギアル': 'Klinklang',
  'シビシラス': 'Tynamo',
  'シビビール': 'Eelektrik',
  'シビルドン': 'Eelektross',
  'リグレー': 'Elgyem',
  'オーベム': 'Beheeyem',
  'ヒトモシ': 'Litwick',
  'ランプラー': 'Lampent',
  'シャンデラ': 'Chandelure',
  'キバゴ': 'Axew',
  'オノンド': 'Fraxure',
  'オノノクス': 'Haxorus',
  'クマシュン': 'Cubchoo',
  'ツンベアー': 'Beartic',
  'フリージオ': 'Cryogonal',
  'チョボマキ': 'Shelmet',
  'アギルダー': 'Accelgor',
  'タマンタ': 'Mantyke',
  'ヌメラ': 'Goomy',
  'コジョフー': 'Pawniard',
  'コジョンド': 'Bisharp',
  'クリムガン': 'Druddigon',
  'ゴビット': 'Golett',
  'ゴルーグ': 'Golurk',
  'コマタナ': 'Pawniard',
  'ヴィブラーバ': 'Vibrava',
  'ダークトリニティ': 'Zoroark',
  'デスバーン': 'Cofagrigus',
  'メラルバ': 'Larvesta',
  'ウルガモス': 'Volcarona',
  'コバルオン': 'Cobalion',
  'テラキオン': 'Terrakion',
  'ビリジオン': 'Virizion',
  'トルネロス': 'Tornadus',
  'ボルトロス': 'Thundurus',
  'ランドロス': 'Landorus',
  'ケルディオ': 'Keldeo',
  'メロエッタ': 'Meloetta',
  'ゲノセクト': 'Genesect',
  'ハリマロン': 'Chespin',
  'ハリボーグ': 'Quilladin',
  'ブリガロン': 'Chesnaught',
  'フォッコ': 'Fennekin',
  'テールナー': 'Braixen',
  'マフォクシー': 'Delphox',
  'ケロマツ': 'Froakie',
  'ゲコガシラ': 'Frogadier',
  'ゲッコウガ': 'Greninja',
  'ニンフィア': 'Sylveon',
  'ジガルデ': 'Zygarde',
  'ディアンシー': 'Diancie',
  'フーパ': 'Hoopa',
  'ボルケニオン': 'Volcanion',
  'モクロー': 'Rowlet',
  'フクスロー': 'Dartrix',
  'ジュナイパー': 'Decidueye',
  'ニャビー': 'Litten',
  'ニャヒート': 'Torracat',
  'ガオガエン': 'Incineroar',
  'アシマリ': 'Popplio',
  'オシャマリ': 'Brionne',
  'アシレーヌ': 'Primarina',
  'ソルガレオ': 'Solgaleo',
  'ルナアーラ': 'Lunala',
  'ネクロズマ': 'Necrozma',
  'サルノリ': 'Grookey',
  'バチンキー': 'Thwackey',
  'ゴリランダー': 'Rillaboom',
  'ヒバニー': 'Scorbunny',
  'ラビフット': 'Raboot',
  'エースバーン': 'Cinderace',
  'メッソン': 'Sobble',
  'ジメレオン': 'Drizzile',
  'インテレオン': 'Inteleon',
  'ザシアン': 'Zacian',
  'ザマゼンタ': 'Zamazenta',
  'ムゲンダイナ': 'Eternatus',
  'ニャオハ': 'Sprigatito',
  'ホゲータ': 'Fuecoco',
  'クワッス': 'Quaxly',
  'コライドン': 'Koraidon',
  'ミライドン': 'Miraidon',
  'テラパゴス': 'Terapagos'
};
function extractEnglishSpeciesName(jpName) {
  if (!jpName) return null;
  for (const [jp, en] of Object.entries(JP_POKEMON_SPECIES)) {
    if (jpName.includes(jp)) return en;
  }
  return null;
}
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
// legge "1st Edition" / "Shadowless" dal nome della carta quando presente
// (es. "Charizard [1st Edition] #4") — se non c'è nessuna delle due
// diciture ma la carta è di un'era dove la distinzione esiste (WOTC),
// si intende Unlimited di default.
function detectEdition(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes('1st edition') || lower.includes('first edition')) return '1st Edition';
  if (lower.includes('shadowless')) return 'Shadowless';
  if (lower.includes('unlimited')) return 'Unlimited';
  return null;
}
function EditionPill({ name }) {
  const edition = detectEdition(name);
  if (!edition) return null;
  return <span className="tk-mono" style={{ fontSize: 9.5, color: C.teal, border: `1px solid ${C.teal}55`, borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap' }}>{edition}</span>;
}
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
  return <button onClick={onClick} className="tk-mono" style={{
    fontSize: 11, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', flexShrink: 0, fontWeight: 700, border: 'none',
    background: active ? `linear-gradient(180deg, ${C.gold}, #C99A2E)` : 'transparent',
    color: active ? C.ink : C.mist,
    boxShadow: active ? '0 3px 10px rgba(232,184,75,0.35), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none',
    transition: 'all 0.15s ease',
  }}>{children}</button>;
}
function SegmentTrack({ children }) {
  return <div className="tk-hscroll" style={{ display: 'inline-flex', gap: 2, padding: 4, borderRadius: 24, background: C.ink, border: `1px solid ${C.line}55`, boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.35)' }}>{children}</div>;
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
        {real.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12, textAlign: 'center', padding: 20 }}>Carico le carte...</div>}
        {real.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 14, padding: 12 }}>{real.error}</div>}
        {real.status === 'ok' && real.cards.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Nessuna carta trovata al momento.</div>}
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
          {INTERVIEWS.filter((it) => !it.comingSoon).map((it) => (
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
              <div key={i} style={{ background: C.ink3, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.gold}`, borderRadius: 14, padding: 16 }}>
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
  TAG: { hasCode: true, digits: [6, 10], hint: 'Il numero seriale verticale (con lettere) è accanto al QR — è quello che leggo qui. Se preferisci il QR, cambia in alto su "Codice a barre".', alphanumeric: true, vertical: true },
};

function ScanView({ onBack, onDetected, onRawCardFound }) {
  const [company, setCompany] = useState(null);
  const [mode, setMode] = useState(null); // barcode | text
  const [hintOpen, setHintOpen] = useState(true);

  if (company === 'RAW') {
    return (
      <div style={{ height: '100%', position: 'relative', background: '#000', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 16px', zIndex: 3 }}>
          <button onClick={() => setCompany(null)} style={{ background: 'rgba(0,0,0,0.55)', border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        </div>
        <RawCardScanMode onFound={onRawCardFound} />
      </div>
    );
  }

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
                ...PANEL, borderRadius: 16, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.paper, fontSize: 14, fontWeight: 600,
              }}>
                {co}
                <span className="tk-mono" style={{ color: C.mist, fontSize: 10.5, fontWeight: 400 }}>{CERT_INFO[co].digits[0]}-{CERT_INFO[co].digits[1]} cifre</span>
              </button>
            ))}
            {onRawCardFound && (
              <button onClick={() => setCompany('RAW')} className="tk-body" style={{
                ...PANEL, borderRadius: 16, padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.paper, fontSize: 14, fontWeight: 600, borderColor: C.teal,
              }}>
                Carta raw (senza gradazione)
                <span className="tk-mono" style={{ color: C.teal, fontSize: 9.5, fontWeight: 600 }}>NUOVO</span>
              </button>
            )}
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
        <div onClick={() => setHintOpen(false)} style={{ position: 'absolute', top: 62, left: 16, right: 16, zIndex: 3, background: 'rgba(0,0,0,0.75)', border: `1px solid ${C.gold}`, borderRadius: 14, padding: 12, cursor: 'pointer' }}>
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
          <div style={{ position: 'absolute', top: '32%', left: '15%', right: '15%', bottom: '42%', border: `2px solid ${C.gold}`, borderRadius: 16, boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)' }} />
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

  async function readWithGemini(base64Image) {
    try {
      const resp = await fetch('/api/gemini-vision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          prompt: 'Su questa slab di gradazione, leggi SOLO il numero di certificato/seriale (può essere in verticale, può contenere lettere). Rispondi con SOLO quel codice, niente altro testo, nessuna spiegazione.',
        }),
      });
      if (!resp.ok) return null; // errore vero: passa al motore dopo, non fermarti qui
      const { text } = await resp.json();
      return typeof text === 'string' ? text : null;
    } catch (e) { return null; }
  }

  async function readWithClaude(base64Image) {
    const key = ''; // <- incolla qui la tua chiave API Anthropic, quando l'hai
    if (!key) return null;
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
              { type: 'text', text: 'Su questa slab di gradazione, leggi SOLO il numero di certificato/seriale (può essere in verticale, può contenere lettere). Rispondi con SOLO quel codice, niente altro testo, nessuna spiegazione.' },
            ],
          }],
        }),
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      const text = json?.content?.[0]?.text;
      return typeof text === 'string' ? text : null;
    } catch (e) { return null; }
  }

  async function readWithOcrSpace(base64Image) {
    const key = 'K84416916188957'; // chiave OCR.space
    if (!key) return null;
    try {
      const form = new FormData();
      form.append('apikey', key);
      form.append('base64Image', `data:image/jpeg;base64,${base64Image}`);
      form.append('OCREngine', '3'); // il più adatto a cifre singole e sfondi difficili (es. l'argentato BGS)
      form.append('scale', 'true'); // ingrandimento interno, utile su foto piccole
      form.append('detectOrientation', 'true'); // ruota da sola il testo in verticale (serve per TAG)
      const resp = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (json?.IsErroredOnProcessing) return null; // OCR.space segnala l'errore così, non con lo status HTTP
      const text = json?.ParsedResults?.[0]?.ParsedText;
      return typeof text === 'string' ? text : null;
    } catch (e) { return null; }
  }

  async function readWithGoogleVision(base64Image) {
    const key = ''; // <- incolla qui la tua chiave Google Cloud Vision, quando l'hai
    if (!key) return null; // nessuna chiave configurata: si passa a Tesseract sotto
    try {
      const resp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: [{ image: { content: base64Image }, features: [{ type: 'TEXT_DETECTION' }] }] }),
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      if (json?.responses?.[0]?.error) return null;
      const text = json?.responses?.[0]?.fullTextAnnotation?.text;
      return typeof text === 'string' ? text : null;
    } catch (e) { return null; }
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

    // Prova prima Gemini (visione vera, gratis, sganciato da Anthropic —
    // quello che avevi chiesto). Poi Claude se hai comunque messo una
    // chiave. Poi OCR.space (gratis, nessuna carta). Poi Google Vision se
    // configurato. Tesseract resta sempre come ultima riserva gratuita.
    try {
      const base64 = base.toDataURL('image/jpeg', 0.9).split(',')[1];
      const geminiText = await readWithGemini(base64);
      if (geminiText !== null) {
        setOcr({ phase: 'done', text: extractBestDigitGroup(geminiText), candidates: [] });
        return;
      }
      const claudeText = await readWithClaude(base64);
      if (claudeText !== null) {
        setOcr({ phase: 'done', text: extractBestDigitGroup(claudeText), candidates: [] });
        return;
      }
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
          {certInfo && certInfo.vertical ? (
            <>
              <div style={{ position: 'absolute', top: '30%', bottom: '35%', right: '20%', width: 36, border: `2px dashed ${C.gold}88`, borderRadius: 8 }} />
              <div style={{ position: 'absolute', top: '20%', left: 0, right: 0, textAlign: 'center' }}>
                <span className="tk-body" style={{ color: C.paper, fontSize: 11, background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 14 }}>Solo indicativo — inquadra tutta l'etichetta, va bene anche se non centri il riquadro</span>
              </div>
            </>
          ) : (
            <div style={{ position: 'absolute', top: '38%', left: '10%', right: '10%', height: 70, border: `2px dashed ${C.gold}88`, borderRadius: 14 }} />
          )}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.75)', padding: '16px 20px calc(24px + env(safe-area-inset-bottom))' }}>
            {ocr.phase === 'idle' && (
              <button onClick={captureAndRead} className="tk-body" style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: C.vermillion, color: C.paper, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Fotografa e leggi il numero</button>
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
                    style={{ flex: 1, background: C.ink2, border: `1px solid ${lenOk ? C.gold : C.vermillion}`, borderRadius: 14, padding: '10px 12px', color: C.paper, fontSize: 14, outline: 'none' }} />
                  <button onClick={() => ocr.text.trim() && onDetected(ocr.text.trim())} className="tk-body" style={{ padding: '0 18px', borderRadius: 14, border: 'none', background: C.gold, color: C.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Conferma</button>
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
function RawCardScanMode({ onFound }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | ready | error
  const [error, setError] = useState('');
  const [ocr, setOcr] = useState({ phase: 'idle', candidates: [], readText: '' }); // idle | working | done | notfound

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

  async function readCardWithGemini(base64Image) {
    const resp = await fetch('/api/gemini-vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        image: base64Image,
        prompt: 'Questa è una carta Pokémon (non una slab gradata). Leggi il nome della carta stampato in alto, e se visibile il nome del set/espansione. Rispondi SOLO con "Nome Carta - Nome Set" (usa il set solo se lo leggi con certezza, altrimenti solo il nome carta), niente altro testo.',
      }),
    });
    if (!resp.ok) throw new Error(`Gemini ha risposto ${resp.status}`);
    const { text } = await resp.json();
    if (typeof text !== 'string' || !text.trim()) throw new Error('Nessun testo letto dalla carta');
    return text.trim();
  }

  async function capture() {
    setOcr({ phase: 'working', candidates: [], readText: '' });
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
      const readText = await readCardWithGemini(base64);
      const searchTerm = readText.split(' - ')[0].trim();
      const candidates = await searchRealCards(searchTerm, 8);
      setOcr({ phase: candidates.length ? 'done' : 'notfound', candidates, readText });
    } catch (e) {
      setOcr({ phase: 'notfound', candidates: [], readText: e.message || String(e) });
    }
  }

  return (
    <>
      {status === 'starting' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="tk-body" style={{ color: C.mist, fontSize: 13 }}>Apro la fotocamera...</span></div>}
      {status === 'error' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}><span className="tk-body" style={{ color: C.vermillion, fontSize: 12.5, textAlign: 'center' }}>{error}</span></div>}
      <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {ocr.phase === 'idle' && status === 'ready' && (
        <div style={{ position: 'absolute', bottom: 26, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div className="tk-body" style={{ color: C.paper, fontSize: 11.5, background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 8 }}>Inquadra la carta, poi scatta — sperimentale, verifica sempre il risultato</div>
          <button onClick={capture} style={{ width: 62, height: 62, borderRadius: '50%', background: C.teal, border: `3px solid ${C.paper}`, cursor: 'pointer' }} />
        </div>
      )}
      {ocr.phase === 'working' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="tk-body" style={{ color: C.paper, fontSize: 13 }}>Leggo la carta...</span>
        </div>
      )}
      {(ocr.phase === 'done' || ocr.phase === 'notfound') && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: C.ink, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '60%', overflowY: 'auto' }}>
          <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginBottom: 8 }}>letto: "{ocr.readText}"</div>
          {ocr.phase === 'notfound' && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5 }}>Nessuna corrispondenza trovata nel catalogo — riprova con più luce o più vicino al nome della carta.</div>}
          {ocr.candidates.map((c) => (
            <div key={c.tcgdex_id} onClick={() => onFound(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ width: 36 }}><CardArt hue={(c.tcgdex_id.length * 37) % 360} label={(c.name_en || c.name || '?').slice(0, 2)} imageUrl={c.image_url} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tk-body" style={{ color: C.paper, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name_en || c.name}</div>
                <div className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{c.set_name}</div>
              </div>
            </div>
          ))}
          <button onClick={() => setOcr({ phase: 'idle', candidates: [], readText: '' })} className="tk-body" style={{ width: '100%', marginTop: 4, padding: '10px 0', borderRadius: 14, border: `1px solid ${C.line}`, background: 'transparent', color: C.mist, fontSize: 12.5, cursor: 'pointer' }}>Riprova</button>
        </div>
      )}
    </>
  );
}

function ScanResultView({ code, onBack, onScanAgain }) {
  const [lookup, setLookup] = useState({ status: 'loading', data: null, error: null });
  useEffect(() => {
    fetch(`/api/psa-cert?cert=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => setLookup({ status: data.error ? 'error' : 'ok', data, error: data.error || null }))
      .catch((error) => setLookup({ status: 'error', data: null, error: error.message || String(error) }));
  }, [code]);

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

        {lookup.status === 'loading' && (
          <div style={{ ...PANEL, borderRadius: 16, padding: 16, marginTop: 26, textAlign: 'center' }}>
            <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Cerco il certificato su PSA...</div>
          </div>
        )}
        {lookup.status === 'error' && (
          <div style={{ ...PANEL, borderRadius: 16, padding: 16, marginTop: 26 }}>
            <div className="tk-body" style={{ color: C.mist, fontSize: 12, lineHeight: 1.6 }}>
              {lookup.data?.notFound ? 'Nessun certificato PSA trovato con questo numero — controlla che sia stato letto giusto.' : `Non sono riuscito a controllare ora: ${lookup.error}`}
            </div>
          </div>
        )}
        {lookup.status === 'ok' && lookup.data?.cardName && (
          <>
            <div style={{ ...PANEL, borderRadius: 16, padding: 16, marginTop: 26 }}>
              <div className="tk-mono" style={{ color: C.gold, fontSize: 10, letterSpacing: 1.5, marginBottom: 6 }}>CARTA IDENTIFICATA</div>
              <div className="tk-body" style={{ color: C.paper, fontSize: 14, fontWeight: 600 }}>{lookup.data.cardName}</div>
              {lookup.data.grade && <div className="tk-body" style={{ color: C.mist, fontSize: 12, marginTop: 4 }}>Grado: {lookup.data.grade}</div>}
              {lookup.data.popHigher !== null && (
                <div className="tk-body" style={{ color: C.mist, fontSize: 11.5, marginTop: 4 }}>
                  {lookup.data.popHigher === 0
                    ? 'Il voto più alto mai assegnato a questa carta — nessuna copia superiore esistente'
                    : `${lookup.data.popHigher} copi${lookup.data.popHigher === 1 ? 'a' : 'e'} con voto più alto di questa esistono`}
                </div>
              )}
            </div>
            <div style={{ marginTop: 18 }}>
              <div className="tk-mono" style={{ color: C.gold, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>VENDITE COMPARABILI (STESSO GRADO)</div>
              {(!lookup.data.sales || lookup.data.sales.length === 0) && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Nessuna vendita comparabile trovata ora.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(lookup.data.sales || []).map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <PlatformPill name={s.platform} />
                        <span className="tk-mono" style={{ color: C.mist, fontSize: 10 }}>{s.grade}</span>
                        <span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{s.date}</span>
                      </div>
                      <div className="tk-body" style={{ color: C.mist, fontSize: 10, marginTop: 3 }}>{s.saleType}</div>
                    </div>
                    <span className="tk-mono" style={{ color: C.paper, fontSize: 14, fontWeight: 700 }}>${s.price.toLocaleString('en-US')}</span>
                  </div>
                ))}
              </div>
              <div className="tk-body" style={{ color: C.mist, fontSize: 9.5, marginTop: 8, fontStyle: 'italic' }}>dati dal certificato PSA ufficiale, letti ora — copre solo carte PSA per ora</div>
            </div>
          </>
        )}

        <button onClick={onScanAgain} className="tk-body" style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 14, cursor: 'pointer', border: `1px solid ${C.gold}`, background: `${C.gold}22`, color: C.gold, fontWeight: 600, fontSize: 13 }}>
          Scansiona un'altra carta
        </button>
      </div>
    </div>
  );
}

function RealCardRow({ card, onOpen }) {
  return (
    <div onClick={() => onOpen(card)} className="tk-rise" style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 10 }}>
      <div style={{ width: 46 }}><CardArt hue={(card.tcgdex_id.length * 37) % 360} label={(card.name_en || card.name || '?').slice(0, 2)} imageUrl={card.image_url} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tk-body" style={{ color: C.paper, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name_en || card.name}</div>
        <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.set_name || card.set_code} {card.rarity ? `· ${card.rarity}` : ''}</div>
      </div>
      {!card.tcgdex_id.startsWith('yuyu-') && <span title="Abbinata a catalogo" style={{ flexShrink: 0 }}><CheckCircle2 size={14} color={C.jade} /></span>}
    </div>
  );
}

function RealBrowseView({ onOpenCard, onScan, onManualCode, initialQuery, savedSearches = [], onToggleSaved }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [state, setState] = useState({ status: 'loading', cards: [], error: null });
  const [manualOpen, setManualOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [mode, setMode] = useState('search'); // 'search' | 'browse'
  const [setsState, setSetsState] = useState({ status: 'idle', sets: [] });
  const [activeSet, setActiveSet] = useState(null);
  const [setCardsState, setSetCardsState] = useState({ status: 'idle', cards: [] });

  useEffect(() => {
    setState((s) => ({ ...s, status: 'loading' }));
    const timer = setTimeout(() => {
      searchRealCards(query)
        .then((cards) => setState({ status: 'ok', cards, error: null }))
        .catch((error) => setState({ status: 'error', cards: [], error: error.message || String(error) }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (mode !== 'browse' || setsState.status !== 'idle') return;
    setSetsState({ status: 'loading', sets: [] });
    fetchAllSets()
      .then((sets) => setSetsState({ status: 'ok', sets }))
      .catch((error) => setSetsState({ status: 'error', sets: [], error: error.message || String(error) }));
  }, [mode]);

  useEffect(() => {
    if (!activeSet) return;
    setSetCardsState({ status: 'loading', cards: [] });
    fetchCardsBySet(activeSet)
      .then((cards) => setSetCardsState({ status: 'ok', cards }))
      .catch((error) => setSetCardsState({ status: 'error', cards: [], error: error.message || String(error) }));
  }, [activeSet]);

  const isSaved = query.trim() && savedSearches.some((s) => s.term.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 8px' }}>
        <TopBar title="Toreka" subtitle="トレカ ・ catalogo reale" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '9px 12px' }}>
            <Search size={15} color={C.mist} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca tra le carte vere..." className="tk-body"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: C.paper, fontSize: 13.5, width: '100%' }} />
          </div>
          {query.trim() && onToggleSaved && (
            <button onClick={() => onToggleSaved(query)} style={{ width: 38, height: 38, borderRadius: 14, background: isSaved ? C.gold : C.ink2, border: `1px solid ${isSaved ? C.gold : C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} title="Salva questa ricerca">
              <Star size={16} color={isSaved ? C.ink : C.mist} fill={isSaved ? C.ink : 'none'} />
            </button>
          )}
          <button onClick={onScan} style={{ width: 38, height: 38, borderRadius: 14, background: C.vermillion, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }} title="Scansiona una carta gradata"><ScanLine size={17} color={C.paper} /></button>
        </div>
        {!manualOpen ? (
          <div onClick={() => setManualOpen(true)} className="tk-body" style={{ color: C.mist, fontSize: 11, marginTop: 8, cursor: 'pointer', textDecoration: 'underline' }}>
            oppure inserisci il numero certificato a mano
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input value={manualValue} onChange={(e) => setManualValue(e.target.value)} placeholder="Numero certificato (es. 0018299244)" className="tk-mono"
              style={{ flex: 1, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '9px 12px', color: C.paper, fontSize: 13, outline: 'none' }} />
            <button onClick={() => { if (manualValue.trim()) { onManualCode(manualValue.trim()); setManualValue(''); setManualOpen(false); } }} className="tk-body" style={{ padding: '0 16px', borderRadius: 14, border: 'none', background: C.gold, color: C.ink, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Vai</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          <button onClick={() => setMode('search')} className="tk-body" style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${mode === 'search' ? C.gold : C.line}`, background: mode === 'search' ? `${C.gold}22` : 'transparent', color: mode === 'search' ? C.gold : C.mist, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Ricerca</button>
          <button onClick={() => setMode('browse')} className="tk-body" style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${mode === 'browse' ? C.gold : C.line}`, background: mode === 'browse' ? `${C.gold}22` : 'transparent', color: mode === 'browse' ? C.gold : C.mist, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>Sfoglia per set</button>
        </div>
      </div>
      <div style={{ position: 'relative', padding: '10px 16px 90px' }}>
        {mode === 'search' && (
          <>
            {state.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 20 }}>Cerco...</div>}
            {state.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 14, padding: 12 }}>{state.error}</div>}
            {state.status === 'ok' && (
              <>
                <div className="tk-body" style={{ color: C.mist, fontSize: 11, marginBottom: 8 }}>{state.cards.length} risultati {!query && '(ultime aggiunte — scrivi per cercare tra tutte)'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {state.cards.map((c) => <RealCardRow key={c.tcgdex_id} card={c} onOpen={onOpenCard} />)}
                </div>
              </>
            )}
          </>
        )}
        {mode === 'browse' && !activeSet && (
          <>
            {setsState.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 20 }}>Carico l'elenco dei set...</div>}
            {setsState.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12 }}>{setsState.error}</div>}
            {setsState.status === 'ok' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {setsState.sets.map((s) => (
                  <div key={s.setName} onClick={() => setActiveSet(s.setName)} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 10, cursor: 'pointer' }}>
                    <div style={{ width: '100%' }}><CardArt hue={(s.setName.length * 37) % 360} label={s.setName.slice(0, 2)} imageUrl={s.image} /></div>
                    <div className="tk-body" style={{ color: C.paper, fontSize: 11.5, fontWeight: 600, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.setName}</div>
                    <div className="tk-body" style={{ color: C.mist, fontSize: 10, marginTop: 1 }}>{s.count} cart{s.count === 1 ? 'a' : 'e'}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {mode === 'browse' && activeSet && (
          <>
            <button onClick={() => setActiveSet(null)} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 12 }}>
              <ChevronLeft size={14} color={C.paper} /><span className="tk-body" style={{ color: C.paper, fontSize: 12 }}>{activeSet}</span>
            </button>
            {setCardsState.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 20 }}>Carico le carte del set...</div>}
            {setCardsState.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, background: C.ink2, border: `1px solid ${C.vermillion}`, borderRadius: 14, padding: 12 }}>{setCardsState.error}</div>}
            {setCardsState.status === 'ok' && setCardsState.cards.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 20 }}>Nessuna carta trovata per questo set.</div>}
            {setCardsState.status === 'ok' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {setCardsState.cards.map((c) => <RealCardRow key={c.tcgdex_id} card={c} onOpen={onOpenCard} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RealCardDetail({ card, onBack, currency, setCurrency, collection = [], toggleCollection }) {
  const [state, setState] = useState({ status: 'loading', prices: [], error: null });
  const [live, setLive] = useState({ status: 'loading', results: [], fetchedAt: null, error: null });
  const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | 'graded' | 'raw'
  useEffect(() => {
    fetchCardPrices(card.tcgdex_id)
      .then((prices) => setState({ status: 'ok', prices, error: null }))
      .catch((error) => setState({ status: 'error', prices: [], error: error.message || String(error) }));
  }, [card.tcgdex_id]);
  useEffect(() => {
    // per le carte salvate solo in giapponese, provo a tradurre almeno
    // il nome della specie (es. "リザードン" -> "Charizard") — senza
    // questo, cercare su eBay/PokeTrace con testo giapponese non trova
    // mai nulla, dato che le inserzioni eBay sono scritte in inglese
    const baseName = card.name_en || extractEnglishSpeciesName(card.name) || card.name;
    const term = card.set_name ? `${baseName} ${card.set_name}` : baseName;
    fetch(`/api/live-price?q=${encodeURIComponent(term)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        // controllo di sicurezza: se sappiamo il set di questa carta e
        // PokeTrace risponde con un set chiaramente diverso, non è la
        // stessa carta — meglio non mostrare nulla che mostrare una
        // carta sbagliata spacciata per quella giusta (è successo con
        // "Charizard Gold Star" che tornava con dati del Base Set)
        // controllo di sicurezza più preciso: tolgo prima le parole
        // generiche ("pokemon", "the", ecc.), poi richiedo che quello
        // che resta combaci quasi per intero — non basta che una
        // parola sola sia in comune (è successo con "Dragon" contro
        // "Dragon Frontiers", due set VERI ma diversi, non lo stesso
        // scritto in modo abbreviato)
        const GENERIC_WORDS = new Set(["pokemon", "the", "tcg", "card", "cards"]);
        const stripGeneric = (s) => s.toLowerCase().split(/\s+/).filter((w) => !GENERIC_WORDS.has(w)).join(" ");
        const setLooksRelated = (r) => {
          if (!card.set_name || !r.set) return true;
          const a = stripGeneric(card.set_name);
          const b = stripGeneric(r.set);
          if (a === b) return true;
          const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
          if (!shorter) return false;
          return longer.includes(shorter) && shorter.length >= longer.length * 0.75;
        };
        const filteredResults = (data.results || []).filter(setLooksRelated);
        setLive({ status: 'ok', results: filteredResults, fetchedAt: data.fetchedAt, error: null });
      })
      .catch((error) => setLive({ status: 'error', results: [], fetchedAt: null, error: error.message || String(error) }));
  }, [card.tcgdex_id]);
  const inColl = collection.includes(card.tcgdex_id);
  const matchesGradeFilter = (p) => gradeFilter === 'all' || (gradeFilter === 'graded' ? !!p.grade_company : !p.grade_company);
  const confirmedSorted = state.status === 'ok' ? state.prices.filter((p) => p.confirmed && matchesGradeFilter(p)).sort((a, b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0)) : [];
  const listedSorted = state.status === 'ok' ? state.prices.filter((p) => !p.confirmed && matchesGradeFilter(p)).sort((a, b) => new Date(b.observed_at || 0) - new Date(a.observed_at || 0)) : [];
  // stima per OGNI grado separatamente (come ALT) — mescolare una
  // vendita raw con una PSA 10 in un'unica media darebbe un numero
  // senza senso, ognuno vale in un mercato diverso
  const gradeTiers = new Map();
  for (const p of confirmedSorted) {
    const key = p.grade_company ? `${p.grade_company} ${p.grade}` : 'Raw';
    if (!gradeTiers.has(key)) gradeTiers.set(key, []);
    gradeTiers.get(key).push(p);
  }
  const tierEstimates = Array.from(gradeTiers.entries()).map(([tier, sales]) => {
    const recent = sales.slice(0, 5);
    const jpy = recent.reduce((sum, p) => sum + p.price / (RATES[p.currency] ?? 1), 0) / recent.length;
    return { tier, jpy, count: sales.length };
  }).sort((a, b) => b.jpy - a.jpy);
  const recentForEstimate = confirmedSorted.slice(0, 5);
  const estimateJPY = recentForEstimate.length > 0
    ? recentForEstimate.reduce((sum, p) => sum + p.price / (RATES[p.currency] ?? 1), 0) / recentForEstimate.length
    : null;
  const chartData = [...confirmedSorted].filter((p) => p.observed_at).reverse().map((p) => ({
    date: fmtDate(new Date(p.observed_at)),
    value: (p.price / (RATES[p.currency] ?? 1)) * RATES[currency],
  }));

  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={17} color={C.paper} /></button>
        <div className="tk-body" style={{ color: C.mist, fontSize: 11.5 }}>{card.set_name || card.set_code} {card.local_id ? `· ${card.local_id}` : ''}</div>
      </div>
      <div className="tk-rise" style={{ position: 'relative', padding: '10px 16px 0' }}>
        <div style={{ width: 190, margin: '0 auto' }}><CardArt hue={(card.tcgdex_id.length * 37) % 360} label={(card.name_en || card.name || '?').slice(0, 2)} imageUrl={card.image_url} /></div>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="tk-display" style={{ color: C.paper, fontSize: 19, fontWeight: 700 }}>{card.name_en || card.name}</div>
          {card.name_en && card.name !== card.name_en && <div className="tk-body" style={{ color: C.mist, fontSize: 12, marginTop: 2 }}>{card.name}</div>}
          {detectEdition(card.name_en || card.name) && <div style={{ marginTop: 6 }}><EditionPill name={card.name_en || card.name} /></div>}
          {card.tcgdex_id.startsWith('yuyu-') && (
            <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 8, fontStyle: 'italic' }}>Non ancora abbinata a un catalogo — nome originale dalla fonte.</div>
          )}
        </div>
        <button onClick={() => toggleCollection(card.tcgdex_id)} className="tk-body" style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${inColl ? C.jade : C.line}`, background: inColl ? `${C.jade}1A` : C.ink2, color: inColl ? C.jade : C.paper }}>
          {inColl ? <Check size={15} /> : <Plus size={15} />}<span style={{ fontWeight: 600, fontSize: 13 }}>{inColl ? 'Nella tua collezione' : 'Aggiungi alla collezione'}</span>
        </button>
        {setCurrency && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
            <SegmentTrack>
              {Object.keys(SYMBOLS).map((cur) => (
                <Chip key={cur} active={cur === currency} onClick={() => setCurrency(cur)}>{cur}</Chip>
              ))}
            </SegmentTrack>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <SegmentTrack>
            <Chip active={gradeFilter === 'all'} onClick={() => setGradeFilter('all')}>Tutte</Chip>
            <Chip active={gradeFilter === 'graded'} onClick={() => setGradeFilter('graded')}>Gradate</Chip>
            <Chip active={gradeFilter === 'raw'} onClick={() => setGradeFilter('raw')}>Raw</Chip>
          </SegmentTrack>
        </div>

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <div className="tk-mono" style={{ color: C.mist, fontSize: 10, letterSpacing: 1.5 }}>STIMA DI MERCATO</div>
          {estimateJPY !== null ? (
            <div className="tk-display" style={{ color: C.gold, fontSize: 32, fontWeight: 700, marginTop: 4 }}>{fmtConverted(estimateJPY * RATES[currency], currency)}</div>
          ) : (
            <div className="tk-body" style={{ color: C.mist, fontSize: 13, marginTop: 6 }}>Ancora nessuna vendita confermata per calcolare una stima.</div>
          )}
          <div className="tk-body" style={{ color: C.mist, fontSize: 10, marginTop: 2 }}>
            {live.status === 'ok' && live.fetchedAt ? `controllato dal vivo alle ${new Date(live.fetchedAt).toLocaleTimeString('it-IT')}` : (live.status === 'loading' ? 'controllo il valore dal vivo...' : '')}
          </div>
          {tierEstimates.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 4, justifyContent: tierEstimates.length <= 4 ? 'center' : 'flex-start' }}>
              {tierEstimates.map((t) => (
                <div key={t.tier} style={{ flexShrink: 0, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '6px 10px', minWidth: 68 }}>
                  <div className="tk-mono" style={{ color: C.mist, fontSize: 9 }}>{t.tier}</div>
                  <div className="tk-mono" style={{ color: C.paper, fontSize: 12.5, fontWeight: 700 }}>{fmtConverted(t.jpy * RATES[currency], currency)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {live.status === 'ok' && live.results.slice(0, 1).map((r, i) => (
          r.confirmedSales.length > 0 && (
            <div key={i} style={{ marginTop: 16, background: C.ink2, border: `1px solid ${C.gold}55`, borderRadius: 14, padding: '10px 12px' }}>
              <div className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1 }}>TROVATO DAL VIVO ORA (eBay, non ancora salvato)</div>
              <div className="tk-body" style={{ color: C.paper, fontSize: 12, marginTop: 4 }}>{r.name}{r.set ? ` — ${r.set}` : ''}</div>
              {r.confirmedSales.map((s, j) => (
                <div key={j} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span className="tk-mono" style={{ color: C.mist, fontSize: 10.5 }}>{s.gradeTier}</span>
                  <span className="tk-mono" style={{ color: C.gold, fontSize: 13, fontWeight: 700 }}>{fmtFrom(s.price, s.currency, currency)}</span>
                </div>
              ))}
            </div>
          )
        ))}

        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <div className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1, marginBottom: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 5 }}>VENDUTI</div>
            {state.status === 'loading' && <div className="tk-body" style={{ color: C.mist, fontSize: 11 }}>Carico...</div>}
            {state.status === 'ok' && confirmedSorted.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>Nessuna ancora.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {confirmedSorted.slice(0, 6).map((p) => (
                <div key={p.id} style={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '7px 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span className="tk-mono" style={{ color: C.paper, fontSize: 11.5, fontWeight: 700 }}>{fmtFrom(p.price, p.currency, currency)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span className="tk-mono" style={{ color: C.mist, fontSize: 9 }}>{p.grade_company ? `${p.grade_company} ${p.grade}` : 'raw'}</span>
                    {p.observed_at && <span className="tk-body" style={{ color: C.mist, fontSize: 9 }}>{fmtDate(new Date(p.observed_at))}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1, marginBottom: 6, borderBottom: `1px solid ${C.line}`, paddingBottom: 5 }}>ANDAMENTO</div>
            {chartData.length < 2 ? (
              <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 8 }}>Servono almeno 2 vendite datate per un grafico.</div>
            ) : (
              <div style={{ width: '100%', height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="andamentoFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.gold} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.gold} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fill: C.mist, fontSize: 8 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip contentStyle={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 11 }} labelStyle={{ color: C.mist }} formatter={(v) => fmtConverted(v, currency)} />
                    <Area type="monotone" dataKey="value" stroke={C.gold} strokeWidth={2.5} fill="url(#andamentoFill)" dot={false} activeDot={{ r: 4, fill: C.gold, stroke: C.ink, strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 22, marginBottom: 90 }}>
          <div className="tk-mono" style={{ color: C.gold, fontSize: 10.5, letterSpacing: 1.5, marginBottom: 8, borderBottom: `1px solid ${C.line}`, paddingBottom: 6 }}>IN VENDITA ORA</div>
          {state.status === 'ok' && listedSorted.length === 0 && <div className="tk-body" style={{ color: C.mist, fontSize: 12 }}>Nessuna inserzione attiva registrata per questa carta.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listedSorted.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <PlatformPill name={p.source} />
                    <span className="tk-mono" style={{ color: C.mist, fontSize: 10 }}>{p.grade_company ? `${p.grade_company} ${p.grade}` : 'raw'}</span>
                    {p.observed_at && <span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>{new Date(p.observed_at).toLocaleDateString('it-IT')}</span>}
                  </div>
                  <div style={{ marginTop: 4 }}><span className="tk-body" style={{ color: C.mist, fontSize: 10.5 }}>prezzo di listino</span></div>
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

function SavedSearchesView({ savedSearches, onRemove, onRunSearch }) {
  return (
    <div className="tk-scroll" style={{ overflowY: 'auto', height: '100%', position: 'relative' }}>
      <GridTexture />
      <div style={{ position: 'relative', padding: '18px 16px 90px' }}>
        <TopBar title="Ricerche salvate" subtitle="le tue ricerche preferite, sempre a portata" />
        {savedSearches.length === 0 && (
          <div className="tk-body" style={{ color: C.mist, fontSize: 13, marginTop: 30, textAlign: 'center', lineHeight: 1.6 }}>
            Nessuna ricerca salvata ancora.<br />
            Cerca una carta, poi tocca l'icona a forma di stella accanto alla ricerca per salvarla qui.
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {savedSearches.map((s) => (
            <div key={s.term} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12 }}>
              <div onClick={() => onRunSearch(s.term)} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
                <div className="tk-body" style={{ color: C.paper, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.term}</div>
                <div className="tk-body" style={{ color: C.mist, fontSize: 10.5, marginTop: 2 }}>salvata il {new Date(s.savedAt).toLocaleDateString('it-IT')}</div>
              </div>
              <button onClick={() => onRunSearch(s.term)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}><Search size={17} color={C.mist} /></button>
              <button onClick={() => onRemove(s.term)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}><X size={17} color={C.vermillion} /></button>
            </div>
          ))}
        </div>
        {savedSearches.length > 0 && (
          <div className="tk-body" style={{ color: C.mist, fontSize: 10, marginTop: 18, textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5 }}>
            Per ora rieseguono la ricerca quando le tocchi — l'avviso automatico su nuove inserzioni è il prossimo pezzo da costruire.
          </div>
        )}
      </div>
    </div>
  );
}

function PortfolioView({ collection, onRemove, onOpenCard, currency }) {
  const [state, setState] = useState({ status: 'loading', cards: [] });
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!collection.length) { setState({ status: 'ok', cards: [] }); setHistory([]); return; }
    setState((s) => ({ ...s, status: 'loading' }));
    fetchCardsByIds(collection)
      .then((cards) => setState({ status: 'ok', cards }))
      .catch((error) => setState({ status: 'error', cards: [], error: error.message || String(error) }));
    fetchPortfolioHistory(collection).then(setHistory).catch(() => setHistory([]));
  }, [collection]);

  const total = state.cards.reduce((sum, c) => sum + (c.latestPrice ? c.latestPrice.price / (RATES[c.latestPrice.currency] ?? 1) : 0), 0);

  // valore totale nel tempo: per ogni giorno con almeno un'osservazione,
  // il valore di ogni carta è l'ULTIMO prezzo conosciuto fino a quel
  // giorno (portato avanti se quel giorno specifico non ha una nuova
  // osservazione per quella carta) — stesso modello di Collectr/CardLadder
  const chartData = useMemo(() => {
    if (history.length < 2) return [];
    const byDay = new Map();
    for (const p of history) {
      const day = p.observed_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(p);
    }
    const days = Array.from(byDay.keys()).sort();
    const knownPriceJpy = new Map();
    return days.map((day) => {
      for (const p of byDay.get(day)) {
        knownPriceJpy.set(p.tcgdex_id, p.price / (RATES[p.currency] ?? 1));
      }
      const totalJpy = Array.from(knownPriceJpy.values()).reduce((sum, v) => sum + v, 0);
      return { date: fmtDate(new Date(day)), value: totalJpy * RATES[currency] };
    });
  }, [history, currency]);

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
        {chartData.length >= 2 && (
          <div style={{ marginTop: 16 }}>
            <div className="tk-mono" style={{ color: C.gold, fontSize: 9.5, letterSpacing: 1, marginBottom: 6 }}>ANDAMENTO VALORE TOTALE</div>
            <div style={{ width: '100%', height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.jade} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.jade} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: C.mist, fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <Tooltip contentStyle={{ background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 11 }} labelStyle={{ color: C.mist }} formatter={(v) => fmtConverted(v, currency)} />
                  <Area type="monotone" dataKey="value" stroke={C.jade} strokeWidth={2.5} fill="url(#portfolioFill)" dot={false} activeDot={{ r: 4, fill: C.jade, stroke: C.ink, strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {state.status === 'error' && <div className="tk-body" style={{ color: C.vermillion, fontSize: 12, marginTop: 16 }}>{state.error}</div>}
        {state.status === 'ok' && collection.length === 0 && (
          <div className="tk-body" style={{ color: C.mist, fontSize: 12.5, textAlign: 'center', marginTop: 60, lineHeight: 1.6 }}>La tua collezione è vuota.<br />Aggiungi una carta dalla sua scheda.</div>
        )}
        {state.status === 'ok' && collection.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {state.cards.map((c) => (
              <div key={c.tcgdex_id} onClick={() => onOpenCard(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 10, cursor: 'pointer' }}>
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
    <div style={{ background: C.ink2, border: `1px solid ${C.gold}88`, borderRadius: 16, overflow: 'hidden' }}>
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

        <button onClick={() => toggleCollection(card.id, editionLang, company, grade)} className="tk-body" style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: `1px solid ${inColl ? C.jade : C.line}`, background: inColl ? `${C.jade}1A` : C.ink2, color: inColl ? C.jade : C.paper }}>
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
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.ink2, border: `1px solid ${C.line}`, borderRadius: 14, padding: '10px 12px' }}>
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
  const items = [{ k: 'home', icon: Home, label: 'Home' }, { k: 'browse', icon: Search, label: 'Cerca' }, { k: 'portfolio', icon: Wallet, label: 'Portfolio' }, { k: 'saved', icon: Star, label: 'Salvate' }];
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
  const [currency, setCurrency] = useState('USD');
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedSearches, setSavedSearches] = useState([]);

  useEffect(() => {
    try { const saved = localStorage.getItem('toreka_collection'); setCollection(saved ? JSON.parse(saved) : []); } catch (e) { setCollection([]); }
    try { const saved = localStorage.getItem('toreka_recent_searches'); setRecentSearches(saved ? JSON.parse(saved) : []); } catch (e) { setRecentSearches([]); }
    try { const saved = localStorage.getItem('toreka_saved_searches'); setSavedSearches(saved ? JSON.parse(saved) : []); } catch (e) { setSavedSearches([]); }
  }, []);

  function persistCollection(next) { setCollection(next); try { localStorage.setItem('toreka_collection', JSON.stringify(next)); } catch (e) {} }
  function persistRecent(next) { setRecentSearches(next); try { localStorage.setItem('toreka_recent_searches', JSON.stringify(next)); } catch (e) {} }
  function persistSavedSearches(next) { setSavedSearches(next); try { localStorage.setItem('toreka_saved_searches', JSON.stringify(next)); } catch (e) {} }
  function toggleSavedSearch(term) {
    const t = term.trim();
    if (!t) return;
    const exists = savedSearches.some((s) => s.term.toLowerCase() === t.toLowerCase());
    const next = exists ? savedSearches.filter((s) => s.term.toLowerCase() !== t.toLowerCase()) : [{ term: t, savedAt: new Date().toISOString() }, ...savedSearches];
    persistSavedSearches(next);
  }
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
  else if (view === 'browse') screen = <RealBrowseView key={navKey === 'browse' ? query : 'browse'} onOpenCard={openRealCard} onScan={() => setView('scan')} onManualCode={(code) => { setScannedCode(code); setView('scanresult'); }} initialQuery={query} savedSearches={savedSearches} onToggleSaved={toggleSavedSearch} />;
  else if (view === 'scan') screen = <ScanView onBack={() => setView(navKey)} onDetected={(code) => { setScannedCode(code); setView('scanresult'); }} onRawCardFound={openRealCard} />;
  else if (view === 'scanresult') screen = <ScanResultView code={scannedCode} onBack={() => setView(navKey)} onScanAgain={() => setView('scan')} />;
  else if (view === 'realdetail') screen = <RealCardDetail key={selectedReal?.tcgdex_id} card={selectedReal} onBack={() => setView(navKey)} currency={currency} setCurrency={setCurrency} collection={collection} toggleCollection={toggleCollection} />;
  else if (view === 'detail') screen = <DetailView key={selected?.id} card={selected} onBack={() => setView(navKey)} currency={currency} setCurrency={setCurrency} collection={collection} toggleCollection={toggleCollection} />;
  else if (view === 'article') screen = <ArticleView key={article?.id} item={article} onBack={() => setView(navKey)} />;
  else if (view === 'portfolio') screen = <PortfolioView collection={collection} onRemove={(id) => toggleCollection(id)} onOpenCard={openRealCard} currency={currency} />;
  else screen = <SavedSearchesView savedSearches={savedSearches} onRemove={toggleSavedSearch} onRunSearch={(term) => { setQuery(term); nav('browse'); }} />;

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
