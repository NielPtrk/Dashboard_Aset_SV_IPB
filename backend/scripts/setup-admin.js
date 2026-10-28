#!/usr/bin/env node
/**
 * Skrip Sekali Jalan: Setup Kredensial Akun Admin Sistem Utama (U-001)
 *
 * Mengatur username 'Admin Sistem' dan meng-hash password baru dengan bcryptjs
 * (salt rounds = 10, identik dengan alur auth sistem).
 *
 * Password TIDAK disimpan dalam bentuk teks biasa dan TIDAK ditulis permanen di kode.
 * Password dibaca dari argumen CLI atau variabel environment saat eksekusi.
 *
 * Penggunaan (Lokal):
 *   node scripts/setup-admin.js <password_baru> [username]
 *   -atau-
 *   ADMIN_PASSWORD=<password_baru> node scripts/setup-admin.js
 *
 * Penggunaan (Docker Compose):
 *   docker compose exec backend node scripts/setup-admin.js <password_baru>
 *   -atau-
 *   docker compose exec -e ADMIN_PASSWORD="<password_baru>" backend node scripts/setup-admin.js
 *
 * Contoh:
 *   node scripts/setup-admin.js "Admin123"
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// ── 1. Baca Password & Username dari Argumen atau Environment Variable ────────
const rawPassword = process.env.ADMIN_PASSWORD || process.env.RESET_PASSWORD || process.argv[2];
const customUsername = process.env.ADMIN_USERNAME || process.argv[3] || "Admin Sistem";

if (!rawPassword || rawPassword.trim().length === 0) {
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Password baru belum disertakan!");
  console.log("\nCara Penggunaan:");
  console.log("  node scripts/setup-admin.js <password_baru> [username_opsional]");
  console.log("  -atau-");
  console.log("  ADMIN_PASSWORD=<password_baru> node scripts/setup-admin.js\n");
  console.log("Contoh:");
  console.log('  node scripts/setup-admin.js "Admin123"\n');
  process.exit(1);
}

const newPassword = rawPassword.trim();
const targetUsername = customUsername.trim().replace(/\s+/g, " ");

if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Kata sandi harus minimal 8 karakter dan memuat kombinasi huruf dan angka!");
  process.exit(1);
}

// ── 2. Baca Konfigurasi Database ──────────────────────────────────────────────
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

async function run() {
  const client = new Client(dbConfig);
  try {
    console.log("\x1b[36m%s\x1b[0m", `[1/5] Menghubungkan ke database ${dbConfig.database} di ${dbConfig.host}:${dbConfig.port}...`);
    await client.connect();
    console.log("\x1b[32m%s\x1b[0m", "✓ Terhubung ke database.");

    await client.query("BEGIN");

    // Pastikan kolom username & token_version ada
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS jabatan VARCHAR(100);
    `);

    // ── 3. Cari Akun Admin Sistem Utama (U-001 atau role 'Admin Sistem') ─────────
    console.log("\x1b[36m%s\x1b[0m", "[2/5] Mencari data akun Admin Sistem utama...");
    const findRes = await client.query(
      `SELECT id, nama, username, role, status, aktif, token_version 
       FROM users 
       WHERE role = 'Admin Sistem'
          OR LOWER(TRIM(username)) = LOWER($1)
          OR LOWER(TRIM(nama)) = LOWER($1)
       ORDER BY (role = 'Admin Sistem') DESC, created_at ASC
       LIMIT 1`,
      [targetUsername]
    );

    let targetUser = findRes.rows[0];

    // ── 4. Hash Password dengan Bcrypt (Salt Rounds = 10) ────────────────────
    console.log("\x1b[36m%s\x1b[0m", "[3/5] Meng-hash password menggunakan bcryptjs (standar autentikasi)...");
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    let updatedUser;
    if (targetUser) {
      console.log("\x1b[36m%s\x1b[0m", `[4/5] Memperbarui kredensial akun ID ${targetUser.id} (${targetUser.nama})...`);
      const nextTokenVersion = (targetUser.token_version || 1) + 1;
      const updateRes = await client.query(
        `UPDATE users
         SET username = $1,
             nama = $1,
             password_hash = $2,
             role = 'Admin Sistem',
             status = 'aktif',
             aktif = true,
             unit = 'Sekolah Vokasi (SV)',
             jabatan = 'Admin Sistem',
             must_change_password = false,
             token_version = $3,
             verification_token = NULL,
             reset_password_token = NULL,
             reset_password_expires = NULL,
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, username, nama, role, status, aktif, token_version, updated_at`,
        [targetUsername, passwordHash, nextTokenVersion, targetUser.id]
      );
      updatedUser = updateRes.rows[0];
    } else {
      console.log("\x1b[36m%s\x1b[0m", "[4/5] Akun Admin Sistem belum ada di database, membuat akun baru...");
      const insertRes = await client.query(
        `INSERT INTO users (
           username, nama, password_hash, role, unit, jabatan, status, aktif, must_change_password, token_version, created_at, updated_at
         ) VALUES (
           $1, $1, $2, 'Admin Sistem', 'Sekolah Vokasi (SV)', 'Admin Sistem', 'aktif', true, false, 1, NOW(), NOW()
         )
         RETURNING id, username, nama, role, status, aktif, token_version, updated_at`,
        [targetUsername, passwordHash]
      );
      updatedUser = insertRes.rows[0];
    }

    await client.query("COMMIT");

    console.log("\x1b[32m%s\x1b[0m", "\n========================================================");
    console.log("\x1b[32m%s\x1b[0m", "✓ SETUP KREDENSIAL ADMIN SISTEM BERHASIL");
    console.log("\x1b[32m%s\x1b[0m", "========================================================");
    console.log(`  ID Akun       : ${updatedUser.id}`);
    console.log(`  Username      : ${updatedUser.username}`);
    console.log(`  Nama Tampil   : ${updatedUser.nama}`);
    console.log(`  Role          : ${updatedUser.role} (Superadmin / Anti-Lockout)`);
    console.log(`  Status        : ${updatedUser.status} (Aktif)`);
    console.log(`  Token Version : ${updatedUser.token_version} (Sesi lama dibatalkan)`);
    console.log(`  Password      : [Telah di-hash dengan Bcrypt]`);
    console.log(`  Waktu Update  : ${updatedUser.updated_at}`);
    console.log("========================================================\n");
    console.log(`Silakan login dengan Username: "${updatedUser.username}" dan password yang baru Anda atur.`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("\x1b[31m%s\x1b[0m", `\n[GAGAL] Terjadi kesalahan: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
