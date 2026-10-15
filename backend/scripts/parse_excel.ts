import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const excelPath = path.join(__dirname, "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx");
const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

function parseRow(row: any, idx: number) {
  const sourceId = typeof row["ID"] === "number" ? row["ID"] : parseInt(String(row["ID"]), 10) || null;
  const gedungRaw = String(row["Gedung"] || "").trim();
  const namaRuangan = String(row["namaRuangan"] || "").trim();
  const level = typeof row["level"] === "number" ? row["level"] : parseInt(String(row["level"]), 10) || 1;
  const alamatRaw = String(row["alamat"] || "").trim();
  const kodeRuangan = String(row["kodeRuangan"] || "").trim() || null;
  const kategori = String(row["kategori"] || "").trim() || null;
  const luas = parseFloat(String(row["luas (m2)"] || "0").replace(",", ".")) || 0;
  const kapasitas = typeof row["kapasitas"] === "number" ? row["kapasitas"] : parseInt(String(row["kapasitas"]), 10) || 0;
  const unitPengguna = String(row["Keterangan"] || "").trim() || null;

  let kampus = "";
  let namaGedung = "";

  const g = gedungRaw.toLowerCase();

  // 1. Baris tanpa Gedung (ID 8385, 8387, 8392, 8393)
  if (!gedungRaw) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Belum Dikategorikan — Area Gunung Gede";
  }
  // 2. GH Lingkungan
  else if (g.includes("gh lingkungan")) {
    kampus = "Kampus Cilibende";
    namaGedung = "Laboratorium GH Lingkungan Sekolah Vokasi";
  }
  // 3. Biokimia
  else if (g.includes("biokimia")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Gedung Biokimia SV";
  }
  // 4. Lab Lingkungan
  else if (g.includes("lab lingkungan")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Lab Lingkungan Sekolah Vokasi IPB";
  }
  // 5. Klinik Hewan
  else if (g.includes("klinik hewan")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Klinik Hewan Pendidikan Sekolah Vokasi IPB";
  }
  // 6. Lab.Perikanan
  else if (g.includes("lab.perikanan") || g.includes("perikanan")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Lab.Perikanan";
  }
  // 7. Gedung IPB Gunung Gede (mislabelled in Excel as IPB Baranangsiang but address Pajajaran)
  else if (g.includes("(ipb baranangsiang)") && alamatRaw.toLowerCase().includes("pajajaran")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Gedung IPB Gunung Gede";
  }
  // 8. Baranangsiang
  else if (g.includes("baranangsiang") || g.includes("( bs )") || g.includes("(bs)")) {
    kampus = "Kampus Baranangsiang";
    namaGedung = "Kampus Baranangsiang (BS)";
  }
  // 9. Asrama Felicia
  else if (g.includes("felicia")) {
    kampus = "Kampus Lainnya";
    namaGedung = "Gedung Asrama Felicia";
  }
  // 10. Asrama Sukasari
  else if (g.includes("sukasari")) {
    kampus = "Kampus Lainnya";
    namaGedung = "Gedung Asrama Sukasari";
  }
  // 11. Creative House
  else if (g.includes("creative house")) {
    kampus = "Kampus Lainnya";
    namaGedung = "Gedung Creative House SV IPB";
  }
  // 12. Cilibende main
  else if (g.includes("cilibende")) {
    kampus = "Kampus Cilibende";
    namaGedung = "Gedung Sekolah Vokasi";
  }
  // 13. Gunung Gede main
  else if (g.includes("gunung gede") || g.includes("pajajaran")) {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Kampus Gunung Gede";
  } else {
    kampus = "Kampus Gunung Gede";
    namaGedung = "Kampus Gunung Gede";
  }

  return {
    id: `R-${idx + 1}`,
    sourceId,
    gedungRaw,
    namaRuangan,
    level,
    alamat: alamatRaw,
    kodeRuangan: kodeRuangan || `KODE-${idx + 1}`,
    kategori,
    luas,
    kapasitas,
    unitPengguna,
    kampus,
    namaGedung,
  };
}

const parsed = rows.map(parseRow).filter((r) => r.namaRuangan);

let totalLuas = 0;
const byKampus: Record<string, number> = {};
const byGedung: Record<string, number> = {};

parsed.forEach((r) => {
  totalLuas += r.luas;
  byKampus[r.kampus] = (byKampus[r.kampus] || 0) + 1;
  byGedung[r.namaGedung] = (byGedung[r.namaGedung] || 0) + 1;
});

console.log("=== RESULTS ===");
console.log(`Total parsed rows: ${parsed.length}`);
console.log(`Total Luas: ${totalLuas.toFixed(2)} m²`);
console.log(`Unique Buildings Count: ${Object.keys(byGedung).length}`);
console.log("\nBuildings Breakdown:");
Object.entries(byGedung).forEach(([g, count]) => {
  console.log(`  - ${g}: ${count} ruangan`);
});
console.log("\nKampus Breakdown:");
Object.entries(byKampus).forEach(([k, count]) => {
  console.log(`  - ${k}: ${count} ruangan`);
});

const seedTsPath = path.join(__dirname, "..", "..", "src", "app", "components", "ruanganSeed.ts");
const seedTsContent = `// Auto-generated 256 real room records from Excel
import type { RuanganData } from "./DataStore";

export const SEED_RUANGAN: RuanganData[] = ${JSON.stringify(parsed, null, 2)};
`;
fs.writeFileSync(seedTsPath, seedTsContent);
console.log("Wrote ruanganSeed.ts successfully!");
