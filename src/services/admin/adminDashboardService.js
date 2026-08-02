// src/services/admin/adminDashboardService.js
// ============================================================
// Service untuk data analitik di AdminDashboardPage.
//
// Ditulis ulang 20 Juli 2026 mengikuti smartrose-api-spec.json
// (tag "Dashboard"). BEDA STRUKTUR dari versi dummy sebelumnya:
// dulu 1 endpoint gabungan `GET /admin/dashboard?periode=...`,
// sekarang backend punya 5 endpoint terpisah, masing-masing pakai
// `startDate`/`endDate` (BUKAN string "Hari ini"/"Minggu ini"/dst) —
// jadi konversi periode -> rentang tanggal dilakukan di file ini.
//
// PENTING — keterbatasan backend yang perlu diketahui:
// `GET /admin/dashboard/trend` TIDAK menerima startDate/endDate sama
// sekali (fixed 12 bulan terakhir dari backend). Jadi chart tren
// bulanan TIDAK akan berubah walau tab periode diganti di UI. Ini
// bukan bug di file ini — perlu dikonfirmasi ke backend apakah ini
// disengaja atau memang belum sempat ditambahkan filternya.
//
// "Status Tindak Lanjut" (persenSelesai, waktuRataRataSelesai, dst)
// SUDAH DIHAPUS dari sini (20 Juli 2026, atas keputusan user) karena
// backend sama sekali tidak punya endpoint/field untuk data ini.
// AdminDashboardPage.jsx tidak perlu diubah untuk ini — statusnya
// sudah di-guard dengan `{statusTindakLanjut && (...)}` di sana,
// jadi otomatis tidak render kalau key ini tidak ada di hasil
// getDashboardData(). Card <StatusTindakLanjutCard> & state terkait
// di halaman itu jadi dead code, boleh dibersihkan kapan-kapan.
//
// CATATAN soal field response — SEBAGIAN SUDAH DIKONFIRMASI, SEBAGIAN MASIH ASUMSI:
// Spec cuma pasti untuk:
//   - summary: { total, overdue, byStatus: [...], byJenisInsiden: [...] }
//     (isi tiap item byStatus/byJenisInsiden TIDAK dicantumkan di spec)
// by-jenis & by-grading SAMA SEKALI tidak ada schema di spec. Fungsi
// `pickField()` di bawah coba beberapa kemungkinan nama field supaya
// tidak gampang patah kalau tebakan pertama salah, tapi tetap WAJIB
// divalidasi ke response asli begitu bisa dites (lihat console.info
// yang saya tambahkan di getDashboardData()).
//
// UPDATE 20 Juli 2026: nilai enum `StatusLaporan` (isi field `status` di
// tiap item `byStatus`) SUDAH DIKONFIRMASI FINAL oleh tim backend:
// DRAFT, SUBMITTED, DALAM_INVESTIGASI, MENUNGGU_VERIFIKASI, SELESAI,
// OVERDUE, ARSIP. Jadi bagian INI tidak lagi tebakan — lihat
// `buildStats()` di bawah untuk detail mapping ke card dashboard.
// Field `jenisInsiden` (KPC/KNC/KTC/KTD/SENTINEL) dan `grading`
// (BIRU/HIJAU/KUNING/MERAH) masih dari observasi response asli lewat
// console.info, belum ada konfirmasi tertulis resmi seperti StatusLaporan.
// ============================================================

import { apiClient } from "../../lib/apiClient";
import {
  FileText,
  AlertCircle,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// Ambil nilai field pertama yang ketemu dari daftar kemungkinan nama field.
// Dipakai karena banyak response backend yang schema-nya belum dikonfirmasi.
function pickField(obj, candidates, fallback) {
  if (!obj) return fallback;
  for (const key of candidates) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return fallback;
}

function formatNumber(n) {
  return (typeof n === "number" ? n : Number(n) || 0).toLocaleString("id-ID");
}

// ------------------------------------------------------------
// Konversi tab periode ("Hari ini"/"Minggu ini"/"Bulan ini"/"Tahun ini")
// ke rentang startDate/endDate ISO 8601 yang diterima backend.
// endDate selalu "sekarang" — tidak masuk akal minta data masa depan.
// ------------------------------------------------------------
function getDateRangeForPeriode(periode) {
  const now = new Date();
  const endDate = now.toISOString();
  let start = new Date(now);

  switch (periode) {
    case "Minggu ini": {
      const day = start.getDay(); // 0 = Minggu, 1 = Senin, ...
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - diffToMonday);
      break;
    }
    case "Tahun ini":
      start = new Date(start.getFullYear(), 0, 1);
      break;
    case "Bulan ini":
      start = new Date(start.getFullYear(), start.getMonth(), 1);
      break;
    case "Hari ini":
    default:
      // start tetap "sekarang", nanti di-nolkan jamnya di bawah
      break;
  }

  start.setHours(0, 0, 0, 0);
  return { startDate: start.toISOString(), endDate };
}

