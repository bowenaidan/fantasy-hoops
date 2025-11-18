/***** CONFIG *****/
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me'; // public host (5 rps)
const SHEET_POINTS = 'Point Structure';
const SHEET_STANDINGS = 'Standings';
const SHEET_DRAFT = '2025-2026 DRAFT';
const PROCESSED_GAME_KEYS_PROP = 'processedGameKeys';

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
                "Duke", "Arkansas", "Iowa St.", "VCU", "Towson", "Wisconsin", "Siena", "Miami (FL)", "California Baptist", "Villanova", 
                "Michigan", "Gonzaga", "Clemson", "Grand Canyon", "Illinois St.", "St. Thomas (MN)", "Cincinnati", "Charleston", "Utah Valley", "Wichita St.", 
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
    .replace(/\bState\b/g, 'St.')
}

function getGameKey_(game) {
  if (!game) return null;
  const candidates = [
    game.id,
    game.gameId,
    game.url,
    game.gameUrl,
    game.boxscoreUrl,
    game.summaryUrl
  ];
  for (const candidate of candidates) {
    if (candidate) return candidate.toString();
  }
  const home = game.home.names.short;
  const away = game.away.names.short;
  const startEpoch = game.startTimeEpoch;
  if (home && away && startEpoch) {
    return `${startEpoch}:${home}:${away}`;
  }
  if (home && away) {
    return `${home}:${away}`;
  }
  return null;
}

function loadProcessedGameKeys_() {
  try {
    const properties = PropertiesService.getDocumentProperties();
    const stored = properties.getProperty(PROCESSED_GAME_KEYS_PROP);
    if (!stored) {
      return new Set();
    }
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return new Set(parsed);
    }
  } catch (err) {
    Logger.log('Failed to load processed game keys; resetting store.');
  }
  PropertiesService.getDocumentProperties().deleteProperty(PROCESSED_GAME_KEYS_PROP);
  return new Set();
}

function saveProcessedGameKeys_(processedGameSet) {
  const properties = PropertiesService.getDocumentProperties();
  const serialized = JSON.stringify(Array.from(processedGameSet));
  properties.setProperty(PROCESSED_GAME_KEYS_PROP, serialized);
  const timeZone = Session.getScriptTimeZone() || 'America/Chicago';
  properties.setProperty('updatedAt', Utilities.formatDate(new Date(), timeZone, 'MMMM d, yyyy h:mm a z'));
}

function dailySync(isoDate) {
  var pointMap = new Map();
  // /scoreboard/basketball-men/d1/yyyy/mm/dd/all-conf
  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate}/all-conf`);
  if (!dayGames || !dayGames.games) return;
  Logger.log(JSON.stringify(dayGames, null, 2));
  const processedGameSet = loadProcessedGameKeys_();
  const roster = ROSTER;
  for (const team of roster) {
    let points = 0;
    for (const games of dayGames.games) {
      if (games.game.currentPeriod == "FINAL" 
        && games.game.finalMessage == "FINAL" 
        && games.game.gameState == "final" 
        && (games.game.home.winner || games.game.away.winner)){
        const gameKey = getGameKey_(games.game);
        if (gameKey && processedGameSet.has(gameKey)) {
          continue;
        }
        const home = games.game.home.names.short;
        const away = games.game.away.names.short;
        const winner = games.game.home.winner ? home : away;
        const loser = games.game.home.winner ? away : home;
        const loserRank = loser === away ? games.game.away.rank : games.game.home.rank;
        if (winner == team){
          const homeConference = games.game.home.conferences[0].conferenceSeo;
          const awayConference = games.game.away.conferences[0].conferenceSeo;
          const winnerConference = (winner === home) ? homeConference : awayConference;
          const loserConference = (winner === home) ? awayConference : homeConference;
          let gamePoints = 0;
          if (homeConference == awayConference){
            // check conference tier
            const tier = HIGH_MAJOR.has(homeConference) ? 'highMajor' :
                            HIGH_MID_MAJOR.has(homeConference) ? 'highMid' :
                            TRUE_MID_MAJOR.has(homeConference) ? 'trueMid' :
                            LOW_MAJOR.has(homeConference) ? 'lowMajor' :
                            null;
            if (tier) {
              gamePoints = CONF_POINTS[tier][winner === home ? 'home' : 'road'];
            }
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
              gamePoints = (confDiff + 1) * 2;
            }
            if (winnerTier == -1) {
              gamePoints = gamePoints - 4;
            }
          }
          if (loserRank != "" && loserRank != null && loserRank != "null" && loserRank <= 25){
            if (loserRank <= 10) {
              gamePoints = gamePoints + 5;
            }
            else {
              gamePoints = gamePoints + 2.5
            }
          }
          points += gamePoints;
          if (gameKey) {
            processedGameSet.add(gameKey);
          }
          break;
        }
      }
    }
    Logger.log(team + ": " + points);
    pointMap.set(team, points);
  }
  Logger.log(JSON.stringify(Array.from(pointMap), null, 2));
  Logger.log(dayGames);
  updateStandings_(pointMap);
  saveProcessedGameKeys_(processedGameSet);
}

function updateStandings_(pointMap) {
  if (!pointMap || pointMap.size === 0) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('No active spreadsheet.');
    return;
  }
  const sheet = ss.getSheetByName(SHEET_STANDINGS);
  if (!sheet) {
    Logger.log(`Sheet not found: ${SHEET_STANDINGS}`);
    return;
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol < 2) return;

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const indexByTeam = new Map();

  values.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      if (colIdx >= row.length - 1) return; // need a points column to the right
      if (typeof cell !== 'string') return;
      const teamName = normalizeSchoolName_(cell);
      if (!teamName) return;
      const pointsCellValue = row[colIdx + 1];
      const currentTotal = Number(pointsCellValue) || 0;
      indexByTeam.set(teamName, { row: rowIdx + 1, col: colIdx + 2, total: currentTotal });
    });
  });

  pointMap.forEach((points, team) => {
    if (typeof points !== 'number' || isNaN(points)) return;
    const normalizedTeam = normalizeSchoolName_(team);
    const entry = indexByTeam.get(normalizedTeam);
    if (!entry) {
      Logger.log(`Team not found in standings: ${team}`);
      return;
    }
    const newTotal = entry.total + points;
    sheet.getRange(entry.row, entry.col).setValue(newTotal);
    entry.total = newTotal;
  });
}