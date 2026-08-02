// src/services/auth/authService.js
// ============================================================
// Service untuk autentikasi (LoginPage). Halaman ini HANYA dipakai
// oleh admin — nakes/user tidak login sama sekali, mereka akses
// form laporan secara anonim lewat rute publik /lapor (lihat App.jsx).
//
// STATUS: sudah terhubung ke backend REAL (https://smartrose.id/api),
// dikonfirmasi via JAWABAN-PERTANYAAN-FRONTEND.md (19 Juli 2026).
//
// 🔑 PALING PENTING — soal refreshToken:
// refreshToken TIDAK PERNAH ada di body JSON manapun. Backend kirim dia
// lewat httpOnly cookie (Set-Cookie: refreshToken=...) — sengaja, demi
// keamanan (JS di browser tidak bisa baca/curi cookie httpOnly). Karena
// itu:
//   - Kita TIDAK PERNAH simpan refreshToken sendiri (tidak ada di
//     localStorage/sessionStorage sama sekali)
//   - Browser otomatis kirim cookie itu di tiap request ke domain yang
//     sama — SELAMA kita pasang `credentials: "include"` di fetch
//   - POST /auth/refresh dan POST /auth/logout tidak perlu body apapun,
//     cukup credentials: "include"
//
// Yang KITA simpan sendiri cuma `accessToken` (dari body response) dan
// data user, untuk dipakai di header Authorization tiap request biasa.
//
// ✅ DIKONFIRMASI BE (27 Juli 2026): path & body POST /auth/password/reset
//   di bawah ini sudah benar, tidak ada perubahan kontrak API.
//
// 🔒 Rate limiting (baru ditambahkan BE, bukan dari laporan FE):
//   - POST /auth/password/forgot: maks 5 request / 15 menit / IP
//   - POST /auth/password/reset: maks 10 request / 15 menit / IP
//   Kalau kena limit, backend balikin 429 dengan { success: false, message }.
//   request() di atas menyertakan `error.status` di error yang di-throw,
//   supaya pemanggil (mis. ResetPasswordPage.jsx) bisa bedakan 429 ini
//   dari 400 token invalid/expired dan tampilkan pesan yang sesuai —
//   bukan menyamaratakan semua error jadi "tautan kedaluwarsa".
//
// 📝 PERUBAHAN 20 Juli 2026 (respons tim BE soal refresh/profile/logout):
//   1. request() sekarang terima opsi `skipAuth: true` — dipakai khusus
//      oleh refreshToken() supaya TIDAK ikut kirim header Authorization
//      dengan accessToken lama/expired. BE bilang endpoint ini cukup
//      credentials: "include" (cookie), jadi kita jangan kirim apa pun
//      yang bisa membuat backend menolak lebih dulu karena token lama
//      sudah kedaluwarsa (kalau ternyata ada middleware JWT global yang
//      jalan sebelum logic cookie refresh-nya sendiri).
//   2. Ditambahkan restoreSession() — dipanggil App.jsx SEKALI saat app
//      pertama mount, SEBELUM render halaman yang butuh auth. Ini beda
//      dari interceptor 401 di apiClient.js (yang cuma reaktif, jalan
//      kalau ADA accessToken tersimpan yang kedaluwarsa). restoreSession()
//      menutup celah: kalau rememberMe=false (token di sessionStorage),
//      lalu user tutup tab/browser lalu buka lagi, sessionStorage kosong
//      — padahal cookie refreshToken di backend bisa saja masih hidup
//      (masa berlakunya independen dari sessionStorage). Tanpa fungsi
//      ini, user itu keliru dianggap logout.
// ============================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// ---- helper: baca accessToken yang tersimpan ----
// Diexport supaya service lain (mis. profilService.js) bisa pakai
// sumber yang sama, bukan menduplikasi cara baca token sendiri-sendiri
// (itu penyebab bug profilService.js baca dari key "authToken" yang
// tidak pernah ada — lihat catatan 20 Juli 2026 di profilService.js).
export function getStoredAccessToken() {
  return (
    localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken")
  );
}

