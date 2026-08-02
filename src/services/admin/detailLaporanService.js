// src/services/admin/detailLaporanService.js
// ============================================================
// Service untuk fitur "Detail Laporan" (DetailLaporanPageAdmin).
//
// STATUS: sudah disambungkan ke backend REAL, sesuai smartrose-api-spec.json
// + JAWABAN-PERTANYAAN-FRONTEND-V2.md untuk bagian feedback.
//
// PERUBAHAN dari versi dummy sebelumnya:
// 1. BUG DIPERBAIKI: versi lama baca token dari localStorage key
//    "authToken" — padahal authService.js simpan di key "accessToken".
//    Jadi versi lama TIDAK PERNAH benar-benar terautentikasi. Sekarang
//    pakai `apiClient` (src/lib/apiClient.js) yang sudah dibenerin, jadi
//    tidak ada lagi helper request()/getAuthToken() duplikat di sini.
// 2. Path endpoint diganti dari `/admin/laporan/:id/...` (dummy, bahasa
//    Indonesia) ke `/admin/reports/:id/...` (path ASLI di spec).
// 3. `tambahNotifikasi()` DIHAPUS dari kirimFeedback() — backend sekarang
//    otomatis buat notifikasi sendiri (server-side) saat feedback dibuat,
//    tidak perlu di-broadcast manual dari frontend lagi.
// 4. Field kirimFeedback() disesuaikan: `isi`+`oleh`+`jenis` (revisi/catatan)
//    → jadi `catatan`+`jenis` (ADVISORY/MENGIKAT) sesuai kontrak asli.
//    Field `oleh` (nama pengirim) TIDAK dikirim — backend ambil otomatis
//    dari token JWT yang login (Admin Utama yang sedang aktif).
//
// ⚠️ BEBERAPA HAL BELUM BISA DIPASTIKAN karena spec JSON tidak
// mencantumkan requestBody untuk endpoint ini (anotasi @swagger backend
// belum lengkap) — lihat komentar "PERLU DIKONFIRMASI" di tiap fungsi.
// ============================================================

import { apiClient } from "../../lib/apiClient";
import { terapkanRegrading, gradingIdKeWarna } from "../../lib/grading";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

/**
 * Ambil detail satu laporan berikut aktivitas terakhirnya.
 * GET /api/admin/reports/:id
 *
 * @param {string} id
 */
export async function getLaporanDetail(id) {
  const res = await apiClient.get(`/admin/reports/${encodeURIComponent(id)}`);
  return unwrap(res);
}

/**
 * Ubah status laporan (baru / ditinjau / investigasi / selesai).
 * PUT /api/admin/reports/:id
 *
 * ⚠️ PERLU DIKONFIRMASI ke backend:
 *   - Tidak ada endpoint khusus PATCH .../status di spec — status
 *     diasumsikan diubah lewat PUT umum (endpoint yang sama dengan
 *     saveLaporan). Kalau backend punya endpoint status terpisah,
 *     kabari supaya dipisah lagi.
 *   - Nilai enum `status` yang benar (dummy pakai lowercase Indonesia:
 *     "baru"/"ditinjau"/"investigasi"/"selesai" — tapi laporan publik
 *     dibuat dengan status "SUBMITTED" berdasar dokumen serah terima,
 *     jadi kemungkinan besar backend pakai enum UPPERCASE English,
 *     bukan lowercase Indonesia). JANGAN asumsikan nilai ini benar
 *     sebelum dicoba manual ke endpoint asli.
 */
export async function updateStatusLaporan(id, status) {
  const res = await apiClient.put(`/admin/reports/${encodeURIComponent(id)}`, {
    status,
  });
  return unwrap(res);
}

