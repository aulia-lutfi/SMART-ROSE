// ── lib/grading.js ───────────────────────────────────────────────────────
// Single source of truth untuk perhitungan Risk Grading (Dampak ×
// Probabilitas) dan penentuan Jenis Investigasi (Sederhana / RCA).
//
// Dipakai bersama oleh:
//   - components/laporan/FormStep2.jsx   (grading otomatis saat user submit)
//   - pages/admin/DetailLaporanPageAdmin.jsx (re-grading oleh admin)
//   - services (buatlaporanService.js, detailLaporanService.js, dll.)
//
// PENTING: jangan duplikasi RISK_MATRIX / hitungGrading di file lain.
// Kalau butuh label atau opsi grading, import dari sini.

// ── Opsi Dampak ("Potential Consequences") ──────────────────────────────
export const dampakOptions = [
  { value: "1", label: "1 - Tidak Signifikan (Insignificant)" },
  { value: "2", label: "2 - Minor" },
  { value: "3", label: "3 - Sedang (Moderate)" },
  { value: "4", label: "4 - Mayor (Major)" },
  { value: "5", label: "5 - Katastropik (Catastropic)" },
];

// ── Opsi Probabilitas ("Frekuensi/Likelihood") ──────────────────────────
export const probabilitasOptions = [
  { value: "1", label: "1 - Sangat Jarang Sekali (>5 thn/x)" },
  { value: "2", label: "2 - Jarang Terjadi (2-5 thn/x)" },
  { value: "3", label: "3 - Mungkin Terjadi (1-2 thn/x)" },
  { value: "4", label: "4 - Sering Terjadi (Bebrp x/thn)" },
  { value: "5", label: "5 - Sangat Sering Terjadi (Tiap mgg/bln)" },
];

// ── Matriks Risk Grading — persis sesuai poster RS ──────────────────────
// Baris = Probabilitas (1-5), Kolom = Dampak (1-5, index 0-4).
// Hasilnya salah satu dari: Low | Moderate | High | Extreme
const RISK_MATRIX = {
  1: ["Low", "Low", "Moderate", "High", "Extreme"],
  2: ["Low", "Low", "Moderate", "High", "Extreme"],
  3: ["Low", "Moderate", "High", "Extreme", "Extreme"],
  4: ["Moderate", "Moderate", "High", "Extreme", "Extreme"],
  5: ["Moderate", "Moderate", "High", "Extreme", "Extreme"],
};

// Hasil matriks (istilah internasional) dipetakan ke label grading yang
// dipakai di aplikasi ini. Ini SATU-SATUNYA tempat mapping label grading —
// disepakati mengikuti penamaan yang sudah dipakai di DetailLaporanPageAdmin:
// Rendah / Moderat / Tinggi / Ekstrim.
export const RISK_TO_GRADING_ID = {
  Low: "Rendah",
  Moderate: "Moderat",
  High: "Tinggi",
  Extreme: "Ekstrim",
};

// Daftar valid grading id — dipakai untuk validasi & dropdown re-grading
// admin, supaya opsi yang muncul selalu konsisten dengan matriks di atas.
export const GRADING_IDS = ["Rendah", "Moderat", "Tinggi", "Ekstrim"];

// ── Mapping warna dari response API (gradingAwal/gradingFinal) ke grading id ──
// Backend simpan grading pakai istilah warna standar KARS ("MERAH", "KUNING",
// dst), sementara source of truth ini pakai grading id ("Ekstrim", "Tinggi").
// Urutan mapping ini dikonfirmasi konsisten dengan warna asli di GRADING_STYLE
// di atas (Rendah=biru, Moderat=hijau, Tinggi=kuning, Ekstrim=merah) —
// jadi bukan asumsi, tapi mengikuti definisi warna yang sudah ada di file ini.
export const WARNA_TO_GRADING_ID = {
  BIRU: "Rendah",
  HIJAU: "Moderat",
  KUNING: "Tinggi",
  MERAH: "Ekstrim",
};