// ---- helper: request generik ke backend ----
// options.skipAuth: true -> JANGAN kirim header Authorization walau ada
// accessToken tersimpan. Dipakai khusus refreshToken() — lihat catatan
// di atas.
async function request(path, options = {}) {
  const token = options.skipAuth ? null : getStoredAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // WAJIB: supaya cookie httpOnly (refreshToken) ikut terkirim &
    // diterima dari backend, di endpoint mana pun yang butuh itu.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    // response tanpa body (misal 204)
  }

  // Backend selalu balikin { success, message, data }
  if (!res.ok || body?.success === false) {
    const message = body?.message || `Terjadi kesalahan (${res.status})`;
    const error = new Error(message);
    // Disertakan supaya pemanggil bisa bedakan jenis error (mis. 429
    // rate limit vs 400 token invalid/expired) tanpa parsing message.
    // Lihat ResetPasswordPage.jsx untuk contoh pemakaian.
    error.status = res.status;
    throw error;
  }

  return body?.data ?? body;
}

// ---- helper: simpan sesi setelah login/verifikasi OTP sukses ----
// Cuma accessToken + user yang disimpan sendiri. refreshToken TIDAK
// pernah masuk sini — dia sudah otomatis tersimpan sebagai cookie oleh
// browser begitu response diterima.
function saveSession({ accessToken, user, rememberMe }) {
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("accessToken", accessToken);
  storage.setItem("authUser", JSON.stringify(user));
}

