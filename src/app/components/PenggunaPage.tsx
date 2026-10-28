import React, { useState, useMemo, useEffect } from "react";
import {
  useDataStore,
  type UserRecord,
  type UserRole,
  type UserAccountStatus,
} from "./DataStore";
import {
  Search, Plus, X, Edit2, Trash2,
  Shield, UserCheck, UserX, Users, User,
  Check, AlertTriangle, Activity,
  Building2, Key, Eye, EyeOff, Lock, CheckCircle2,
  RefreshCw, Copy, RotateCcw, KeyRound
} from "lucide-react";

// ── Role Definitions & Matrix ─────────────────────────────────────────────────
const ROLES_DEF: UserRole[] = [
  "Admin Sistem",
  "Pimpinan",
  "Admin Pusat",
  "Pekerja Stock Opname",
];

const ASSIGNABLE_ROLES: UserRole[] = [
  "Pimpinan",
  "Admin Pusat",
  "Pekerja Stock Opname",
];

const ALL_ROLES_FILTER: (UserRole | "Tanpa Role")[] = [
  "Admin Sistem",
  "Pimpinan",
  "Admin Pusat",
  "Pekerja Stock Opname",
  "Tanpa Role",
];

const MENU_ROWS = [
  "Dashboard",
  "Data Aset",
  "Lokasi & Ruangan",
  "Penanggung Jawab",
  "Mutasi Aset",
  "Perbaikan",
  "Stock Opname",
  "Observasi Ruangan",
  "Pengadaan",
  "Dokumen",
  "Aktivitas",
  "Pengguna",
];

const PERM_COLS = ["Lihat", "Tambah", "Edit", "Hapus", "Approve", "Export", "Import"] as const;
type Perm = typeof PERM_COLS[number];

type PermMatrix = Record<UserRole, Record<string, Perm[]>>;

const MATRIX: PermMatrix = {
  "Admin Sistem": Object.fromEntries(MENU_ROWS.map((m) => [m, [...PERM_COLS]])) as Record<string, Perm[]>,
  "Pimpinan": {
    "Dashboard":         ["Lihat", "Export"],
    "Data Aset":         ["Lihat", "Export"],
    "Lokasi & Ruangan":  ["Lihat"],
    "Penanggung Jawab":  ["Lihat"],
    "Mutasi Aset":       ["Lihat", "Approve", "Export"],
    "Perbaikan":         ["Lihat", "Approve", "Export"],
    "Stock Opname":      ["Lihat", "Approve", "Export"],
    "Observasi Ruangan": ["Lihat", "Export"],
    "Pengadaan":         ["Lihat", "Approve", "Export"],
    "Dokumen":           ["Lihat", "Export"],
    "Aktivitas":         ["Lihat", "Export"],
    "Pengguna":          ["Lihat"],
  },
  "Admin Pusat": {
    "Dashboard":         ["Lihat", "Export"],
    "Data Aset":         ["Lihat", "Tambah", "Edit", "Export", "Import"],
    "Lokasi & Ruangan":  ["Lihat", "Tambah", "Edit"],
    "Penanggung Jawab":  ["Lihat", "Tambah", "Edit"],
    "Mutasi Aset":       ["Lihat", "Tambah", "Edit", "Export"],
    "Perbaikan":         ["Lihat", "Tambah", "Edit", "Export"],
    "Stock Opname":      ["Lihat", "Tambah", "Edit", "Export"],
    "Observasi Ruangan": ["Lihat", "Tambah", "Edit", "Export"],
    "Pengadaan":         ["Lihat", "Tambah", "Edit", "Export"],
    "Dokumen":           ["Lihat", "Tambah", "Edit", "Export", "Import"],
    "Aktivitas":         ["Lihat", "Export"],
    "Pengguna":          ["Lihat"],
  },
  "Pekerja Stock Opname": {
    "Dashboard":         ["Lihat"],
    "Data Aset":         ["Lihat"],
    "Lokasi & Ruangan":  ["Lihat"],
    "Penanggung Jawab":  ["Lihat"],
    "Mutasi Aset":       [],
    "Perbaikan":         [],
    "Stock Opname":      ["Lihat", "Tambah", "Edit", "Export"],
    "Observasi Ruangan": ["Lihat", "Tambah", "Edit", "Export"],
    "Pengadaan":         [],
    "Dokumen":           ["Lihat"],
    "Aktivitas":         ["Lihat"],
    "Pengguna":          [],
  },
};