/**
 * Normalisasi input grading dari sumber manapun (warna backend ATAU grading
 * id internal yang sudah benar) jadi grading id yang valid.
 * @param {string} input misal "MERAH" atau "Ekstrim" atau "merah"
 * @returns {string} salah satu dari GRADING_IDS, atau "" kalau tidak dikenali
 */
export function normalisasiGradingId(input) {
  if (!input) return "";
  if (GRADING_IDS.includes(input)) return input;
  return WARNA_TO_GRADING_ID[String(input).toUpperCase()] || "";
}

/**
 * Ambil style badge/dot (GRADING_STYLE) langsung dari input warna backend
 * ATAUPUN grading id — jadi pemanggil gak perlu mikir soal normalisasi.
 * @param {string} input "MERAH" / "Ekstrim" / dll
 * @returns {{bg:string,border:string,dot:string,text:string} | null}
 */
export function getGradingStyle(input) {
  const id = normalisasiGradingId(input);
  return GRADING_STYLE[id] || null;
}

// ── Kebalikan dari WARNA_TO_GRADING_ID — dibutuhkan saat kirim data ke
// backend, karena beberapa endpoint (mis. PUT /admin/reports/:id/regrade)
// expect format warna (HIJAU/BIRU/KUNING/MERAH), bukan grading id internal.
export const GRADING_ID_TO_WARNA = Object.fromEntries(
  Object.entries(WARNA_TO_GRADING_ID).map(([warna, id]) => [id, warna]),
);

/**
 * Konversi grading id internal ("Ekstrim") ke format warna backend ("MERAH").
 * @param {string} gradingId salah satu dari GRADING_IDS
 * @returns {string} warna backend, atau "" kalau tidak dikenali
 */
export function gradingIdKeWarna(gradingId) {
  return GRADING_ID_TO_WARNA[gradingId] || "";
}

// Styling per grading (dipakai di badge/kartu UI). Dipusatkan di sini juga
// supaya warna gak perlu didefinisikan ulang di tiap halaman.
export const GRADING_STYLE = {
  Rendah: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-600",
    text: "text-blue-700",
  },
  Moderat: {
    bg: "bg-green-50",
    border: "border-green-200",
    dot: "bg-green-600",
    text: "text-green-700",
  },
  Tinggi: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    dot: "bg-yellow-600",
    text: "text-yellow-700",
  },
  Ekstrim: {
    bg: "bg-red-50",
    border: "border-red-200",
    dot: "bg-red-600",
    text: "text-red-700",
  },
};

/**
 * Hitung grading dari Dampak (1-5) x Probabilitas (1-5).
 * @param {string|number} dampak
 * @param {string|number} probabilitas
 * @returns {string} salah satu dari GRADING_IDS, atau "" kalau input belum lengkap
 */
export function hitungGrading(dampak, probabilitas) {
  if (!dampak || !probabilitas) return "";
  const hasil = RISK_MATRIX[probabilitas]?.[Number(dampak) - 1];
  return hasil ? RISK_TO_GRADING_ID[hasil] : "";
}

// ── Jenis investigasi mengikuti hasil grading ───────────────────────────
// Rendah/Moderat (Biru/Hijau) → Investigasi Sederhana
// Tinggi/Ekstrim (Kuning/Merah) → Investigasi Komprehensif (RCA)
export const JENIS_INVESTIGASI = {
  SEDERHANA: "Sederhana",
  RCA: "RCA",
};

// ── Jenis insiden yang WAJIB RCA apapun hasil grading-nya ───────────────
// Event sentinel selalu butuh investigasi mendalam, terlepas dari
// grading Dampak x Probabilitas. Aturan ini resmi (bukan quick fix per
// halaman) supaya semua konsumen tentukanJenisInvestigasi() konsisten.
const JENIS_INSIDEN_SELALU_RCA = ["sentinel"];

