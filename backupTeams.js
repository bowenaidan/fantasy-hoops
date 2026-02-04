function backupTeams() {
    const teams = readTable(SHEET_TEAMS);
    writeTable(SHEET_TEAMS_BACKUP, teams);
}

function restoreFromBackup() {
    const teams = readTable(SHEET_TEAMS_BACKUP);
    writeTable(SHEET_TEAMS, teams);
}