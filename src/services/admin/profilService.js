// src/services/admin/profilService.js
// ============================================================
// Service untuk fitur "Pengaturan Profil" (halaman Profil admin).
//
// DITULIS ULANG 20 Juli 2026 setelah dicek ke smartrose-api-spec.json
// (tag "Profile") — versi sebelumnya SALAH TOTAL di banyak tempat:
//   1. BUG PALING KRITIS: baca token dari localStorage key "authToken",
//      padahal authService.js (yang benar-benar dipakai saat login)
//      menyimpannya di key "accessToken". Akibatnya SEMUA request dari
//      halaman ini selalu terkirim tanpa token valid → selalu gagal
//      401, walau user sudah login.
//   2. Path salah: pakai `/admin/profile`, seharusnya `/auth/profile`
//      (endpoint profil sama untuk semua role, bukan khusus admin —
//      lihat tag "Profile" di spec, bukan tag "Admin").
//   3. Method salah: pakai PATCH, spec-nya PUT.
//   4. Field update salah: kirim `{ name, telepon }`, seharusnya
//      `{ name, phone }` (field-nya bahasa Inggris di backend).
//   5. deleteAccount() tidak kirim body, padahal spec mewajibkan body
//      `{ password }` untuk konfirmasi sebelum akun dihapus (soft
//      delete) — tanpa ini request pasti ditolak 400/401 oleh backend.
//   6. uploadPhoto() manggil `POST /admin/profile/photo` — endpoint ini
//      TIDAK ADA sama sekali di spec resmi saat itu.
//
// 🔁 27 Juli 2026 — FITUR FOTO PROFIL (uploadPhoto) SEMPAT DIHAPUS pagi
// harinya (endpoint hapus foto 404 saat itu, dianggap terlalu ribet),
// lalu DIKEMBALIKAN sore harinya setelah dokumen BE resmi "Update
// Backend untuk FE - Profil dan Search Laporan" mengonfirmasi endpoint
// upload sudah live dengan kontrak final. Lihat komentar lengkap tepat
// di atas fungsi uploadPhoto() di bawah untuk detail kontraknya.
// 🔁 27 Juli 2026 (sore, update kedua) — deletePhoto() SEKARANG ADA.
// BE mengirim dokumen terpisah mengonfirmasi DELETE /auth/profile/photo
// sudah live. Lihat komentar lengkap di atas fungsi deletePhoto() di
// bawah untuk detail kontraknya.
//
// ✅ 27 Juli 2026 — DIPINDAH dari `fetch` custom ke `apiClient` (axios).
// SEBELUMNYA file ini punya helper request() sendiri (fetch biasa),
// TERPISAH TOTAL dari apiClient.js. Akibatnya: apiClient.js sudah punya
// interceptor auto-refresh token yang bagus (kalau accessToken expired
// ~15 menit, otomatis refresh & retry request), TAPI halaman Profil sama
// sekali TIDAK KEBAGIAN mekanisme itu — begitu accessToken expired saat
// user sedang di halaman Profil (lihat profil / ubah profil / ganti
// password / hapus akun), request langsung gagal 401 TANPA sempat
// dicoba refresh dulu, beda dari fitur lain (Manajemen Insiden,
// Manajemen Pengguna) yang sudah lewat apiClient dan aman.
//
// PENTING: getProfile() & logout() di sini SENGAJA punya implementasi
// sendiri lewat apiClient (BUKAN reuse dari authService.js), walau
// authService.js juga punya fungsi bernama sama — authService.js masih
// pakai fetch biasa tanpa auto-refresh, jadi kalau di-reuse di sini
// masalah yang sama akan muncul lagi. Nama fungsi sama bukan berarti
// implementasinya harus disatukan; di sini yang penting SEMUA request
// dari halaman Profil lewat apiClient.
//
// Errors: apiClient (axios) melempar AxiosError, bukan Error biasa
// dengan `.message` = pesan backend. Supaya pemanggil (mis.
// PengaturanProfilAdminPage.jsx) yang sudah terbiasa baca `err.message`
// sebagai pesan backend tidak perlu diubah, setiap fungsi di sini
// menangkap AxiosError dan melempar ulang sebagai `Error` biasa berisi
// pesan backend (lihat throwPesanBackend() di bawah).
// ============================================================

