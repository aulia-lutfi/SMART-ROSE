// eksporLaporanService.js
//
// Service untuk fitur "Unduh Ulang Laporan per Insiden".
//
// ── STATUS PER ENDPOINT ──────────────────────────────────────────────────
// ✅ SUDAH ADA di backend (smartrose-api-spec.json), langsung disambungkan:
//    - GET /reports/{reportId}/rca/export?format=excel|pdf
//
// ⚠️ BELUM ADA di spec, masih perlu dibuat tim backend:
//    - Export "Laporan Standar" per insiden
//        usulan: GET /admin/reports/{id}/export?format=excel|pdf
//    - Export "Hasil Investigasi Sederhana" per insiden
//        usulan: GET /admin/reports/{id}/investigasi-sederhana/export?format=excel|pdf
//    - Cari laporan berdasarkan kode laporan (untuk admin)
//        yang sudah ada baru:
//          • GET /reports/track/{trackingNumber} → versi PUBLIK, field terbatas
//          • GET /admin/reports/{id}             → butuh ID internal, bukan kode
//        usulan: tambahkan query filter di GET /admin/reports?kode=...
//        atau endpoint baru GET /admin/reports/search?kode=...
//
// Sampai endpoint di atas dibuat, dua fungsi unduh yang belum tersedia akan
// melempar Error yang jelas (bukan gagal diam-diam), dan fungsi cari laporan
// memberi catatan asumsi di komentarnya. Sesuaikan begitu backend siap.
// ──────────────────────────────────────────────────────────────────────────
//
// PERUBAHAN dari versi sebelumnya:
// - Tidak lagi bikin HTTP client sendiri (fetch + localStorage.getItem("token")).
//   Sekarang pakai `apiClient` (axios) yang sama dengan service lain di project,
//   supaya otomatis kebagian interceptor 401 auto-refresh yang sudah ada di
//   apiClient.js — tanpa ini, unduhan akan gagal total begitu access token
//   (umur 15 menit) kedaluwarsa di tengah sesi user.
// - ⚠️ ASUMSI path import: "../apiClient". Samakan manual dengan lokasi asli
//   apiClient.js di project (pola sama seperti di detailInvestigasiService.js).

import { apiClient } from "../../lib/apiClient";

function ekstensiUntuk(format) {
  return format === "excel" ? "xlsx" : "pdf";
}

function filenameFromResponse(res, fallback) {
  const disposition = res.headers?.["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return match ? match[1] : fallback;
}

// Backend simpan jenisInvestigasi sbg enum uppercase SEDERHANA | RCA_LENGKAP
// (dikonfirmasi tim BE). EksporLaporanPage.jsx membandingkan terhadap label
// "Sederhana" / "RCA" (readable), jadi dipetakan di sini supaya halaman
// tidak perlu tahu soal enum mentah backend.
const LABEL_JENIS_INVESTIGASI = {
  SEDERHANA: "Sederhana",
  RCA_LENGKAP: "RCA",
};

/**
 * Cari 1 laporan berdasarkan kode laporan, untuk ditampilkan di panel
 * "Unduh Ulang Laporan per Insiden".
 *
 * ⚠️ ASUMSI SEMENTARA: kode yang diketik user dipakai langsung sebagai
 * path param `id` ke GET /admin/reports/{id}. Ini valid HANYA kalau
 * kode laporan = ID internal (UUID). Kalau kode yang dipakai sebenarnya
 * trackingNumber (mis. "INC-2024-001"), endpoint ini akan 404 karena
 * trackingNumber ≠ id — perlu diganti begitu backend menambahkan
 * filter/search resmi (lihat TODO di atas file ini). Sebaiknya
 * dikonfirmasi ke tim BE sebelum fitur ini dianggap selesai.
 *
 * ⚠️ statusInvestigasi BELUM DIKONFIRMASI ke tim BE sebagai field asli.
 * Ada kemungkinan field ini tidak ada langsung di response GET
 * /admin/reports/{id}, dan status "selesai investigasi" sebenarnya harus
 * diturunkan dari field status laporan utama (mis. status === "SELESAI"),
 * mirip pola yang sudah pernah ditemukan di DetailLaporanPageAdmin.jsx.
 * JANGAN anggap tombol unduh investigasi ini benar sebelum ditest dengan
 * data laporan yang investigasinya sungguh sudah selesai di backend asli.
 */
export async function cariLaporanUntukUnduh(kode) {
  const res = await apiClient.get(`/admin/reports/${encodeURIComponent(kode)}`);
  const body = res.data;
  const data = body.data || body;

  if (!data || !data.id) {
    throw new Error("Laporan tidak ditemukan.");
  }

  return {
    id: data.id,
    kodeLaporan: data.trackingNumber || data.kodeLaporan || kode,
    jenisInsiden: data.jenisInsiden,
    unitKerja: data.unitKerja,
    tanggalKejadian: data.tanggalKejadian,
    jenisInvestigasi:
      LABEL_JENIS_INVESTIGASI[data.jenisInvestigasi] ??
      data.jenisInvestigasi ??
      null,
    // ⚠️ lihat catatan di atas — belum dikonfirmasi field/enum aslinya
    statusInvestigasi: data.statusInvestigasi ?? null,
  };
}

/**
 * Unduh "Laporan Standar" — laporan insiden asli yang masuk dari user.
 *
 * ⚠️ BELUM ADA endpoint export ini di spec backend saat ini.
 */
export async function unduhLaporanStandar(id, format = "pdf") {
  throw new Error(
    "Export Laporan Standar belum tersedia — endpoint backend belum dibuat. " +
      "Minta tim backend menyediakan GET /admin/reports/{id}/export?format=",
  );
  // Setelah endpoint tersedia, aktifkan ini dan hapus throw di atas:
  // const res = await apiClient.get(`/admin/reports/${id}/export`, {
  //   params: { format },
  //   responseType: "blob",
  // });
  // const filename = filenameFromResponse(res, `laporan-standar-${id}.${ekstensiUntuk(format)}`);
  // return { blob: res.data, filename };
}

/**
 * Unduh "Hasil Investigasi Sederhana".
 *
 * ⚠️ BELUM ADA endpoint ini sama sekali di spec backend saat ini.
 */
export async function unduhHasilInvestigasiSederhana(id, format = "pdf") {
  throw new Error(
    "Export Hasil Investigasi Sederhana belum tersedia — endpoint backend belum dibuat. " +
      "Minta tim backend menyediakan GET /admin/reports/{id}/investigasi-sederhana/export?format=",
  );
  // const res = await apiClient.get(`/admin/reports/${id}/investigasi-sederhana/export`, {
  //   params: { format },
  //   responseType: "blob",
  // });
  // const filename = filenameFromResponse(res, `investigasi-sederhana-${id}.${ekstensiUntuk(format)}`);
  // return { blob: res.data, filename };
}

/**
 * Unduh "Hasil Investigasi RCA".
 * ✅ Endpoint ini SUDAH ADA: GET /reports/{reportId}/rca/export?format=
 */
export async function unduhHasilInvestigasiRCA(id, format = "pdf") {
  const res = await apiClient.get(`/reports/${id}/rca/export`, {
    params: { format },
    responseType: "blob",
  });
  const filename = filenameFromResponse(
    res,
    `hasil-investigasi-rca-${id}.${ekstensiUntuk(format)}`,
  );
  return { blob: res.data, filename };
}
