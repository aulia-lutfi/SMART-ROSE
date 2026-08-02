// src/services/admin/analisisInvestigasiService.js
// ============================================================
// Service untuk fitur "Analisis & Investigasi Lanjutan"
// (AnalisisInvestigasiPage).
//
// UPDATE 21 Juli 2026: sekarang ambil laporan ASLI dari backend
// (GET /admin/reports, pola sama seperti insidenService.js), BUKAN lagi
// dari dummyLaporanStore.js.
//
// KENAPA DIUBAH: DetailInvestigasiPage.jsx menggabungkan data laporan asli
// (getLaporanDetail dari detailLaporanService.js) dengan data RCA
// (detailInvestigasiService.js). Kalau list ini masih pakai ID dummy
// (SR-0921 dst), getLaporanDetail(id) akan gagal (404) karena ID itu
// tidak pernah ada di database backend sungguhan. Sekarang ID laporan
// selalu konsisten dari list sampai halaman detail.
//
// Yang MASIH dummy: detailInvestigasiService.js (data RCA itu sendiri) —
// karena endpoint /reports/:id/rca belum ada di backend. Lihat komentar
// di file itu. dummyLaporanStore.js SUDAH TIDAK DIPAKAI lagi oleh file
// ini (aman dihapus kalau tidak ada file lain yang masih import).
//
// ATURAN TAMPIL DI HALAMAN INI (Analisis Investigasi Lanjutan):
//   1. jenisInvestigasi === "RCA" → dihitung otomatis dari grading laporan
//      via tentukanJenisInvestigasiDariLaporan() (lib/grading.js) — SATU-
//      SATUNYA tempat aturan Tinggi/Ekstrim/Sentinel = RCA didefinisikan,
//      supaya konsisten dengan halaman lain (tidak dicek manual di sini).
//   2. status !== SELESAI/ARSIP → begitu laporan selesai atau diarsipkan,
//      dia HILANG dari halaman ini saja. Laporan itu TIDAK hilang dari
//      sistem — tetap ada & terlihat di Manajemen Insiden.
//
// ⚠️ PERLU DIKONFIRMASI (asumsi sementara, belum dicek langsung dari
// Network tab seperti field lain yang sudah dipastikan tim):
//   - Nama field tanggal masuk laporan dari GET /admin/reports. Diasumsikan
//     `createdAt` format ISO (konvensi REST API umum) — kalau ternyata
//     field/format-nya beda, cukup sesuaikan di getTanggalMasukRaw() di
//     bawah, satu tempat saja, tidak menyebar ke fungsi lain.
// ============================================================

import { apiClient } from "../../lib/apiClient";
import {
  tentukanJenisInvestigasiDariLaporan,
  normalisasiGradingId,
} from "../../lib/grading";
import { STATUS_LABEL } from "./insidenService";

const SLA_HARI_RCA = 45;
const MS_PER_HARI = 1000 * 60 * 60 * 24;

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// Coba beberapa nama field tanggal yang mungkin dipakai backend, supaya
// tidak crash kalau asumsi field utama (createdAt) meleset.
function getTanggalMasukRaw(row) {
  return row.createdAt || row.tanggalMasuk || row.tanggal || null;
}

// Hitung sisa waktu SLA (45 hari) dari tanggal masuk, real-time terhadap
// hari ini setiap kali halaman dibuka (bukan disimpan statis di data).
function hitungSisaWaktu(tanggalMasukRaw) {
  if (!tanggalMasukRaw) return { sisaWaktu: 0, sisaLabel: "-" };
  const tglMasuk = new Date(tanggalMasukRaw);
  if (isNaN(tglMasuk.getTime())) return { sisaWaktu: 0, sisaLabel: "-" };

  const deadline = new Date(tglMasuk);
  deadline.setDate(deadline.getDate() + SLA_HARI_RCA);

  const now = new Date();
  const sisaWaktu = Math.ceil((deadline - now) / MS_PER_HARI);

  let sisaLabel = "Aman";
  if (sisaWaktu < 0) sisaLabel = "Terlambat";
  else if (sisaWaktu <= 4) sisaLabel = "Kritis";
  else if (sisaWaktu <= 10) sisaLabel = "Berjalan";

  return { sisaWaktu, sisaLabel };
}

