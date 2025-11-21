function updateOpponentCellsRunner() {
  const isoDate = getTodayIsoDate_();
  updateOpponentCellsForDate(isoDate);
}

function updateOpponentCellsForDate(isoDate) {
  if (!isoDate) {
    Logger.log('No date supplied for opponent sync.');
    return;
  }

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

  const rosterSet = new Set(ROSTER.map(name => normalizeSchoolName_(name)));
  const indexByTeam = buildOpponentColumnIndex_(sheet, rosterSet);
  if (indexByTeam.size === 0) {
    Logger.log('No roster teams found in standings sheet.');
    return;
  }

  clearOpponentCells_(sheet, indexByTeam);

  const dayGames = fetchJson_(`${NCAA_API_BASE}/scoreboard/basketball-men/d1/${isoDate}/all-conf`);
  if (!dayGames || !Array.isArray(dayGames.games) || dayGames.games.length === 0) {
    Logger.log(`No games returned for ${isoDate}.`);
    return;
  }

  const opponentMap = collectOpponentLabels_(dayGames.games, rosterSet);
  if (opponentMap.size === 0) {
    Logger.log(`No opponents found for roster on ${isoDate}.`);
    return;
  }

  opponentMap.forEach((label, team) => {
    const entry = indexByTeam.get(team);
    if (!entry) return;
    sheet.getRange(entry.row, entry.opponentCol).setValue(label);
  });
}

function buildOpponentColumnIndex_(sheet, rosterSet) {
  const index = new Map();
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow === 0 || lastCol === 0) return index;

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  values.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      if (colIdx >= row.length - 1) return; // ensure there is a points column
      if (typeof cell !== 'string') return;
      const team = normalizeSchoolName_(cell);
      if (!team || !rosterSet.has(team)) return;
      index.set(team, { row: rowIdx + 1, opponentCol: colIdx + 3 });
    });
  });
  return index;
}

function clearOpponentCells_(sheet, teamIndex) {
  teamIndex.forEach(entry => {
    sheet.getRange(entry.row, entry.opponentCol).clearContent();
  });
}

function collectOpponentLabels_(games, rosterSet) {
  const opponents = new Map();
  games.forEach(wrapper => {
    const game = wrapper.game || wrapper;
    if (!game || !game.home || !game.away) return;
    const homeShort = (game.home.names && game.home.names.short) || game.home.alias || game.home.name;
    const awayShort = (game.away.names && game.away.names.short) || game.away.alias || game.away.name;
    const homeRank = game.home.rank;
    const awayRank = game.away.rank;
    if (!homeShort || !awayShort) return;

    const homeNormalized = normalizeSchoolName_(homeShort);
    const awayNormalized = normalizeSchoolName_(awayShort);

    if (rosterSet.has(homeNormalized) && !opponents.has(homeNormalized)) {
      opponents.set(homeNormalized, `vs ${awayShort} ${awayRank ? `(${awayRank})` : ''}`.trim());
    }
    if (rosterSet.has(awayNormalized) && !opponents.has(awayNormalized)) {
      opponents.set(awayNormalized, `@ ${homeShort} ${homeRank ? `(${homeRank})` : ''}`.trim());
    }
  });
  return opponents;
}

function getTodayIsoDate_() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
