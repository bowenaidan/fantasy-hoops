MANAGERS = ["Jackson", "Ethan", "Caleb", "Aidan", "Camden", "Will", "John", "Duy", "Kevin", "Eddie"];

function getStandingsData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No active spreadsheet found.');
  }
  if (typeof SHEET_STANDINGS === 'undefined' || !SHEET_STANDINGS) {
    throw new Error('SHEET_STANDINGS constant is not defined.');
  }
  const sheet = ss.getSheetByName(SHEET_STANDINGS);
  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_STANDINGS}`);
  }
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  if (!values || values.length === 0) {
    return { headers: [], rows: [] };
  }
  let headers = values[0];
  let lastColIndex = headers.length - 1;
  const hasData = cell => {
    if (cell === null || typeof cell === 'undefined') {
      return false;
    }
    if (typeof cell === 'string') {
      return cell.trim() !== '';
    }
    return cell !== '';
  };

  while (lastColIndex >= 0) {
    const columnHasData = values.some(row => hasData(row[lastColIndex]));
    if (columnHasData) {
      break;
    }
    lastColIndex--;
  }

  if (lastColIndex < headers.length - 1) {
    headers = headers.slice(0, lastColIndex + 1);
  }

  const rows = values
    .slice(1)
    .map(row => row.slice(0, lastColIndex + 1))
    .filter(row => row.some(cell => hasData(cell)));
  return { headers, rows };
}

function doGet() {
  const standings = getStandingsData_();
  const template = HtmlService.createTemplateFromFile('standings');
  template.standings = standings;
  const timeZone = Session.getScriptTimeZone() || 'America/Chicago';
  template.generatedAt = Utilities.formatDate(new Date(), timeZone, 'MMMM d, yyyy h:mm a z');
  return template
    .evaluate()
    .setTitle('Fantasy Hoops Standings')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}