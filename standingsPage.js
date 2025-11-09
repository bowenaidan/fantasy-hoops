const MANAGERS = ["Jackson", "Ethan", "Caleb", "Aidan", "Camden", "Will", "John", "Duy", "Kevin", "Eddie"];

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

function extractManagerScores_(standings, managers) {
  if (!standings || !Array.isArray(standings.rows) || standings.rows.length === 0) {
    return [];
  }
  if (!Array.isArray(managers) || managers.length === 0) {
    return [];
  }

  const headers = Array.isArray(standings.headers) ? standings.headers : [];
  const rows = standings.rows;
  const normalize = value => (value || '').toString().trim().toLowerCase();
  const safeIndex = (idx, row) => (idx >= 0 && idx < row.length ? row[idx] : '');

  let managerIdx = headers.findIndex(header => {
    const normalized = normalize(header);
    return normalized === 'manager' || normalized === 'team' || normalized === 'manager name' || normalized === 'name';
  });
  if (managerIdx === -1) {
    managerIdx = 0;
  }

  let scoreIdx = headers.findIndex(header => {
    const normalized = normalize(header);
    return (
      normalized === 'score' ||
      normalized === 'points' ||
      normalized === 'total points' ||
      normalized === 'total' ||
      normalized === 'total score'
    );
  });
  if (scoreIdx === -1) {
    if (headers.length > 1) {
      scoreIdx = managerIdx === 0 ? 1 : 0;
    } else {
      scoreIdx = -1;
    }
  }

  const rowsByManager = new Map();
  rows.forEach(row => {
    if (!Array.isArray(row)) {
      return;
    }
    const nameCell = safeIndex(managerIdx, row);
    const normalizedName = normalize(nameCell);
    if (!normalizedName) {
      return;
    }
    rowsByManager.set(normalizedName, row);
  });

  return managers.map(name => {
    const trimmedName = (name || '').toString().trim();
    const row = rowsByManager.get(trimmedName.toLowerCase());
    let score = '';
    if (row && scoreIdx !== -1) {
      const value = safeIndex(scoreIdx, row);
      const stringValue = (value || '').toString();
      if (stringValue.trim() !== '') {
        score = value;
      }
    }
    return {
      name: trimmedName,
      score: score
    };
  });
}

function doGet() {
  const standings = getStandingsData_();
  const managerScores = extractManagerScores_(standings, MANAGERS);
  const template = HtmlService.createTemplateFromFile('standings');
  template.standings = standings;
  template.managerScores = managerScores;
  const timeZone = Session.getScriptTimeZone() || 'America/Chicago';
  template.generatedAt = Utilities.formatDate(new Date(), timeZone, 'MMMM d, yyyy h:mm a z');
  return template
    .evaluate()
    .setTitle('Fantasy Hoops Standings')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}