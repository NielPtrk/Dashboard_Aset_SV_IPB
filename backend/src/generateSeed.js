const fs = require("fs");
const path = require("path");

try {
  const XLSX = require(path.join(__dirname, "..", "node_modules", "xlsx"));
  const excelPath = path.join(__dirname, "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx");
  const wb = XLSX.readFile(excelPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  function parseGedungDanKampus(gedungRaw, alamatRaw) {
    const g = (gedungRaw || "").trim().toLowerCase();
    const a = (alamatRaw || "").trim().toLowerCase();

    if (!g) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Belum Dikategorikan — Area Gunung Gede" };
    }
    if (g.includes("gh lingkungan")) {
      return { kampus: "Kampus Cilibende", namaGedung: "Laboratorium GH Lingkungan Sekolah Vokasi" };
    }
    if (g.includes("biokimia")) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Gedung Biokimia SV" };
    }
    if (g.includes("lab lingkungan")) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Lab Lingkungan Sekolah Vokasi IPB" };
    }
    if (g.includes("klinik hewan")) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Klinik Hewan Pendidikan Sekolah Vokasi IPB" };
    }
    if (g.includes("lab.perikanan") || g.includes("perikanan")) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Lab.Perikanan" };
    }
    if (g.includes("(ipb baranangsiang)") && a.includes("pajajaran")) {
      return { kampus: "Kampus Gunung Gede", namaGedung: "Gedung IPB Gunung Gede" };
    }
    if (g.includes("baranangsiang") || g.includes("( bs )") || g.includes("(bs)")) {
      return { kampus: "Kampus Baranangsiang", namaGedung: "Kampus Baranangsiang (BS)" };
    }
    if (g.includes("felicia")) {
      return { kampus: "Kampus Lainnya", namaGedung: "Gedung Asrama Felicia" };
    }
    if (g.includes("sukasari")) {
      return { kampus: "Kampus Lainnya", namaGedung: "Gedung Asrama Sukasari" };
    }
    if (g.includes("creative house")) {
      return { kampus: "Kampus Lainnya", namaGedung: "Gedung Creative House SV IPB" };
    }
    if (g.includes("cilibende")) {
      return { kampus: "Kampus Cilibende", namaGedung: "Gedung Sekolah Vokasi" };
    }
    return { kampus: "Kampus Gunung Gede", namaGedung: "Kampus Gunung Gede" };
  }

  function parseRow(row, idx) {
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

    const { kampus, namaGedung } = parseGedungDanKampus(gedungRaw, alamatRaw);

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
  const byKampus = {};
  const byGedung = {};

  parsed.forEach((r) => {
    totalLuas += r.luas;
    byKampus[r.kampus] = (byKampus[r.kampus] || 0) + 1;
    byGedung[r.namaGedung] = (byGedung[r.namaGedung] || 0) + 1;
  });

  const targetPath = path.join(__dirname, "..", "..", "src", "app", "components", "ruanganSeed.ts");
  const seedTsContent = `// Auto-generated 256 real room records from Excel
import type { RuanganData } from "./DataStore";

export const SEED_RUANGAN: RuanganData[] = ${JSON.stringify(parsed, null, 2)};
`;
  fs.writeFileSync(targetPath, seedTsContent);

  const summary = `SUCCESS! Parsed ${parsed.length} rooms. Total Luas: ${totalLuas.toFixed(2)} m2. Buildings: ${Object.keys(byGedung).length}\nBy Kampus: ${JSON.stringify(byKampus)}\nBy Gedung: ${JSON.stringify(byGedung)}`;
  fs.writeFileSync(path.join(__dirname, "seed_result.txt"), summary);
  console.log(summary);
} catch (err) {
  fs.writeFileSync(path.join(__dirname, "seed_result.txt"), "ERROR: " + err.stack);
}
