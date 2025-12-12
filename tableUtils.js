function readTable(sheetName) {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      'readTable: Sheet not found: "' + sheetName + '" in spreadsheet "' + ss.getName() + '"'
    );
  }

  const values = sheet.getDataRange().getValues();
  if (values.length === 0) return [];  // optional safety

  const headers = values.shift();

  return values.map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function writeTable(sheetName, dataArray) {
  if (dataArray.length === 0) return;

  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);

  const headers = Object.keys(dataArray[0]);
  const values = [headers].concat(
    dataArray.map(obj => headers.map(h => obj[h]))
  );

  sheet.clearContents();
  sheet.getRange(1,1,values.length,values[0].length).setValues(values);
}