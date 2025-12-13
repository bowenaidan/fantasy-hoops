function resetStandingsToZero() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('No active spreadsheet.');
    return;
  }
  const sheet = ss.getSheetByName(SHEET_TEAMS);
  if (!sheet) {
    Logger.log(`Sheet not found: ${SHEET_TEAMS}`);
    return;
  }

  let teams = readTable(SHEET_TEAMS);
  teams.forEach(r => {
    r.points = 0;
  });

  writeTable(SHEET_TEAMS, teams)
}