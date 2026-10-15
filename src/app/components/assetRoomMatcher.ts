import type { Asset, RuanganData } from "./DataStore";

export interface UnmatchedRoomItem {
  rawRoom: string;
  count: number;
  assets: Asset[];
}

export interface MatchResult {
  assetRoomMap: Map<string, RuanganData>;
  unmatchedRoomsReport: UnmatchedRoomItem[];
  totalUnmatchedCount: number;
  totalMatchedCount: number;
}

/**
 * Normalize room name for resilient fuzzy matching
 * (removes non-alphanumeric chars, removes leading "r" or "ruang", case-insensitive)
 */
export function normRoomStr(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/^r(uang)?/g, "")
    .trim();
}

/**
 * Single Canonical Matching Function used across ALL modules:
 * - Menu Stock Opname (Landing, Progress, SO per Gedung, SO per Ruangan, Tab Daftar Aset)
 * - Menu Lokasi & Ruangan (Ringkasan, Aset per Ruangan, Denah)
 * - Dashboard Analytics & Financials
 */
export function buildAssetRoomMap(assets: Asset[], masterRooms: RuanganData[]): MatchResult {
  const assetRoomMap = new Map<string, RuanganData>();
  const unmatchedMap = new Map<string, { rawRoom: string; count: number; assets: Asset[] }>();

  // 1. Build lookup index maps
  const byIdOrSource = new Map<string, RuanganData>();
  const byNameExact = new Map<string, RuanganData>();
  const byNameNorm = new Map<string, RuanganData>();

  masterRooms.forEach((r) => {
    // Unique ID lookups
    if (r.id) {
      byIdOrSource.set(String(r.id).toLowerCase().trim(), r);
      byIdOrSource.set(`r-${r.id}`.toLowerCase().trim(), r);
    }
    if (r.sourceId) {
      byIdOrSource.set(String(r.sourceId).toLowerCase().trim(), r);
    }

    // Name lookups (trimmed & lowercase)
    if (r.namaRuangan) {
      const trimmedName = r.namaRuangan.trim().toLowerCase();
      byNameExact.set(trimmedName, r);
      const n = normRoomStr(r.namaRuangan);
      if (n) byNameNorm.set(n, r);
    }
  });

  // 2. Match each asset
  let totalMatched = 0;

  assets.forEach((a) => {
    const rawNama = String(
      a.Nama_ruangan ||
      a.nama_ruangan ||
      a.nama_ruangan_standar ||
      (a.extra_fields && a.extra_fields.Nama_ruangan) ||
      ""
    ).trim();

    const rawId = String(
      a.Id_ruangan ||
      a.id_ruangan ||
      a.kode_ruangan ||
      (a.extra_fields && a.extra_fields.Id_ruangan) ||
      ""
    ).trim();

    if (!rawNama && !rawId) return;

    const aNamaLower = rawNama.toLowerCase();
    const aIdLower = rawId.toLowerCase();
    const aNamaNorm = normRoomStr(rawNama);

    let matched: RuanganData | undefined = undefined;

    // Strategy 1: Match by unique Room ID or sourceId (e.g. "3243", "3617", UUID)
    if (aIdLower && byIdOrSource.has(aIdLower)) {
      matched = byIdOrSource.get(aIdLower);
    }
    // Strategy 2: Exact match by Room Name (case-insensitive & trimmed)
    if (!matched && aNamaLower && byNameExact.has(aNamaLower)) {
      matched = byNameExact.get(aNamaLower);
    }
    // Strategy 3: Normalized fuzzy match by Room Name
    if (!matched && aNamaNorm && byNameNorm.has(aNamaNorm)) {
      matched = byNameNorm.get(aNamaNorm);
    }
    // Strategy 4: Substring match for Room Names (bidirectional, min 4 chars)
    if (!matched && rawNama && rawNama.length >= 4) {
      matched = masterRooms.find((r) => {
        const rNameLower = (r.namaRuangan || "").toLowerCase().trim();
        if (!rNameLower || rNameLower.length <= 3) return false;
        return aNamaLower.includes(rNameLower) || rNameLower.includes(aNamaLower);
      });
    }

    const assetKey = String(a.id || a.kode_tag_aset || "");

    if (matched) {
      totalMatched += 1;
      assetRoomMap.set(assetKey, matched);
    } else {
      const key = rawNama || rawId;
      const existing = unmatchedMap.get(key) || { rawRoom: key, count: 0, assets: [] };
      existing.count += 1;
      existing.assets.push(a);
      unmatchedMap.set(key, existing);
    }
  });

  const reportList: UnmatchedRoomItem[] = Array.from(unmatchedMap.values()).sort(
    (a, b) => b.count - a.count
  );
  const totalUnmatched = reportList.reduce((acc, curr) => acc + curr.count, 0);

  return {
    assetRoomMap,
    unmatchedRoomsReport: reportList,
    totalUnmatchedCount: totalUnmatched,
    totalMatchedCount: totalMatched,
  };
}

/**
 * Filter assets strictly belonging to a specific master room by room ID
 */
export function getAssetsForRoom<T extends { id?: string; kode_tag_aset?: string }>(
  items: T[],
  assetRoomMap: Map<string, RuanganData>,
  roomId: string | number
): T[] {
  const targetId = String(roomId);
  return items.filter((item) => {
    const key = String(item.id || item.kode_tag_aset || "");
    const matched = assetRoomMap.get(key);
    return matched && String(matched.id) === targetId;
  });
}

/**
 * Filter assets strictly belonging to a specific master building
 */
export function getAssetsForBuilding<T extends { id?: string; kode_tag_aset?: string }>(
  items: T[],
  assetRoomMap: Map<string, RuanganData>,
  buildingName: string
): T[] {
  return items.filter((item) => {
    const key = String(item.id || item.kode_tag_aset || "");
    const matched = assetRoomMap.get(key);
    return matched && matched.namaGedung === buildingName;
  });
}

/**
 * Filter assets strictly belonging to a specific campus
 */
export function getAssetsForCampus<T extends { id?: string; kode_tag_aset?: string }>(
  items: T[],
  assetRoomMap: Map<string, RuanganData>,
  campusName: string
): T[] {
  return items.filter((item) => {
    const key = String(item.id || item.kode_tag_aset || "");
    const matched = assetRoomMap.get(key);
    if (!matched) return false;
    if (campusName === "Kampus / Lokasi Lainnya" || campusName === "Kampus Lainnya") {
      return matched.kampus === "Kampus Lainnya" || matched.kampus === "Kampus / Lokasi Lainnya";
    }
    return matched.kampus === campusName;
  });
}