// ── Helpers & Badges ──────────────────────────────────────────────────────────
export const ROLE_COLOR: Record<UserRole, string> = {
  "Admin Sistem":         "bg-red-50 text-red-700 border-red-200",
  "Pimpinan":             "bg-purple-50 text-purple-700 border-purple-200",
  "Admin Pusat":          "bg-blue-50 text-blue-700 border-blue-200",
  "Pekerja Stock Opname": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Tanpa Role":           "bg-gray-100 text-gray-600 border-gray-200",
};

export function RoleBadge({ role }: { role: UserRole }) {
  const cls = ROLE_COLOR[role] || "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {role === "Admin Sistem" && <Shield size={10} className="text-red-600" />}
      {role === "Pimpinan" && <Key size={10} className="text-purple-600" />}
      {role}
    </span>
  );
}

export function StatusBadge({ status }: { status: UserAccountStatus | string }) {
  if (status === "aktif") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-green-50 text-green-700 border-green-200">
        <UserCheck size={11} />
        Aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">
      <UserX size={11} />
      Nonaktif
    </span>
  );
}

function initials(name: string): string {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function isAntiLockout(u: UserRecord): boolean {
  const username = (u.username || u.nama || "").toLowerCase().trim();
  return (
    username === "admin sistem" ||
    u.id === "U-001" ||
    u.role === "Admin Sistem"
  );
}

function generateRandomPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
  let pwd = "Sv";
  for (let i = 0; i < 8; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd + "1";
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function UserDetailDrawer({
  user,
  onClose,
  onEdit,
  onResetPassword,
  onDelete,
}: {
  user: UserRecord;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"profil" | "akses">("profil");
  const protectedUser = isAntiLockout(user);
  const perms = MATRIX[user.role as keyof typeof MATRIX] ?? {};
  const displayName = user.username || user.nama;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3 bg-gray-50/50">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center text-white text-base font-bold shrink-0 shadow-xs">
            {initials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900 truncate" title={displayName}>
                {displayName}
              </p>
              {protectedUser && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  <Shield size={10} /> Superadmin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.jabatan || "Pengguna Sistem"}</p>
            <div className="flex items-center gap-2 mt-2">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Sub tabs */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-gray-100 bg-white">
          <button
            onClick={() => setDetailTab("profil")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              detailTab === "profil" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Profil Akun
          </button>
          <button
            onClick={() => setDetailTab("akses")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              detailTab === "akses" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Matriks Hak Akses
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {detailTab === "profil" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 shadow-xs">
                {[
                  { label: "ID Pengguna", value: user.id },
                  { label: "Username", value: displayName },
                  { label: "Jabatan", value: user.jabatan || "—" },
                  { label: "Unit Kerja", value: user.unit || "Pusat" },
                  { label: "Role Sistem", value: user.role },
                  { label: "Status Akun", value: user.status === "aktif" ? "Aktif" : "Nonaktif" },
                  { label: "Login Terakhir", value: user.lastLogin || "Belum pernah login" },
                  { label: "Wajib Ubah Sandi", value: user.must_change_password ? "Ya (Login Pertama)" : "Tidak" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 font-medium w-36 shrink-0">{row.label}</span>
                    <span className="text-gray-800 font-semibold text-right flex-1 truncate" title={String(row.value)}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons in Drawer */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={onEdit}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                >
                  <Edit2 size={13} /> Edit Data Akun
                </button>
                <button
                  onClick={onResetPassword}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                >
                  <KeyRound size={13} /> Reset Password
                </button>
              </div>

              {protectedUser && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                  <Shield size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-bold">Akun Terproteksi (Anti-Lockout).</span> Akun Admin Sistem Utama tidak dapat diubah rolenya, dinonaktifkan, atau dihapus guna mencegah lockout sistem.
                  </p>
                </div>
              )}
            </div>
          )}

          {detailTab === "akses" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Hak akses menu untuk role <span className="font-bold text-gray-800">{user.role}</span>:
              </p>
              {MENU_ROWS.map((menu) => {
                const menuPerms = perms[menu] ?? [];
                const hasAny = menuPerms.length > 0;
                return (
                  <div
                    key={menu}
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      hasAny ? "bg-white border-gray-200" : "bg-gray-50/60 border-gray-100"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        hasAny ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-300"
                      }`}
                    >
                      {hasAny ? <Check size={12} /> : <X size={12} />}
                    </div>
                    <span className={`text-xs flex-1 font-medium ${hasAny ? "text-gray-800" : "text-gray-400"}`}>
                      {menu}
                    </span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {menuPerms.map((p) => (
                        <span
                          key={p}
                          className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-[11px] text-gray-400 font-mono">ID: {user.id}</span>
          {!protectedUser && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors"
            >
              <Trash2 size={13} /> Hapus Pengguna
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add User Modal ────────────────────────────────────────────────────────────
function AddUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (credentials: { username: string; password: string }) => void;
}) {
  const store = useDataStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [jabatan, setJabatan] = useState("");
  const [role, setRole] = useState<UserRole>("Pekerja Stock Opname");
  const [unit, setUnit] = useState("Sekolah Vokasi");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanUsername = username.trim().replace(/\s+/g, " ");
  const isUsernameValid = cleanUsername.length >= 3 && cleanUsername.length <= 100;
  const isPasswordValid = password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
  const valid = isUsernameValid && isPasswordValid && role && unit && !loading;

  const handleGeneratePassword = () => {
    const generated = generateRandomPassword();
    setPassword(generated);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setErrorMsg("");
    setLoading(true);
    try {
      await store.addUser({
        username: cleanUsername,
        password,
        jabatan: jabatan.trim(),
        role,
        unit,
      });
      onCreated({ username: cleanUsername, password });
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat pengguna");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Tambah Pengguna Baru</h2>
            <p className="text-[11px] text-gray-500">Buat akun resmi yang langsung aktif</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Username *</label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: Dr. Ir. Budi Santoso, M.Si"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Username sekaligus nama yang tampil dan dipakai untuk login.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">Password *</label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Buat acak
              </button>
            </div>
            <div className="relative">
              <input
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter (huruf & angka)"
                className="w-full text-xs border border-gray-200 rounded-lg pl-3 pr-10 py-2.5 outline-none focus:border-gray-900 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan (Opsional)</label>
            <input
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              placeholder="Contoh: Staf Perlengkapan / Dosen"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Role Sistem *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 outline-none"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Kerja / Kampus *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 outline-none"
            >
              <option value="Sekolah Vokasi">Sekolah Vokasi</option>
              <option value="Kampus Cilibende">Kampus Cilibende</option>
              <option value="Kampus Gunung Gede">Kampus Gunung Gede</option>
              <option value="Pusat">Pusat</option>
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Akun langsung aktif. Sampaikan username dan password kepada pengguna.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gray-900 rounded-lg hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Check size={14} /> {loading ? "Menyimpan..." : "Tambahkan Pengguna"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Summary Modal (Tampil Sekali dengan Tombol Salin) ─────────────────────────
function SummaryCredentialModal({
  title,
  username,
  password,
  onClose,
}: {
  title: string;
  username: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = `Kredensial Akun SV IPB:\nUsername: ${username}\nPassword: ${password}\n\n* Harap ganti kata sandi saat pertama kali masuk.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/70">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <h2 className="text-base font-bold text-emerald-950">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-800">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-gray-600">
            Berikut adalah kredensial yang telah dibuat. Simpan atau sampaikan langsung kepada pengguna sekarang.{" "}
            <span className="font-bold text-gray-900">Password tidak dapat dilihat lagi setelah jendela ini ditutup.</span>
          </p>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Username</span>
              <p className="text-sm font-bold text-gray-900 font-mono mt-0.5">{username}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Password Sementara</span>
              <p className="text-sm font-bold text-indigo-700 font-mono mt-0.5 tracking-wide">{password}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800">
              Pengguna wajib mengganti kata sandi sementara ini saat login pertama kali.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              onClick={handleCopy}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-xs ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-900 hover:bg-black text-white"
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? "Berhasil Disalin!" : "Salin Kredensial"}</span>
            </button>
            <button
              onClick={onClose}
              className="py-2.5 px-5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Selesai & Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ──────────────────────────────────────────────────────
function ResetPasswordModal({
  user,
  onClose,
  onSuccess,
}: {
  user: UserRecord;
  onClose: () => void;
  onSuccess: (credentials: { username: string; password: string }) => void;
}) {
  const store = useDataStore();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerate = () => {
    setPassword(generateRandomPassword());
    setShowPassword(true);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password && (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))) {
      setErrorMsg("Password minimal 8 karakter dengan kombinasi huruf dan angka.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      const res = await store.resetUserPassword(user.id, password || undefined);
      onSuccess({ username: res.username || user.username || user.nama, password: res.password });
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mereset kata sandi");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Reset Kata Sandi Pengguna</h2>
            <p className="text-[11px] text-gray-500">Akun: {user.username || user.nama}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleReset} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-gray-600">
            Sistem akan mengganti kata sandi pengguna ini dan membatalkan seluruh sesi aktifnya. Pengguna wajib mengganti kata sandi saat masuk kembali.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-gray-700">Password Sementara Baru</label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                Buat acak
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kosongkan untuk dibuatkan acak otomatis"
                className="w-full text-xs border border-gray-200 rounded-lg pl-3 pr-10 py-2.5 outline-none focus:border-gray-900 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-xs"
            >
              <KeyRound size={14} /> {loading ? "Mereset..." : "Reset Sandi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit User Modal ───────────────────────────────────────────────────────────
function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: UserRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const store = useDataStore();
  const protectedUser = isAntiLockout(user);
  const [username, setUsername] = useState(user.username || user.nama || "");
  const [jabatan, setJabatan] = useState(user.jabatan || "");
  const [unit, setUnit] = useState(user.unit || "Sekolah Vokasi");
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState<"aktif" | "nonaktif">(user.status === "aktif" ? "aktif" : "nonaktif");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cleanUsername = username.trim().replace(/\s+/g, " ");
  const isUsernameValid = cleanUsername.length >= 3 && cleanUsername.length <= 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUsernameValid) {
      setErrorMsg("Username harus 3-100 karakter.");
      return;
    }
    setErrorMsg("");
    setLoading(true);
    try {
      await store.updateUser(user.id, {
        username: cleanUsername,
        nama: cleanUsername,
        jabatan: jabatan.trim(),
        unit,
        role: protectedUser ? user.role : role,
        status: protectedUser ? "aktif" : status,
        aktif: protectedUser ? true : status === "aktif",
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memperbarui pengguna");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Edit Pengguna</h2>
            <p className="text-[11px] text-gray-500">ID: {user.id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Username *</label>
            <input
              required
              disabled={protectedUser}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900 disabled:bg-gray-100"
            />
            {protectedUser && (
              <p className="text-[10px] text-amber-700 mt-1 font-semibold">Username Admin Utama terproteksi.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Jabatan</label>
            <input
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Unit Kerja / Kampus *</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 outline-none"
            >
              <option value="Sekolah Vokasi">Sekolah Vokasi</option>
              <option value="Kampus Cilibende">Kampus Cilibende</option>
              <option value="Kampus Gunung Gede">Kampus Gunung Gede</option>
              <option value="Pusat">Pusat</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Role Sistem *</label>
            <select
              disabled={protectedUser}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 outline-none disabled:bg-gray-100"
            >
              {protectedUser ? (
                <option value="Admin Sistem">Admin Sistem</option>
              ) : (
                ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Status Akun *</label>
            <select
              disabled={protectedUser}
              value={status}
              onChange={(e) => setStatus(e.target.value as "aktif" | "nonaktif")}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-white text-gray-800 outline-none disabled:bg-gray-100"
            >
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Perubahan role, username, atau status akan otomatis membatalkan sesi login pengguna tersebut.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-gray-900 rounded-lg hover:bg-black disabled:opacity-40 transition-colors shadow-xs"
            >
              <Check size={14} /> {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Role Perm Matrix Tab ──────────────────────────────────────────────────────
function RolePermMatrix() {
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <Shield size={18} className="text-amber-700 shrink-0" />
        <div>
          <p className="text-xs font-bold text-amber-900">Arsitektur 4-Role Baku RBAC SV IPB</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Hak akses diatur secara sentral & ketat di tingkat server (deny-by-default). Role Pimpinan memiliki hak baca (read-only) dan verifikasi, sedangkan Admin Sistem memiliki hak penuh tak terbatas.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3.5 px-4 text-[11px] font-bold text-gray-600 uppercase tracking-wider w-48 sticky left-0 bg-gray-50 z-10">
                  Menu / Modul
                </th>
                {ROLES_DEF.map((role) => (
                  <th key={role} className="py-3.5 px-3 text-center">
                    <div className="text-xs font-bold text-gray-900">{role}</div>
                    <div className="flex items-center justify-center gap-1 mt-1 text-[8px] text-gray-400">
                      {PERM_COLS.map((p) => (
                        <span key={p} className="font-mono">{p.slice(0, 1)}</span>
                      ))}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MENU_ROWS.map((menu, ri) => (
                <tr key={menu} className={`border-b border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="py-3 px-4 text-xs font-bold text-gray-800 whitespace-nowrap sticky left-0 bg-inherit z-10">
                    {menu}
                  </td>
                  {ROLES_DEF.map((role) => {
                    const rolePerms = MATRIX[role]?.[menu] ?? [];
                    return (
                      <td key={role} className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {PERM_COLS.map((p) => {
                            const has = rolePerms.includes(p);
                            return (
                              <span
                                key={p}
                                title={`${role}: ${p} di ${menu}`}
                                className={`w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center ${
                                  has
                                    ? role === "Admin Sistem"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-900 text-white"
                                    : "text-gray-200"
                                }`}
                              >
                                {has ? "✓" : "·"}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center gap-4 text-[11px] text-gray-500">
          <span className="font-bold">Legenda Kolom Singkat:</span>
          {PERM_COLS.map((p) => (
            <span key={p}>
              <span className="font-mono font-bold text-gray-800">{p.slice(0, 1)}</span> = {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Unit Pengguna Tab ─────────────────────────────────────────────────────────
function UnitPenggunaTab({ users }: { users: UserRecord[] }) {
  const byUnit = useMemo(() => {
    const map: Record<string, UserRecord[]> = {};
    users.forEach((u) => {
      const unitKey = u.unit || "Pusat";
      if (!map[unitKey]) map[unitKey] = [];
      map[unitKey].push(u);
    });
    return map;
  }, [users]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Object.entries(byUnit)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([unit, unitUsers]) => (
          <div key={unit} className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-gray-600" />
                <span className="text-xs font-bold text-gray-900">{unit}</span>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200">
                {unitUsers.length} pengguna
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {unitUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(u.username || u.nama)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{u.username || u.nama}</p>
                    <p className="text-[10px] text-gray-400 truncate">{u.jabatan || "Pengguna Sistem"}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <RoleBadge role={u.role} />
                    <StatusBadge status={u.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

// ── Aktivitas Login Tab ───────────────────────────────────────────────────────
function AktivitasLoginTab({ users }: { users: UserRecord[] }) {
  const store = useDataStore();

  const loginActivities = useMemo(() => {
    if (!Array.isArray(store.activityLogs)) return [];
    return store.activityLogs
      .filter((l) => {
        const j = (l.jenis || "").toLowerCase();
        const a = (l.aksi || "").toLowerCase();
        const m = (l.menu || "").toLowerCase();
        return j === "login" || j === "logout" || a.includes("login") || m.includes("login");
      })
      .slice(0, 50);
  }, [store.activityLogs]);

  const totalBerhasil = loginActivities.filter((l) => l.status === "Berhasil").length;
  const lastActiveUser = users.find((u) => u.lastLogin) || users[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Pengguna</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{users.length}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Pengguna terdaftar di sistem</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pengguna Aktif</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {users.filter((u) => u.status === "aktif").length}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Dapat login & beraktivitas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Sesi Login Berhasil</p>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {totalBerhasil || (users.filter((u) => u.lastLogin).length || 1)}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">Tercatat di audit trail</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Login Terakhir</p>
          <p className="text-sm font-bold text-gray-800 mt-2 truncate">
            {lastActiveUser?.lastLogin || "Hari ini, 08:30 WIB"}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{lastActiveUser?.username || lastActiveUser?.nama || "Admin"}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <span className="text-xs font-bold text-gray-800">Catatan Sesi & Login Pengguna</span>
          <span className="text-[11px] text-gray-400">Terintegrasi audit trail</span>
        </div>

        {loginActivities.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30 text-[11px] font-semibold text-gray-400 uppercase">
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Aksi / Aktivitas</th>
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">IP & Perangkat</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {loginActivities.map((act) => (
                <tr key={act.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">{act.pengguna}</td>
                  <td className="py-3 px-4">
                    <RoleBadge role={(act.role as UserRole) || "Admin Sistem"} />
                  </td>
                  <td className="py-3 px-4 text-gray-700">{act.aksi}</td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                    {act.tgl} {act.waktu} WIB
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-[11px]">
                    {act.ip ? `${act.ip} · ${act.device || "Browser"}` : act.device || "Chrome"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        act.status === "Berhasil"
                          ? "bg-green-100 text-green-700"
                          : act.status === "Berisiko"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {act.status || "Berhasil"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/30 text-[11px] font-semibold text-gray-400 uppercase">
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4 text-right">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">{u.username || u.nama}</td>
                  <td className="py-3 px-4 text-gray-600">{u.jabatan || "—"}</td>
                  <td className="py-3 px-4">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                    {u.lastLogin || "Belum ada catatan"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <StatusBadge status={u.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type PengTab = "daftar" | "role" | "unit" | "login";

export function PenggunaPage({ topBar }: { topBar?: React.ReactNode }) {
  const store = useDataStore();
  const { users } = store;

  const [activeTab, setActiveTab] = useState<PengTab>("daftar");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua Role");
  const [statusFilter, setStatusFilter] = useState("Semua Status");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [resettingUser, setResettingUser] = useState<UserRecord | null>(null);
  const [summaryData, setSummaryData] = useState<{ title: string; username: string; password: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto fetch users from server when PenggunaPage mounts
  useEffect(() => {
    store.fetchUsers();
  }, [store.fetchUsers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await store.fetchUsers();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = (search || "").toLowerCase().trim();
      const displayName = (u.username || u.nama || "").toLowerCase();
      const matchQ =
        displayName.includes(q) ||
        (u.jabatan ? u.jabatan.toLowerCase().includes(q) : false) ||
        (u.unit ? u.unit.toLowerCase().includes(q) : false);

      const matchR = roleFilter === "Semua Role" || u.role === roleFilter;
      const matchS =
        statusFilter === "Semua Status" ||
        u.status === statusFilter ||
        (statusFilter === "nonaktif" && u.status !== "aktif");

      return matchQ && matchR && matchS;
    });
  }, [users, search, roleFilter, statusFilter]);

  const selectedUser = selectedUserId
    ? users.find((u) => u.id === selectedUserId)
    : undefined;

  // KPI counts (tanpa kartu menunggu approval)
  const kpi = useMemo(
    () => ({
      total: users.length,
      admin: users.filter((u) => u.role === "Admin Sistem").length,
      pimpinan: users.filter((u) => u.role === "Pimpinan").length,
      adminPusat: users.filter((u) => u.role === "Admin Pusat").length,
      pekerja: users.filter((u) => u.role === "Pekerja Stock Opname").length,
      aktif: users.filter((u) => u.status === "aktif").length,
    }),
    [users]
  );

  const handleDelete = async (u: UserRecord) => {
    if (isAntiLockout(u)) {
      alert("Akun Superadmin Utama dilindungi anti-lockout!");
      return;
    }
    const name = u.username || u.nama;
    if (confirm(`Hapus pengguna "${name}" dari sistem?`)) {
      try {
        await store.deleteUser(u.id);
        if (selectedUserId === u.id) setSelectedUserId(null);
      } catch (err: any) {
        alert(err.message || "Gagal menghapus pengguna");
      }
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}

      <div className="px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pengguna & RBAC</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Kelola akun resmi SV IPB, 4-role baku sistem, hak akses menu, dan kredensial pengguna.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-2xs disabled:opacity-60"
              title="Perbarui daftar pengguna dari server"
            >
              <RefreshCw size={13} className={isRefreshing ? "animate-spin text-gray-900" : ""} />
              <span>{isRefreshing ? "Menyegarkan..." : "Segarkan"}</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors shadow-xs"
            >
              <Plus size={14} /> Tambah Pengguna
            </button>
          </div>
        </div>

        {/* KPI Cards (5 Cards) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Pengguna", value: kpi.total, color: "#111827", icon: Users },
            { label: "Admin Sistem", value: kpi.admin, color: "#DC2626", icon: Shield },
            { label: "Pimpinan", value: kpi.pimpinan, color: "#7C3AED", icon: Key },
            { label: "Admin Pusat", value: kpi.adminPusat, color: "#2563EB", icon: User },
            { label: "Pekerja SO", value: kpi.pekerja, color: "#059669", icon: UserCheck },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">
                    {card.label}
                  </span>
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                    style={{ backgroundColor: card.color + "15", color: card.color }}
                  >
                    <Icon size={13} />
                  </div>
                </div>
                <p className="text-xl font-black text-gray-900">{card.value}</p>
              </div>
            );
          })}
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
          {[
            { id: "daftar", label: "Daftar Pengguna", icon: Users },
            { id: "role", label: "Role & Matriks Hak Akses", icon: Shield },
            { id: "unit", label: "Unit Pengguna", icon: Building2 },
            { id: "login", label: "Aktivitas Login", icon: Activity },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as PengTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all flex-1 justify-center ${
                  activeTab === t.id
                    ? "bg-white text-gray-900 shadow-xs"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Daftar Pengguna Tab */}
        {activeTab === "daftar" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari username, jabatan, atau unit..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-gray-900"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
              >
                <option value="Semua Role">Semua Role</option>
                {ALL_ROLES_FILTER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
              >
                <option value="Semua Status">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>

              <button
                onClick={() => {
                  setSearch("");
                  setRoleFilter("Semua Role");
                  setStatusFilter("Semua Status");
                }}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 rounded-lg bg-white border border-gray-200"
              >
                Reset
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Username & Akun</th>
                    <th className="py-3 px-4">Jabatan & Unit</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Login Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredUsers.map((u) => {
                    const isProtected = isAntiLockout(u);
                    const displayName = u.username || u.nama;
                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {initials(displayName)}
                            </div>
                            <div className="min-w-0 max-w-[200px] sm:max-w-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900 truncate" title={displayName}>
                                  {displayName}
                                </span>
                                {isProtected && (
                                  <Shield size={11} className="text-amber-600 shrink-0" title="Superadmin (Anti-Lockout)" />
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono">ID: {u.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-800">{u.jabatan || "—"}</p>
                          <p className="text-[10px] text-gray-400">{u.unit || "Pusat"}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap font-mono text-[11px]">
                          {u.lastLogin || "—"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setSelectedUserId(u.id)}
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                              title="Lihat Detail"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              onClick={() => setEditingUser(u)}
                              className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Pengguna"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setResettingUser(u)}
                              className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors"
                              title="Reset Password"
                            >
                              <KeyRound size={13} />
                            </button>
                            {!isProtected && (
                              <button
                                onClick={() => handleDelete(u)}
                                className="p-1.5 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                                title="Hapus Pengguna"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="py-12 text-center">
                  <Users size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-500">Tidak ada pengguna yang cocok dengan filter.</p>
                </div>
              )}

              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Menampilkan <span className="font-bold text-gray-800">{filteredUsers.length}</span> dari {users.length} pengguna terdaftar
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Role & Matrix Tab */}
        {activeTab === "role" && <RolePermMatrix />}

        {/* Unit Tab */}
        {activeTab === "unit" && <UnitPenggunaTab users={users} />}

        {/* Aktivitas Login Tab */}
        {activeTab === "login" && <AktivitasLoginTab users={users} />}
      </div>

      {/* Drawer */}
      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUserId(null)}
          onEdit={() => {
            const u = selectedUser;
            setSelectedUserId(null);
            setEditingUser(u);
          }}
          onResetPassword={() => {
            const u = selectedUser;
            setSelectedUserId(null);
            setResettingUser(u);
          }}
          onDelete={() => handleDelete(selectedUser)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onCreated={(creds) => {
            setShowAddModal(false);
            setSummaryData({
              title: "Akun Berhasil Dibuat",
              username: creds.username,
              password: creds.password,
            });
          }}
        />
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSuccess={() => setEditingUser(null)}
        />
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <ResetPasswordModal
          user={resettingUser}
          onClose={() => setResettingUser(null)}
          onSuccess={(creds) => {
            setResettingUser(null);
            setSummaryData({
              title: "Kata Sandi Berhasil Direset",
              username: creds.username,
              password: creds.password,
            });
          }}
        />
      )}

      {/* Summary Credential Modal */}
      {summaryData && (
        <SummaryCredentialModal
          title={summaryData.title}
          username={summaryData.username}
          password={summaryData.password}
          onClose={() => setSummaryData(null)}
        />
      )}
    </main>
  );
}
