import axios from "axios";

// Buat instance axios dengan konfigurasi base
// VITE_API_BASE_URL nanti akan diisi di file .env
// Contoh: http://localhost:4000/api
//
// 📝 PERUBAHAN 20 Juli 2026: default fallback diganti dari
// "http://localhost:4000/api" (absolut, cuma valid pas dev) jadi "/api"
// (relatif) — DISELARASKAN dengan authService.js yang sudah lebih dulu
// pakai fallback "/api". Sebelumnya kedua file ini punya default yang
// beda: kalau VITE_API_BASE_URL sampai tidak ke-set pas build
// production, authService.js (pakai fetch biasa) akan tetap benar
// menembak domain yang sama (https://smartrose.id/api/...), TAPI
// apiClient.js (axios, dipakai hampir semua fitur admin) akan diam-diam
// coba menembak localhost:4000 dari browser user — gagal total tanpa
// pesan error yang jelas. "/api" relatif otomatis ikut domain saat ini,
// jadi aman dipakai baik di dev (lewat proxy Vite) maupun production.
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  // WAJIB: sama seperti authService.js — supaya cookie httpOnly refreshToken
  // ikut terkirim kalau suatu saat endpoint di sini butuh refresh otomatis.
  withCredentials: true,
  // CATATAN: Content-Type TIDAK di-set default di sini lagi (bug lama —
  // lihat interceptor request di bawah). Kalau di-set default "application/json"
  // di sini, itu akan menimpa Content-Type multipart/form-data yang harus
  // di-generate browser sendiri (dengan boundary) untuk request FormData,
  // dan bikin semua upload file (mis. lampiran laporan) gagal di backend.
});

// ---- helper: baca accessToken tersimpan ----
// PENTING: pakai key & lokasi PERSIS sama seperti authService.js
// ("accessToken" di localStorage ATAU sessionStorage, tergantung
// rememberMe waktu login). Kalau authService.js nanti ganti nama key,
// helper ini WAJIB ikut diubah, atau token tidak akan pernah ketemu.
function getStoredAccessToken() {
  return (
    localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken")
  );
}

function getStorage() {
  return localStorage.getItem("accessToken") ? localStorage : sessionStorage;
}

