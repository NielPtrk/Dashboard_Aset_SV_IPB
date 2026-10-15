import * as XLSX from "xlsx";

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = "Data",
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export interface DBRRoomMeta {
  year?: number | string;
  unitKerja?: string;
  departemen?: string;
  kodeRuang?: string;
  namaRuang?: string;
}

export interface DBRExportRow {
  no?: number | string;
  kodeBarang?: string;
  namaBarang?: string;
  nup?: string;
  merekType?: string;
  tahunPerolehan?: string;
  hargaSatuan?: number | string;
  volume?: number | string;
  satuan?: string;
  jumlahHarga?: number | string;
  sumberDana?: string;
  kondisi?: string;
  penguasaan?: string;
  keterangan?: string;
}

export function exportDBRExcel(
  roomMeta: DBRRoomMeta,
  rows: DBRExportRow[],
  filename: string,
  sheetName = "Sheet 1"
) {
  const year = roomMeta.year || new Date().getFullYear();
  const unitKerja = roomMeta.unitKerja || "Sekolah Vokasi";
  const departemen = roomMeta.departemen || "";
  const kodeRuang = roomMeta.kodeRuang || "";
  const namaRuang = roomMeta.namaRuang || "Ruang Kelas";

  const sheetData: any[][] = [
    ["DAFTAR BARANG RUANGAN", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["INSTITUT PERTANIAN BOGOR", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["PERIODE TAHUN " + year, "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Unit Kerja ", "", ": " + unitKerja, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Departemen/Bag ", "", ": " + departemen, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["No. Kode Ruang ", "", ": " + kodeRuang, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Nama Ruang ", "", ": " + namaRuang, "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["No ", "Kode Barang ", "Nama Barang ", "NUP", "Identitas Barang", "", "Harga Satuan (Rp)", "Vol", "Satuan", "Jumlah Harga (Rp) ", "Sumber Dana ", "Kondisi Barang ", "", "", "Penguasaan", "Keterangan  \n(Nama Ruangan)"],
    ["", "", "", "", "Merek/Type ", "Tahun Perolehan ", "", "", "", "", "", "B", "RR", "RB", "", ""]
  ];

  rows.forEach((r, idx) => {
    const kLower = String(r.kondisi || "Baik").toLowerCase();
    const isRB = kLower.includes("rusak berat") || kLower === "rb";
    const isRR = kLower.includes("rusak ringan") || kLower === "rr";
    const isB = (!isRB && !isRR) || kLower.includes("baik") || kLower === "b";

    const hargaVal = r.hargaSatuan !== undefined && r.hargaSatuan !== "" ? (typeof r.hargaSatuan === "number" ? r.hargaSatuan : Number(r.hargaSatuan) || r.hargaSatuan) : "";
    const volVal = r.volume !== undefined && r.volume !== "" ? (typeof r.volume === "number" ? r.volume : Number(r.volume) || r.volume) : "";
    let jmlVal = r.jumlahHarga !== undefined && r.jumlahHarga !== "" ? (typeof r.jumlahHarga === "number" ? r.jumlahHarga : Number(r.jumlahHarga) || r.jumlahHarga) : "";
    if (!jmlVal && typeof hargaVal === "number" && typeof volVal === "number") {
      jmlVal = hargaVal * volVal;
    }

    sheetData.push([
      r.no || idx + 1,
      r.kodeBarang || "",
      r.namaBarang || "",
      r.nup || "",
      r.merekType || "",
      r.tahunPerolehan || "",
      hargaVal,
      volVal,
      r.satuan || "",
      jmlVal,
      r.sumberDana || "",
      isB ? "✓" : "",
      isRR ? "✓" : "",
      isRB ? "✓" : "",
      r.penguasaan || "",
      r.keterangan || ""
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 14 } },
    { s: { r: 10, c: 0 }, e: { r: 11, c: 0 } },
    { s: { r: 10, c: 1 }, e: { r: 11, c: 1 } },
    { s: { r: 10, c: 2 }, e: { r: 11, c: 2 } },
    { s: { r: 10, c: 3 }, e: { r: 11, c: 3 } },
    { s: { r: 10, c: 4 }, e: { r: 10, c: 5 } },
    { s: { r: 10, c: 6 }, e: { r: 11, c: 6 } },
    { s: { r: 10, c: 7 }, e: { r: 11, c: 7 } },
    { s: { r: 10, c: 8 }, e: { r: 11, c: 8 } },
    { s: { r: 10, c: 9 }, e: { r: 11, c: 9 } },
    { s: { r: 10, c: 10 }, e: { r: 11, c: 10 } },
    { s: { r: 10, c: 11 }, e: { r: 10, c: 13 } },
    { s: { r: 10, c: 14 }, e: { r: 11, c: 14 } },
    { s: { r: 10, c: 15 }, e: { r: 11, c: 15 } },
  ];

  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 32 },
    { wch: 10 },
    { wch: 22 },
    { wch: 16 },
    { wch: 18 },
    { wch: 8 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 6 },
    { wch: 6 },
    { wch: 6 },
    { wch: 16 },
    { wch: 24 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function importExcelMatrix(file: File): Promise<{
  matrix: any[][];
  sheetName: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve({ matrix: [], sheetName: "" });
          return;
        }
        const firstSheet = workbook.Sheets[sheetName];
        const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
        resolve({ matrix, sheetName });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsBinaryString(file);
  });
}

export function importFromExcel(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          resolve([]);
          return;
        }
        const firstSheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }) as Record<string, unknown>[];
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsBinaryString(file);
  });
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBlob(content: string, filename: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

