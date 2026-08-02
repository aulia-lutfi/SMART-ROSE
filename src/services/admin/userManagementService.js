// ── Service: Manajemen Pengguna (Admin) ──────────────────────────────────
// STATUS: terhubung ke backend REAL. GET /admin/users
//
// ✅ 25 Juli 2026 — endpoint dikonfirmasi live oleh tim BE. Satu endpoint
// menggabungkan 2 kebutuhan lewat query param:
//
// 1. Dropdown Tim Investigasi:
//    GET /admin/users?role=ADMIN
//    - Backend otomatis exclude ADMIN_UTAMA.
//    - Hanya akun statusVerifikasi: APPROVED dan aktif: true.
//    - Response ringkas: [{ id, nama }].
//    - `id` formatnya sama persis dengan yang dipakai
//      POST /admin/reports/:id/assign — langsung pakai, tidak perlu
//      transformasi apapun.
//
// 2. List lengkap semua akun (dipakai buat lookup, mis. resolve nama
//    admin di Audit Log, atau nanti halaman Manajemen Pengguna):
//    GET /admin/users
//    - TANPA pagination, backend kembalikan semua akun sekaligus — aman
//      dijadikan lookup map di client (dikonfirmasi tim BE).
//    - TERMASUK akun nonaktif/suspended (supaya bisa resolve nama di
//      Audit Log lama yang usernya sudah tidak aktif).
//    - Response per item: { id, nama, email, role, unitKerja,
//      statusVerifikasi, aktif, createdAt }.
//    - Bisa dikombinasikan dengan ?search= (filter nama/email,
//      case-insensitive).
//
// Auth: bisa diakses ADMIN maupun ADMIN_UTAMA (tidak dibatasi cuma
// superadmin) — beda dari versi lama endpoint ini yang cuma bisa diakses
// ADMIN_UTAMA dengan pagination (versi lama itu belum pernah dipakai/
// didokumentasikan resmi ke FE, jadi perubahan ini BUKAN breaking change).
//
// ✅ 27 Juli 2026 — updateUser() & deleteUser() ditambahkan: PATCH & DELETE
// /admin/users/:id dikonfirmasi live oleh BE, lengkap dengan guard yang
// mencegah ADMIN_UTAMA aktif terakhir di-nonaktifkan/downgrade/dihapus.
//
// ✅ 27 Juli 2026 (update kedua, dokumen final BE) — semua poin yang
// sebelumnya masih "belum dikonfirmasi" sudah dijawab tuntas:
//   - Nama field payload PATCH memang persis field response GET
//     (nama, email, role, unitKerja, aktif) — asumsi sebelumnya benar.
//   - Ganti email: BENAR auto-invalidate semua sesi/token aktif milik
//     user itu, DAN backend otomatis kirim email notifikasi ke email
//     lama + baru sekaligus. `statusVerifikasi` tidak berubah sama
//     sekali. Password tidak ikut berubah. FE tidak perlu lagi
//     menampilkan catatan "belum pasti" — lihat updateUser() di bawah.
// Lihat catatan detail di masing-masing fungsi di bawah.

import { apiClient } from "../../lib/apiClient";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// Backend GET /admin/users balikin array langsung di dalam `data`
// (tidak ada nesting { items, total } seperti /admin/reports, karena
// tidak ada pagination). Helper ini jaga-jaga kalau ternyata dibungkus
// { items: [...] } atau { data: [...] } juga, supaya tidak gampang patah
// kalau backend berubah bentuk di kemudian hari.
function extractArray(data) {
  if (Array.isArray(data)) return data;
  return data?.items ?? data?.data ?? [];
}

/**
 * Ambil daftar akun ber-role ADMIN untuk dropdown "Tim Investigasi"
 * (mis. saat assign investigator dari DetailInvestigasiPage.jsx).
 * GET /admin/users?role=ADMIN
 *
 * @returns {Promise<Array<{ id: string, nama: string }>>}
 */
export async function getDaftarAdminUntukAssign() {
  const res = await apiClient.get("/admin/users", {
    params: { role: "ADMIN" },
  });
  return extractArray(unwrap(res));
}

/**
 * Ambil daftar SEMUA akun (termasuk nonaktif), untuk kebutuhan lookup
 * (resolve nama di Audit Log) atau halaman Manajemen Pengguna nanti.
 * GET /admin/users
 *
 * @param {{ search?: string }} [opts] - filter opsional nama/email
 * @returns {Promise<Array<{
 *   id: string, nama: string, email: string, role: string,
 *   unitKerja: string, statusVerifikasi: string, aktif: boolean,
 *   createdAt: string
 * }>>}
 */
export async function getDaftarUserLengkap({ search } = {}) {
  const params = {};
  if (search) params.search = search;
  const res = await apiClient.get("/admin/users", { params });
  return extractArray(unwrap(res));
}

/**
 * Buat akun admin baru (hanya ADMIN_UTAMA yang boleh, dicek di BE).
 * POST /admin/users — body: { nama, email, noPegawai, unitKerja }
 *
 * Response 201 mengembalikan password plain text SEKALI SAJA (backend
 * yang generate, bukan FE) — lihat handleCreateAdmin() di
 * UserManagementPage.jsx yang menampilkan password ini ke admin sesaat
 * setelah akun berhasil dibuat.
 *
 * @param {{ nama: string, email: string, noPegawai: string, unitKerja: string }} payload
 * @returns {Promise<{ id: string, nama: string, email: string, password: string }>}
 */
