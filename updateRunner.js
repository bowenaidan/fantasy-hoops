function updateRunner() {
  isoDate = getTodayIsoDate_();
  dailySync(isoDate);
}

function getTodayIsoDate_() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  Logger.log(d);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}