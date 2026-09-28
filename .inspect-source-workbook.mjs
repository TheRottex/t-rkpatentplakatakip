import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile("../PTS_Abone_Listesi_Excel.xlsx");
const sheet = workbook.worksheets[0];
const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? "").trim());
const nameIndex = headers.findIndex((value) => /ad\s*soyad|adsoyad|isim/i.test(value));
const plateIndex = headers.findIndex((value) => /plaka|plate/i.test(value));
const plateOwners = new Map();
let dataRows = 0;
let rowsMissingName = 0;
let rowsMissingPlate = 0;

for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
  const name = String(sheet.getRow(rowNumber).getCell(nameIndex + 1).text ?? "").trim();
  const plate = String(sheet.getRow(rowNumber).getCell(plateIndex + 1).text ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!name && !plate) continue;
  dataRows += 1;
  if (!name) rowsMissingName += 1;
  if (!plate) rowsMissingPlate += 1;
  if (plate) plateOwners.set(plate, (plateOwners.get(plate) || 0) + 1);
}

const repeatedPlateRows = [...plateOwners.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
console.log(JSON.stringify({ dataRows, rowsMissingName, rowsMissingPlate, distinctPlates: plateOwners.size, repeatedPlateRows }));
