import fs from 'node:fs'

const html = fs.readFileSync('scripts/fc26-extractor.html', 'utf-8')
const match = html.match(/<script>([\s\S]*)<\/script>/)
let js = match[1]

const newSearch = `
async function getVersion() {
  const el = document.querySelector('[data-page]');
  return JSON.parse(el.getAttribute('data-page')).version;
}

async function searchPlayer(name) {
  const ver = await getVersion();
  const url = BASE + '/es/database/fc26/players?filters[aliases][$contains]=' + encodeURIComponent(name) + '&perPage=5';
  const res = await fetch(url, {
    headers: {
      'X-Inertia': 'true',
      'X-Inertia-Version': ver,
      'X-Inertia-Partial-Data': 'players',
      'X-Inertia-Partial-Component': 'Database/Players/DatabasePlayersIndex'
    }
  });
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
`

const oldSearch = js.indexOf('async function searchPlayer')
const searchEnd = js.indexOf('async function processBatch')
js = js.substring(0, oldSearch) + newSearch + js.substring(searchEnd)

fs.writeFileSync('scripts/fc26-extractor-v2.js', js, 'utf-8')
console.log('Written v2 script: ' + js.length + ' bytes')
