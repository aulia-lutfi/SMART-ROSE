// ── Service: Pengumuman (Announcement) ────────────────────────────────────
// STATUS: sudah terhubung ke backend REAL, sesuai smartrose-api-spec.json.
// (Berbeda dari Notifikasi — modul ini SUDAH ADA lengkap di spec, bukan di
// dokumen jawaban tambahan.)
//
// Endpoint:
//   GET    /api/admin/announcements       → semua pengumuman (admin)
//   POST   /api/admin/announcements       → buat pengumuman baru (admin)
//   PUT    /api/admin/announcements/:id   → ubah pengumuman (admin)
//   DELETE /api/admin/announcements/:id   → hapus pengumuman (admin)
//   GET    /api/announcements             → daftar pengumuman utk user,
//                                            otomatis difilter sesuai role
//                                            yang login (tidak perlu kirim
//                                            parameter apapun)
//
// ⚠️ PERUBAHAN FIELD dari versi dummy sebelumnya (kirimPengumuman):
//   - `isiPengumuman` → jadi `isi`
//   - `targetPenerima` (teks bebas) → jadi `targetRole`, WAJIB salah satu
//     dari enum: "SEMUA" | "USER" | "ADMIN"
// Form pengirim pengumuman di UI (kemungkinan di NotifikasiAdminPage atau
// halaman terpisah) perlu disesuaikan: dropdown target harus pakai 3 nilai
// enum ini, bukan teks bebas.
//
// ⚠️ Field response detail (selain judul/isi/targetRole) BELUM dikonfirmasi
// backend (lihat JAWABAN-PERTANYAAN-FRONTEND-V2.md, bagian "Yang Masih
// Belum Ada"). Kalau UI butuh field seperti createdAt/pengirim, cek dulu
// response asli sebelum dipakai.

import { apiClient } from "../../lib/apiClient";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

/**
 * Ambil semua pengumuman (tampilan admin, mis. daftar/riwayat pengumuman
 * yang pernah dikirim).
 * GET /api/admin/announcements
 */
export async function getRiwayatPengumuman() {
  const res = await apiClient.get("/admin/announcements");
  return unwrap(res);
}

/**
 * Buat pengumuman baru.
 * POST /api/admin/announcements
 *
 * @param {{ judul: string, isi: string, targetRole?: "SEMUA"|"USER"|"ADMIN" }} payload
 */
export async function kirimPengumuman({ judul, isi, targetRole = "SEMUA" }) {
  const res = await apiClient.post("/admin/announcements", {
    judul,
    isi,
    targetRole,
  });
  return unwrap(res);
}

/**
 * Ubah pengumuman yang sudah ada.
 * PUT /api/admin/announcements/:id
 *
 * @param {string} id
 * @param {{ judul?: string, isi?: string, targetRole?: "SEMUA"|"USER"|"ADMIN" }} payload
 */
export async function ubahPengumuman(id, payload) {
  const res = await apiClient.put(`/admin/announcements/${id}`, payload);
  return unwrap(res);
}

/**
 * Hapus pengumuman.
 * DELETE /api/admin/announcements/:id
 */
export async function hapusPengumuman(id) {
  const res = await apiClient.delete(`/admin/announcements/${id}`);
  return unwrap(res);
}

/**
 * Ambil daftar pengumuman untuk ditampilkan ke USER (nakes/perawat),
 * sudah otomatis difilter backend sesuai role user yang login.
 * GET /api/announcements
 *
 * (Dipakai kalau ada halaman pengumuman di sisi user — belum kelihatan
 * ada di struktur project saat ini, tapi endpoint-nya sudah tersedia.)
 */
export async function getPengumumanUntukUser() {
  const res = await apiClient.get("/announcements");
  return unwrap(res);
}

export default {
  getRiwayatPengumuman,
  kirimPengumuman,
  ubahPengumuman,
  hapusPengumuman,
  getPengumumanUntukUser,
};
