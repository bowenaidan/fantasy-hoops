const SHEET_BUY_GAME_LOSSES = 'Buy Game Losses';

function applyBuyGameLossesToStandings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log('No active spreadsheet.');
    return;
  }

  const buySheet = ss.getSheetByName(SHEET_BUY_GAME_LOSSES);
  if (!buySheet) {
    Logger.log(`Sheet not found: ${SHEET_BUY_GAME_LOSSES}`);
    return;
  }

  const standingsSheet = ss.getSheetByName(SHEET_STANDINGS);
  if (!standingsSheet) {
    Logger.log(`Sheet not found: ${SHEET_STANDINGS}`);
    return;
  }

  const lossValues = buySheet.getDataRange().getValues();
  const lossMap = buildBuyGameLossMap_(lossValues);
  if (lossMap.size === 0) {
    Logger.log('No buy game losses found to apply.');
    return;
  }

  updateStandings_(lossMap);
}

function buildBuyGameLossMap_(values) {
  const lossMap = new Map();
  if (!Array.isArray(values)) return lossMap;

  values.forEach(row => {
    if (!Array.isArray(row) || row.length < 2) return;
    const [teamCell, lossCell] = row;
    const teamName = (teamCell || '').toString().trim();
    const normalizedTeam = normalizeSchoolName_(teamName);
    const numericLosses = Number(lossCell);

    if (!normalizedTeam || Number.isNaN(numericLosses) || numericLosses === 0) return;
    lossMap.set(normalizedTeam, (lossMap.get(normalizedTeam) || 0) + numericLosses);
  });

  return lossMap;
}
