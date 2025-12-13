const TABLE_TEAMS = 'TEAMS';

function updateOpponentCellsRunner() {
  const isoDate = getTodayIsoDate_();
  updateOpponentCellsForDate(isoDate);
}

function updateOpponentCellsForDate(isoDate) {
  if (!isoDate) {
    Logger.log('No date supplied for opponent sync.');
    return;
  }

  let teams;
  try {
    teams = readTable(SHEET_TEAMS);
  } catch (err) {
    Logger.log(err);
    return;
  }
  settleScores(teams);

  if (!Array.isArray(teams) || teams.length === 0) {
    Logger.log('No teams found in standings sheet.');
    return;
  }

  const normalizedIndex = new Map();
  teams.forEach((row, idx) => {
    const normalizedTeam = normalizeSchoolName_(row.team);
    if (normalizedTeam) {
      normalizedIndex.set(normalizedTeam, idx);
    }
  });

  resetOpponentData_(teams, normalizedIndex);

  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate}/all-conf`);
  if (!dayGames || !Array.isArray(dayGames.games) || dayGames.games.length === 0) {
    Logger.log(`No games returned for ${isoDate}.`);
    writeTable(TABLE_TEAMS, teams);
    return;
  }

  dayGames.games.forEach(wrapper => {
    const game = wrapper.game || wrapper;
    if (!game || !game.home || !game.away) return;

    const homeShort = (game.home.names && game.home.names.short) || game.home.alias || game.home.name;
    const awayShort = (game.away.names && game.away.names.short) || game.away.alias || game.away.name;

    if (!homeShort || !awayShort) return;

    const homeNormalized = normalizeSchoolName_(homeShort);
    const awayNormalized = normalizeSchoolName_(awayShort);

    const homeIdx = normalizedIndex.get(homeNormalized);
    const awayIdx = normalizedIndex.get(awayNormalized);

    if (typeof homeIdx !== 'undefined') {
      applyOpponentData_(
        teams[homeIdx],
        game,
        {
          opponentName: awayShort,
          opponentRank: game.away?.rank,
          opponentConference: game.away?.conferences?.[0]?.conferenceSeo
        },
        true
      );
    }

    if (typeof awayIdx !== 'undefined') {
      applyOpponentData_(
        teams[awayIdx],
        game,
        {
          opponentName: homeShort,
          opponentRank: game.home?.rank,
          opponentConference: game.home?.conferences?.[0]?.conferenceSeo
        },
        false
      );
    }
  });

  writeTable(TABLE_TEAMS, teams);
}

function resetOpponentData_(teams, normalizedIndex) {
  if (!normalizedIndex || normalizedIndex.size === 0) return;
  normalizedIndex.forEach(idx => {
    const row = teams[idx];
    if (row) {
      row.opponent = '';
      row.opponent_rank = '';
      row.opponent_conference = '';
      row.potential_points = 0;
    }
  });
}

function applyOpponentData_(row, game, { opponentName, opponentRank, opponentConference }, winnerIsHome) {
  if (!row) return;
  row.opponent = opponentName || '';
  row.opponent_rank = opponentRank || '';
  row.opponent_conference = opponentConference || '';

  if (typeof calculateGamePoints_ === 'function') {
    const potentialPoints = calculateGamePoints_(game, winnerIsHome);
    if (typeof potentialPoints === 'number' && !isNaN(potentialPoints)) {
      row.potential_points = potentialPoints;
    }
  }
}

function getTodayIsoDate_() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

function settleScores(sheetName){
  const teams = sheetName;
  teams.forEach(rows => {
    rows.points = rows.points + rows.points_today;
    if (rows.points_today){
      Logger.log(`${rows.team} settling ${rows.points_today}.`);
    }
    rows.points_today = 0;
  });
}

function calculateLostPoints() {
  let teams = readTable(SHEET_TEAMS);
  let losses = readTable(BUY_GAME_LOSSES);

  losses.forEach(row => {
    let teamObj = teams.find(t => t.team === row.team);
    Logger.log(teamObj);

    if (teamObj) {
      teamObj.points = Number(teamObj.points) + Number(row.points);
    } else {
      Logger.log("Team not found in TEAMS sheet: " + row.team);
    }
  });

  writeTable(SHEET_TEAMS, teams);
}