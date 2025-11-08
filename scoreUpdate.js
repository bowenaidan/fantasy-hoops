/***** CONFIG *****/
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me'; // public host (5 rps)
const SHEET_POINTS = 'Point Structure';
const SHEET_STANDINGS = '2025-2026 Standings';
const SHEET_DRAFT = '2025-2026 DRAFT';

// EDIT: define your tier lists (adjust to your league)
const HIGH_MAJOR = new Set([
  'acc','big-12','big-ten','sec','big-east'
]);
const HIGH_MID_MAJOR = new Set([
  'mountain-west','atlantic-10','wcc','american'
]);
const TRUE_MID_MAJOR = new Set([
  'mvc','cusa','ivy-league','big-west','socon','caa', 'sun-belt', 'mac'
]);
const LOW_MAJOR = new Set([
  'wac','big-south','big-sky','southland','horizon','summit-league', 'maac', 'asun', 'ovc', 'patriot', 'america-east', 'swac', 'meac', 'nec'
]);

const ROSTER = ["UConn", "BYU", "High Point", "Michigan St.", "Saint Louis", "Marquette", "South Fla.", "UC Irvine", "Norfolk St.", "UNCW",
                "Kentucky", "Tennessee", "Saint Mary's (CA)", "Utah St.", "VMI", "North Dakota St.", "Drake", "Virginia", "UMBC", "Texas A&M", "Houston", "Illinois", "Memphis", "Southern California", "NC State", "UNI", "Vermont", "Ole Miss", "Bethune-Cookman", "Oklahoma St.", 
                "Florida", "UCLA", "Louisville", "George Mason", "Creighton", "North Carolina", "Arkansas St.", "UC Santa Barbara", "Little Rock", "Colorado St.", 
                "Duke", "Arkansas", "Iowa St.", "VCU", "Towson", "Wisconsin", "Siena", "Miama (FL)", "California Baptist", "Villanova", 
                "Michigan", "Gonzaga", "Clemson", "Grand Canyon", "Illinois St.", "St. Thomas (MN)", "Cincinatti", "Charleston", "Utah Valley", "Wichita St.", 
                "St. John's (NY)", "Texas Tech", "Liberty", "McNeese", "Mississippi St.", "Montana", "George Washington", "Indiana", "Iowa", "Kent St.", 
                "Purdue", "Alabama", "Auburn", "San Francisco", "Chattanooga", "Ohio St.", "Queens (NC)", "Tulsa", "James Madison", "Notre Dame", 
                "Kansas", "San Diego St.", "Baylor", "Yale", "Vanderbilt", "Texas", "Lamar University", "Maryland", "Washington", "Hawaii", 
                "Oregon", "Arizona", "Dayton", "Akron", "Robert Morris", "Missouri", "SMU", "Butler", "Pepperdine", "LSU"];


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

function getGames() {
  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/2025/11/07/all-conf`);
  // Logger.log(JSON.stringify(dayGames.games?.[0], null, 2));
  for (const games of dayGames.games) {
    if (games.game.away.names.short === "Kansas"){
      Logger.log(games);
      Logger.log(games.game.away.conferences);
      Logger.log(games.game.home.conferences);
    }
  }
}

function fetchJson_(url) {
  Utilities.sleep(50); // gentle spacing (<5 rps)
  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) return null;
  try {
    return JSON.parse(res.getContentText());
  } catch (e) { return null; }
}

function parseApPoll_(json) {
  return (json.data || [])
    .map(row => normalizeSchoolName_(
      (row.TEAM || '').replace(/\s*\(.*?\).*/, '').trim()
    ));
}

function normalizeSchoolName_(s) {
  return (s || '').toString().trim()
    .replace(/\s+/g,' ')
    .replace(/St\.$/,'State')
    .replace(/Univ\.$/,'University');
}

function dailySync(isoDate) {
  var pointMap = new Map();
  // /scoreboard/basketball-men/d1/yyyy/mm/dd/all-conf
  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate}/all-conf`);
  const top25Raw = fetchJson_(`${NCAA_API_BASE}/rankings/basketball-men/d1/associated-press`);
  const top25 = parseApPoll_(top25Raw);
  if (!dayGames || !dayGames.games) return;
  const roster = ROSTER;
  for (const team of roster) {
    for( const games of dayGames.games){
      var points = 0;
      const home = games.game.home.names.short;
      const away = games.game.away.names.short;
      const winner = games.game.home.winner ? home : away;
      const loser = games.game.home.winner ? away : home;
      if (winner == team){
        const homeConference = games.game.home.conferences[0].conferenceSeo;
        const awayConference = games.game.away.conferences[0].conferenceSeo;
        const winnerConference = (winner === home) ? homeConference : awayConference;
        const loserConference = (winner === home) ? awayConference : homeConference;
        if (homeConference == awayConference){
          // check conference tier
          const tier = HIGH_MAJOR.has(homeConference) ? highMajor :
                          HIGH_MID_MAJOR.has(homeConference) ? highMid :
                          TRUE_MID_MAJOR.has(homeConference) ? trueMid :
                          LOW_MAJOR.has(homeConference) ? lowMajor :
                          null;
          points = CONF_POINTS[tier][winner === 'home' ? 'home' : 'road'];
        }
        else {
          const winnerTier = HIGH_MAJOR.has(winnerConference) ? 3 :
                          HIGH_MID_MAJOR.has(winnerConference) ? 2 :
                          TRUE_MID_MAJOR.has(winnerConference) ? 1 :
                          LOW_MAJOR.has(winnerConference) ? 0 :
                          -1;
          const loserTier = HIGH_MAJOR.has(loserConference) ? 3 :
                          HIGH_MID_MAJOR.has(loserConference) ? 2 :
                          TRUE_MID_MAJOR.has(loserConference) ? 1 :
                          LOW_MAJOR.has(loserConference) ? 0 :
                          -1;
          const confDiff = loserTier - winnerTier;
          if (confDiff + 1 > 0) {
            points = (confDiff + 1) * 2;
          }
          if (winnerTier == -1) {
            points = -4;
          }
        }
        if (top25.includes(loser)){
          if (top25.indexOf(loser) < 10) {
            points = points + 5;
          }
          else {
            points = points + 2.5;
          }
        }
        break;
      }
    }
    Logger.log(team + ": " + points);
    pointMap.set(team, points);
  }
  Logger.log(JSON.stringify(Array.from(pointMap), null, 2));
}

const d = new Date();
d.setDate(d.getDate() - 1);
const yyyy = d.getFullYear();
const mm = String(d.getMonth() + 1).padStart(2, '0');
const dd = String(d.getDate()).padStart(2, '0');
isoDate = `${yyyy}/${mm}/${dd}`;

dailySync(isoDate);