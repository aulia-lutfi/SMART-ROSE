// ── Service: Laporan Insiden (Manajemen Insiden) ─────────────────────────────
// STATUS: sudah disambungkan ke backend REAL.
//
// PERUBAHAN dari versi dummy sebelumnya:
// 1. Tidak lagi import dari dummyLaporanStore.js — data sekarang dari
//    GET /api/admin/reports langsung.
// 2. getDetailLaporan() & updateLaporan() SEKARANG MEMANGGIL fungsi dari
//    detailLaporanService.js (getLaporanDetail, saveLaporan) alih-alih
//    re-implement logic fetch sendiri lagi di sini. Ini supaya tidak ada
//    2 tempat berbeda yang punya bug/asumsi field yang beda-beda untuk
//    endpoint yang sama persis (/admin/reports/:id).
//
// ⚠️ PERLU DIKONFIRMASI ke backend — spec JSON untuk GET /admin/reports
// TIDAK mencantumkan query parameter APAPUN (tidak ada page/limit/search/
// status seperti di endpoint Dashboard), TAPI response asli (dicek 20 Juli
// 2026 lewat tab Network) TERNYATA sudah punya field page/limit/totalPages
// di dalam `data`. Karena itu:
//   - Filter & pagination di ManajemenInsidenPage.jsx untuk SEMENTARA
//     tetap dilakukan di sisi client (ambil semua data, filter di JS),
//     SAMA seperti versi dummy sebelumnya.
//   - Kalau jumlah laporan sudah banyak, ini akan lambat & boros bandwidth.
//     Tanyakan ke backend apakah endpoint ini sebenarnya sudah support
//     query params server-side (page/limit/search/status) tapi belum
//     dianotasi @swagger, atau memang belum diimplementasikan.
//
// FIX 20 Juli 2026 — DIKONFIRMASI lewat tab Network (Preview response asli):
// 1. Bentuk response GET /admin/reports ternyata nested DUA KALI:
//      { success, message, data: { total, page, limit, totalPages, data: [...] } }
//    Array laporannya ada di `data.data`, BUKAN `data.items` seperti asumsi
//    sebelumnya — makanya tabel selalu nampilin "0 dari 0 laporan" walau
//    request-nya sukses (200/304) dan backend sebenarnya punya datanya.
// 2. Enum `status` asli dari backend SUDAH DIKONFIRMASI (sama seperti yang
//    dipakai Dashboard Analitik): DRAFT, SUBMITTED, DALAM_INVESTIGASI,
//    MENUNGGU_VERIFIKASI, SELESAI, OVERDUE, ARSIP (uppercase) — bukan
//    lowercase Indonesia dari versi dummy lagi.

import { apiClient } from "../../lib/apiClient";
import { getLaporanDetail, saveLaporan } from "./detailLaporanService";

// Enum status resmi dari backend (StatusLaporan) — sama dengan yang
// dipakai AdminDashboardPage.jsx / adminDashboardService.js.
export const STATUS_LABEL = {
  DRAFT: "Draf",
  SUBMITTED: "Baru",
  DALAM_INVESTIGASI: "Dalam Investigasi",
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  SELESAI: "Selesai",
  OVERDUE: "Lewat Deadline",
  ARSIP: "Arsip",
};

function unwrap(res) {
  return res.data?.data ?? res.data;
}

/**
 * Ambil daftar laporan insiden untuk tabel Manajemen Insiden.
 * GET /api/admin/reports
 *
 * `params` (search, dll) untuk SEMENTARA belum diteruskan ke backend
 * (lihat catatan PERLU DIKONFIRMASI di atas) — filter tetap dilakukan
 * di ManajemenInsidenPage.jsx seperti sebelumnya.
 *
 * ✅ 27 Juli 2026 — pengecualian: `includeArchived` DITERUSKAN ke backend
 * (lewat `...params` di bawah). Info dari tim BE: laporan berstatus ARSIP
 * sekarang disembunyikan dari response default GET /admin/reports, dan
 * cuma dikembalikan kalau request mengirim `includeArchived=true`. Jadi
 * beda dengan param search/status lain di atas, param ini WAJIB dikirim
 * kalau mau menampilkan laporan arsip — filter client-side saja TIDAK
 * CUKUP karena datanya memang tidak pernah ikut ke-fetch dari backend.
 * Pemanggil: getDaftarLaporan({ includeArchived: true }).
 *
 * Bentuk response: { success, message, data: { total, page, limit,
 * totalPages, data: [...] } } — array laporannya ada di data.data (nested
 * dua kali), bukan data.items. Dicek langsung dari response asli 20 Juli 2026.
 *
 * FIX 23 Juli 2026 — BUG #1: request sebelumnya tidak mengirim `limit`
 * sama sekali, jadi backend balikin limit default-nya sendiri (kemungkinan
 * besar 10) dan HANYA memberi 1 halaman pertama lewat `data.data`. Karena
 * pagination di ManajemenInsidenPage.jsx dilakukan di CLIENT (asumsi
 * `dataLaporan` sudah berisi SEMUA laporan), akibatnya tabel cuma pernah
 * menampilkan sebagian laporan (mis. 10 dari 28 total), sedangkan card
 * dashboard yang hitung langsung dari database tetap benar (28).
 *
 * FIX 23 Juli 2026 — BUG #2 (percobaan fix pertama): sempat coba kirim
 * `limit: 1000` supaya backend balikin semua sekaligus, TAPI backend
 * menolak dengan 400 "Validasi gagal: query.limit: Too big" — jadi ada
 * batas maksimal limit di backend yang nilainya belum diketahui pasti.
 * Daripada menebak-nebak angka amannya (rawan rusak lagi kalau jumlah
 * laporan makin banyak), sekarang LOOP ambil semua halaman satu-satu
 * pakai `page` + `totalPages` dari response — jumlah item per-request
 * dibiarkan default backend (tidak kirim `limit` sama sekali), jadi tidak
 * akan pernah kena validasi "Too big" lagi. Ada `MAX_PAGES` sebagai jaring
 * pengaman supaya tidak infinite loop kalau response `totalPages` ternyata
 * tidak bisa diandalkan.
 */