// ------------------------------------------------------------
// Warna kategori jenis insiden (KPC/KNC/KTC/KTD/Sentinel), diurutkan
// dari paling ringan ke paling serius. ASUMSI nilai enum backend persis
// pakai singkatan ini (huruf besar) — sesuaikan kalau ternyata beda.
// ------------------------------------------------------------
const WARNA_JENIS_INSIDEN = {
  KPC: "#22c55e",
  KNC: "#84cc16",
  KTC: "#eab308",
  KTD: "#f97316",
  SENTINEL: "#dc2626",
};

// Warna tingkat keparahan/grading. Key sudah dikonfirmasi dari respons
// backend asli (lihat log console: {grading: 'HIJAU', count: 1}) — dulu
// pakai key Indonesia (EKSTREM/TINGGI/dst) yang salah total. Urutan warna
// menaik sesuai tingkat keparahan: BIRU (Rendah) < HIJAU (Moderat) <
// KUNING (Tinggi) < MERAH (Ekstrim) - konsisten dengan mapping
// GRADING_ID_KE_WARNA_BACKEND di buatlaporanService.js. Value berupa kode
// warna hex (bukan class Tailwind), supaya bisa dipakai langsung sebagai
// `fill` di chart, bukan cuma buat dot legend.
const WARNA_GRADING = {
  BIRU: "#3b82f6",
  HIJAU: "#22c55e",
  KUNING: "#eab308",
  MERAH: "#dc2626",
};

// Nama bulan pendek Indonesia, dipakai untuk ubah format "2025-07" (dari
// backend) jadi "JUL" (dipakai chart, dataKey `bulan` tidak berubah supaya
// AdminDashboardPage.jsx tidak perlu diubah).
const BULAN_PENDEK = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MEI",
  "JUN",
  "JUL",
  "AGU",
  "SEP",
  "OKT",
  "NOV",
  "DES",
];

function formatBulanYYYYMM(bulanStr) {
  // bulanStr contoh: "2025-07"
  const parts = String(bulanStr || "").split("-");
  const monthIndex = parseInt(parts[1], 10) - 1;
  return BULAN_PENDEK[monthIndex] || bulanStr;
}

// ------------------------------------------------------------
// GET /admin/dashboard/summary
// ------------------------------------------------------------
async function fetchSummary(range) {
  const res = await apiClient.get("/admin/dashboard/summary", {
    params: range,
  });
  return unwrap(res) || {};
}

// ------------------------------------------------------------
// GET /admin/dashboard/by-jenis
// ------------------------------------------------------------
async function fetchByJenis(range) {
  const res = await apiClient.get("/admin/dashboard/by-jenis", {
    params: range,
  });
  return unwrap(res) || [];
}

// ------------------------------------------------------------
// GET /admin/dashboard/by-grading
// ------------------------------------------------------------
async function fetchByGrading(range) {
  const res = await apiClient.get("/admin/dashboard/by-grading", {
    params: range,
  });
  return unwrap(res) || [];
}

// ------------------------------------------------------------
// GET /admin/dashboard/by-unit (top 10 unit kerja)
// TIDAK dipakai di AdminDashboardPage.jsx saat ini — disediakan untuk
// dipakai nanti kalau mau nambah section "per unit kerja".
// ------------------------------------------------------------
export async function getByUnit(periode = "Bulan ini") {
  const range = getDateRangeForPeriode(periode);
  const res = await apiClient.get("/admin/dashboard/by-unit", {
    params: range,
  });
  return unwrap(res) || [];
}

// ------------------------------------------------------------
// GET /admin/dashboard/trend — TIDAK menerima startDate/endDate,
// selalu 12 bulan terakhir dari backend (lihat catatan di atas).
// ------------------------------------------------------------
async function fetchTrend() {
  const res = await apiClient.get("/admin/dashboard/trend");
  const data = unwrap(res) || [];
  return data.map((item) => ({
    bulan: formatBulanYYYYMM(pickField(item, ["bulan", "month"], "")),
    insiden: pickField(item, ["count", "jumlah", "total"], 0),
  }));
}

// ------------------------------------------------------------
// POST /admin/dashboard/export — body: { format: "excel"|"pdf", cakupan: string[] }
// Response berupa file (bukan JSON), jadi responseType diminta "blob".
// Pemanggil (mis. ExportDialog.jsx) bertanggung jawab bikin link
// download dari Blob yang dikembalikan. Belum dites end-to-end —
// sesuaikan kalau ExportDialog.jsx butuh bentuk return yang beda.
// @param {{ format: "excel"|"pdf", cakupan: string[] }} payload
// ------------------------------------------------------------
export async function exportDashboard(payload) {
  const res = await apiClient.post("/admin/dashboard/export", payload, {
    responseType: "blob",
  });
  return res.data; // Blob
}

