/***** CONFIG *****/
const NCAA_API_BASE = 'https://ncaa-api.henrygd.me';
const AP_POLL_ENDPOINT = `${NCAA_API_BASE}/rankings/basketball-men/d1/associated-press`;
const SHEET_POINTS = 'Point Structure';
const SHEET_TEAMS = 'TEAMS';
const SHEET_TEAMS_BACKUP = 'TEAMS_BACKUP';
const LIVE_SCORES = 'LIVE_SCORES';
const BUY_GAME_LOSSES = 'BUY_GAME_LOSSES';
const SHEET_DRAFT = '2025-2026 DRAFT';
const PROCESSED_GAME_KEYS_PROP = 'processedGameKeys';
const DEFAULT_SEASON_START_ISO = '2025/11/03';

const CONFERENCE_TIER_MAP = new Map([
  ['acc', 'highMajor'],
  ['big-12', 'highMajor'],
  ['big-ten', 'highMajor'],
  ['sec', 'highMajor'],
  ['big-east', 'highMajor'],
  ['mountain-west', 'highMid'],
  ['atlantic-10', 'highMid'],
  ['wcc', 'highMid'],
  ['american', 'highMid'],
  ['mvc', 'trueMid'],
  ['cusa', 'trueMid'],
  ['ivy-league', 'trueMid'],
  ['big-west', 'trueMid'],
  ['socon', 'trueMid'],
  ['caa', 'trueMid'],
  ['sun-belt', 'trueMid'],
  ['mac', 'trueMid'],
  ['wac', 'lowMajor'],
  ['big-south', 'lowMajor'],
  ['big-sky', 'lowMajor'],
  ['southland', 'lowMajor'],
  ['horizon', 'lowMajor'],
  ['summit-league', 'lowMajor'],
  ['maac', 'lowMajor'],
  ['asun', 'lowMajor'],
  ['ovc', 'lowMajor'],
  ['patriot', 'lowMajor'],
  ['america-east', 'lowMajor'],
  ['swac', 'lowMajor'],
  ['meac', 'lowMajor'],
  ['nec', 'lowMajor']
]);

const ROSTER = ["UConn", "BYU", "High Point", "Michigan St.", "Saint Louis", "Marquette", "South Fla.", "UC Irvine", "Norfolk St.", "UNCW",
                "Kentucky", "Tennessee", "Saint Mary's (CA)", "Utah St.", "VMI", "North Dakota St.", "Drake", "Virginia", "UMBC", "Texas A&M", "Houston", "Illinois", "Memphis", "Southern California", "NC State", "UNI", "Vermont", "Ole Miss", "Bethune-Cookman", "Oklahoma St.", 
                "Florida", "UCLA", "Louisville", "George Mason", "Creighton", "North Carolina", "Arkansas St.", "UC Santa Barbara", "Little Rock", "Colorado St.", 
                "Duke", "Arkansas", "Iowa St.", "VCU", "Towson", "Wisconsin", "Siena", "Miami (FL)", "California Baptist", "Villanova", 
                "Michigan", "Gonzaga", "Clemson", "Grand Canyon", "Illinois St.", "St. Thomas (MN)", "Cincinnati", "Col. of Charleston", "Utah Valley", "Wichita St.", 
                "St. John's (NY)", "Texas Tech", "Liberty", "McNeese", "Mississippi St.", "Montana", "George Washington", "Indiana", "Iowa", "Kent St.", 
                "Purdue", "Alabama", "Auburn", "San Francisco", "Chattanooga", "Ohio St.", "Queens (NC)", "Tulsa", "James Madison", "Notre Dame", 
                "Kansas", "San Diego St.", "Baylor", "Yale", "Vanderbilt", "Texas", "Lamar University", "Maryland", "Washington", "Hawaii", 
                "Oregon", "Arizona", "Dayton", "Akron", "Robert Morris", "Missouri", "SMU", "Butler", "Pepperdine", "LSU"];


// POSTSEASON mapping by round label appearing on NCAA pages.
const POSTSEASON_POINTS = {
  'Championship': 80,
  'FINAL FOUR': 40,
  'Elite Eight': 30,
  'Sweet 16': 20
};

// Conference win points (from your "Point Structure" sheet)
const CONF_POINTS = {
  highMajor: { home: 3.5, road: 5 },
  highMid:   { home: 2.5, road: 4 },
  trueMid:   { home: 1.5, road: 2.5},
  lowMajor:    { home: 1, road: 1.5}
};

const NON_CONF_POINTS = {
    0: 2,
    1: 4,
    2: 6,
    3: 8
}