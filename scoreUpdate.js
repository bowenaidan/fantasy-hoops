/***** CONFIG *****/
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me'; // public host (5 rps)
const SHEET_POINTS = 'Point Structure';
const SHEET_STANDINGS = '2025-2026 Standings';
const SHEET_DRAFT = '2025-2026 DRAFT'; // source of rosters

// EDIT: define your tier lists (adjust to your league)
const HIGH_MAJOR = new Set([
  'ACC','Big 12','Big Ten','SEC','Big East','Pac-12','AAC' // example; tweak
]);
const HIGH_MID_MAJOR = new Set([
  'Mountain West','A-10','WCC','AAC','MVC','C-USA' // example; tweak
]);
const TRUE_MID_MAJOR = new Set([
  'Mountain West','A-10','WCC','AAC','MVC','C-USA' // example; tweak
]);
const LOW_MAJOR = new Set([
  'Mountain West','A-10','WCC','AAC','MVC','C-USA' // example; tweak
]);

// POSTSEASON mapping by round label appearing on NCAA pages.
const POSTSEASON_POINTS = {
  'National Champion': 80,
  'National Runner Up': 50,
  'Final Four': 40,
  'Elite 8': 30,
  'Sweet 16': 20
};

// Conference win points (from your "Point Structure" sheet)
const CONF_POINTS = {
  highMajor: { home: 3.5, road: 5 },
  highMid:   { home: 2.5, road: 4 },
  trueMid:   { home: 1.5, road: 2.5},
  lowMajor:    { home: 1, road: 1.5}
};

const NON_CONF_POINTS = {
    0: 2,
    1: 4,
    2: 6,
    3: 8
}

/***** ENTRY POINTS *****/
// Pull yesterday’s games (or set a date) and update standings
function updateDaily() {
  const tz = Session.getScriptTimeZone() || 'America/Chicago';
  const today = new Date();
  today.setDate(today.getDate() - 1); // yesterday
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  syncDay(`${yyyy}-${mm}-${dd}`);
}

// Recalculate season-to-date from a date range
function rebuildSeason(fromISO, toISO) {
  const roster = getRosterFromDraft_();
  clearStandings_();
  let d = new Date(fromISO);
  const end = new Date(toISO);
  while (d <= end) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    syncDay(`${yyyy}-${mm}-${dd}`, roster);
    d.setDate(d.getDate() + 1);
  }
}

