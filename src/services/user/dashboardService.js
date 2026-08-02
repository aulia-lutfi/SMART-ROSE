// src/services/user/dashboardService.js
// ============================================================
// STATUS: getCurrentUser() masih DUMMY, dipasangkan dengan
// services/auth/authService.js — saat login (authService.login),
// data user dummy disimpan ke storage dengan key "authUser".
// Fungsi ini membaca kembali data itu untuk merekonstruksi sesi
// (dipanggil App.jsx setiap kali halaman di-refresh, supaya user
// tidak perlu login ulang selama token/authUser masih ada).
//
// Saat backend siap, tinggal:
//   1. Hapus blok "Versi DUMMY" di bawah
//   2. Un-comment blok "Versi REAL"
// Tidak perlu ubah apapun di App.jsx.
// ============================================================

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "/api";

function getAuthToken() {
  return (
    localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
  );
}

async function request(url, options = {}) {
  const token = getAuthToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // response tanpa body
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Terjadi kesalahan (${res.status})`;
    throw new Error(message);
  }

  return data;
}

/**
 * Ambil data user yang sedang login berdasarkan token tersimpan.
 * Dipanggil App.jsx saat aplikasi pertama kali dibuka untuk cek sesi.
 * GET /auth/me
 */
export async function getCurrentUser() {
  // ── Versi DUMMY (aktif sekarang) ────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 300));

  const rawUser =
    localStorage.getItem("authUser") || sessionStorage.getItem("authUser");

  if (!rawUser) {
    throw new Error("Sesi tidak ditemukan, silakan login kembali.");
  }

  return JSON.parse(rawUser);
  // ─────────────────────────────────────────────────────────────────────

  // ── Versi REAL (un-comment saat backend siap, hapus blok DUMMY di atas) ──
  // return request(`${API_BASE_URL}/auth/me`, { method: "GET" });
  // ─────────────────────────────────────────────────────────────────────
}

/**
 * Ambil ringkasan statistik untuk Beranda (kartu Total Laporan,
 * Sedang Diproses, Selesai Ditindak Lanjuti). Dipanggil BerandaPage.jsx.
 * GET /user/dashboard-summary
 * @returns {{ totalLaporanSaya: number, menungguTindakLanjut: number, selesaiDiproses: number }}
 */
export async function getDashboardData() {
  // ── Versi DUMMY (aktif sekarang) ────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 400));
  return {
    totalLaporanSaya: 12,
    menungguTindakLanjut: 3,
    selesaiDiproses: 9,
  };
  // ─────────────────────────────────────────────────────────────────────

  // ── Versi REAL (un-comment saat backend siap, hapus blok DUMMY di atas) ──
  // return request(`${API_BASE_URL}/user/dashboard-summary`, {
  //   method: "GET",
  // });
  // ─────────────────────────────────────────────────────────────────────
}

export default { getCurrentUser, getDashboardData };