export async function createAdmin(payload) {
  const res = await apiClient.post("/admin/users", payload);
  return unwrap(res);
}

/**
 * Update data akun user (nama, email, role, unitKerja, status aktif).
 * PATCH /admin/users/:id — hanya bisa dipanggil oleh ADMIN_UTAMA (BE yang
 * cek, bukan FE — kalau dipanggil user non-ADMIN_UTAMA akan ditolak 403).
 *
 * ✅ 27 Juli 2026 — dikonfirmasi BE final, semua poin di bawah ini SUDAH
 * PASTI (bukan asumsi lagi):
 *
 * - Partial update sungguhan: field yang tidak dikirim tidak berubah.
 *   Body kosong (tidak ada field sama sekali) ditolak dengan pesan
 *   validasi — jadi pemanggil harus selalu kirim minimal 1 field.
 * - Nama field body persis sama dengan field response GET /admin/users
 *   ({ nama, email, role, unitKerja, aktif }) — konfirmasi final, bukan
 *   asumsi lagi.
 * - Guard ADMIN_UTAMA aktif minimal 1: kalau perubahan role/aktif akan
 *   membuat total ADMIN_UTAMA aktif jadi 0, ditolak 400. ADMIN_UTAMA juga
 *   tidak bisa menurunkan role akun sendiri ("Tidak bisa mengubah role
 *   akun sendiri") maupun menonaktifkan akun sendiri ("Anda tidak dapat
 *   menonaktifkan akun Anda sendiri") — dua pesan ini teksnya BEDA
 *   (bukan typo), diteruskan apa adanya lewat extractErrorMessage() di
 *   UserManagementPage.jsx.
 * - Ganti EMAIL — CONFIRMED, tidak ada lagi yang belum pasti:
 *     1. Tidak perlu verifikasi ulang, `statusVerifikasi` tidak berubah
 *        sama sekali (tetap APPROVED kalau memang sudah approved).
 *     2. Password tidak ikut berubah / tidak termasuk scope endpoint ini.
 *     3. Begitu PATCH sukses, SEMUA token/sesi aktif user itu otomatis
 *        di-invalidate oleh BE (bukan tugas FE) — request berikutnya
 *        dari device lain akan dapat 401 "Sesi tidak valid, silakan
 *        login kembali".
 *     4. BE otomatis kirim email notifikasi ke email LAMA dan email BARU
 *        sekaligus, jadi FE TIDAK PERLU lagi menyuruh admin
 *        "sampaikan manual ke pengguna" — cukup info singkat bahwa
 *        notifikasi & logout paksa terjadi otomatis (lihat modal Edit di
 *        UserManagementPage.jsx).
 *     5. Kalau email baru sudah dipakai akun lain → 400 dengan pesan
 *        "Email sudah digunakan oleh akun lain", diteruskan apa adanya.
 *
 * @param {string} id
 * @param {{ nama?: string, email?: string, role?: string, unitKerja?: string, aktif?: boolean }} payload
 */
export async function updateUser(id, payload) {
  const res = await apiClient.patch(`/admin/users/${id}`, payload);
  return unwrap(res);
}

/**
 * Hapus (soft-delete) akun user.
 * DELETE /admin/users/:id — hanya ADMIN_UTAMA (ada bug internal sempat
 * membuka akses ini ke ADMIN biasa, sudah diperbaiki BE sebelum deploy —
 * test dari sisi kita harus dapat 403 kalau dicoba pakai akun ADMIN
 * biasa).
 *
 * ✅ 27 Juli 2026 — dikonfirmasi BE:
 *   - Ini SOFT DELETE (backend set `deletedAt` + `aktif: false`, bukan
 *     hapus dari database). Data historis (laporan, assignment
 *     investigasi, audit log) tetap ada dan tetap tampil dengan nama
 *     asli user yang dihapus — tidak ada FK yang di-null-kan/cascade.
 *   - Backend otomatis exclude user dengan `deletedAt` terisi dari SEMUA
 *     query GET /admin/users (findMany/findFirst/count) — jadi user yang
 *     baru dihapus TIDAK PERLU difilter manual lagi di FE, cukup refetch
 *     atau hapus dari state lokal.
 *   - Guard sama seperti updateUser(): backend menolak (400) kalau
 *     target-nya ADMIN_UTAMA aktif terakhir di sistem, atau kalau
 *     ADMIN_UTAMA mencoba menghapus akun sendiri ("Anda tidak dapat
 *     menghapus akun Anda sendiri").
 *   - User yang masih di-assign ke investigasi aktif BOLEH langsung
 *     dihapus tanpa blocker apa pun — struktur Tim Investigasi RCA
 *     dicatat manual sebagai teks bebas (timKetuaLegacyText, dst), bukan
 *     relasi ke userId, jadi tidak ada dependency yang perlu dicek.
 *
 * ⚠️ Belum ada endpoint restore yang dikonfirmasi BE. Kalau nanti FE
 * butuh fitur "pulihkan user yang terhapus", WAJIB tanya dulu ke tim BE
 * apakah endpoint-nya sudah ada atau perlu dibuatkan — jangan asumsikan
 * soft-delete otomatis berarti ada cara membalikkannya dari FE.
 *
 * @param {string} id
 */
export async function deleteUser(id) {
  const res = await apiClient.delete(`/admin/users/${id}`);
  return unwrap(res);
}

export default {
  getDaftarAdminUntukAssign,
  getDaftarUserLengkap,
  createAdmin,
  updateUser,
  deleteUser,
};
