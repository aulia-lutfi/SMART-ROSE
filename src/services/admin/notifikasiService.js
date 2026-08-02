// ── Service: Notifikasi ───────────────────────────────────────────────────
// STATUS: sudah terhubung ke backend REAL, sesuai
// JAWABAN-PERTANYAAN-FRONTEND-V2.md (19 Juli 2026, malam).
//
// Endpoint yang tersedia (semua butuh login, akses ke notifikasi milik
// user yang login sendiri):
//   GET   /api/notifications/me         → riwayat notifikasi (page, limit)
//   PATCH /api/notifications/:id/read   → tandai 1 notifikasi dibaca
//   PATCH /api/notifications/read-all   → tandai SEMUA notifikasi dibaca
//
// ⚠️ PERUBAHAN PENTING dari versi dummy sebelumnya:
// Fungsi `tambahNotifikasi()` DIHAPUS dari service ini. Dulu dipakai untuk
// simulasi lokal (push manual ke array dummy) waktu service lain seperti
// detailLaporanService.kirimFeedback() mau "memberi tahu" admin lain.
// Di backend asli TIDAK ADA endpoint untuk membuat notifikasi dari
// frontend — notifikasi otomatis dibuat SERVER-SIDE saat kejadian terkait
// terjadi (mis. saat Admin Utama kirim feedback), dan didorong ke client
// lewat Socket.io real-time (lihat Bagian 10 dokumen serah terima) ATAU
// baru muncul di GET /notifications/me setelah itu.
//
// AKIBATNYA: kalau ada pemanggil lain (mis. detailInvestigasiService.js
// atau detailLaporanService.js) yang masih memanggil
// `notifikasiService.tambahNotifikasi(...)`, panggilan itu HARUS DIHAPUS
// dari sana — backend yang akan buat notifikasinya sendiri. Cek dan
// bersihkan pemanggil itu supaya tidak error "tambahNotifikasi is not a
// function".
//
// ✅ UPDATE tim BE 24 Juli 2026 — struktur satu item notifikasi:
//   { id, userId, tipe, pesan, referensiId, isRead, createdAt }
// - `tipe` sekarang SELALU salah satu dari 5 nilai UPPERCASE:
//   LAPORAN | SENTINEL | CHATBOT | INVESTIGASI | UPDATE
//   (sebelumnya kadang cuma "PENGUMUMAN" generic untuk semua kejadian —
//   sudah tidak lagi begitu, pemanggil TIDAK PERLU fallback ke string itu).
// - `referensiId` (nullable) baru ditambahkan — untuk tipe LAPORAN &
//   INVESTIGASI isinya id laporan terkait, dipakai FE buat link langsung
//   ke halaman detail laporan (lihat NotifikasiAdminPage.jsx).
// - Real-time: backend sekarang juga dorong event Socket.io
//   "notification:new" dengan struktur PERSIS sama seperti satu item di
//   atas, begitu notifikasi baru dibuat — supaya FE tidak perlu polling
//   getNotifikasi() terus-menerus. BELUM diintegrasikan di service ini
//   (menyusul terpisah, butuh keputusan taruh koneksi socket di mana —
//   App.jsx/AdminLayout/context tersendiri).

import { apiClient } from "../../lib/apiClient";

// 5 nilai resmi field `tipe` notifikasi (lihat catatan update BE di atas).
// Diekspor supaya komponen lain (mis. NotifikasiAdminPage.jsx) bisa
// validasi/mapping tanpa hardcode ulang daftar ini di banyak tempat.
export const TIPE_NOTIFIKASI = [
  "LAPORAN",
  "SENTINEL",
  "CHATBOT",
  "INVESTIGASI",
  "UPDATE",
];

function unwrap(res) {
  return res.data?.data ?? res.data;
}

/**
 * Ambil riwayat notifikasi milik user yang login.
 * GET /api/notifications/me
 *
 * ✅ UPDATE tim BE 27 Juli 2026 — kebijakan retensi & archive notifikasi
 * sudah live di production:
 *   - 3 field baru di tiap item notifikasi: `readAt` (timestamp|null —
 *     diisi PERTAMA KALI notifikasi ditandai dibaca; idempotent, TIDAK
 *     reset walau PATCH .../read dipanggil ulang pada notifikasi yang
 *     sama), `isArchived` (boolean), `archivedAt` (timestamp|null).
 *   - Kebijakan retensi (jalan otomatis via cron tiap hari jam 02:00
 *     WIB): notifikasi isRead:true otomatis di-archive 30 hari setelah
 *     `readAt` (bukan createdAt); yang isArchived:true dihapus permanen
 *     1 tahun setelah `archivedAt`; yang isRead:false TIDAK PERNAH
 *     disentuh kondisi apapun.
 *   - Parameter baru `includeArchived` (opsional): default/tidak dikirim
 *     → backend EXCLUDE notifikasi isArchived:true (perilaku lama,
 *     backward compatible, TIDAK ADA breaking change). Kirim
 *     `includeArchived: true` untuk toggle "Notifikasi Lama" (tampilkan
 *     semua, termasuk yang sudah diarsipkan) — lihat pemakaiannya di
 *     NotifikasiAdminPage.jsx.
 *
 * (Catatan: ada juga `POST /admin/jobs/notification-retention` khusus
 * ADMIN_UTAMA untuk trigger manual job ini — cuma untuk kebutuhan
 * darurat/debugging BE, FE tidak perlu memanggilnya.)
 *
 * @param {{ page?: number, limit?: number, includeArchived?: boolean }} [opts]
 * @returns {Promise<{ items: object[], total: number, page: number, limit: number }>}
 */
export async function getNotifikasi({
  page = 1,
  limit = 20,
  includeArchived,
} = {}) {
  const params = { page, limit };
  // Cuma kirim param ini kalau true — biar tetap 100% sama seperti
  // request lama (tanpa param sama sekali) waktu toggle "Notifikasi
  // Lama" belum diaktifkan, sesuai catatan backward-compatible dari BE.
  if (includeArchived) params.includeArchived = true;

  const res = await apiClient.get("/notifications/me", { params });
  return unwrap(res);
}

/**
 * Tandai satu notifikasi sebagai sudah dibaca.
 * PATCH /api/notifications/:id/read
 *
 * ✅ Catatan (dokumen retensi BE 27 Juli 2026): backend mengisi `readAt`
 * PERTAMA KALI notifikasi ini ditandai dibaca, dan itu idempotent — kalau
 * endpoint ini kepanggil ulang pada notifikasi yang sudah pernah dibaca
 * sebelumnya (mis. double-click di FE), `readAt` TIDAK berubah/ter-reset.
 * Jadi aman dipanggil berkali-kali dari FE tanpa mempengaruhi kapan
 * notifikasi ini akan di-archive otomatis (masa retensi 30 hari dihitung
 * dari `readAt` pertama, bukan panggilan terakhir).
 *
 * @param {string} id
 */
export async function tandaiNotifikasiDibaca(id) {
  const res = await apiClient.patch(`/notifications/${id}/read`);
  return unwrap(res);
}

/**
 * Tandai SEMUA notifikasi milik user yang login sebagai sudah dibaca.
 * PATCH /api/notifications/read-all
 *
 * (Endpoint baru — belum ada di versi dummy sebelumnya. Cocok dipakai
 * untuk tombol "Tandai semua sudah dibaca" di NotifikasiAdminPage.)
 */
export async function tandaiSemuaDibaca() {
  const res = await apiClient.patch("/notifications/read-all");
  return unwrap(res);
}

export default {
  getNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaDibaca,
};
