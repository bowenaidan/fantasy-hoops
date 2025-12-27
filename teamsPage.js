function doGet() {
  return HtmlService.createHtmlOutputFromFile('teams')
    .setTitle('Fantasy Hoops Teams');
}

function getTeamsPageData() {
  const teams = readTable(SHEET_TEAMS);
  const liveScores = readTable(LIVE_SCORES);
  const managerTotalsMap = new Map();
  const managerDailyTotalMap = new Map();

  teams.forEach(team => {
    const manager = team?.manager || 'Unassigned';
    const points = Number(team?.points);
    const todayPoints = Number(team?.points_today);
    if (!isNaN(todayPoints)) {
      managerDailyTotalMap.set(manager, (managerDailyTotalMap.get(manager || 0) || 0) + todayPoints);
    }
    if (!isNaN(points)) {
      managerTotalsMap.set(manager, (managerTotalsMap.get(manager) || 0) + points);
    }
  });

  liveScores.forEach(r => {
    if (r.time instanceof Date) {
      r.time = Utilities.formatDate(r.time, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    } else {
      r.time = String(r.time ?? '');
    }
  });

  const managerDailyTotal = Array.from(managerDailyTotalMap.entries())
    .map(([manager, dailyPoints]) => ({ manager, dailyPoints }))
    .sort((a, b) => {
      if (b.dailyPoints === a.dailyPoints) {
        return a.manager.localeCompare(b.manager);
      }
      return b.dailyPoints - a.dailyPoints;
    });

  const managerTotals = Array.from(managerTotalsMap.entries())
    .map(([manager, totalPoints]) => ({ manager, totalPoints }))
    .sort((a, b) => {
      if (b.totalPoints === a.totalPoints) {
        return a.manager.localeCompare(b.manager);
      }
      return b.totalPoints - a.totalPoints;
    });
  
  Logger.log(liveScores);

  return {
    teams,
    managerTotals,
    managerDailyTotal,
    liveScores,
  };
}