function isJenisInsidenSelaluRca(jenisInsiden) {
  return JENIS_INSIDEN_SELALU_RCA.includes(
    String(jenisInsiden || "")
      .trim()
      .toLowerCase(),
  );
}

/**
 * Tentukan jenis investigasi (id + info tampilan) dari grading id.
 * @param {string} gradingId salah satu dari GRADING_IDS
 * @param {string} [jenisInsiden] opsional — kalau "Sentinel" (case-insensitive),
 *   hasilnya selalu RCA apapun gradingId-nya.
 * @returns {{ id: "Sederhana"|"RCA", label: string, desc: string, style: string } | null}
 */
export function tentukanJenisInvestigasi(gradingId, jenisInsiden = null) {
  if (isJenisInsidenSelaluRca(jenisInsiden))
    return {
      id: JENIS_INVESTIGASI.RCA,
      label: "Investigasi Komprehensif (RCA)",
      desc: "Kejadian Sentinel — wajib RCA apapun hasil grading-nya.",
      style: "border-red-200 bg-red-50 text-red-700",
    };
  if (gradingId === "Rendah" || gradingId === "Moderat")
    return {
      id: JENIS_INVESTIGASI.SEDERHANA,
      label: "Investigasi Sederhana",
      desc: "Grading Biru/Hijau — cukup ditangani & dianalisis oleh unit terkait tanpa RCA formal.",
      style: "border-green-200 bg-green-50 text-green-700",
    };
  if (gradingId === "Tinggi" || gradingId === "Ekstrim")
    return {
      id: JENIS_INVESTIGASI.RCA,
      label: "Investigasi Komprehensif (RCA)",
      desc: "Grading Kuning/Merah — wajib dilakukan Root Cause Analysis (RCA) oleh tim investigasi.",
      style: "border-red-200 bg-red-50 text-red-700",
    };
  return null;
}

/**
 * Helper untuk tabel/list laporan: tentukan jenis investigasi langsung dari
 * row data laporan (response API), tanpa pemanggil perlu tahu soal
 * normalisasi warna atau prioritas gradingFinal vs gradingAwal.
 *
 * Aturan grading efektif: gradingFinal dipakai kalau sudah ada (laporan
 * sudah pernah di-regrading), fallback ke gradingAwal kalau belum.
 *
 * @param {{ gradingAwal?: string, gradingFinal?: string, jenisInsiden?: string }} row
 * @returns {{ id: "Sederhana"|"RCA", label: string, desc: string, style: string } | null}
 *   null kalau grading efektifnya kosong/tidak dikenali (tampilkan "-", jangan
 *   asal tebak "Sederhana").
 */
export function tentukanJenisInvestigasiDariLaporan(row) {
  const gradingEfektif = normalisasiGradingId(
    row?.gradingFinal || row?.gradingAwal,
  );
  if (!gradingEfektif && !isJenisInsidenSelaluRca(row?.jenisInsiden))
    return null;
  return tentukanJenisInvestigasi(gradingEfektif, row?.jenisInsiden);
}

/**
 * Helper ringkas: langsung dari Dampak & Probabilitas ke jenis investigasi.
 * Dipakai saat submit laporan baru, supaya gak perlu 2x panggil fungsi.
 * @param {string|number} dampak
 * @param {string|number} probabilitas
 * @param {string} [jenisInsiden] opsional — laporan Sentinel selalu RCA,
 *   apapun hasil hitungan Dampak x Probabilitas-nya.
 * @returns {{ grading: string, jenisInvestigasi: "Sederhana"|"RCA"|null }}
 */
export function hitungGradingDanJenis(
  dampak,
  probabilitas,
  jenisInsiden = null,
) {
  const grading = hitungGrading(dampak, probabilitas);
  const info =
    grading || jenisInsiden
      ? tentukanJenisInvestigasi(grading, jenisInsiden)
      : null;
  return { grading, jenisInvestigasi: info?.id ?? null };
}

