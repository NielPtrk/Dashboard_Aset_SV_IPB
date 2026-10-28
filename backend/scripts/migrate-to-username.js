#!/usr/bin/env node
/**
 * Skrip Migrasi Skema & Data: Akun Berbasis Username & Penonaktifan Pendaftar Lama
 *
 * 1. Menambahkan kolom 'username', 'must_change_password', 'token_version', 'jabatan' ke tabel 'users' jika belum ada.
 * 2. Menghapus batasan NOT NULL dan UNIQUE lama pada kolom email.
 * 3. Mengisi 'username' dari 'nama' yang dirapikan spasinya (trim dan collapse spasi ganda).
 * 4. Menangani nama kembar (case-insensitive): memberikan akhiran ' (2)', ' (3)', dst.
 * 5. Mengubah status akun pendaftar lama ('menunggu_verifikasi', 'menunggu_persetujuan', 'ditolak') menjadi 'nonaktif'.
 * 6. Membuat UNIQUE INDEX pada LOWER(TRIM(username)).
 *
 * Penggunaan:
 *   node scripts/migrate-to-username.js
 *   -atau-
 *   docker compose exec backend node scripts/migrate-to-username.js
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || "").trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "aset_sv_ipb",
};

function normalizeWhitespace(str) {
  if (!str) return "";
  return str.trim().replace(/\s+/g, " ");
}

async function runMigration() {
  const client = new Client(dbConfig);
  try {
    console.log("\x1b[36m%s\x1b[0m", `[1/6] Menghubungkan ke database ${dbConfig.database} di ${dbConfig.host}:${dbConfig.port}...`);
    await client.connect();
    console.log("\x1b[32m%s\x1b[0m", "✓ Terhubung ke database.");

    await client.query("BEGIN");

    // ── 1. Penambahan Kolom Skema Baru ─────────────────────────────────────────
    console.log("\x1b[36m%s\x1b[0m", "[2/6] Memeriksa dan memperbarui struktur kolom tabel 'users'...");
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS jabatan VARCHAR(100);
      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    `);

    // Drop unique constraint on email if exists
    try {
      await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_fe0bb3f6520ee0469504521e710";`);
      await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "users_email_key";`);
    } catch {}

    // ── 2. Ambil Semua Akun untuk Normalisasi Username & Migrasi Status ─────────
    console.log("\x1b[36m%s\x1b[0m", "[3/6] Membaca data akun yang ada...");
    const resUsers = await client.query(`
      SELECT id, nama, username, email, role, status, aktif
      FROM users
      ORDER BY created_at ASC
    `);

    const users = resUsers.rows;
    console.log(`Ditemukan ${users.length} akun terdaftar.`);

    const usedUsernames = new Map(); // normalizedKey -> count
    const twinRenamed = [];
    const statusMigrated = [];

    // First pass: identify usernames
    for (const u of users) {
      const baseName = normalizeWhitespace(u.nama || u.username || "Pengguna");
      const normKey = baseName.toLowerCase();

      let assignedUsername = baseName;
      if (usedUsernames.has(normKey)) {
        const count = usedUsernames.get(normKey) + 1;
        usedUsernames.set(normKey, count);
        assignedUsername = `${baseName} (${count})`;
        twinRenamed.push({ id: u.id, originalNama: u.nama, assignedUsername });
      } else {
        usedUsernames.set(normKey, 1);
      }

      // Check legacy status
      let newStatus = u.status;
      let newAktif = u.aktif;
      if (["menunggu_verifikasi", "menunggu_persetujuan", "ditolak"].includes(u.status)) {
        newStatus = "nonaktif";
        newAktif = false;
        statusMigrated.push({ id: u.id, nama: u.nama, oldStatus: u.status });
      }

      await client.query(
        `UPDATE users
         SET username = $1,
             nama = $1,
             status = $2,
             aktif = $3,
             token_version = COALESCE(token_version, 1),
             updated_at = NOW()
         WHERE id = $4`,
        [assignedUsername, newStatus, newAktif, u.id]
      );
    }

    // ── 3. Buat Unique Index untuk Username ─────────────────────────────────────
    console.log("\x1b[36m%s\x1b[0m", "[4/6] Membuat index unik untuk username...");
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower_trimmed
      ON users (LOWER(TRIM(username)));
    `);

    await client.query("COMMIT");

    console.log("\x1b[32m%s\x1b[0m", "\n========================================================");
    console.log("\x1b[32m%s\x1b[0m", "✓ MIGRASI DATA AKUN BERHASIL DISELESAIKAN");
    console.log("\x1b[32m%s\x1b[0m", "========================================================");
    console.log(`Total akun diproses: ${users.length}`);

    if (twinRenamed.length > 0) {
      console.log("\n[DAFTAR AKUN NAMA KEMBAR YANG DIBERI AKHIRAN]");
      twinRenamed.forEach((t) => {
        console.log(`- ID: ${t.id} | Nama Asli: "${t.originalNama}" -> Username Baru: "${t.assignedUsername}"`);
      });
    } else {
      console.log("\nTidak ada akun nama kembar yang memerlukan akhiran.");
    }

    if (statusMigrated.length > 0) {
      console.log("\n[DAFTAR AKUN MENUNGGU/DITOLAK YANG DIUBAH JADI NONAKTIF]");
      statusMigrated.forEach((s) => {
        console.log(`- ID: ${s.id} | Nama: "${s.nama}" | Status Lama: "${s.oldStatus}" -> Status Baru: "nonaktif"`);
      });
    } else {
      console.log("\nTidak ada akun menunggu atau ditolak yang diubah.");
    }

    console.log("========================================================\n");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("\x1b[31m%s\x1b[0m", `\n[GAGAL] Migrasi dibatalkan karena kesalahan: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
