import fs from 'node:fs'

const players = JSON.parse(fs.readFileSync('src/lib/seeds/generated/player-names.json', 'utf-8'))

const js = `
const PLAYERS = ${JSON.stringify(players)};
const BASE = 'https://fctoolshub.com';
const RESULTS = [];
let completed = 0;
let VER = null;

async function getVersion() {
  const el = document.querySelector('[data-page]');
  const data = JSON.parse(el.getAttribute('data-page'));
  VER = data.version;
}

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9\\s-]/g, '').trim();
}

function scoreMatch(searchName, r) {
  const sn = normalize(searchName);
  const nn = normalize(r.name);
  const kn = normalize(r.known_as);
  if (nn === sn || kn === sn) return 100;
  const sp = sn.split(/\\s+/);
  const np = nn.split(/\\s+/);
  const kp = kn.split(/\\s+/);
  const ln = sp[sp.length - 1];
  const fn = sp[0];
  const nnHasLn = nn.includes(ln);
  const nnHasFn = nn.includes(fn);
  const knHasLn = kn.includes(ln);
  const knHasFn = kn.includes(fn);
  const allInName = sp.every(p => nn.includes(p));
  const allInKnown = sp.every(p => kn.includes(p));
  if (allInName && np.length >= sp.length) return 90;
  if (allInKnown && kp.length >= sp.length) return 88;
  if (nnHasLn && nnHasFn) return 70;
  if (knHasLn && knHasFn) return 68;
  if (nnHasLn || knHasLn) return 40;
  return 0;
}

function bestMatch(searchName, results) {
  if (!results || !results.length) return null;
  const scored = results.map(r => ({...r, score: scoreMatch(searchName, r)})).filter(r => r.score >= 60);
  if (!scored.length) {
    // Try looser matching on last name only
    const ln = normalize(searchName).split(/\\s+/).pop();
    const loose = results.filter(r => {
      const nn = normalize(r.name);
      return nn.includes(ln) || normalize(r.known_as).includes(ln);
    });
    if (loose.length === 1) return loose[0];
    return null;
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

async function searchPlayer(name) {
  const url = BASE + '/es/database/fc26/players?filters[aliases][\\$contains]=' + encodeURIComponent(name) + '&perPage=5';
  const res = await fetch(url, {
    headers: {
      'X-Inertia': 'true',
      'X-Inertia-Version': VER,
      'X-Inertia-Partial-Data': 'players',
      'X-Inertia-Partial-Component': 'Database/Players/DatabasePlayersIndex'
    }
  });
  if (res.status === 409) { return []; }
  const json = await res.json();
  return (json.props.players.data || []).map(p => ({
    id: p.id,
    name: p.full_name,
    known_as: p.known_as,
    ovr: p.stats.overall,
    potential: p.stats.potential,
    position: p.main_position ? p.main_position.name : null,
    club: p.club ? p.club.name : null,
    age: p.age,
  }));
}

async function processBatch(startIdx) {
  const batch = PLAYERS.slice(startIdx, startIdx + 10);
  const searches = await Promise.all(batch.map(p => searchPlayer(p.name).catch(() => [])));
  for (let j = 0; j < batch.length; j++) {
    const match = bestMatch(batch[j].name, searches[j]);
    RESULTS.push({ slug: batch[j].slug, name: batch[j].name, ...(match || {}), fc26Found: !!match });
    completed++;
  }
  const found = RESULTS.filter(r => r.fc26Found).length;
  document.title = completed + '/' + PLAYERS.length + ' (found ' + found + ')';
  if (completed < PLAYERS.length) {
    setTimeout(function() { processBatch(startIdx + 10); }, 300);
  } else {
    localStorage.setItem('fc26Results', JSON.stringify(RESULTS));
    document.title = 'DONE - ' + found + '/' + PLAYERS.length;
  }
}

getVersion().then(function() {
  document.title = 'START - version ' + VER;
  processBatch(0);
});
`

fs.writeFileSync('scripts/fc26-extractor-v3.js', js, 'utf-8')
console.log('Written v3 script: ' + js.length + ' bytes')
