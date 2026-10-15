#!/usr/bin/env node
/**
 * Skrip Sekali Jalan: Pembaruan Kredensial Akun Admin Sistem (U-001)
 *
 * Mengubah email menjadi othnielpatrick@apps.ipb.ac.id, meng-hash password
 * baru dengan bcryptjs (salt rounds = 10, identik dengan alur auth aplikasi),
 * serta memastikan status akun aktif & terverifikasi.
 *
 * Password TIDAK disimpan dalam bentuk teks biasa dan TIDAK ditulis hardcoded.
 * Password dibaca dari argumen CLI atau variabel environment saat eksekusi.
 *
 * Penggunaan (Lokal):
 *   node scripts/reset-admin-u001.js <password_baru>
 *   -atau-
 *   RESET_PASSWORD=<password_baru> node scripts/reset-admin-u001.js
 *
 * Penggunaan (Docker Compose):
 *   docker compose exec backend node scripts/reset-admin-u001.js <password_baru>
 *   -atau-
 *   docker compose exec -e RESET_PASSWORD="<password_baru>" backend node scripts/reset-admin-u001.js
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

// ── 1. Baca Password dari Argumen atau Environment Variable ───────────────────
const rawPassword = process.env.RESET_PASSWORD || process.env.NEW_PASSWORD || process.argv[2];

if (!rawPassword || rawPassword.trim().length === 0) {
  console.error("\x1b[31m%s\x1b[0m", "[ERROR] Password baru belum disertakan!");
  console.log("\nCara Penggunaan:");
  console.log("  node scripts/reset-admin-u001.js <password_baru>");
  console.log("  -atau-");
  console.log("  RESET_PASSWORD=<password_baru> node scripts/reset-admin-u001.js\n");
  console.log("Contoh:");
  console.log('  node scripts/reset-admin-u001.js "Password"\n');
  process.exit(1);
}

const newPassword = rawPassword.trim();

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

    // ── 3. Cari Akun Target (U-001 / Othniel Patrick Limbong) ──────────────────
    console.log("\x1b[36m%s\x1b[0m", "[2/5] Mencari data akun Admin Sistem utama...");
    const findRes = await client.query(
      `SELECT id, nama, email, role, status, aktif 
       FROM users 
       WHERE LOWER(TRIM(email)) = 'othniel.patrick@apps.ipb.ac.id'
          OR LOWER(TRIM(email)) = 'othnielpatrick@apps.ipb.ac.id'
          OR role = 'Admin Sistem'
          OR nama ILIKE '%Othniel Patrick%'
       ORDER BY (role = 'Admin Sistem') DESC, created_at ASC
       LIMIT 1`
    );

    let targetUser = findRes.rows[0];
    const targetEmail = "othnielpatrick@apps.ipb.ac.id";

    // ── 4. Cek Bentrok Email Baru pada Akun Lain ──────────────────────────────
    if (targetUser) {
      const conflictRes = await client.query(
        `SELECT id, email, nama FROM users 
         WHERE LOWER(TRIM(email)) = $1 AND id != $2`,
        [targetEmail, targetUser.id]
      );
      if (conflictRes.rows.length > 0) {
        throw new Error(
          `Email target ${targetEmail} sudah dipakai oleh akun lain (ID: ${conflictRes.rows[0].id}, Nama: ${conflictRes.rows[0].nama}).`
        );
      }
    }

    // ── 5. Hash Password dengan Bcrypt (Salt Rounds = 10) ────────────────────
    console.log("\x1b[36m%s\x1b[0m", "[3/5] Meng-hash password menggunakan bcryptjs (metode standar autentikasi)...");
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    let updatedUser;
    if (targetUser) {
      console.log("\x1b[36m%s\x1b[0m", `[4/5] Memperbarui akun ID ${targetUser.id} (${targetUser.nama})...`);
      const updateRes = await client.query(
        `UPDATE users
         SET email = $1,
             password_hash = $2,
             role = 'Admin Sistem',
             status = 'aktif',
             aktif = true,
             unit = 'Sekolah Vokasi (SV)',
             verification_token = NULL,
             reset_password_token = NULL,
             reset_password_expires = NULL,
             updated_at = NOW()
         WHERE id = $3
         RETURNING id, nama, email, role, status, aktif, updated_at`,
        [targetEmail, passwordHash, targetUser.id]
      );
      updatedUser = updateRes.rows[0];
    } else {
      console.log("\x1b[36m%s\x1b[0m", "[4/5] Akun belum ada di database, membuat akun Admin Sistem baru...");
      const insertRes = await client.query(
        `INSERT INTO users (
           nama, email, password_hash, role, unit, status, aktif, created_at, updated_at
         ) VALUES (
           'Othniel Patrick Limbong', $1, $2, 'Admin Sistem', 'Sekolah Vokasi (SV)', 'aktif', true, NOW(), NOW()
         )
         RETURNING id, nama, email, role, status, aktif, updated_at`,
        [targetEmail, passwordHash]
      );
      updatedUser = insertRes.rows[0];
    }

    await client.query("COMMIT");

    console.log("\x1b[32m%s\x1b[0m", "\n========================================================");
    console.log("\x1b[32m%s\x1b[0m", "✓ PEMBARUAN KREDENSIAL BERHASIL DISELESAIKAN DENGAN AMAN");
    console.log("\x1b[32m%s\x1b[0m", "========================================================");
    console.log(`  ID Akun     : ${updatedUser.id}`);
    console.log(`  Nama        : ${updatedUser.nama}`);
    console.log(`  Email Baru  : ${updatedUser.email}`);
    console.log(`  Role        : ${updatedUser.role} (Akses Penuh / Terlindungi)`);
    console.log(`  Status      : ${updatedUser.status} (Aktif & Terverifikasi)`);
    console.log(`  Lockout     : Bebas kunci / Tidak terkunci`);
    console.log(`  Password    : [Telah di-hash dengan Bcrypt secara aman]`);
    console.log(`  Waktu Update: ${updatedUser.updated_at}`);
    console.log("========================================================\n");
    console.log("Silakan lakukan pengujian login secara manual dengan kredensial baru tersebut.");
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
