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
    const loserName = winnerIsHome ? away : home;
    const normalizedWinner = normalizeSchoolName_(winnerName);
    const normalizedLoser = normalizeSchoolName_(loserName);
    const winnerRosterName = rosterLookup.get(normalizedWinner);
    const loserRosterName = rosterLookup.get(normalizedLoser);

    if (!winnerRosterName && !loserRosterName) return;

    const gamePoints = calculateGamePoints_(game, winnerIsHome);
    if (winnerRosterName) {
      pointMap.set(winnerRosterName, (pointMap.get(winnerRosterName) || 0) + gamePoints);
    }

    const winnerConference = winnerIsHome
      ? game.home?.conferences?.[0]?.conferenceSeo
      : game.away?.conferences?.[0]?.conferenceSeo;
    const winnerTier = getConferenceTier_(winnerConference);
    const normalizedWinnerTier = (winnerTier === null || typeof winnerTier === 'undefined') ? -1 : winnerTier;

    if (loserRosterName && normalizedWinnerTier === -1) {
      pointMap.set(loserRosterName, (pointMap.get(loserRosterName) || 0) - 4);
    }

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