// ------------------------------------------------------------
// Bangun array stat cards dari response summary.
// Sesuai mockup UI: SELALU 4 card dengan urutan & ikon/warna tetap —
// Total Laporan (biru), Laporan Baru (hijau), Dalam Investigasi
// (oranye), Selesai (hijau). Card "Overdue" yang sebelumnya ada di sini
// dihapus (20 Juli 2026) karena tidak ada di desain dan tidak dianggap
// berguna oleh user.
//
// UPDATE 20 Juli 2026: enum `StatusLaporan` sudah dikonfirmasi FINAL oleh
// tim backend — persis 7 nilai berikut (huruf besar, snake_case):
//   DRAFT, SUBMITTED, DALAM_INVESTIGASI, MENUNGGU_VERIFIKASI, SELESAI,
//   OVERDUE, ARSIP
// Jadi field `status` di tiap item `summary.byStatus` dipastikan salah
// satu dari nilai ini — bukan lagi tebakan. Matching di bawah diganti
// dari `includes()` (cocok sebagian, dulu dipakai karena masih menebak)
// jadi exact match, supaya tidak ada risiko salah tangkap status lain.
//
// Catatan mapping ke 3 card di bawah:
//   - "Laporan Baru" = SUBMITTED + MENUNGGU_VERIFIKASI (23 Juli 2026:
//     diubah dari SUBMITTED saja — laporan yang tahapnya baru dipindah ke
//     "Ditinjau" masih dianggap "laporan baru" sampai benar-benar masuk
//     tahap Investigasi, lihat catatan lengkap di findStatusCountGabungan
//     & buildStats di bawah).
//   - "Dalam Investigasi" = DALAM_INVESTIGASI.
//   - "Selesai" = SELESAI.
// Status OVERDUE, ARSIP saat ini tidak dipetakan ke card manapun (di luar
// 4 card sesuai mockup) — kalau nanti dibutuhkan, tinggal tambah card
// baru pakai pola yang sama.
//
// Kalau status yang dicari tidak ketemu di byStatus (mis. belum ada
// laporan dengan status itu), nilainya default 0 (bukan card-nya
// hilang), supaya urutan & jumlah card tetap 4 selalu.
//
// CATATAN: field `trend` (dulu "+12%" dsb di dummy) tetap null — backend
// tidak punya data perbandingan periode sebelumnya, jadi tidak ada
// sumber datanya sama sekali. Kalau butuh ini nanti, harus tanya backend.
// ------------------------------------------------------------
// UPDATE 23 Juli 2026: card "Laporan Baru" sekarang SENGAJA menghitung
// gabungan SUBMITTED + MENUNGGU_VERIFIKASI (bukan SUBMITTED saja seperti
// sebelumnya). Alasannya: dari sisi bisnis, laporan yang baru dipindah
// tahapnya jadi "Ditinjau" (MENUNGGU_VERIFIKASI) masih dianggap "laporan
// baru masuk" yang belum benar-benar ditangani (belum masuk tahap
// Investigasi) — jadi harusnya TETAP terhitung di card ini, bukan
// langsung hilang begitu admin memindah tahap dari "Baru" ke "Ditinjau".
// Baru dianggap tidak lagi "baru" setelah statusnya DALAM_INVESTIGASI.
function findStatusCount(byStatus, statusValue) {
  const found = byStatus.find((item) => {
    const label = String(pickField(item, ["status", "label", "name"], ""))
      .trim()
      .toUpperCase();
    return label === statusValue;
  });
  return found ? pickField(found, ["count", "jumlah", "total"], 0) : 0;
}

// Jumlahkan count dari beberapa status sekaligus (dipakai khusus untuk
// "Laporan Baru" = SUBMITTED + MENUNGGU_VERIFIKASI, lihat catatan di atas).
function findStatusCountGabungan(byStatus, statusValues) {
  return statusValues.reduce(
    (total, statusValue) => total + findStatusCount(byStatus, statusValue),
    0,
  );
}