/**
 * Simpan hasil re-grading admin (mengubah grading risiko + hitung ulang
 * deadline SLA).
 * PUT /api/admin/reports/:id/regrade
 *
 * Field body ini SUDAH DIPASTIKAN di spec: gradingBaru (enum HIJAU/BIRU/
 * KUNING/MERAH) + alasan (wajib, minimal 10 karakter).
 *
 * PENTING: parameter `gradingBaru` yang diterima fungsi ini adalah grading
 * id INTERNAL (Rendah/Moderat/Tinggi/Ekstrim — sesuai GRADING_IDS di
 * lib/grading.js, dan sesuai isi dropdown re-grading di UI). Endpoint
 * regrade backend expect format WARNA (HIJAU/BIRU/KUNING/MERAH), jadi
 * dikonversi dulu lewat gradingIdKeWarna() sebelum dikirim — supaya body
 * request cocok sama spec, sementara perhitungan lokal (terapkanRegrading)
 * tetap konsisten pakai grading id internal seperti fungsi lain di
 * lib/grading.js.
 *
 * ⚠️ PERLU DIKONFIRMASI: field `jenisInvestigasi` (hasil dari
 * terapkanRegrading() di lib/grading.js) TIDAK ada di schema requestBody
 * endpoint ini. Kemungkinan logic kunci jalur investigasi ini murni
 * aturan frontend (lib/grading.js), dan backend tidak menyimpan/proses
 * jenisInvestigasi sama sekali di endpoint regrade — perlu ditanyakan
 * apakah field ini perlu tetap dikirim (barangkali diabaikan backend)
 * atau harus disimpan lewat endpoint lain.
 *
 * @param {string} id
 * @param {string} gradingBaru grading id INTERNAL, salah satu dari GRADING_IDS (lib/grading.js)
 * @param {string} alasan minimal 10 karakter
 * @param {{ statusSaatIni: string, jenisInvestigasiLama: string|null, jenisInsiden?: string }} konteks
 *   `jenisInsiden` dipakai supaya aturan "Sentinel selalu RCA" ikut berlaku
 *   saat re-grading, bukan cuma saat grading otomatis pertama kali.
 */
export async function updateGrading(id, gradingBaru, alasan, konteks) {
  const { statusSaatIni, jenisInvestigasiLama, jenisInsiden } = konteks || {};
  const hasil = terapkanRegrading(
    gradingBaru,
    statusSaatIni,
    jenisInvestigasiLama,
    jenisInsiden,
  );

  const gradingBaruWarna = gradingIdKeWarna(gradingBaru);

  const res = await apiClient.put(
    `/admin/reports/${encodeURIComponent(id)}/regrade`,
    {
      gradingBaru: gradingBaruWarna || gradingBaru,
      alasan,
      // TODO konfirmasi: field ini mungkin diabaikan backend, lihat catatan di atas
      jenisInvestigasi: hasil.jenisInvestigasi,
    },
  );
  const data = unwrap(res);
  return { success: true, ...hasil, ...data };
}

/**
 * Kirim feedback dari Admin Utama ke tim/admin yang menangani laporan ini.
 * POST /api/reports/:reportId/feedback   (khusus role ADMIN_UTAMA)
 *
 * Gating "cuma Admin Utama yang boleh kirim" tetap dicek di sisi komponen
 * (DetailLaporanPageAdmin.jsx), backend juga akan tolak (403) kalau
 * bukan ADMIN_UTAMA yang kirim, sebagai lapis keamanan kedua.
 *
 * Notifikasi ke admin lain SEKARANG OTOMATIS dibuat backend saat
 * feedback ini tersimpan (server-side, muncul di GET /notifications/me
 * dan/atau lewat Socket.io real-time) — TIDAK perlu lagi broadcast
 * manual lewat notifikasiService di sini.
 *
 * @param {string} id ID laporan (dipetakan ke :reportId di backend)
 * @param {{ isi: string, jenis: "revisi"|"catatan" }} entry
 *   `isi` dipetakan ke field `catatan` di body request.
 *   `jenis`: "revisi" → "MENGIKAT" (wajib ditindaklanjuti),
 *            "catatan" → "ADVISORY" (sekadar informasi).
 */
export async function kirimFeedback(id, entry) {
  const jenisBackend = entry.jenis === "revisi" ? "MENGIKAT" : "ADVISORY";

  const res = await apiClient.post(
    `/reports/${encodeURIComponent(id)}/feedback`,
    {
      catatan: entry.isi,
      jenis: jenisBackend,
    },
  );
  return { success: true, feedback: unwrap(res) };
}

