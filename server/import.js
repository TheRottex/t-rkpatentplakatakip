import ExcelJS from "exceljs";
import { parse as parseCsv } from "csv-parse/sync";
import { norm } from "./db.js";

const MAX_ROWS = 10_000;
const COLUMN_NAMES = {
  plaka: new Set(["plaka", "plate", "aracplakasi", "vehicleplate"]),
  blok: new Set(["blok", "block"]),
  daire: new Set(["daire", "unit", "flat", "daireNo", "unitNo"]),
};

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
  const hasHeader = Object.values(columns).some((index) => index >= 0);
  if (hasHeader && Object.values(columns).some((index) => index < 0)) {
    throw new Error("Başlık satırında plaka, blok ve daire sütunlarının tümü bulunmalıdır.");
  }

  const dataRows = hasHeader
    ? rows.slice(1).map((row) => [row[columns.plaka], row[columns.blok], row[columns.daire]])
    : rows;
  if (dataRows.length > MAX_ROWS) throw new Error(`Dosya en fazla ${MAX_ROWS} kayıt içerebilir.`);

  const records = [];
  for (let index = 0; index < dataRows.length; index += 1) {
    const values = dataRows[index].map(cellText);
    if (values.every((value) => !value)) continue;
    const [plaka, blok, daire] = values;
    if (!norm(plaka) || !blok || !daire) {
      throw new Error(`${index + (hasHeader ? 2 : 1)}. satırda plaka, blok veya daire eksik.`);
    }
    records.push({ plaka, blok, daire });
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