// Format tanggal jadi teks Indonesia yang enak dibaca di tabel, apapun
// format asli tanggal dari backend (ISO / lainnya).
function formatTanggalIndo(tanggalMasukRaw) {
  const tgl = new Date(tanggalMasukRaw);
  if (isNaN(tgl.getTime())) return "-";
  return tgl.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Helper: ubah 1 baris laporan asli (response backend) jadi bentuk
// yang dipakai AnalisisInvestigasiPage.jsx ──────────────────────────────
function mapLaporanKeInvestigasi(row) {
  const tanggalMasukRaw = getTanggalMasukRaw(row);
  const { sisaWaktu, sisaLabel } = hitungSisaWaktu(tanggalMasukRaw);

  // Normalisasi grading ke grading id internal (Rendah/Moderat/Tinggi/
  // Ekstrim) — backend kirim format warna (MERAH/KUNING/dst), sementara
  // GRADING_STYLE di lib/grading.js (dipakai untuk badge di halaman ini)
  // pakai key grading id internal. Tanpa normalisasi ini, badge warna
  // tidak akan ke-style dengan benar.
  const gradingEfektif =
    normalisasiGradingId(row.gradingFinal || row.gradingAwal) || "-";

  return {
    id: row.id,
    grading: gradingEfektif,
    tanggalMasuk: formatTanggalIndo(tanggalMasukRaw),
    sisaWaktu,
    sisaLabel,
    status: row.status, // kode asli backend: DRAFT/SUBMITTED/DALAM_INVESTIGASI/dst
    statusLabel: STATUS_LABEL[row.status] || row.status,
  };
}

const STATUS_TIDAK_TAMPIL = new Set(["SELESAI", "ARSIP"]);

// FIX 23 Juli 2026 — BUG: halaman "Analisis & Investigasi" cuma nampilin
// sebagian kecil laporan RCA (mis. 2 dari 10+ yang seharusnya), padahal
// Manajemen Insiden nampilin semuanya dengan benar.
//
// PENYEBAB: GET /admin/reports itu DIPAGINASI oleh backend (lihat catatan
// "BUG #1" di insidenService.js) — kalau tidak diminta per halaman, backend
// cuma balikin 1 halaman pertama (limit default, kemungkinan 10 laporan).
// getInvestigasiList() sebelumnya cuma manggil apiClient.get("/admin/reports")
// SEKALI tanpa loop halaman sama sekali, jadi filter RCA di bawah cuma jalan
// di antara laporan-laporan halaman pertama itu saja — laporan RCA di
// halaman ke-2/3/dst tidak pernah ke-fetch, makanya jumlahnya jomplang
// dibanding Manajemen Insiden.
//
// FIX: reuse pola loop-semua-halaman yang sama persis dengan
// getDaftarLaporan() di insidenService.js (page + totalPages dari response,
// MAX_PAGES_SAFETY sebagai jaring pengaman). Sengaja TIDAK reuse
// getDaftarLaporan() itu sendiri karena fungsi itu sudah menerjemahkan
// row.status ke label Indonesia ("Selesai"/"Arsip"), sedangkan logic
// STATUS_TIDAK_TAMPIL & mapLaporanKeInvestigasi di file ini masih
// membandingkan terhadap kode asli backend (SELESAI/ARSIP, uppercase).
const MAX_PAGES_SAFETY = 50; // jaring pengaman, bukan batas bisnis

async function getSemuaLaporanMentah() {
  let page = 1;
  let totalPages = 1;
  const allItems = [];

  do {
    const res = await apiClient.get("/admin/reports", { params: { page } });
    const data = unwrap(res);
    const items = Array.isArray(data) ? data : data?.data || [];
    allItems.push(...items);

    totalPages = Array.isArray(data) ? 1 : data?.totalPages || 1;

    if (items.length === 0) break;
    page += 1;
  } while (page <= totalPages && page <= MAX_PAGES_SAFETY);

  return allItems;
}

/**
 * Ambil daftar laporan yang butuh investigasi lanjutan (RCA, belum selesai).
 * @param {{ search?: string, page?: number, limit?: number }} params
 * @returns { data: [...], total: number }
 */
export async function getInvestigasiList(params = {}) {
  const { search = "", page = 1, limit = 6 } = params;

  const items = await getSemuaLaporanMentah();

  const hanyaRCABelumSelesai = items.filter((row) => {
    const jenis = tentukanJenisInvestigasiDariLaporan(row);
    return jenis?.id === "RCA" && !STATUS_TIDAK_TAMPIL.has(row.status);
  });

  const mapped = hanyaRCABelumSelesai.map(mapLaporanKeInvestigasi);

  const filtered = search
    ? mapped.filter((row) =>
        row.id.toLowerCase().includes(search.toLowerCase()),
      )
    : mapped;

  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return { data: paged, total: filtered.length };
}

/**
 * Ambil detail satu laporan investigasi (dipakai kalau halaman ini perlu
 * detail sendiri tanpa lewat DetailInvestigasiPage). Reuse endpoint yang
 * sama dengan Manajemen Insiden (GET /admin/reports/:id), supaya tidak
 * ada 2 sumber data laporan berbeda untuk endpoint yang sama.
 * @param {string} id
 */
export async function getInvestigasiDetail(id) {
  const res = await apiClient.get(`/admin/reports/${encodeURIComponent(id)}`);
  const row = unwrap(res);
  return row ? mapLaporanKeInvestigasi(row) : null;
}

export default {
  getInvestigasiList,
  getInvestigasiDetail,
};
