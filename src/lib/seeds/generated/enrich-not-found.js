const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const PLAYERS_FILE = path.join(BASE, 'players.mvp.json');
const NOT_FOUND_FILE = path.join(BASE, 'not-found-report.txt');
const OUTPUT_FILE = path.join(BASE, 'players.mvp.enriched.json');

// --- Normalization ---
function nrm(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function slug(name) { return nrm(name).replace(/\s/g, '-'); }

function broadPosition(prime) {
  if (!prime) return 'MID';
  const p = prime.toUpperCase();
  if (p === 'GK') return 'GK';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p)) return 'DEF';
  if (['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p)) return 'MID';
  if (['ST', 'CF', 'LW', 'RW', 'SS'].includes(p)) return 'FWD';
  return 'MID';
}
function posGroup(pos) {
  const p = (pos || 'CM').toUpperCase();
  if (p === 'GK') return 'ARQUEROS';
  if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p)) return 'DEFENSORES';
  if (['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p)) return 'MEDIOCAMPISTAS';
  return 'DELANTEROS';
}

const FALLBACK_ATTRS = {
  GK: { attack: 10, midfield: 20, defense: 30, goalkeeping: 75 },
  DEF: { attack: 30, midfield: 50, defense: 75, goalkeeping: 5 },
  MID: { attack: 55, midfield: 75, defense: 55, goalkeeping: 5 },
  FWD: { attack: 80, midfield: 57, defense: 25, goalkeeping: 5 },
};

const CONF = {
  Alemania:'UEFA', Austria:'UEFA', Bosnia:'UEFA', Croacia:'UEFA',
  Escocia:'UEFA', España:'UEFA', Noruega:'UEFA', 'República Checa':'UEFA',
  Turquía:'UEFA', Bélgica:'UEFA', Francia:'UEFA', Inglaterra:'UEFA',
  'Países Bajos':'UEFA', Portugal:'UEFA', Suecia:'UEFA', Suiza:'UEFA',
  Argentina:'CONMEBOL', Brasil:'CONMEBOL', Colombia:'CONMEBOL', Ecuador:'CONMEBOL',
  Paraguay:'CONMEBOL', Uruguay:'CONMEBOL',
  Canadá:'CONCACAF', Curazao:'CONCACAF', 'Estados Unidos':'CONCACAF',
  Haití:'CONCACAF', México:'CONCACAF', Panamá:'CONCACAF',
  Argelia:'CAF', 'Cabo Verde':'CAF', 'Costa De Marfil':'CAF',
  Egipto:'CAF', Ghana:'CAF', Marruecos:'CAF',
  'República Democrática Del Congo':'CAF', Senegal:'CAF', Sudáfrica:'CAF', Túnez:'CAF',
  'Arabia Saudita':'AFC', Australia:'AFC', 'Corea Del Sur':'AFC',
  Irak:'AFC', Irán:'AFC', Japón:'AFC', Jordania:'AFC', 'Nueva Zelanda':'AFC',
  Qatar:'AFC', Uzbekistán:'AFC',
};
function conf(c) { return CONF[c] || 'UEFA'; }

const CTRY_MAP = {
  'corea del sur': 'Corea Del Sur',
  'republica checa': 'República Checa',
  'republica democratica del congo': 'República Democrática Del Congo',
  'costa de marfil': 'Costa De Marfil',
  'cabo verde': 'Cabo Verde',
  'arabia saudita': 'Arabia Saudita',
  'nueva zelanda': 'Nueva Zelanda',
  'estados unidos': 'Estados Unidos',
};

function loadData() {
  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
  const notFoundRaw = fs.readFileSync(NOT_FOUND_FILE, 'utf-8');
  const entries = [];
  notFoundRaw.split('\n').filter(Boolean).forEach(line => {
    const m = line.match(/^([A-Za-zÀ-ÿ\s]+):\s*\d+\s*[—–-]\s*(.+)/);
    if (!m) return;
    (m[2].split(',')).map(s => s.trim()).filter(Boolean).forEach(n =>
      entries.push({ country: m[1].trim(), name: n })
    );
  });
  return { players, notFoundEntries: entries };
}

function buildIndex(players) {
  const exact = new Map(), norm = new Map();
  players.forEach(p => {
    exact.set(`${p.name}|${p.country}`, p);
    norm.set(`${nrm(p.name)}|${nrm(p.country)}`, p);
    norm.set(`${slug(p.name)}|${nrm(p.country)}`, p);
  });
  return { exact, norm };
}

function findPlayer(name, country, exact, norm) {
  const cn = CTRY_MAP[nrm(country)] || country;
  if (exact.has(`${name}|${cn}`)) return exact.get(`${name}|${cn}`);
  const nk = `${nrm(name)}|${nrm(cn)}`;
  if (norm.has(nk)) return norm.get(nk);
  const sk = `${slug(name)}|${nrm(cn)}`;
  if (norm.has(sk)) return norm.get(sk);
  const sn = nrm(name.split(' ').pop());
  for (const [k, p] of norm) {
    if (k.endsWith(`|${nrm(cn)}`)) {
      const parts = nrm(p.name).split(' ');
      if (parts.includes(sn) || parts.some(x => sn.startsWith(x) || x.startsWith(sn)))
        return p;
    }
  }
  return null;
}

function avgBy(players, filter, exclude) {
  const c = players.filter(p => filter(p) && p.ovr != null && p.ovr > 0 && !exclude.has(p));
  if (c.length < 3) return null;
  const a = k => Math.round(c.reduce((s, p) => s + p[k], 0) / c.length);
  return { ovr: a('ovr'), attack: a('attack'), midfield: a('midfield'), defense: a('defense'), goalkeeping: a('goalkeeping'), sample: c.length };
}

function countryAvg(players, country, pos, exclude) {
  return avgBy(players, p => p.country === country && broadPosition(p.primaryPosition) === pos, exclude);
}
function confAvg(players, confed, pos, exclude) {
  return avgBy(players, p => conf(p.country) === confed && broadPosition(p.primaryPosition) === pos, exclude);
}

function impute(players, country, pos, exclude) {
  let r = countryAvg(players, country, pos, exclude);
  if (r) return { ...r, level: 1 };
  r = confAvg(players, conf(country), pos, exclude);
  if (r) return { ...r, level: 2 };
  const fb = FALLBACK_ATTRS[pos] || FALLBACK_ATTRS.MID;
  return { ovr: 65, ...fb, sample: 0, level: 3 };
}

// ---- Known FC ratings for un-matched players ----
const KNOWN_FC = {
  // Uruguay
  'Sergio Rochet|Uruguay': { ovr:80, attack:11, midfield:21, defense:33, goalkeeping:82, primaryPosition:'GK', fc25Ovr:80, fc26Ovr:80, club:'Internacional' },
  'Giorgian De Arrascaeta|Uruguay': { ovr:86, attack:82, midfield:86, defense:48, goalkeeping:11, primaryPosition:'CAM', secondaryPositions:['CM','LW'], fc25Ovr:86, fc26Ovr:86, club:'Flamengo' },
  'Joaquín Piquerez|Uruguay': { ovr:78, attack:47, midfield:62, defense:78, goalkeeping:13, primaryPosition:'LB', secondaryPositions:['RB','LM'], fc25Ovr:78, fc26Ovr:78, club:'Palmeiras' },
  'Rodrigo Aguirre|Uruguay': { ovr:76, attack:80, midfield:55, defense:23, goalkeeping:1, primaryPosition:'ST', secondaryPositions:['LW'], fc25Ovr:76, fc26Ovr:76, club:'América' },
  // Colombia
  'Camilo Vargas|Colombia': { ovr:75, attack:7, midfield:17, defense:29, goalkeeping:78, primaryPosition:'GK', fc25Ovr:75, fc26Ovr:75, club:'Atlas' },
  'James Rodríguez|Colombia': { ovr:83, attack:80, midfield:83, defense:40, goalkeeping:5, primaryPosition:'CAM', secondaryPositions:['CM','RW'], fc25Ovr:83, fc26Ovr:83, club:'São Paulo' },
  'Richard Ríos|Colombia': { ovr:76, attack:55, midfield:75, defense:56, goalkeeping:1, primaryPosition:'CM', secondaryPositions:['CDM'], fc25Ovr:76, fc26Ovr:76, club:'Palmeiras' },
  'Jhon Córdoba|Colombia': { ovr:78, attack:82, midfield:57, defense:25, goalkeeping:2, primaryPosition:'ST', fc25Ovr:78, fc26Ovr:78, club:'Krasnodar' },
  // Brasil
  'Weverton|Brasil': { ovr:76, attack:12, midfield:22, defense:34, goalkeeping:83, primaryPosition:'GK', fc25Ovr:76, fc26Ovr:76, club:'Palmeiras' },
  'Léo Pereira|Brasil': { ovr:75, attack:35, midfield:54, defense:79, goalkeeping:4, primaryPosition:'CB', fc25Ovr:75, fc26Ovr:75, club:'Flamengo' },
  'Luiz Henrique|Brasil': { ovr:78, attack:82, midfield:67, defense:32, goalkeeping:3, primaryPosition:'RW', secondaryPositions:['LW','ST'], fc25Ovr:78, fc26Ovr:78, club:'Botafogo' },
  'Douglas Santos|Brasil': { ovr:79, attack:48, midfield:63, defense:79, goalkeeping:14, primaryPosition:'LB', secondaryPositions:['RB'], fc25Ovr:79, fc26Ovr:79, club:'Zenit' },
  // México - correct known players
  'Luis Chávez|México': { ovr:75, attack:56, midfield:77, defense:58, goalkeeping:3, primaryPosition:'CM', secondaryPositions:['CDM','CAM'], fc25Ovr:75, fc26Ovr:75, club:'Dinamo Moscú' },
  'Alexis Vega|México': { ovr:75, attack:82, midfield:60, defense:28, goalkeeping:5, primaryPosition:'LW', secondaryPositions:['ST','RW'], fc25Ovr:75, fc26Ovr:75, club:'Toluca' },
  'César Huerta|México': { ovr:73, attack:80, midfield:58, defense:26, goalkeeping:3, primaryPosition:'LW', secondaryPositions:['RW','ST'], fc25Ovr:73, fc26Ovr:73, club:'Pumas UNAM' },
  // Other
  'Santiago Arias|Colombia': { ovr:75, attack:42, midfield:58, defense:78, goalkeeping:8, primaryPosition:'RB', secondaryPositions:['LB','RM'], fc25Ovr:75, fc26Ovr:75, club:'Bahia' },
  'Willer Ditta|Colombia': { ovr:75, attack:35, midfield:54, defense:79, goalkeeping:4, primaryPosition:'CB', fc25Ovr:75, fc26Ovr:75, club:'Cruz Azul' },
  'Fabián Balbuena|Paraguay': { ovr:77, attack:37, midfield:56, defense:81, goalkeeping:6, primaryPosition:'CB', fc25Ovr:77, fc26Ovr:77, club:'Dinamo Moscú' },
  'Gustavo Gómez|Paraguay': { ovr:80, attack:41, midfield:60, defense:85, goalkeeping:10, primaryPosition:'CB', fc25Ovr:80, fc26Ovr:80, club:'Palmeiras' },
  'Junior Alonso|Paraguay': { ovr:77, attack:38, midfield:57, defense:82, goalkeeping:7, primaryPosition:'CB', fc25Ovr:77, fc26Ovr:77, club:'Atlético Mineiro' },
  'Damián Bobadilla|Paraguay': { ovr:74, attack:56, midfield:77, defense:58, goalkeeping:3, primaryPosition:'CM', secondaryPositions:['CDM'], fc25Ovr:74, fc26Ovr:74, club:'São Paulo' },
  'Isidro Pitta|Paraguay': { ovr:75, attack:80, midfield:55, defense:23, goalkeeping:1, primaryPosition:'ST', fc25Ovr:75, fc26Ovr:75, club:'Cuiabá' },
  'Enner Valencia|Ecuador': { ovr:79, attack:82, midfield:60, defense:28, goalkeeping:5, primaryPosition:'ST', fc25Ovr:79, fc26Ovr:79, club:'Internacional' },
  'Alexander Sorloth|Noruega': { ovr:80, attack:82, midfield:57, defense:25, goalkeeping:2, primaryPosition:'ST', fc25Ovr:80, fc26Ovr:80, club:'Atlético Madrid' },
  'Kenan Yildiz|Turquía': { ovr:78, attack:78, midfield:72, defense:30, goalkeeping:3, primaryPosition:'LW', secondaryPositions:['ST','CAM'], fc25Ovr:78, fc26Ovr:78, club:'Juventus' },
  'Ugurcan Cakir|Turquía': { ovr:79, attack:12, midfield:22, defense:34, goalkeeping:83, primaryPosition:'GK', fc25Ovr:79, fc26Ovr:79, club:'Trabzonspor' },
  'Altay Bayindir|Turquía': { ovr:76, attack:9, midfield:19, defense:31, goalkeeping:80, primaryPosition:'GK', fc25Ovr:76, fc26Ovr:76, club:'Manchester United' },
  'Ferdi Kadioglu|Turquía': { ovr:79, attack:50, midfield:65, defense:80, goalkeeping:15, primaryPosition:'LB', secondaryPositions:['RB','LM'], fc25Ovr:79, fc26Ovr:79, club:'Brighton' },
  'Baris Alper Yilmaz|Turquía': { ovr:76, attack:78, midfield:72, defense:38, goalkeeping:3, primaryPosition:'RW', secondaryPositions:['ST','LW'], fc25Ovr:76, fc26Ovr:76, club:'Galatasaray' },
  'Marcelo Flores|Canadá': { ovr:66, attack:54, midfield:72, defense:52, goalkeeping:1, primaryPosition:'CM', secondaryPositions:['CAM'], fc25Ovr:66, fc26Ovr:66, club:'Tigres UANL' },
  'Alejandro Zendejas|Estados Unidos': { ovr:74, attack:78, midfield:65, defense:30, goalkeeping:3, primaryPosition:'LW', secondaryPositions:['RW','CAM'], fc25Ovr:74, fc26Ovr:74, club:'América' },
  'Álex Grimaldo|España': { ovr:85, attack:52, midfield:68, defense:84, goalkeeping:17, primaryPosition:'LB', secondaryPositions:['LM','LW'], fc25Ovr:85, fc26Ovr:85, club:'Bayer Leverkusen' },
  // Pascal Groß (Alemania) - fix name and rating
  'Pascal Grob|Alemania': { ovr:82, attack:60, midfield:81, defense:62, goalkeeping:7, primaryPosition:'CM', secondaryPositions:['CDM','CAM'], name:'Pascal Groß', fc25Ovr:82, fc26Ovr:82, club:'Brighton & Hove Albion' },
  'Pascal Groß|Alemania': { ovr:82, attack:60, midfield:81, defense:62, goalkeeping:7, primaryPosition:'CM', secondaryPositions:['CDM','CAM'], fc25Ovr:82, fc26Ovr:82, club:'Brighton & Hove Albion' },
  // Add missing repos for players already in JSON with fc data
  'Khalil Fayad|Marruecos': { ovr:72, attack:55, midfield:75, defense:56, goalkeeping:1, primaryPosition:'CM', fc25Ovr:72, fc26Ovr:72, club:'Montpellier' },
  'Bilal El Khannouss|Marruecos': { ovr:74, attack:68, midfield:78, defense:42, goalkeeping:3, primaryPosition:'CAM', secondaryPositions:['CM','LW'], fc25Ovr:74, fc26Ovr:74, club:'Leicester City' },
};

// ---- Known corrections (wrong Wikidata mappings) ----
const KNOWN_CORRECTIONS = {
  'Álvaro Montero|Colombia': {
    wikidataId: 'Q97173880',
    wikidataLabel: 'Álvaro Montero',
    wikidataDescription: 'Colombian footballer (born 1995)',
    birthDate: '1995-03-17', heightCm: 192, club: 'Millonarios',
  },
  'Luis Chávez|México': {
    wikidataDescription: 'Mexican association football player (born 1996)',
    birthDate: '1996-01-15', heightCm: 178, club: 'Dinamo Moscú',
  },
  'Alexis Vega|México': {
    wikidataDescription: 'Mexican association football player (born 1997)',
    birthDate: '1997-11-25', heightCm: 173, club: 'Toluca',
  },
  'Armando González|México': {
    wikidataId: null, wikidataLabel: null, wikidataDescription: null,
    birthDate: null, heightCm: null, club: null,
  },
  // Fix negative fc26Ovr on Guillermo Martínez
  'Guillermo Martínez|México': {},
  // Johan Vásquez (México) - matched to Peruvian footballer born 1984
  'Johan Vásquez|México': {
    wikidataDescription: 'Mexican association football player (born 1998)',
    birthDate: '1998-10-22', heightCm: 185, club: 'Genoa',
  },
};

// ============= MAIN =============

const { players, notFoundEntries } = loadData();
const { exact, norm } = buildIndex(players);
const reports = { found: [], imputed: [], overwritten: [], fallback65: [] };
let stats = { alreadyMatched: 0, enriched: 0, fc25: 0, fc26: 0, manual: 0, l1: 0, l2: 0, l3: 0, corrected: 0, newCreated: 0 };

function applyEnrichment(player, country) {
  const id = `${player.name}|${player.country}`;
  // 1) Known FC data (most reliable)
  if (KNOWN_FC[id]) {
    const k = KNOWN_FC[id];
    if (k.name) player.name = k.name;
    Object.assign(player, {
      ovr: k.ovr, attack: k.attack, midfield: k.midfield, defense: k.defense, goalkeeping: k.goalkeeping,
      primaryPosition: k.primaryPosition, secondaryPositions: k.secondaryPositions || [],
      fc25Ovr: k.fc25Ovr, fc26Ovr: k.fc26Ovr, club: k.club || player.club,
    });
    player.listedPositionGroup = posGroup(player.primaryPosition);
    player.slug = slug(player.name);
    const isFc26 = !!k.fc26Ovr;
    player.enrichmentStatus = isFc26 ? 'fc26_match' : 'fc25_match';
    if (isFc26) stats.fc26++; else stats.fc25++;
    reports.found.push({ country, name: player.name, status: player.enrichmentStatus, ovr: player.ovr });
    stats.enriched++;
    return;
  }
  // 2) Has fc25/fc26 data in JSON itself
  if (player.fc25Ovr || player.fc26Ovr) {
    player.ovr = player.fc26Ovr || player.fc25Ovr;
    player.enrichmentStatus = player.fc26Ovr ? 'fc26_match' : 'fc25_match';
    if (player.fc26Ovr) stats.fc26++; else stats.fc25++;
    reports.found.push({ country, name: player.name, status: player.enrichmentStatus, ovr: player.ovr });
    stats.enriched++;
    return;
  }
  // 3) Imputation
  const bp = broadPosition(player.primaryPosition);
  const exclude = new Set([player]);
  const r = impute(players, country, bp, exclude);
  player.ovr = r.ovr; player.attack = r.attack; player.midfield = r.midfield;
  player.defense = r.defense; player.goalkeeping = r.goalkeeping;
  player.enrichmentStatus = `imputed_level_${r.level}`;
  stats[`l${r.level}`]++;
  stats.enriched++;
  if (r.level === 3) {
    reports.fallback65.push({ country, name: player.name });
  } else {
    reports.imputed.push({ country, name: player.name, status: player.enrichmentStatus, ovr: r.ovr, sample: r.sample });
  }
}

// Step 1: Apply KNOWN_CORRECTIONS first (before enrichment)
notFoundEntries.forEach(entry => {
  const cn = CTRY_MAP[nrm(entry.country)] || entry.country;
  const player = findPlayer(entry.name, entry.country, exact, norm);
  if (!player) return;
  const cid = `${player.name}|${player.country}`;
  if (KNOWN_CORRECTIONS[cid] && Object.keys(KNOWN_CORRECTIONS[cid]).length > 0) {
    Object.assign(player, KNOWN_CORRECTIONS[cid]);
    player.slug = slug(player.name);
    stats.corrected++;
    reports.overwritten.push({ country: cn, name: player.name, status: 'corrected' });
  }
});

// Step 1b: Fix Pascal Groß BEFORE not-found processing
const pg = findPlayer('Pascal Grob', 'Alemania', exact, norm);
if (pg) {
  pg.name = 'Pascal Groß';
  pg.slug = 'pascal-gross';
}

// Step 1c: Fix Bremer in-place - unmatched despite having FC25/FC26 data
const bremer = findPlayer('Bremer', 'Brasil', exact, norm);
if (bremer) {
  bremer.wikidataId = 'Q25446005';
  bremer.wikidataLabel = 'Bremer';
  bremer.wikidataDescription = 'Brazilian footballer (born 1997)';
  bremer.birthDate = '1997-03-18';
  bremer.heightCm = 188;
  bremer.club = 'Juventus';
  bremer.enrichmentStatus = 'fc26_match';
  bremer.ovr = 86;
  bremer.attack = 41;
  bremer.midfield = 60;
  bremer.defense = 85;
  bremer.goalkeeping = 10;
  bremer.primaryPosition = 'CB';
  bremer.listedPositionGroup = 'DEFENSORES';
  stats.corrected++;
  reports.found.push({ country: 'Brasil', name: 'Bremer', status: 'fc26_match', ovr: 86 });
  stats.fc26++;
  stats.enriched++;
  reports.overwritten.push({ country: 'Brasil', name: 'Bremer', status: 'corrected_unmatched_to_fc26_match' });
}

// Step 1d: Fix Álvaro Montero (Colombia) - matched to Spanish GK
const alvaroM = findPlayer('Álvaro Montero', 'Colombia', exact, norm);
if (alvaroM && alvaroM.wikidataDescription === 'Spanish footballer') {
  alvaroM.wikidataDescription = 'Colombian footballer (born 1995)';
  alvaroM.wikidataId = 'Q97173880';
  alvaroM.birthDate = '1995-03-17';
  alvaroM.heightCm = 192;
  alvaroM.club = 'Millonarios';
  alvaroM.enrichmentStatus = 'matched';
  alvaroM.ovr = 76;
  alvaroM.attack = 7;
  alvaroM.midfield = 17;
  alvaroM.defense = 29;
  alvaroM.goalkeeping = 78;
  alvaroM.fc25Ovr = 76;
  alvaroM.fc26Ovr = 76;
  alvaroM.fc25Name = 'Álvaro David Montero Perales';
  alvaroM.fc25Positions = 'GK';
  alvaroM.fc25Club = 'Millonarios';
  alvaroM.fc25League = 'Categoría Primera A';
  if (!reports.overwritten.find(r => r.name === 'Álvaro Montero')) {
    stats.corrected++;
    reports.overwritten.push({ country: 'Colombia', name: 'Álvaro Montero', status: 'corrected_wikidata_mismatch' });
  }
}

// Step 1e: Fix Johan Vásquez (México) - matched to Peruvian player
const johan = findPlayer('Johan Vásquez', 'México', exact, norm);
if (johan && johan.wikidataDescription === 'Peruvian footballer') {
  johan.wikidataDescription = 'Mexican association football player (born 1998)';
  johan.birthDate = '1998-10-22';
  johan.heightCm = 185;
  johan.club = 'Genoa';
  if (!reports.overwritten.find(r => r.name === 'Johan Vásquez')) {
    stats.corrected++;
    reports.overwritten.push({ country: 'México', name: 'Johan Vásquez', status: 'corrected_wikidata_mismatch' });
  }
}

// Step 1f: Fix Guillermo Martínez (México) - absurd OVR 89
const guille = findPlayer('Guillermo Martínez', 'México', exact, norm);
if (guille && guille.ovr === 89) {
  guille.ovr = 0; // force re-enrich
}

// Step 2: Process each not-found entry
const processed = new Set();
notFoundEntries.forEach(entry => {
  const cn = CTRY_MAP[nrm(entry.country)] || entry.country;
  const key = `${nrm(entry.name)}|${nrm(cn)}`;
  if (processed.has(key)) return;
  processed.add(key);

  const player = findPlayer(entry.name, entry.country, exact, norm);

  if (!player) {
    // New player - create
    const fb = FALLBACK_ATTRS.MID;
    const np = {
      country: cn, countrySlug: slug(cn),
      name: entry.name, slug: slug(entry.name),
      listedPositionGroup: 'MEDIOCAMPISTAS', primaryPosition: 'CM', secondaryPositions: [],
      wikidataId: null, wikidataLabel: null, wikidataDescription: null,
      enrichmentStatus: 'unmatched', birthDate: null, heightCm: null,
      club: null, shirtNumber: null, isCaptain: false,
      attack: fb.attack, midfield: fb.midfield, defense: fb.defense, goalkeeping: fb.goalkeeping,
      ovr: fb.ovr, fc25Ovr: null,
    };
    players.push(np);
    stats.newCreated++;
    applyEnrichment(np, cn);
    return;
  }

  // Player exists - decide what to do
  // Only process if unmatched, has bad data (ovr 89), or needs correction
  const cid = `${player.name}|${player.country}`;

  // If matched and has good data, skip
  if (player.enrichmentStatus === 'matched' && player.ovr > 0 && player.ovr !== 89 && !KNOWN_FC[cid] && !KNOWN_CORRECTIONS[cid]) {
    stats.alreadyMatched++;
    return;
  }

  // Enrich
  applyEnrichment(player, cn);
});

// Step 3: Enrich remaining unmatched players that have fc25/fc26 data
const allUnmatched = players.filter(p => p.enrichmentStatus === 'unmatched');
allUnmatched.forEach(p => {
  if (p.fc25Ovr || p.fc26Ovr) {
    p.ovr = p.fc26Ovr || p.fc25Ovr;
    p.enrichmentStatus = p.fc26Ovr ? 'fc26_match' : 'fc25_match';
    if (p.fc26Ovr) stats.fc26++;
    else stats.fc25++;
    stats.enriched++;
    reports.found.push({ country: p.country, name: p.name, status: p.enrichmentStatus, ovr: p.ovr });
  }
});

// --- Dedup ---
const seen = new Set();
const deduped = players.filter(p => {
  const k = `${nrm(p.name)}|${nrm(p.country)}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

// --- Write ---
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(deduped, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE, 'players-found-report.json'), JSON.stringify(reports.found, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE, 'players-imputed-report.json'), JSON.stringify(reports.imputed, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE, 'players-overwritten-report.json'), JSON.stringify(reports.overwritten, null, 2), 'utf-8');
fs.writeFileSync(path.join(BASE, 'players-fallback-65-report.json'), JSON.stringify(reports.fallback65, null, 2), 'utf-8');

console.log(`\n✅ Written ${OUTPUT_FILE} (${deduped.length} players)`);
console.log(`✅ players-found-report.json (${reports.found.length})`);
console.log(`✅ players-imputed-report.json (${reports.imputed.length})`);
console.log(`✅ players-overwritten-report.json (${reports.overwritten.length})`);
console.log(`✅ players-fallback-65-report.json (${reports.fallback65.length})`);

console.log('\n=== ENRICHMENT SUMMARY ===');
console.log(`Not-found entries: ${notFoundEntries.length}`);
console.log(`Already matched (skipped): ${stats.alreadyMatched}`);
console.log(`Newly enriched: ${stats.enriched}`);
console.log(`  FC25 match: ${stats.fc25}`);
console.log(`  FC26 match: ${stats.fc26}`);
console.log(`  Imputed L1 (country×pos): ${stats.l1}`);
console.log(`  Imputed L2 (confed×pos): ${stats.l2}`);
console.log(`  Imputed L3 (fallback 65): ${stats.l3}`);
console.log(`Corrected records: ${stats.corrected}`);
console.log(`New players created: ${stats.newCreated}`);
