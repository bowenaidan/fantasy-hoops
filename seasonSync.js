const DEFAULT_SEASON_START_ISO = '2025/11/03';

function seasonSyncRunner(options) {
  runSeasonDailySync_(DEFAULT_SEASON_START_ISO, getTodayIsoDate_(), options || {});
}

function seasonSyncForRange(startIsoDate, endIsoDate, options) {
  runSeasonDailySync_(startIsoDate, endIsoDate || getTodayIsoDate_(), options || {});
}

function runSeasonDailySync_(startIsoDate, endIsoDate, options) {
  const start = parseIsoDate_(startIsoDate);
  const today = parseIsoDate_(getTodayIsoDate_());
  const suppliedEnd = parseIsoDate_(endIsoDate);

  if (!start || !suppliedEnd || !today) {
    Logger.log('Invalid start or end date supplied for season sync.');
    return;
  }

  const effectiveEnd = suppliedEnd > today ? today : suppliedEnd;
  if (start > effectiveEnd) {
    Logger.log(`Start date ${startIsoDate} is after end date ${endIsoDate}.`);
    return;
  }

  Logger.log('Resetting processed game keys before running season sync.');
  resetProcessedGameKeys();

  let cursor = new Date(start.getTime());
  while (cursor <= effectiveEnd) {
    const isoDate = formatIsoDate_(cursor);
    Logger.log(`Running daily sync for ${isoDate}`);
    dailySync(isoDate);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function resetProcessedGameKeys() {
  const properties = PropertiesService.getDocumentProperties();
  properties.deleteProperty(PROCESSED_GAME_KEYS_PROP);
}

function parseIsoDate_(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return null;
  const parts = isoDate.split('/').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return isNaN(date.getTime()) ? null : date;
}

function formatIsoDate_(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}