import { apiClient } from "../../lib/apiClient";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// Normalisasi error axios -> Error biasa dengan pesan backend di
// `.message`, supaya kontrak lama (pemanggil baca err.message langsung)
// tetap konsisten dan tidak perlu ubah kode di halaman Profil.
function throwPesanBackend(err, fallback) {
  const message = err?.response?.data?.message || fallback;
  throw new Error(message);
}

/**
 * Ambil data profil user yang sedang login.
 * GET /auth/profile
 */
export async function getProfile() {
  try {
    const res = await apiClient.get("/auth/profile");
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal memuat data profil");
  }
}

/**
 * Perbarui data pribadi (nama, unit kerja).
 * PUT /auth/profile
 *
 * UPDATE 25 Juli 2026: kontrak field BE berubah dari { name, phone }
 * menjadi { nama, unitKerja } (lihat dokumen "Update Backend untuk FE -
 * Profil dan Search Laporan"). Field "phone" (no. telepon) DIHAPUS dari
 * kontrak backend, digantikan field baru "unitKerja". Kedua field
 * bersifat optional di BE (partial update), TAPI kalau dikirim,
 * unitKerja tidak boleh string kosong (minimal 1 karakter) dan nama
 * minimal 3 karakter -- karena itu field yang kosong/whitespace-only
 * sengaja tidak diikutsertakan di body request (lihat pemanggilan di
 * PengaturanProfilAdminPage.jsx).
 *
 * @param {{ nama?: string, unitKerja?: string }} payload
 */
export async function updateProfile({ nama, unitKerja }) {
  try {
    const res = await apiClient.put("/auth/profile", { nama, unitKerja });
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal memperbarui profil");
  }
}

/**
 * Ganti kata sandi.
 * PUT /auth/profile/password
 * @param {{ oldPassword: string, newPassword: string }} payload
 */
export async function changePassword({ oldPassword, newPassword }) {
  try {
    const res = await apiClient.put("/auth/profile/password", {
      oldPassword,
      newPassword,
    });
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal mengganti kata sandi");
  }
}

/**
 * Keluar dari akun (invalidasi sesi/token di server).
 * POST /auth/logout
 */
export async function logout() {
  try {
    const res = await apiClient.post("/auth/logout");
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal keluar dari akun");
  }
}

/**
 * Hapus akun secara permanen (soft delete di backend).
 * DELETE /auth/profile
 * Backend WAJIB menerima `password` di body sebagai konfirmasi —
 * tanpa ini request akan ditolak (400 "Incorrect password" kalau field
 * ada tapi salah, atau error validasi kalau field tidak dikirim sama
 * sekali).
 * @param {{ password: string }} payload
 */
export async function deleteAccount({ password }) {
  try {
    // axios delete() body dikirim lewat config.data, bukan argumen ke-2
    const res = await apiClient.delete("/auth/profile", {
      data: { password },
    });
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal menghapus akun");
  }
}