// Interceptor request: setiap request otomatis tambah token auth di header,
// dan atur Content-Type SESUAI JENIS DATA — bukan dipaksa sama untuk semua
// request (lihat catatan di axios.create() di atas soal kenapa ini penting
// untuk upload file pakai FormData).
apiClient.interceptors.request.use(
  (config) => {
    const token = getStoredAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      // Biarkan browser yang set Content-Type (termasuk boundary-nya) —
      // kalau kita paksa set manual di sini, boundary-nya hilang dan
      // backend tidak akan bisa parse multipart-nya.
      delete config.headers["Content-Type"];
    } else if (!config.headers["Content-Type"]) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Antrian request yang menunggu proses refresh selesai, supaya tidak ada
// beberapa panggilan /auth/refresh bersamaan kalau banyak request 401
// sekaligus (mis. buka Dashboard yang langsung fetch banyak endpoint).
let isRefreshing = false;
let pendingQueue = [];

function resolveQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

// Interceptor response: kalau 401, coba refresh token otomatis dulu
// (pakai authService.refreshToken() yang sudah ada, BUKAN duplikat logic),
// baru redirect ke login kalau refresh juga gagal.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    // ✅ FIX 27 Juli 2026: sebelumnya `isAuthEndpoint` cek
    // `url.includes("/auth/")` — ini terlalu lebar, ikut meng-exclude
    // endpoint SEPERTI `/auth/profile` yang JUSTRU butuh auto-refresh
    // (401 di endpoint ini seharusnya tetap dicoba refresh dulu, sama
    // seperti endpoint lain). Yang SEHARUSNYA dikecualikan dari refresh
    // cuma endpoint auth yang: (a) memang dipanggil SAAT proses refresh
    // itu sendiri (mencegah infinite loop refresh-gagal-refresh-lagi),
    // atau (b) 401 di situ memang berarti kredensial salah, bukan token
    // kedaluwarsa (login gagal, OTP salah) — bukan sinyal "sesi habis".
    const ENDPOINT_AUTH_DIKECUALIKAN = [
      "/auth/login",
      "/auth/login/otp",
      "/auth/refresh",
    ];
    const isAuthEndpoint = ENDPOINT_AUTH_DIKECUALIKAN.some((path) =>
      originalRequest?.url?.includes(path),
    );

    // ── 403: akun belum diverifikasi ──────────────────────────────────
    // ✅ PERUBAHAN 24 Juli 2026 (dari update tim BE): sebelumnya backend
    // balikin 401 generic untuk kasus ini ("Token tidak valid atau
    // kadaluarsa"), padahal tokennya valid — cuma akun belum di-approve
    // admin. Kalau dulu itu sempat kena cabang 401 di bawah, efeknya
    // salah: coba refresh token (sia-sia, token memang valid) lalu
    // akhirnya redirect logout paksa, padahal user masih berhak login,
    // cuma fiturnya dibatasi.
    // Sekarang backend sudah benar kirim 403 dengan pesan spesifik.
    // Di-handle TERPISAH di sini, SEBELUM cabang 401, dan SENGAJA tidak
    // menghapus token / tidak dispatch auth:sessionExpired — sesi tetap
    // sah, cuma perlu ditampilkan pesan "akun kamu masih menunggu
    // persetujuan admin". Event auth:accountUnverified dipancarkan
    // supaya komponen (mis. halaman dashboard/App.jsx) bisa menangkap &
    // menampilkan pesan itu tanpa redirect ke login.
    // ⚠️ PERLU DIKERJAKAN MENYUSUL: belum ada listener untuk event ini
    // di App.jsx atau komponen lain — baru interceptor-nya saja yang
    // siap di sini.
    const pesanBackend403 = error?.response?.data?.message;
    if (
      status === 403 &&
      pesanBackend403 === "Akses ditolak: Akun belum diverifikasi"
    ) {
      window.dispatchEvent(
        new CustomEvent("auth:accountUnverified", {
          detail: { message: pesanBackend403 },
        }),
      );
      return Promise.reject(error);
    }

    // ── 401: sesi di-invalidate PAKSA (kasus baru — dokumen BE 27 Juli
    // 2026 soal PATCH /admin/users/:id) ───────────────────────────────
    // Begitu email seorang user diubah admin lain, backend meng-
    // invalidate semua "token akses" yang sedang aktif untuk user itu.
    // Request berikutnya ditolak 401 dengan pesan PERSIS:
    //   "Sesi tidak valid, silakan login kembali"
    //
    // ⚠️ PERLU DIKONFIRMASI KE BE: dokumen itu spesifik menyebut "token
    // akses" (access token) yang di-invalidate — belum jelas apakah
    // refresh token (cookie httpOnly) dari sesi yang sama IKUT di-revoke.
    // Kalau TIDAK ikut di-revoke, logic refresh-otomatis di bawah (blok
    // 401 generic) akan diam-diam BERHASIL dapat access token baru dan
    // retry request originalnya — user jadi TIDAK benar-benar logout
    // paksa seperti yang dimaksud BE, malah tetap jalan seolah tidak
    // terjadi apa-apa, padahal emailnya sudah berubah. Perlu ditanyakan
    // terpisah ke tim BE.
    //
    // Sebagai jaring pengaman SEMENTARA (aman dipakai terlepas dari
    // jawaban BE di atas): pesan spesifik ini dicek LEBIH DULU, sebelum
    // masuk ke logic refresh-otomatis, supaya kasus ini SELALU langsung
    // logout paksa (skip refresh sama sekali) — bukan diperlakukan
    // seperti token expired biasa yang masih boleh dicoba refresh.
    const PESAN_SESI_DIINVALIDATE = "Sesi tidak valid, silakan login kembali";
    const pesanBackend401 = error?.response?.data?.message;

    if (status === 401 && pesanBackend401 === PESAN_SESI_DIINVALIDATE) {
      getStorage().removeItem("accessToken");
      getStorage().removeItem("authUser");
      // ⚠️ PERLU DIKERJAKAN MENYUSUL (sama seperti catatan event
      // auth:accountUnverified di atas): pastikan listener event ini
      // (mis. di App.jsx) menampilkan `detail.message` apa adanya ke
      // user, bukan cuma pesan generic "sesi habis" — supaya user tahu
      // ini karena emailnya baru diubah admin, bukan token kedaluwarsa
      // biasa.
      window.dispatchEvent(
        new CustomEvent("auth:sessionExpired", {
          detail: { message: pesanBackend401 },
        }),
      );
      return Promise.reject(error);
    }

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Import dinamis supaya tidak ada circular import dengan authService.js
        const { refreshToken } = await import("../services/auth/authService");
        const newAccessToken = await refreshToken();

        resolveQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        resolveQueue(refreshError, null);
        console.warn("Refresh token gagal, sesi berakhir — redirect ke login");
        getStorage().removeItem("accessToken");
        getStorage().removeItem("authUser");
        // Bentuk detail disamakan dengan blok PESAN_SESI_DIINVALIDATE di
        // atas (selalu { message }), supaya listener di App.jsx cukup
        // satu cara baca tanpa perlu cek dua bentuk event yang beda.
        window.dispatchEvent(
          new CustomEvent("auth:sessionExpired", {
            detail: {
              message:
                refreshError?.response?.data?.message ||
                "Sesi Anda telah berakhir, silakan login kembali",
            },
          }),
        );
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
