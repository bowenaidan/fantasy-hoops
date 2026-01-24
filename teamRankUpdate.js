function updateApPollRanksRunner() {
  const rankMap = loadApPollRankings_();
  if (!rankMap || rankMap.size === 0) {
    Logger.log('No AP poll rankings available.');
    return;
  }
  applyApPollRanks_(rankMap);
}

function loadApPollRankings_() {
  const json = fetchJson_(AP_POLL_ENDPOINT);
  const entries = parseApPollRanks_(json);
  const map = new Map();
  entries.forEach(entry => map.set(entry.team, entry.rank));
  return map;
}

function normalizeSchoolNameAP_(s) {
  return (s || '').toString()
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g,' ')
    .replace(/\bState\b/g, 'St.')
    .trim()
}

function parseApPollRanks_(json) {
  const rankings = [];
  if (!json) return rankings;

  const addEntry = (team, rank) => {
    if (!team) return;
    const numRank = Number(rank);
    if (!numRank || numRank < 1 || numRank > 25) return;
    const normalized = normalizeSchoolNameAP_(team);
    if (!normalized) return;
    rankings.push({ team: normalized, rank: numRank });
  };

  if (Array.isArray(json.data)) {
    json.data.forEach((row, idx) => {
      const rank = row.RANK || row.rank || row.ranking || row.apRank || idx + 1;
      const team = row.TEAM || row.team || row.school || row.SCHOOL || row['SCHOOL (1ST VOTES)'];
      addEntry(team, rank);
    });
    return rankings;
  }

  if (Array.isArray(json.polls)) {
    const poll = json.polls.find(p => (p.poll || p.pollName || '').toLowerCase().includes('ap')) || json.polls[0];
    if (poll) {
      const ranks = poll.ranks || poll.rankings || poll.entries || [];
      ranks.forEach((entry, idx) => {
        const rank = entry.rank || entry.rnk || entry.current || entry.AP || entry.pollRank || entry.pointsRank || entry.origRank || idx + 1;
        const team = entry.school || entry.team || entry.name || entry.displayName || (entry.schoolData && entry.schoolData.name) || entry.rSchool;
        addEntry(team, rank);
      });
    }
    return rankings;
  }

  if (Array.isArray(json)) {
    json.forEach((entry, idx) => {
      const rank = entry.rank || entry.RANK || entry.apRank || idx + 1;
      const team = entry.school || entry.team || entry.TEAM;
      addEntry(team, rank);
    });
    return rankings;
  }

  return rankings;
}

function applyApPollRanks_(rankMap) {
  let teams;
  try {
    teams = readTable('TEAMS');
  } catch (err) {
    Logger.log(err);
    return;
  }

  if (!Array.isArray(teams) || teams.length === 0) {
    Logger.log('No teams found in TEAMS table.');
    return;
  }

  const normalizedIndex = new Map();
  teams.forEach((row, idx) => {
    const normalized = normalizeSchoolNameAP_(row.team);
    if (normalized) {
      normalizedIndex.set(normalized, idx);
    }
  });

  let updated = false;
  normalizedIndex.forEach((rowIdx, teamName) => {
    const rank = rankMap.get(teamName) || '';
    if (teams[rowIdx].rank !== rank) {
      teams[rowIdx].rank = rank;
      updated = true;
    }
  });

  if (!updated) {
    Logger.log('No AP rank changes found.');
    return;
  }

  writeTable('TEAMS', teams);
  Logger.log('AP poll ranks applied to TEAMS table.');
}