import React, { useState, useMemo, useEffect } from "react";
import {
  useDataStore,
  type UserRecord,
  type UserRole,
  type UserAccountStatus,
} from "./DataStore";
import {
  Search, Download, Plus, X, Edit2, Trash2,
  Shield, UserCheck, UserX, Users, User,
  Check, AlertTriangle, Activity,
  Building2, Key, Eye, Clock, Lock, CheckCircle2, XCircle, RefreshCw
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

// ── Badges & Helpers ──────────────────────────────────────────────────────────
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
  switch (status) {
    case "aktif":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-green-50 text-green-700 border-green-200">
          <UserCheck size={11} />
          Aktif
        </span>
      );
    case "menunggu_persetujuan":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 animate-pulse">
          <Clock size={11} />
          Menunggu Persetujuan
        </span>
      );
    case "menunggu_verifikasi":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-sky-50 text-sky-700 border-sky-200">
          <Clock size={11} />
          Verifikasi Email
        </span>
      );
    case "ditolak":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-rose-50 text-rose-700 border-rose-200">
          <XCircle size={11} />
          Ditolak
        </span>
      );
    case "nonaktif":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-gray-100 text-gray-500 border-gray-200">
          <UserX size={11} />
          Nonaktif
        </span>
      );
  }
}

function initials(nama: string): string {
  if (!nama) return "U";
  return nama
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function isAntiLockout(u: UserRecord): boolean {
  const email = (u.email || "").toLowerCase().trim();
  return (
    email === "othniel.patrick@apps.ipb.ac.id" ||
    email === "othnielpatrick@apps.ipb.ac.id" ||
    u.id === "U-001" ||
    u.nama === "Othniel Patrick Limbong" ||
    u.role === "Admin Sistem"
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function UserDetailDrawer({
  user,
  onClose,
  onUpdateRole,
  onApprove,
  onDelete,
}: {
  user: UserRecord;
  onClose: () => void;
  onUpdateRole: (newRole: UserRole) => void;
  onApprove: (action: "setujui" | "tolak", role?: UserRole, catatan?: string) => void;
  onDelete: () => void;
}) {
  const [detailTab, setDetailTab] = useState<"profil" | "akses">("profil");
  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    if (user.status === "menunggu_persetujuan" || user.status === "menunggu_verifikasi") {
      const h = user.harapan_role as UserRole;
      if (h && (ASSIGNABLE_ROLES as readonly string[]).includes(h)) return h;
      return "Pekerja Stock Opname";
    }
    return user.role;
  });
  const [catatan, setCatatan] = useState("");
  const protectedUser = isAntiLockout(user);
  const perms = MATRIX[user.role as keyof typeof MATRIX] ?? {};

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-3 bg-gray-50/50">
          <div className="w-12 h-12 rounded-xl bg-gray-900 flex items-center justify-center text-white text-base font-bold shrink-0 shadow-xs">
            {initials(user.nama)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-gray-900 truncate">{user.nama}</p>
              {protectedUser && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  <Shield size={10} /> Superadmin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user.email}</p>
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
            Profil & Status
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
                  { label: "Nama Lengkap", value: user.nama },
                  { label: "Email", value: user.email },
                  { label: "NIP", value: user.nip || "—" },
                  { label: "Jabatan", value: user.jabatan || "—" },
                  { label: "Unit Kerja", value: user.unit || "Pusat" },
                  { label: "Harapan Role", value: user.harapan_role || "—" },
                  { label: "Login Terakhir", value: user.lastLogin || "Belum pernah login" },
                  { label: "Catatan Admin", value: user.catatan_admin || "—" },
                ].map((row) => (
                  <div key={row.label} className="flex items-start justify-between text-xs py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-400 font-medium w-32 shrink-0">{row.label}</span>
                    <span className="text-gray-800 font-semibold text-right flex-1 truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Pending Approval Controls */}
              {(user.status === "menunggu_persetujuan" || user.status === "menunggu_verifikasi") && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                      <Clock size={14} /> Permintaan Pendaftaran Akun
                    </div>
                    {user.status === "menunggu_verifikasi" ? (
                      <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                        Menunggu Verifikasi Email
                      </span>
                    ) : (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                        Email Terverifikasi
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Pengguna mengajukan pendaftaran akun dengan permohonan role:{" "}
                    <span className="font-bold underline text-amber-900">{user.harapan_role || "Pekerja Stock Opname"}</span>.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Tetapkan Role Saat Menyetujui
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="w-full text-xs border border-amber-300 rounded-lg p-2 bg-white text-gray-800 outline-none font-medium"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 mb-1">
                      Catatan Persetujuan / Penolakan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Contoh: Disetujui sesuai SK Penugasan SV..."
                      className="w-full text-xs border border-amber-300 rounded-lg p-2 bg-white text-gray-800 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onApprove("setujui", selectedRole, catatan)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                    >
                      <CheckCircle2 size={14} /> Setujui Pendaftaran
                    </button>
                    <button
                      onClick={() => onApprove("tolak", undefined, catatan)}
                      className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                  </div>
                </div>
              )}

              {/* Role Change for Active Users */}
              {!protectedUser && user.status === "aktif" && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800">Ubah Role Pengguna</span>
                    <span className="text-[10px] text-gray-400">4-Role RBAC Baku</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      className="flex-1 text-xs border border-gray-300 rounded-lg p-2 bg-white text-gray-800 outline-none"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={selectedRole === user.role}
                      onClick={() => onUpdateRole(selectedRole)}
                      className="px-3 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              )}

              {protectedUser && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
                  <Shield size={15} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-bold">Akun Terproteksi (Anti-Lockout).</span> Akun Superadmin Utama tidak dapat diubah rolenya, dinonaktifkan, atau dihapus guna mencegah lockout sistem.
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
  onAdd,
}: {
  onClose: () => void;
  onAdd: (payload: { nama: string; email: string; nip?: string; jabatan?: string; role: UserRole; unit: string }) => void;
}) {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [nip, setNip] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [role, setRole] = useState<UserRole>("Pekerja Stock Opname");
  const [unit, setUnit] = useState("Sekolah Vokasi");

  const valid = nama.trim().length > 2 && email.includes("@") && role && unit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    onAdd({ nama: nama.trim(), email: email.trim(), nip: nip.trim(), jabatan: jabatan.trim(), role, unit });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-base font-bold text-gray-900">Tambah Pengguna Baru</h2>
            <p className="text-[11px] text-gray-500">Daftarkan akun langsung dengan role terotorisasi</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Lengkap *</label>
            <input
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Dr. Ir. Budi Santoso, M.Si"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email IPB / Resmi *</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@apps.ipb.ac.id"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">NIP</label>
              <input
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="19XXXXXXXX XXXXXX X XXX"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jabatan</label>
              <input
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Staf Perlengkapan"
                className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2.5 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role Sistem *</label>
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
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unit Kerja / Kampus *</label>
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
            <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800">
              Pengguna yang ditambahkan langsung oleh Admin Sistem akan berstatus <span className="font-bold">Aktif</span> dan dapat langsung masuk ke dashboard.
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
              <Check size={14} /> Tambahkan
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
                    {initials(u.nama)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{u.nama}</p>
                    <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
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
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{lastActiveUser?.nama || "Admin"}</p>
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
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Login Terakhir</th>
                <th className="py-3 px-4 text-right">Status Akun</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-4 font-bold text-gray-900">{u.nama}</td>
                  <td className="py-3 px-4 text-gray-600">{u.email}</td>
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

  // Helper: check if a user is awaiting admin approval
  const isPendingApproval = (u: UserRecord) =>
    u.status === "menunggu_persetujuan" || u.status === "menunggu_verifikasi";

  // Approval filter counts
  const pendingUsers = useMemo(
    () => users.filter(isPendingApproval),
    [users]
  );

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = (search || "").toLowerCase();
      const matchQ =
        (u.nama || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.unit ? u.unit.toLowerCase().includes(q) : false) ||
        (u.nip ? u.nip.toLowerCase().includes(q) : false);

      const matchR = roleFilter === "Semua Role" || u.role === roleFilter;
      const matchS =
        statusFilter === "Semua Status" ||
        u.status === statusFilter ||
        (statusFilter === "menunggu_persetujuan" && isPendingApproval(u));

      return matchQ && matchR && matchS;
    });
  }, [users, search, roleFilter, statusFilter]);

  const selectedUser = selectedUserId
    ? users.find((u) => u.id === selectedUserId)
    : undefined;

  // KPI counts
  const kpi = useMemo(
    () => ({
      total: users.length,
      admin: users.filter((u) => u.role === "Admin Sistem").length,
      pimpinan: users.filter((u) => u.role === "Pimpinan").length,
      adminPusat: users.filter((u) => u.role === "Admin Pusat").length,
      pekerja: users.filter((u) => u.role === "Pekerja Stock Opname").length,
      pending: pendingUsers.length,
    }),
    [users, pendingUsers]
  );

  // Handlers
  const handleUpdateRole = async (newRole: UserRole) => {
    if (!selectedUserId) return;
    try {
      await store.updateUserRole(selectedUserId, newRole);
    } catch (err: any) {
      alert(err.message || "Gagal mengubah role");
    }
  };

  const handleApprove = async (
    action: "setujui" | "tolak",
    role?: UserRole,
    catatan?: string
  ) => {
    if (!selectedUserId) return;
    try {
      await store.approveUser(selectedUserId, action, role, catatan);
      setSelectedUserId(null);
    } catch (err: any) {
      alert(err.message || "Gagal memproses persetujuan");
    }
  };

  const handleDelete = async () => {
    if (!selectedUserId) return;
    const target = users.find((u) => u.id === selectedUserId);
    if (!target) return;
    if (isAntiLockout(target)) {
      alert("Akun Superadmin Utama dilindungi anti-lockout!");
      return;
    }
    if (confirm(`Hapus pengguna "${target.nama}" (${target.email}) dari sistem?`)) {
      try {
        await store.deleteUser(selectedUserId);
        setSelectedUserId(null);
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
              Kelola akun resmi SV IPB, 4-role baku sistem, otorisasi menu, dan persetujuan registrasi.
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

        {/* Pending Approval Alert Banner */}
        {pendingUsers.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900">
                  {pendingUsers.length} Permintaan Registrasi Menunggu Persetujuan
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Calon pengguna telah mendaftar dan menunggu persetujuan otorisasi role oleh Admin Sistem.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setActiveTab("daftar");
                setStatusFilter("menunggu_persetujuan");
              }}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap shadow-xs"
            >
              Tinjau Sekarang ({pendingUsers.length})
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "Total Pengguna", value: kpi.total, color: "#111827", icon: Users },
            { label: "Admin Sistem", value: kpi.admin, color: "#DC2626", icon: Shield },
            { label: "Pimpinan", value: kpi.pimpinan, color: "#7C3AED", icon: Key },
            { label: "Admin Pusat", value: kpi.adminPusat, color: "#2563EB", icon: User },
            { label: "Pekerja SO", value: kpi.pekerja, color: "#059669", icon: UserCheck },
            { label: "Menunggu Approval", value: kpi.pending, color: "#D97706", icon: Clock },
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
                  placeholder="Cari nama, email, NIP, atau unit..."
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
                <option value="menunggu_persetujuan">Menunggu Persetujuan</option>
                <option value="menunggu_verifikasi">Verifikasi Email</option>
                <option value="ditolak">Ditolak</option>
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
                    <th className="py-3 px-4">Nama & Akun</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Unit Kerja</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Login Terakhir</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs">
                  {filteredUsers.map((u) => {
                    const isProtected = isAntiLockout(u);
                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedUserId(u.id)}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {initials(u.nama)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-gray-900">{u.nama}</span>
                                {isProtected && (
                                  <Shield size={11} className="text-amber-600" title="Superadmin (Anti-Lockout)" />
                                )}
                              </div>
                              <p className="text-[10px] text-gray-400">
                                {u.nip ? `NIP ${u.nip}` : u.jabatan || "Pengguna Sistem"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{u.email}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{u.unit || "Pusat"}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={u.status} />
                        </td>
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap font-mono text-[11px]">
                          {u.lastLogin || "—"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {isPendingApproval(u) ? (
                              <button
                                onClick={() => setSelectedUserId(u.id)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-md shadow-2xs flex items-center gap-1"
                              >
                                <Clock size={11} /> Tinjau / Setujui
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={() => setSelectedUserId(u.id)}
                                  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                  title="Lihat Detail"
                                >
                                  <Eye size={13} />
                                </button>
                                {!isProtected && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`Hapus pengguna "${u.nama}"?`)) {
                                        store.deleteUser(u.id);
                                      }
                                    }}
                                    className="p-1.5 rounded hover:bg-rose-50 text-gray-400 hover:text-rose-600 transition-colors"
                                    title="Hapus Pengguna"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </>
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
          onUpdateRole={handleUpdateRole}
          onApprove={handleApprove}
          onDelete={handleDelete}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onAdd={async (payload) => {
            try {
              await store.addUser({
                ...payload,
                status: "aktif",
                aktif: true,
              });
            } catch (err: any) {
              alert(err.message || "Gagal menambahkan pengguna");
            }
          }}
        />
      )}
    </main>
  );
}
