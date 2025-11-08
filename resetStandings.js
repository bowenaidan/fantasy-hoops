function resetStandingsToZero() {
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
  if (lastRow === 0 || lastCol === 0) return;

  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getValues();
  const resetValues = values.map(row => row.map(cell => {
    if (typeof cell === 'number' && !isNaN(cell)) return 0;
    return cell;
  }));
  range.setValues(resetValues);
}