// ── Enum status laporan (asli backend, uppercase English) ──────────────
// Dikonfirmasi dari STATUS_LABEL di services/admin/insidenService.js —
// itu source of truth resmi untuk daftar nilai status yang backend
// benar-benar kirim. Diduplikasi di sini (bukan di-import) supaya
// lib/grading.js tetap tidak punya dependency ke services/.
// TODO: kalau insidenService.js berubah, sinkronkan manual di sini juga.
export const STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  MENUNGGU_VERIFIKASI: "MENUNGGU_VERIFIKASI",
  DALAM_INVESTIGASI: "DALAM_INVESTIGASI",
  SELESAI: "SELESAI",
  OVERDUE: "OVERDUE",
  ARSIP: "ARSIP",
};

// Urutan 4 tahap yang punya representasi visual di stepper
// DetailLaporanPageAdmin.jsx. DRAFT/OVERDUE/ARSIP SENGAJA tidak
// dimasukkan — belum ada keputusan soal posisi/perlakuannya di UI ini
// (lihat catatan terbuka di percakapan sebelumnya). Kalau laporan
// berstatus salah satu dari 3 itu masuk ke halaman ini, stepper akan
// render dengan getStatusProgressIndex() = -1 (tidak ada tahap yang
// ke-highlight) — bukan crash, tapi juga bukan representasi yang benar.
export const STATUS_STEPPER_ORDER = [
  STATUS.SUBMITTED,
  STATUS.MENUNGGU_VERIFIKASI,
  STATUS.DALAM_INVESTIGASI,
  STATUS.SELESAI,
];

// ── Lock jenisInvestigasi saat regrading ────────────────────────────────
// Selama laporan masih di tahap awal (belum ada progres investigasi
// nyata), jenisInvestigasi boleh ikut re-sync otomatis kalau admin
// regrading — laporan bisa pindah jalur Sederhana <-> RCA dengan bebas.
// Begitu status sudah masuk tahap investigasi (atau selesai),
// jenisInvestigasi DIKUNCI — regrading tetap boleh (untuk akurasi data),
// tapi jalur investigasi yang sudah berjalan tidak ikut berubah otomatis.
export const STATUS_BELUM_MULAI_INVESTIGASI = [
  STATUS.SUBMITTED,
  STATUS.MENUNGGU_VERIFIKASI,
];

/**
 * @param {string} status status laporan saat ini
 * @returns {boolean} true kalau jenisInvestigasi sudah terkunci (tidak
 *   boleh berubah otomatis lagi walau grading berubah)
 */
export function jenisInvestigasiTerkunci(status) {
  return !STATUS_BELUM_MULAI_INVESTIGASI.includes(status);
}

/**
 * Tentukan hasil regrading: grading baru selalu tersimpan, tapi
 * jenisInvestigasi hanya ikut berubah kalau belum terkunci.
 * @param {string} gradingBaru
 * @param {string} statusSaatIni
 * @param {string|null} jenisInvestigasiLama
 * @param {string} [jenisInsiden] opsional — laporan Sentinel selalu RCA,
 *   apapun gradingBaru-nya (kecuali sudah terkunci karena investigasi
 *   sudah berjalan).
 * @returns {{ jenisInvestigasi: string|null, terkunci: boolean, berubahJalur: boolean }}
 */
export function terapkanRegrading(
  gradingBaru,
  statusSaatIni,
  jenisInvestigasiLama,
  jenisInsiden = null,
) {
  const terkunci = jenisInvestigasiTerkunci(statusSaatIni);
  if (terkunci) {
    return {
      jenisInvestigasi: jenisInvestigasiLama,
      terkunci: true,
      berubahJalur: false,
    };
  }
  const infoBaru = tentukanJenisInvestigasi(gradingBaru, jenisInsiden);
  return {
    jenisInvestigasi: infoBaru?.id ?? jenisInvestigasiLama,
    terkunci: false,
    berubahJalur: (infoBaru?.id ?? null) !== jenisInvestigasiLama,
  };
}
