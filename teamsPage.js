function doGet() {
  return HtmlService.createHtmlOutputFromFile('teams')
    .setTitle('Fantasy Hoops Teams');
}

function getTeamsPageData() {
  const teams = readTable(SHEET_TEAMS);
  const managerTotalsMap = new Map();

  teams.forEach(team => {
    const manager = team?.manager || 'Unassigned';
    const points = Number(team?.points);
    if (!isNaN(points)) {
      managerTotalsMap.set(manager, (managerTotalsMap.get(manager) || 0) + points);
    }
  });

  const managerTotals = Array.from(managerTotalsMap.entries())
    .map(([manager, totalPoints]) => ({ manager, totalPoints }))
    .sort((a, b) => {
      if (b.totalPoints === a.totalPoints) {
        return a.manager.localeCompare(b.manager);
      }
      return b.totalPoints - a.totalPoints;
    });

  return {
    teams,
    managerTotals,
  };
}