// ❌ 27 Juli 2026 (pagi) — FITUR FOTO PROFIL (uploadPhoto/deletePhoto)
// SEMPAT DIHAPUS atas keputusan tim: endpoint upload sudah live di BE,
// tapi endpoint hapus foto ternyata belum ada (404 saat dites), dan
// fitur ini secara keseluruhan dianggap terlalu ribet untuk kebutuhan
// saat itu.
//
// ✅ 27 Juli 2026 (sore) — uploadPhoto() DIKEMBALIKAN. Dokumen resmi BE
// "Update Backend untuk FE - Profil dan Search Laporan" mengonfirmasi
// POST /api/auth/profile/photo sudah live di production dengan kontrak
// final (lihat fungsi di bawah). UI-nya (PengaturanProfilAdminPage.jsx)
// ternyata TIDAK PERNAH ikut dihapus paginya — masih memanggil
// profilService.uploadPhoto(file) — jadi penghapusan sebelumnya justru
// bikin upload foto rusak (function not found), bukan menghilangkan
// fitur dengan bersih. deletePhoto() SENGAJA TIDAK dikembalikan —
// dokumen ini tidak menyebutkan endpoint hapus foto sama sekali, jadi
// statusnya masih belum ada/belum dikonfirmasi.
//
// Kontrak final (dari dokumen BE):
//   - POST /auth/profile/photo, multipart/form-data
//   - Nama field file WAJIB "photo" (bukan "file" atau "foto")
//   - Validasi BE: JPG/PNG/WEBP (dicek dari isi file/magic bytes, bukan
//     ekstensi), maks 2MB — cocok dengan validasi client-side yang
//     sudah ada di PengaturanProfilAdminPage.jsx, tidak perlu diubah.
//   - Response sukses (201) HANYA berisi { avatarUrl } — tidak ada id/
//     nama/field lain.
//   - avatarUrl adalah SIGNED URL Supabase Storage yang berubah tiap
//     kali endpoint profil dipanggil (baik lewat GET /auth/profile
//     maupun upload ini) — JANGAN di-cache/disimpan lama di FE, selalu
//     pakai versi terbaru dari response. (Halaman pemanggil sudah
//     menangani ini dengan benar — lihat catatan di
//     PengaturanProfilAdminPage.jsx soal kenapa fetchProfile() selalu
//     dipanggil ulang tiap halaman dibuka.)
//   - Foto lama otomatis terhapus dari storage BE saat upload foto baru
//     berhasil; kalau upload gagal validasi, foto lama tetap utuh.
//
// @param {File} file
// @returns {Promise<{ avatarUrl: string }>}
export async function uploadPhoto(file) {
  try {
    const formData = new FormData();
    // PENTING: nama field HARUS "photo" persis (dikonfirmasi dokumen
    // BE) — field name lain akan ditolak backend.
    formData.append("photo", file);

    // JANGAN set header Content-Type manual — browser yang menentukan
    // boundary multipart-nya sendiri. apiClient.js sudah menghapus
    // Content-Type otomatis untuk data instanceof FormData.
    const res = await apiClient.post("/auth/profile/photo", formData);
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal mengunggah foto profil");
  }
}

// ✅ 27 Juli 2026 (sore, update kedua) — deletePhoto() DIKONFIRMASI &
// DITAMBAHKAN. BE mengirim dokumen terpisah khusus soal ini:
//   - DELETE /auth/profile/photo (butuh auth, sama seperti upload)
//   - Sukses: 200 OK, { success:true, message:"Foto profil berhasil
//     dihapus", data:{ avatarUrl:null } }
//   - Kalau user memang belum punya foto: 400 Bad Request,
//     { success:false, message:"User tidak memiliki foto profil saat
//     ini" } — makanya pemanggil (PengaturanProfilAdminPage.jsx) tetap
//     men-disable tombol ini saat `profilePhoto` kosong, supaya tidak
//     memicu error ini secara percuma.
//   - Setelah dihapus, GET /auth/profile otomatis balikin
//     avatarUrl:null juga — tidak perlu refetch profil, cukup pakai
//     avatarUrl dari response DELETE ini langsung.
// @returns {Promise<{ avatarUrl: null }>}
export async function deletePhoto() {
  try {
    const res = await apiClient.delete("/auth/profile/photo");
    return unwrap(res);
  } catch (err) {
    throwPesanBackend(err, "Gagal menghapus foto profil");
  }
}

export default {
  getProfile,
  updateProfile,
  changePassword,
  logout,
  deleteAccount,
  uploadPhoto,
  deletePhoto,
};
