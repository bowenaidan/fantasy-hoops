/***** CONFIG *****/
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me'; // public host (5 rps)
const SHEET_POINTS = 'Point Structure';
const SHEET_TEAMS = 'TEAMS';
const BUY_GAME_LOSSES = 'BUY_GAME_LOSSES';
const SHEET_DRAFT = '2025-2026 DRAFT';
const PROCESSED_GAME_KEYS_PROP = 'processedGameKeys';

// EDIT: define your tier lists (adjust to your league)
const CONFERENCE_TIER_MAP = new Map([
  ['acc', 'highMajor'],
  ['big-12', 'highMajor'],
  ['big-ten', 'highMajor'],
  ['sec', 'highMajor'],
  ['big-east', 'highMajor'],
  ['mountain-west', 'highMid'],
  ['atlantic-10', 'highMid'],
  ['wcc', 'highMid'],
  ['american', 'highMid'],
  ['mvc', 'trueMid'],
  ['cusa', 'trueMid'],
  ['ivy-league', 'trueMid'],
  ['big-west', 'trueMid'],
  ['socon', 'trueMid'],
  ['caa', 'trueMid'],
  ['sun-belt', 'trueMid'],
  ['mac', 'trueMid'],
  ['wac', 'lowMajor'],
  ['big-south', 'lowMajor'],
  ['big-sky', 'lowMajor'],
  ['southland', 'lowMajor'],
  ['horizon', 'lowMajor'],
  ['summit-league', 'lowMajor'],
  ['maac', 'lowMajor'],
  ['asun', 'lowMajor'],
  ['ovc', 'lowMajor'],
  ['patriot', 'lowMajor'],
  ['america-east', 'lowMajor'],
  ['swac', 'lowMajor'],
  ['meac', 'lowMajor'],
  ['nec', 'lowMajor']
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

function getConferenceTier_(seo) {
  if (!seo) return null;
  const tier = CONFERENCE_TIER_MAP.get(seo.toString().toLowerCase());
  if (!tier) return null;
  switch (tier) {
    case 'highMajor':
      return 3;
    case 'highMid':
      return 2;
    case 'trueMid':
      return 1;
    case 'lowMajor':
      return 0;
    default:
      return null;
  }
}

function buildRosterLookup_() {
  const lookup = new Map();
  ROSTER.forEach(name => {
    const normalized = normalizeSchoolName_(name);
    if (normalized) {
      lookup.set(normalized, name);
    }
  });
  return lookup;
}

function getGameKey_(game) {
  if (!game) return null;
  const gameID = game.gameID;

  if (gameID) return gameID.toString();

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

function getTeamPoints_(team) {
  const score = team?.score;
  const numeric = Number(score);
  if (!isNaN(numeric)) {
    return numeric;
  } else {
    return null;
  }
}

function isGameFinal_(game) {
  if (!game || !game.home || !game.away) return false;
  const homePoints = getTeamPoints_(game.home);
  const awayPoints = getTeamPoints_(game.away);
  if (homePoints !== null && awayPoints !== null) {
    if (homePoints === awayPoints) return false;
    const pointsWinnerIsHome = homePoints > awayPoints;
    const homeWinnerFlag = !!game.home?.winner;
    const awayWinnerFlag = !!game.away?.winner;
    if (pointsWinnerIsHome !== homeWinnerFlag) return false;
    if (pointsWinnerIsHome === awayWinnerFlag) return false;
  }

  const currentPeriod = (game.currentPeriod || '').toString().toLowerCase();
  const finalMessage = (game.finalMessage || '').toString().toLowerCase();
  const gameState = (game.gameState || '').toString().toLowerCase();
  const clock = (game.contestClock || '').toString();
  const hasWinner = game.home?.winner === true || game.away?.winner === true;

  return hasWinner
    && (currentPeriod === 'final' || currentPeriod === 'finished')
    && (finalMessage === '' || finalMessage === 'final')
    && (gameState === 'final' || gameState === 'post' || gameState === 'complete' || clock === '0:00');
}

function calculateGamePoints_(game, winnerIsHome) {
  const homeConference = game.home?.conferences?.[0]?.conferenceSeo;
  const awayConference = game.away?.conferences?.[0]?.conferenceSeo;
  const loserRank = winnerIsHome ? game.away?.rank : game.home?.rank;
  let gamePoints = 0;

  if (homeConference && awayConference && homeConference === awayConference) {
    const tierKey = CONFERENCE_TIER_MAP.get(homeConference);
    if (tierKey && CONF_POINTS[tierKey]) {
      gamePoints = CONF_POINTS[tierKey][winnerIsHome ? 'home' : 'road'];
    }
  } else {
    const winnerConference = winnerIsHome ? homeConference : awayConference;
    const loserConference = winnerIsHome ? awayConference : homeConference;
    const winnerTier = getConferenceTier_(winnerConference);
    const loserTier = getConferenceTier_(loserConference);
    const normalizedWinnerTier = (winnerTier === null || typeof winnerTier === 'undefined') ? -1 : winnerTier;
    const normalizedLoserTier = (loserTier === null || typeof loserTier === 'undefined') ? -1 : loserTier;
    const confDiff = normalizedLoserTier - normalizedWinnerTier;
    if (confDiff + 1 > 0) {
      gamePoints = (confDiff + 1) * 2;
    }
    if (normalizedWinnerTier === -1) {
      gamePoints -= 4;
    }
  }

  if (loserRank !== "" && loserRank !== null && loserRank !== "null" && loserRank <= 25) {
    if (loserRank <= 10) {
      gamePoints += 5;
    } else {
      gamePoints += 2.5;
    }
  }

  return gamePoints;
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
  properties.setProperty('updatedAt', Utilities.formatDate(new Date(), timeZone, 'h:mm a z'));
}

function dailySync(isoDate) {
  const pointMap = new Map();
  const rosterLookup = buildRosterLookup_();
  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate}/all-conf`);
  if (!dayGames || !dayGames.games) return;

  dayGames.games.forEach(wrapper => {
    const game = wrapper.game || wrapper;
    if (!isGameFinal_(game)) return;

    const home = game.home?.names?.short;
    const away = game.away?.names?.short;
    if (!home || !away) return;

    const winnerIsHome = !!game.home?.winner;
    const winnerName = winnerIsHome ? home : away;
    const normalizedWinner = normalizeSchoolName_(winnerName);
    const rosterName = rosterLookup.get(normalizedWinner);
    if (!rosterName) return;

    const gamePoints = calculateGamePoints_(game, winnerIsHome);
    pointMap.set(rosterName, (pointMap.get(rosterName) || 0) + gamePoints);

  });

  if (pointMap.size === 0) {
    Logger.log('No roster winners found for the provided date.');
    return;
  }

  Logger.log(JSON.stringify(Array.from(pointMap), null, 2));
  updateStandings_(pointMap);
}

function updateStandings_(pointMap) {
  if (!pointMap || pointMap.size === 0) return;

  let teams;
  try {
    teams = readTable(SHEET_TEAMS);
  } catch (err) {
    Logger.log(err);
    return;
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    Logger.log('No teams found to update.');
    return;
  }

  const normalizedIndex = new Map();
  teams.forEach((row, idx) => {
    const normalizedTeam = normalizeSchoolName_(row.team);
    if (normalizedTeam) {
      normalizedIndex.set(normalizedTeam, idx);
    }
  });

  pointMap.forEach((points, team) => {
    if (typeof points !== 'number' || isNaN(points)) return;
    const normalizedTeam = normalizeSchoolName_(team);
    const rowIndex = normalizedIndex.get(normalizedTeam);

    if (typeof rowIndex === 'undefined') {
      Logger.log(`Team not found in standings: ${team}`);
      return;
    }

    if (teams[rowIndex].points_today != points) {
      teams[rowIndex].points_today = points;
      Logger.log(`${team} : ${points}`);
    }
  });

  writeTable(SHEET_TEAMS, teams);
}