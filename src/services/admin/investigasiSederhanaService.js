// src/services/admin/investigasiSederhanaService.js
// ============================================================
// Service untuk fitur "Investigasi Sederhana" — jalur ringkas
// investigasi untuk laporan grading Rendah/Moderat (Biru/Hijau),
// alternatif dari RCA.
//
// Mengikuti pola yang sama dengan detailLaporanService.js:
//   - fungsi fetch & mutate berbentuk async, dummy pakai delay
//   - saat backend siap: hapus blok "DUMMY DATA", uncomment "Versi REAL"
//
// PENTING — reuse, bukan duplikasi:
//   - getLaporanDetail(id)      -> reuse dari detailLaporanService.js
//   - updateStatusLaporan(id,s) -> reuse dari detailLaporanService.js
//   Jangan bikin ulang fetch/mutate laporan di sini, cukup import.
// ============================================================

import { getLaporanDetail, updateStatusLaporan } from "./detailLaporanService";

const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "/api";

function getAuthToken() {
  return localStorage.getItem("authToken");
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

// Re-export supaya InvestigasiSederhanaPage.jsx cukup import satu
// service ini saja, tanpa perlu import dari 2 file berbeda.
export { getLaporanDetail };

// ── DUMMY DATA — hapus seluruh blok ini saat backend siap ─────────────────
// Menyimpan draft investigasi sederhana per id laporan, supaya kalau
// halaman dibuka ulang datanya gak hilang (simulasi persistence backend).
const DUMMY_STORE = {};
// ────────────────────────────────────────────────────────────────────────

/**
 * Ambil draft investigasi sederhana yang sudah pernah disimpan untuk
 * laporan ini (kalau ada). Dipanggil saat InvestigasiSederhanaPage
 * dibuka, supaya form ke-prefill dari data sebelumnya (bukan cuma
 * detail laporan read-only).
 * GET /admin/investigasi-sederhana/:id
 * @param {string} id
 * @returns {object|null}
 */
export async function getInvestigasiSederhana(id) {
  // ── Versi DUMMY (aktif sekarang) ────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 300));
  return DUMMY_STORE[id] || null;
  // ─────────────────────────────────────────────────────────────────────

  // ── Versi REAL (un-comment saat backend siap) ──────────────────────
  // try {
  //   return await request(
  //     `${API_BASE_URL}/admin/investigasi-sederhana/${encodeURIComponent(id)}`,
  //     { method: "GET" },
  //   );
  // } catch (err) {
  //   // Belum pernah diisi -> anggap null, bukan error fatal
  //   return null;
  // }
  // ─────────────────────────────────────────────────────────────────────
}

/**
 * Simpan (create/update) investigasi sederhana untuk laporan ini.
 *
 * Kalau payload.statusSelesai === true, otomatis panggil
 * updateStatusLaporan(id, "SELESAI") yang di-reuse dari
 * detailLaporanService.js — TANPA approval Admin Utama (beda dari RCA).
 *
 * PUT /admin/investigasi-sederhana/:id
 * @param {string} id id laporan
 * @param {{
 *   penyebabLangsung: string,
 *   penyebabAkarMasalah: string,
 *   rekomendasi: {id:string, teks:string, pic:string, tanggal:string}[],
 *   tindakan: {id:string, teks:string, pic:string, tanggal:string}[],
 *   manager: {
 *     nama: string,
 *     tandaTangan: string|null,
 *     tanggalMulai: string,
 *     tanggalSelesai: string|null,
 *   },
 *   manajemenRisiko: {
 *     investigasiLengkap: "Ya"|"Tidak"|"",
 *     tanggalInvestigasiLengkap: string,
 *     perluLanjut: "Ya"|"Tidak"|"",
 *     gradingUlang: "Biru"|"Hijau"|"Kuning"|"Merah"|"",
 *   },
 *   statusSelesai: boolean,
 * }} payload
 * @returns {{ success: boolean }}
 */
export async function simpanInvestigasiSederhana(id, payload) {
  // ── Versi DUMMY (aktif sekarang) ────────────────────────────────────
  await new Promise((resolve) => setTimeout(resolve, 400));
  DUMMY_STORE[id] = { ...payload };
  console.log("[DUMMY] simpanInvestigasiSederhana", id, payload);

  if (payload.statusSelesai) {
    // Enum status backend uppercase (lihat validasi PUT /admin/reports/:id):
    // "DRAFT"|"SUBMITTED"|"DALAM_INVESTIGASI"|"MENUNGGU_VERIFIKASI"|"SELESAI"|"OVERDUE"|"ARSIP"
    await updateStatusLaporan(id, "SELESAI");
  }

  return { success: true };
  // ─────────────────────────────────────────────────────────────────────

  // ── Versi REAL (un-comment saat backend siap) ──────────────────────
  // const hasil = await request(
  //   `${API_BASE_URL}/admin/investigasi-sederhana/${encodeURIComponent(id)}`,
  //   { method: "PUT", body: JSON.stringify(payload) },
  // );
  // if (payload.statusSelesai) {
  //   await updateStatusLaporan(id, "SELESAI");
  // }
  // return hasil;
  // ─────────────────────────────────────────────────────────────────────
}

export default {
  getLaporanDetail,
  getInvestigasiSederhana,
  simpanInvestigasiSederhana,
};