/***** CORE *****/
function syncDay(isoDate, roster = null) {
  if (!roster) roster = getRosterFromDraft_();

  // 1) fetch daily scoreboard → game IDs
  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate.replace(/-/g,'/')}`);
  if (!dayGames || !dayGames.games) return;

  // 2) build conference lookup (schools → conference)
  const schoolIndex = getSchoolIndex_(); // cached

  // 3) compute points by game
  const pointsByManager = new Map(); // manager => points delta

  for (const g of dayGames.games) {
    const gameId = g.id || g.game?.id || g.url?.split('/').pop();
    if (!gameId) continue;

    const box = fetchJson_(`${NCAA_API_BASE}/game/${gameId}/boxscore`);
    if (!box) continue;

    // Determine winner + home/away
    const home = box.teams?.find(t => (t.homeAway || t.side) === 'home') || box.home;
    const away = box.teams?.find(t => (t.homeAway || t.side) === 'away') || box.away;
    if (!home || !away) continue;

    const homePts = safeScore_(home);
    const awayPts = safeScore_(away);
    let winner = null, winnerSide = null;
    if (homePts > awayPts) { winner = home; winnerSide = 'home'; }
    else if (awayPts > homePts) { winner = away; winnerSide = 'away'; }
    else continue; // tie or no final

    const winnerName = normalizeSchoolName_(winner?.school || winner?.name);
    const conf = schoolIndex.get(winnerName)?.conference || '';

    // tier → points
    const tier = HIGH_MAJOR.has(conf) ? 'highMajor'
               : HIGH_MID_MAJOR.has(conf) ? 'highMid'
               : null;

    if (tier) {
      const pts = CONF_POINTS[tier][winnerSide === 'home' ? 'home' : 'road'];
      awardPoints_(pointsByManager, roster, winnerName, pts);
    }

    // Bonus: postseason rounds (if scoreboard tags the round)
    const roundLabel = g.round || box.round || null;
    if (roundLabel) {
      const ps = postseasonFromLabel_(roundLabel);
      if (ps) awardPoints_(pointsByManager, roster, winnerName, ps);
    }
  }

  // 4) post results into Standings
  applyPointsToStandings_(pointsByManager);
}

/***** HELPERS *****/
function getRosterFromDraft_() {
  // Assumes two or more side-by-side columns of team names under owner headers.
  // Produces: Map<manager, Set<teamName>>
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_DRAFT);
  const values = sh.getDataRange().getDisplayValues();
  // Try to detect manager names on row 2 (based on your sheet)
  const managers = [];
  for (let c = 0; c < values[1].length; c++) {
    const v = values[1][c]?.trim();
    if (v) managers.push({col: c, name: v});
  }
  const roster = new Map();
  for (const m of managers) roster.set(m.name, new Set());
  for (let r = 2; r < values.length; r++) {
    for (const m of managers) {
      const team = normalizeSchoolName_(values[r][m.col]);
      if (team) roster.get(m.name).add(team);
    }
  }
  return roster;
}

function clearStandings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_STANDINGS);
  if (!sh) return;
  const rng = sh.getRange(2,1,Math.max(sh.getLastRow()-1,0), sh.getLastColumn());
  rng.clearContent();
}

function applyPointsToStandings_(pointsByManager) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_STANDINGS);
  if (!sh) return;

  // Build current totals map (name in col A, points in col B)
  const data = sh.getDataRange().getValues();
  const header = data[0] || [];
  let map = new Map();
  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    const pts = Number(data[i][1]) || 0;
    if (name) map.set(name, {row: i+1, pts});
  }

  // Apply deltas
  pointsByManager.forEach((delta, mgr) => {
    const existing = map.get(mgr);
    const newTotal = (existing?.pts || 0) + delta;
    if (existing) {
      sh.getRange(existing.row, 2).setValue(newTotal);
    } else {
      sh.appendRow([mgr, newTotal]);
    }
  });
}

function awardPoints_(pointsByManager, roster, schoolName, pts) {
  // find which manager drafted this school
  for (const [mgr, teams] of roster.entries()) {
    if (teams.has(schoolName)) {
      pointsByManager.set(mgr, (pointsByManager.get(mgr) || 0) + pts);
    }
  }
}

function postseasonFromLabel_(label) {
  // map loose labels to your POSTSEASON_POINTS
  const L = label.toLowerCase();
  if (L.includes('championship')) return POSTSEASON_POINTS['National Champion'];
  if (L.includes('title game') || L.includes('final')) return POSTSEASON_POINTS['National Runner Up'];
  if (L.includes('final four')) return POSTSEASON_POINTS['Final Four'];
  if (L.includes('elite 8') || L.includes('elite eight')) return POSTSEASON_POINTS['Elite 8'];
  if (L.includes('sweet 16')) return POSTSEASON_POINTS['Sweet 16'];
  return 0;
}

function safeScore_(teamObj) {
  // works across older/newer seasons per API notes
  return Number(teamObj.final || teamObj.score || teamObj.points || 0);
}

function normalizeSchoolName_(s) {
  return (s || '').toString().trim()
    .replace(/\s+/g,' ')
    .replace(/St\.$/,'State')
    .replace(/Univ\.$/,'University');
}

/***** NCAA LOOKUPS & HTTP *****/
function getSchoolIndex_() {
  const cache = CacheService.getScriptCache();
  const key = 'schools-index';
  const hit = cache.get(key);
  if (hit) return new Map(JSON.parse(hit));

  // returns array of { name, conference, ... }
  const rows = fetchJson_(`${NCAA_API_BASE}/standings/basketball-men/d1`);
  const map = new Map();
  for (const row of (rows.data)) {
    const conference = row.conference;
    for (const school of row.standings){
        map.set(school.School, conference);
    }
  }
  cache.put(key, JSON.stringify([...map]), 21600); // 6 hours
  return map;
}

function fetchJson_(url) {
  Utilities.sleep(50); // gentle spacing (<5 rps)
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) return null;
  try {
    return JSON.parse(res.getContentText());
  } catch (e) { return null; }
}



function dailySync(){
    // /scoreboard/basketball-men/d1/yyyy/mm/dd/all-conf
    const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate.replace(/-/g,'/')}`);
    const top25Raw = fetchJson_(`{NCAA_API_BASE}/rankings/basketball-men/d1/associated-press`);
    const top25 = parseApPoll_(top25Raw);
    if (!dayGames || !dayGames.games) return;

    for (const team of roster) {
        for( const game of dayGames.games){
            let points = 0;
            const home = game.home.names.short;
            const away = game.away.names.short;
            const winner = game.home.winner ? home : away;
            if (winner == team){
                const homeConference = game.home.conferences.conferenceSeo;
                const awayConference = game.home.conferences.conferenceSeo;
                if (homeConference == awayConference){
                    // check conference tier
                    const tier = HIGH_MAJOR.has(homeConference) ? highMajor :
                                    HIGH_MID_MAJOR.has(homeConference) ? highMid :
                                    TRUE_MID_MAJOR.has(homeConference) ? trueMid :
                                    LOW_MAJOR.has(homeConference) ? lowMajor :
                                    null;
                    points = CONF_POINTS[tier][winnerSide === 'home' ? 'home' : 'road'];
                    if (top25.includes(winner)){
                        if (top25.indexOf(winner) < 10) {
                            points = points + 5;
                        }
                        else {
                            points = points + 2.5;
                        }
                    }
                }
                else {
                    // non conference tier
                }
                confTierDiff = checkConferenceTierDiff_(homeConference, awayConference);
            }
        }
    }
}

function parseApPoll_(json) {
  const teams = [];
  for (const row of (json.data || [])) {
    const name = normalizePollTeamName_(row.TEAM);
    const rank = Number(row.RANKING);
    teams.push({ name, rank, points: Number(row.POINTS) });
  }
  return teams;
}