/**
 * Ambil daftar feedback yang pernah dikirim untuk laporan ini.
 * GET /api/reports/:reportId/feedback
 *
 * (Fungsi baru — belum ada di versi dummy sebelumnya, tapi dibutuhkan
 * kalau DetailLaporanPageAdmin.jsx mau menampilkan histori feedback dari
 * backend, bukan cuma feedback yang baru saja dikirim di sesi ini.)
 *
 * Aturan akses (dari backend): role USER cuma bisa lihat feedback untuk
 * laporan miliknya sendiri / yang di-assign ke dia. ADMIN/ADMIN_UTAMA
 * bebas akses semua.
 */
export async function getFeedbackList(id) {
  const res = await apiClient.get(
    `/reports/${encodeURIComponent(id)}/feedback`,
  );
  return unwrap(res);
}

/**
 * Tugaskan investigator utama untuk laporan ini.
 * POST /api/admin/reports/:id/assign
 *
 * ⚠️ PERLU DIKONFIRMASI: spec JSON TIDAK mencantumkan requestBody untuk
 * endpoint ini sama sekali (anotasi @swagger di kode backend kemungkinan
 * belum lengkap). Field body di bawah ({ investigator: investigatorName })
 * adalah ASUMSI mengikuti nama variabel yang sudah dipakai di sini —
 * WAJIB dicek ke backend field yang benar (mis. bisa saja butuh
 * `investigatorId` bukan nama teks bebas).
 */
export async function assignInvestigator(id, investigatorName) {
  const res = await apiClient.post(
    `/admin/reports/${encodeURIComponent(id)}/assign`,
    { investigator: investigatorName }, // TODO konfirmasi nama field asli
  );
  return unwrap(res);
}

/**
 * Simpan perubahan umum pada laporan (mis. field yang diedit di form).
 * PUT /api/admin/reports/:id
 *
 * ⚠️ PERLU DIKONFIRMASI: spec tidak mencantumkan requestBody untuk PUT
 * ini. `payload` dikirim apa adanya (field-field yang diedit di form) —
 * pastikan nama field di form sudah sesuai konvensi backend (kemungkinan
 * sama dengan field POST /reports publik: jenisInsiden, tanggalKejadian,
 * lokasi, unitKerja, kronologi, dampak, gradingAwal).
 */
export async function saveLaporan(id, payload) {
  const res = await apiClient.put(
    `/admin/reports/${encodeURIComponent(id)}`,
    payload,
  );
  return unwrap(res);
}

/**
 * Hapus (arsipkan) laporan.
 * DELETE /api/admin/reports/:id
 *
 * ✅ DIPERBAIKI: sebelumnya fungsi ini (dan archiveLaporan() yang terpisah)
 * memanggil endpoint `/archive` dan `/hard` yang TIDAK ADA di backend
 * (dokumen tim backend cuma mencantumkan satu endpoint hapus/arsip).
 * Backend menjelaskan bahwa DELETE /api/admin/reports/:id ini akan
 * MENGARSIPKAN laporan, BUKAN menghapus permanen — jadi tidak ada
 * hard-delete terpisah di sisi server. archiveLaporan() dan deleteLaporan()
 * digabung jadi satu fungsi ini supaya tidak ada lagi pemanggilan ke
 * endpoint yang tidak terdaftar.
 *
 * Kalau nanti backend ternyata memang menyediakan hard-delete sungguhan
 * di endpoint lain, tinggal tambah fungsi baru — jangan tebak-tebak path
 * lagi sebelum dikonfirmasi ke tim backend.
 *
 * @param {string} id
 */
export async function deleteLaporan(id) {
  const res = await apiClient.delete(
    `/admin/reports/${encodeURIComponent(id)}`,
  );
  return unwrap(res);
}

export default {
  getLaporanDetail,
  updateStatusLaporan,
  updateGrading,
  kirimFeedback,
  getFeedbackList,
  assignInvestigator,
  saveLaporan,
  deleteLaporan,
};
