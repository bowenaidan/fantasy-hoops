function updateRunner() {
  const d = new Date();
  d.setDate(d.getDate());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  isoDate = `${yyyy}/${mm}/${dd}`;
  dailySync(isoDate);
  // dailySync("2025/11/03");
  // dailySync("2025/11/04");
  // dailySync("2025/11/05");
  // dailySync("2025/11/06");
  // dailySync("2025/11/07");
}