function buildStats(summary) {
  const byStatus = Array.isArray(summary.byStatus) ? summary.byStatus : [];

  const laporanBaru = findStatusCountGabungan(byStatus, [
    "SUBMITTED",
    "MENUNGGU_VERIFIKASI",
  ]);
  const dalamInvestigasi = findStatusCount(byStatus, "DALAM_INVESTIGASI");
  const selesai = findStatusCount(byStatus, "SELESAI");

  return [
    {
      icon: FileText,
      value: formatNumber(summary.total),
      label: "Total Laporan",
      trend: null,
      color: "blue",
    },
    {
      icon: AlertCircle,
      value: formatNumber(laporanBaru),
      label: "Laporan Baru",
      trend: null,
      color: "green",
    },
    {
      icon: ClipboardList,
      value: formatNumber(dalamInvestigasi),
      label: "Dalam Investigasi",
      trend: null,
      color: "orange",
    },
    {
      icon: CheckCircle2,
      value: formatNumber(selesai),
      label: "Selesai",
      trend: null,
      color: "green",
    },
  ];
}

function buildDistribusiJenis(byJenisRaw) {
  const list = Array.isArray(byJenisRaw) ? byJenisRaw : [];
  return list.map((item) => {
    const name = pickField(
      item,
      ["jenisInsiden", "jenis", "name", "label"],
      "-",
    );
    const jumlah = pickField(item, ["jumlah", "count", "total"], 0);
    const key = String(name).toUpperCase();
    return {
      name,
      jumlah,
      color: WARNA_JENIS_INSIDEN[key] || "#94a3b8",
    };
  });
}

// Label tampilan yang enak dibaca untuk tiap kode warna grading dari
// backend. Urutan sama dengan WARNA_GRADING di atas (kebalikan dari
// GRADING_ID_KE_WARNA_BACKEND di buatlaporanService.js) - dipakai supaya
// chart & legend menampilkan "Rendah/Moderat/Tinggi/Ekstrim", bukan kode
// warna mentah ("BIRU"/"HIJAU"/dst) yang kurang enak dibaca pengguna.
const LABEL_GRADING = {
  BIRU: "Rendah",
  HIJAU: "Moderat",
  KUNING: "Tinggi",
  MERAH: "Ekstrim",
};

function buildTingkatKeparahan(byGradingRaw) {
  const list = Array.isArray(byGradingRaw) ? byGradingRaw : [];
  const urutanKeparahan = ["MERAH", "KUNING", "HIJAU", "BIRU"]; // Ekstrim -> Rendah
  return list
    .map((item) => {
      const warna = pickField(item, ["grading", "name", "label"], "-");
      const laporan = pickField(item, ["jumlah", "count", "total"], 0);
      const key = String(warna).toUpperCase();
      return {
        name: LABEL_GRADING[key] || warna,
        laporan,
        color: WARNA_GRADING[key] || "#94a3b8",
        _key: key,
      };
    })
    .sort(
      (a, b) =>
        urutanKeparahan.indexOf(a._key) - urutanKeparahan.indexOf(b._key),
    )
    .map(({ _key, ...rest }) => rest);
}

/**
 * Ambil seluruh data analitik dashboard admin untuk satu periode.
 * Gabungan dari 4 endpoint (summary, by-jenis, by-grading, trend) —
 * dipanggil paralel & saling independen: kalau satu gagal, bagian lain
 * tetap tampil (dengan array/nilai kosong) daripada seluruh dashboard blank.
 * @param {string} periode - "Hari ini" | "Minggu ini" | "Bulan ini" | "Tahun ini"
 */
export async function getDashboardData(periode = "Bulan ini") {
  const range = getDateRangeForPeriode(periode);

  const [summaryRes, byJenisRes, byGradingRes, trendRes] =
    await Promise.allSettled([
      fetchSummary(range),
      fetchByJenis(range),
      fetchByGrading(range),
      fetchTrend(),
    ]);

  const summary = summaryRes.status === "fulfilled" ? summaryRes.value : {};
  const byJenis = byJenisRes.status === "fulfilled" ? byJenisRes.value : [];
  const byGrading =
    byGradingRes.status === "fulfilled" ? byGradingRes.value : [];
  const trend = trendRes.status === "fulfilled" ? trendRes.value : [];

  [summaryRes, byJenisRes, byGradingRes, trendRes].forEach((r) => {
    if (r.status === "rejected") {
      console.error(
        "[adminDashboardService] Salah satu request gagal:",
        r.reason,
      );
    }
  });

  // Bantu verifikasi field asli saat testing manual — hapus/comment kalau
  // sudah tidak dibutuhkan lagi setelah semua field dikonfirmasi ke backend.
  console.info("[adminDashboardService] Raw response (buat cek nama field):", {
    summary,
    byJenis,
    byGrading,
  });

  return {
    stats: buildStats(summary),
    distribusiJenis: buildDistribusiJenis(
      byJenis.length ? byJenis : summary.byJenisInsiden,
    ),
    tingkatKeparahan: buildTingkatKeparahan(byGrading),
    trenBulanan: trend,
  };
}

export default {
  getDashboardData,
  getByUnit,
  exportDashboard,
};