const MAX_PAGES_SAFETY = 50; // jaring pengaman, bukan batas bisnis

export async function getDaftarLaporan(params = {}) {
  let page = 1;
  let totalPages = 1;
  const allItems = [];

  do {
    const res = await apiClient.get("/admin/reports", {
      params: { page, ...params },
    });
    const data = unwrap(res);
    const items = Array.isArray(data) ? data : data?.data || [];
    allItems.push(...items);

    totalPages = Array.isArray(data) ? 1 : data?.totalPages || 1;

    // Jaring pengaman: kalau halaman ini kosong tapi seharusnya belum
    // habis (mis. totalPages tidak akurat), berhenti daripada infinite loop.
    if (items.length === 0) break;

    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES_SAFETY);

  return allItems.map((row) => ({
    ...row,
    status: STATUS_LABEL[row.status] || row.status,
  }));
}

/**
 * Cari laporan cepat berdasarkan trackingNumber / namaFasilitas / unitKerja.
 * GET /api/admin/reports/search?q=...
 *
 * BARU 25 Juli 2026 (lihat dokumen "Update Backend untuk FE - Profil dan
 * Search Laporan"). Beda penting dari getDaftarLaporan() di atas:
 *   - TIDAK di-loop per halaman seperti getDaftarLaporan() — backend
 *     sendiri sudah membatasi maksimal 20 hasil per pencarian, jadi
 *     cukup 1 request.
 *   - Bentuk response BEDA: { success, message, data: { total, results:
 *     [...] } } — array laporannya di `data.results`, BUKAN `data.data`
 *     nested dua kali seperti getDaftarLaporan(). `total` adalah jumlah
 *     TOTAL yang cocok (bisa lebih dari 20), bukan cuma yang ditampilkan.
 *   - `q` WAJIB diisi, backend balas 400 kalau kosong. Fungsi ini sengaja
 *     tidak melakukan guard itu sendiri — pemanggil (UI) yang wajib
 *     memastikan tidak memanggil ini dengan query kosong (lihat
 *     ManajemenInsidenPage.jsx).
 *   - Kalau laporan bersifat anonim (isAnonim: true), namaPelapor &
 *     pelaporId akan selalu null dari backend walau kata kuncinya
 *     kebetulan cocok dengan nama pelapor asli — ini sudah ditangani
 *     backend, tidak perlu ditangani lagi di FE.
 *
 * ✅ 27 Juli 2026 — tambah opsi `includeArchived`, sama alasannya dengan
 * getDaftarLaporan() di atas: tanpa param ini, laporan ARSIP tidak ikut
 * dikembalikan backend sama sekali (bukan cuma disaring FE).
 *
 * @param {string} q - kata kunci pencarian
 * @param {{ includeArchived?: boolean }} [opts]
 * @returns {Promise<{ total: number, results: Array }>}
 */
export async function searchLaporan(q, { includeArchived = false } = {}) {
  const res = await apiClient.get("/admin/reports/search", {
    params: { q, ...(includeArchived ? { includeArchived: true } : {}) },
  });
  const data = unwrap(res);
  const results = data?.results || [];

  return {
    total: data?.total ?? results.length,
    results: results.map((row) => ({
      ...row,
      status: STATUS_LABEL[row.status] || row.status,
    })),
  };
}

/**
 * Ambil detail satu laporan berdasarkan id.
 * Reuse getLaporanDetail() dari detailLaporanService.js supaya path &
 * penanganan error konsisten dengan halaman Detail Laporan.
 */
export async function getDetailLaporan(id) {
  const { laporan } = await getLaporanDetail(id);
  return laporan
    ? { ...laporan, status: STATUS_LABEL[laporan.status] || laporan.status }
    : null;
}

/**
 * Update status / penugasan satu laporan (mis. saat admin assign
 * investigator langsung dari tabel Manajemen Insiden).
 * Reuse saveLaporan() dari detailLaporanService.js — endpoint & payload
 * sama persis (PUT /api/admin/reports/:id).
 */
export async function updateLaporan(id, payload) {
  return saveLaporan(id, payload);
}
