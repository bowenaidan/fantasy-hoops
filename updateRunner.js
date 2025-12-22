function updateRunner(isoDate) {
  const targetIsoDate = isoDate || getTodayIsoDate_();
  dailySync(targetIsoDate);
}

function updateAndSettleYesterdayRunner() {
  const isoDate = getYesterdayIsoDate_();
  Logger.log(`Running updates for ${isoDate}`);
  updateRunner(isoDate);
  settleScoresForSheet_();
}

function settleScoresForSheet_() {
  let teams;
  try {
    teams = readTable(SHEET_TEAMS);
  } catch (err) {
    Logger.log(err);
    return;
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    Logger.log('No teams found to settle.');
    return;
  }

  settleScores(teams);
  writeTable(SHEET_TEAMS, teams);
}

function getTodayIsoDate_() {
  return getIsoDateDaysAgo_(0);
}

function getYesterdayIsoDate_() {
  return getIsoDateDaysAgo_(1);
}

function getIsoDateDaysAgo_(daysAgo) {
  const d = new Date();
  d.setHours(d.getHours() - 3 - (24 * (Number(daysAgo) || 0)));
  Logger.log(d);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}
