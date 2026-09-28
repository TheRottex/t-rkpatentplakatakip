import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { norm } from "./db.js";

const MAX_ROWS = 10_000;
const COLUMN_NAMES = {
  isim: new Set(["surucuadsoyad", "adsoyad", "isim", "name", "drivername"]),
  plaka: new Set(["plaka", "plate", "aracplakasi", "vehicleplate"]),
  blok: new Set(["blok", "block"]),
  daire: new Set(["daire", "unit", "flat", "daireno", "unitno"]),
};

export async function createPlateTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "TPPlaka";
  const sheet = workbook.addWorksheet("Plakalar");
  sheet.columns = [
    { header: "SÜRÜCÜ AD SOYAD", key: "isim", width: 30 },
    { header: "PLAKA", key: "plaka", width: 18 },
    { header: "BLOK", key: "blok", width: 18 },
    { header: "DAİRE", key: "daire", width: 14 },
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1C3F8A" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const instructions = workbook.addWorksheet("Kullanım");
  instructions.addRows([
    ["Zorunlu sütunlar", "SÜRÜCÜ AD SOYAD ve PLAKA"],
    ["İsteğe bağlı sütunlar", "BLOK ve DAİRE (ikisini birlikte doldurun)"],
    ["Konum bilgisi yoksa", "BLOK ve DAİRE hücrelerini boş bırakın; aramada isim gösterilir."],
    ["Aktarım sınırı", "En fazla 10.000 kayıt ve 5 MB."],
  ]);
  instructions.getColumn(1).width = 26;
  instructions.getColumn(2).width = 72;

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function parsePlateUpload(file) {
  const extension = String(file.originalname || "").split(".").pop().toLowerCase();
  let rows;

  if (extension === "csv") {
    rows = parseCsvRows(file.buffer);
  } else if (extension === "xlsx") {
    rows = await parseWorkbookRows(file.buffer);
  } else {
    throw new Error("Yalnızca .csv veya .xlsx dosyası yükleyebilirsiniz.");
  }

  return normalizeRows(rows);
}

function parseCsvRows(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const delimiters = [";", ",", "\t"];
  const delimiter = delimiters.sort((left, right) => count(firstLine, right) - count(firstLine, left))[0];
  return parseCsv(text, {
    bom: true,
    delimiter,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });
}

async function parseWorkbookRows(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Excel dosyasında çalışma sayfası bulunamadı.");
  if (sheet.rowCount > MAX_ROWS + 1) throw new Error(`Dosya en fazla ${MAX_ROWS} kayıt içerebilir.`);

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1).map(cellText));
  });
  return rows;
}

function normalizeRows(rows) {
  if (rows.length > MAX_ROWS + 1) throw new Error(`Dosya en fazla ${MAX_ROWS} kayıt içerebilir.`);
  if (!rows.length) throw new Error("Dosyada aktarılacak satır bulunamadı.");

  const first = rows[0].map(headerKey);
  const columns = Object.fromEntries(Object.entries(COLUMN_NAMES).map(([key, aliases]) => [
    key,
    first.findIndex((header) => [...aliases].some((alias) => headerKey(alias) === header)),
  ]));
  const hasRecognizedHeaders = Object.values(columns).some((index) => index >= 0);
  const hasHeader = columns.plaka >= 0 && hasRecognizedHeaders;
  if (hasRecognizedHeaders && !hasHeader) {
    throw new Error("Başlık satırında PLAKA sütunu bulunmalıdır.");
  }

  const dataRows = hasHeader
    ? rows.slice(1).map((row) => ({
      isim: columns.isim < 0 ? "" : row[columns.isim],
      plaka: row[columns.plaka],
      blok: columns.blok < 0 ? "" : row[columns.blok],
      daire: columns.daire < 0 ? "" : row[columns.daire],
    }))
    : rows.map(([plaka, blok, daire]) => ({ isim: "", plaka, blok, daire }));
  const requiresName = hasHeader && columns.isim >= 0;
  if (dataRows.length > MAX_ROWS) throw new Error(`Dosya en fazla ${MAX_ROWS} kayıt içerebilir.`);

  const records = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const row = Object.fromEntries(Object.entries(dataRows[index]).map(([key, value]) => [key, cellText(value)]));
    if (Object.values(row).every((value) => !value)) continue;
    const hasBlock = Boolean(row.blok);
    const hasUnit = Boolean(row.daire);
    if (!norm(row.plaka) || (requiresName && !row.isim) || hasBlock !== hasUnit || (!row.isim && !hasBlock)) {
      throw new Error(`${index + (hasHeader ? 2 : 1)}. satırda isim ve plaka gerekli; blok/daire varsa ikisini de doldurun.`);
    }
    records.push(row);
  }
  if (!records.length) throw new Error("Dosyada aktarılabilecek geçerli kayıt bulunamadı.");
  return records;
}

function headerKey(value) {
  return cellText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]/g, "");
}

function cellText(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return String(value.result).trim();
    return "";
  }
  return String(value).trim();
}

function count(value, character) {
  return value.split(character).length - 1;
}