// Diexport supaya halaman lain (mis. PengaturanProfilAdminPage.jsx) bisa
// bersihkan sesi dengan cara yang sama persis — sebelumnya beberapa
// halaman salah hapus key "authToken" yang tidak pernah dipakai untuk
// menyimpan sesi (lihat catatan 20 Juli 2026).
export function clearSession() {
  for (const key of ["accessToken", "authUser"]) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

/**
 * Login. Dipanggil dari LoginPage.jsx.
 * POST /auth/login
 *
 * Kalau backend minta OTP (dikonfirmasi: field `data.requiresOtp`),
 * fungsi ini TIDAK langsung mengembalikan user — dia mengembalikan
 * { requiresOtp: true, email }. LoginPage.jsx perlu mengarahkan ke form
 * OTP, lalu memanggil verifyOtp() di bawah.
 *
 * Response sukses langsung cuma punya `accessToken` — TIDAK ada
 * `refreshToken` di body (lihat catatan cookie di atas), dan juga
 * TIDAK ada `user` langsung di response login (dikonfirmasi Hafidz:
 * data cuma { accessToken }). Karena itu setelah login sukses, kita
 * panggil getProfile() supaya dapat data user (role, nama, dll).
 *
 * @param {{ identifier: string, password: string, rememberMe?: boolean }} params
 * @returns {Promise<{ requiresOtp: boolean, email?: string, user?: object }>}
 */
export async function login({ identifier, password, rememberMe }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  if (data?.requiresOtp) {
    return { requiresOtp: true, email: data.email || identifier };
  }

  // Simpan accessToken dulu (tanpa user), supaya request getProfile()
  // di bawah ini terkirim dengan header Authorization yang benar.
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("accessToken", data.accessToken);

  const user = await getProfile();
  storage.setItem("authUser", JSON.stringify(user));

  return { requiresOtp: false, user };
}

/**
 * Verifikasi OTP (khusus admin). Dipanggil setelah login() mengembalikan
 * requiresOtp: true.
 * POST /auth/login/otp
 *
 * @param {{ email: string, otp: string, rememberMe?: boolean }} params
 * @returns {Promise<object>} user
 */
export async function verifyOtp({ email, otp, rememberMe }) {
  const data = await request("/auth/login/otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem("accessToken", data.accessToken);

  const user = await getProfile();
  storage.setItem("authUser", JSON.stringify(user));

  return user;
}

/**
 * Ambil accessToken baru. Tidak perlu kirim body apapun — refreshToken
 * dikirim otomatis lewat cookie httpOnly (asalkan credentials: "include"
 * terpasang, sudah ditangani helper request() di atas).
 * POST /auth/refresh
 *
 * skipAuth: true -> sengaja TIDAK kirim header Authorization dengan
 * accessToken lama/expired. Sesuai konfirmasi BE: endpoint ini cukup
 * credentials: "include" (cookie), Authorization header tidak
 * dibutuhkan — dan berpotensi membuat request ini ditolak lebih dulu
 * kalau ada middleware JWT global di backend yang cek token sebelum
 * logic refresh-nya sendiri jalan.
 */
export async function refreshToken() {
  const data = await request("/auth/refresh", {
    method: "POST",
    skipAuth: true,
  });

  const storage = localStorage.getItem("accessToken")
    ? localStorage
    : sessionStorage;
  storage.setItem("accessToken", data.accessToken);

  return data.accessToken;
}

/**
 * Logout. Beri tahu backend (invalidasi refresh token cookie di server)
 * lalu bersihkan sesi lokal.
 * POST /auth/logout
 */
export async function logout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch (_) {
    // tetap bersihkan sesi lokal walau request ke server gagal
  } finally {
    clearSession();
  }
}

/**
 * Ambil data profil user yang sedang login dari backend.
 * GET /auth/profile
 * Dipanggil setelah login/verifyOtp sukses (backend tidak sertakan user
 * langsung di response login), dan juga bisa dipanggil App.jsx saat
 * refresh halaman untuk validasi sesi + ambil data user terbaru.
 */
export async function getProfile() {
  return request("/auth/profile", { method: "GET" });
}

/**
 * Baca user dari sesi tersimpan LOKAL (tanpa hit backend) — dipakai
 * untuk render cepat saat pertama render sebelum getProfile() selesai.
 * Untuk data yang dijamin fresh, pakai getProfile().
 */
export function getCurrentUser() {
  const raw =
    localStorage.getItem("authUser") || sessionStorage.getItem("authUser");
  return raw ? JSON.parse(raw) : null;
}

/**
 * Coba pulihkan sesi saat aplikasi PERTAMA KALI di-mount (buka tab baru
 * / reload halaman) — dipanggil SEKALI oleh App.jsx, sebelum merender
 * halaman yang butuh auth.
 *
 * Kenapa ini perlu SELAIN interceptor 401 di apiClient.js: interceptor
 * itu cuma jalan reaktif, kalau ADA accessToken tersimpan yang sudah
 * kedaluwarsa dan dipakai buat request. Tapi kalau rememberMe=false
 * waktu login (token disimpan di sessionStorage), lalu user menutup
 * tab/browser lalu buka lagi, sessionStorage-nya KOSONG TOTAL — padahal
 * cookie refreshToken di backend bisa saja masih hidup (masa berlakunya
 * diatur backend sendiri, independen dari sessionStorage browser).
 * Tanpa restoreSession(), user seperti ini keliru dianggap logout
 * padahal sesinya sebenarnya masih valid.
 *
 * Kalau memang tidak ada sesi valid (cookie tidak ada/sudah kedaluwarsa
 * juga), fungsi ini akan gagal dengan senyap (bukan melempar error ke
 * pemanggil) — itu kondisi NORMAL untuk user yang belum pernah login,
 * bukan kegagalan yang perlu ditampilkan ke UI.
 *
 * @returns {Promise<object|null>} user kalau sesi berhasil dipulihkan, null kalau tidak ada sesi valid
 */
export async function restoreSession() {
  try {
    await refreshToken();
    const user = await getProfile();

    const storage = localStorage.getItem("accessToken")
      ? localStorage
      : sessionStorage;
    storage.setItem("authUser", JSON.stringify(user));

    return user;
  } catch (_) {
    // Tidak ada sesi valid — normal untuk user yang belum login.
    clearSession();
    return null;
  }
}

/**
 * Kirim tautan/kode reset kata sandi. Dipanggil dari ForgotPasswordPage.jsx.
 * POST /auth/password/forgot
 *
 * Dikonfirmasi: backend HANYA menerima field `email` (bukan `identifier`
 * — tidak bisa pakai nomor pegawai). Sesuaikan ForgotPasswordPage.jsx
 * supaya form-nya minta email saja.
 *
 * @param {{ email: string }} params
 */
export async function forgotPassword({ email }) {
  return request("/auth/password/forgot", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Set password baru pakai token dari link reset password.
 * POST /auth/password/reset
 *
 * ✅ Dikonfirmasi BE (27 Juli 2026): path & body sudah benar, tidak ada
 * perubahan kontrak API. Token berlaku 30 menit sejak email dikirim.
 *
 * ⚠️ Endpoint ini kena rate limit (maks 10 request / 15 menit / IP) —
 * error yang di-throw membawa `error.status`. Kalau `error.status === 429`,
 * JANGAN tampilkan sebagai "token invalid/kedaluwarsa" ke user (lihat
 * ResetPasswordPage.jsx untuk pesan yang benar).
 *
 * @param {{ token: string, newPassword: string }} params
 */
export async function resetPassword({ token, newPassword }) {
  return request("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

export default {
  login,
  verifyOtp,
  refreshToken,
  restoreSession,
  logout,
  getProfile,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};
