const MANAGERS = ["Jackson", "Aidan", "Caleb", "Camden", "John", "Kevin", "Ethan", "Will", "Duy", "Eddie"];

// const COPY_SHEET_STANDINGS = "Copy of Standings";

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
    return { headers: [], managerColumnIndex: -1, scoreColumnIndex: -1, entries: [] };
  }
  if (!Array.isArray(managers) || managers.length === 0) {
    return { headers: [], managerColumnIndex: -1, scoreColumnIndex: -1, entries: [] };
  }

  const headers = Array.isArray(standings.headers) ? standings.headers : [];
  const rows = standings.rows;
  const normalize = value => (value || '').toString().trim().toLowerCase();
  const safeIndex = (idx, row) => (idx >= 0 && idx < row.length ? row[idx] : '');
  const hasCellData = value => {
    if (value === null || typeof value === 'undefined') {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    return value !== '';
  };

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

  const sanitizedHeaders = headers.map((header, idx) => {
    if (header === null || typeof header === 'undefined') {
      return `Column ${idx + 1}`;
    }
    const stringValue = header.toString();
    return stringValue.trim() === '' ? `Column ${idx + 1}` : stringValue;
  });

  const managerNameSet = new Set(
    managers
      .map(name => normalize(name))
      .filter(Boolean)
  );

  const entriesByManager = new Map();
  const emptyRow = () => sanitizedHeaders.map(() => '');
  let activeManagerKey = null;

  rows.forEach(row => {
    if (!Array.isArray(row)) {
      activeManagerKey = null;
      return;
    }
    const limitedRow = sanitizedHeaders.map((_, idx) => {
      const value = safeIndex(idx, row);
      if (value === null || typeof value === 'undefined') {
        return '';
      }
      return value;
    });

    const rowHasData = limitedRow.some(hasCellData);
    if (!rowHasData) {
      activeManagerKey = null;
      return;
    }

    const nameCell = safeIndex(managerIdx, row);
    const normalizedName = normalize(nameCell);

    if (managerNameSet.has(normalizedName)) {
      const existing = entriesByManager.get(normalizedName) || { managerRow: emptyRow(), teams: [] };
      existing.managerRow = limitedRow;
      entriesByManager.set(normalizedName, existing);
      activeManagerKey = normalizedName;
      return;
    }

    if (activeManagerKey) {
      const existing = entriesByManager.get(activeManagerKey) || { managerRow: emptyRow(), teams: [] };
      existing.teams.push(limitedRow);
      entriesByManager.set(activeManagerKey, existing);
    }
  });

  const entries = managers.map(name => {
    const trimmedName = (name || '').toString().trim();
    const normalizedName = normalize(trimmedName);
    const stored = entriesByManager.get(normalizedName) || { managerRow: emptyRow(), teams: [] };
    const row = Array.isArray(stored.managerRow) ? stored.managerRow : emptyRow();
    let score = '';
    if (Array.isArray(row) && scoreIdx !== -1) {
      const value = safeIndex(scoreIdx, row);
      const stringValue = (value || '').toString();
      if (stringValue.trim() !== '') {
        score = value;
      }
    }
    return {
      name: trimmedName,
      score,
      row,
      teams: Array.isArray(stored.teams) ? stored.teams : []
    };
  });

  const parseScoreForSort = value => {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      if (normalized === '') {
        return null;
      }
      const parsed = parseFloat(normalized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  };

  const sortedEntries = (scoreIdx !== -1)
    ? entries
        .map((entry, index) => {
          const parsedScore = parseScoreForSort(entry.score);
          const numericScore = parsedScore === null ? Number.NEGATIVE_INFINITY : parsedScore;
          return { entry, index, numericScore };
        })
        .sort((a, b) => {
          if (b.numericScore !== a.numericScore) {
            return b.numericScore - a.numericScore;
          }
          return a.index - b.index;
        })
        .map(wrapper => wrapper.entry)
    : entries;

  return {
    headers: sanitizedHeaders,
    managerColumnIndex: managerIdx,
    scoreColumnIndex: scoreIdx,
    entries: sortedEntries
  };
}

function getTeamEntries_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No active spreadsheet found.');
  }
  const sheet = ss.getSheetByName('Teams');
  if (!sheet) {
    return { entries: [] };
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values || values.length < 2) {
    return { entries: [] };
  }

  const headers = values[0].map((header, idx) => {
    if (header === null || typeof header === 'undefined') {
      return `Column ${idx + 1}`;
    }
    const stringValue = header.toString();
    return stringValue.trim() === '' ? `Column ${idx + 1}` : stringValue;
  });

  const normalizedHeaders = headers.map(header => (header || '').toString().trim().toLowerCase());
  const findColumnIndex = (candidates, fallbackIndex = -1) => {
    const idx = normalizedHeaders.findIndex(header => candidates.some(candidate => header === candidate || header.indexOf(candidate) !== -1));
    if (idx !== -1) return idx;
    if (fallbackIndex >= 0 && fallbackIndex < headers.length) return fallbackIndex;
    return -1;
  };

  const ownerIdx = findColumnIndex(['owner', 'manager']);
  const teamIdx = findColumnIndex(['team', 'school', 'name'], 1);
  const pointsIdx = findColumnIndex(['points', 'score', 'total']);
  const rankIdx = findColumnIndex(['rank', 'ap']);
  const opponentIdx = findColumnIndex(['opponent', 'opp']);

  const safeCell = (idx, row) => {
    if (!Array.isArray(row) || idx < 0 || idx >= row.length) return '';
    const value = row[idx];
    if (value === null || typeof value === 'undefined') return '';
    return value;
  };

  const hasData = value => {
    if (value === null || typeof value === 'undefined') return false;
    if (typeof value === 'string') return value.trim() !== '';
    return value !== '';
  };

  const parsePoints = value => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const normalized = value.replace(/,/g, '').trim();
      if (normalized === '') return null;
      const parsed = parseFloat(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const entries = values
    .slice(1)
    .filter(row => {
      const teamValue = safeCell(teamIdx, row);
      return hasData(teamValue);
    })
    .map((row, index) => {
      const pointsValue = safeCell(pointsIdx, row);
      const numericPoints = parsePoints(pointsValue);
      return {
        owner: safeCell(ownerIdx, row),
        team: safeCell(teamIdx, row),
        points: pointsValue,
        numericPoints,
        rank: safeCell(rankIdx, row),
        opponent: safeCell(opponentIdx, row),
        index
      };
    })
    .sort((a, b) => {
      const scoreA = a.numericPoints === null ? Number.NEGATIVE_INFINITY : a.numericPoints;
      const scoreB = b.numericPoints === null ? Number.NEGATIVE_INFINITY : b.numericPoints;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.index - b.index;
    })
    .map(entry => {
      const { numericPoints, ...rest } = entry;
      return rest;
    });

  return { entries };
}

function doGet() {
  const standings = getStandingsData_();
  const managerScores = extractManagerScores_(standings, MANAGERS);
  const teamStandings = getTeamEntries_();
  const template = HtmlService.createTemplateFromFile('standings');
  template.standings = standings;
  template.managerScores = managerScores;
  template.teamEntries = Array.isArray(teamStandings.entries) ? teamStandings.entries : [];
  const properties = PropertiesService.getDocumentProperties();
  template.generatedAt = properties.getProperty('updatedAt');
  return template
    .evaluate()
    .setTitle('Fantasy Hoops Standings')
    .setFaviconUrl('https://drive.google.com/uc?id=1jrs17VqgPU22dXWgMJSNRMjvOOcJcVzA&export=download&format=png')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}