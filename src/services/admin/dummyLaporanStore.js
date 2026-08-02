// src/services/admin/dummyLaporanStore.js
// ============================================================
// SATU sumber data dummy dipakai bersama oleh:
//   - insidenService.js            (daftar/tabel Manajemen Insiden)
//   - detailLaporanService.js      (Detail Laporan admin)
//   - investigasiSederhanaService.js (reuse getLaporanDetail &
//     updateStatusLaporan dari detailLaporanService.js, jadi otomatis
//     ikut baca/tulis store ini juga — tidak perlu diubah)
//
// Sebelumnya insidenService.js & detailLaporanService.js punya
// masing-masing DUMMY_LAPORAN sendiri (beda ID format & beda isi),
// jadi status yang diubah dari halaman Detail Laporan / Investigasi
// Sederhana TIDAK pernah kelihatan di tabel Manajemen Insiden.
// File ini menggantikan keduanya sebagai satu-satunya sumber data.
//
// STATUS pakai kode standar lowercase: "baru" | "ditinjau" |
// "investigasi" | "selesai" — konsisten dengan yang dipakai
// DetailLaporanPageAdmin.jsx & InvestigasiSederhanaPage.jsx.
// Tabel Manajemen Insiden butuh label berwarna ("Baru", "Sedang
// Ditinjau", dst), jadi mapping-nya disediakan lewat STATUS_LABEL di
// bawah — insidenService.js yang menerjemahkan kode -> label saat
// mengembalikan data ke ManajemenInsidenPage.jsx, supaya
// ManajemenInsidenPage.jsx TIDAK perlu diubah sama sekali.
//
// GANTI saat backend siap: hapus seluruh file ini, dan di
// insidenService.js / detailLaporanService.js panggil API asli
// langsung (lihat komentar "Versi REAL" di masing-masing file).
// ============================================================

import { tentukanJenisInvestigasi } from "../../lib/grading";

export const STATUS_LABEL = {
  baru: "Baru",
  ditinjau: "Sedang Ditinjau",
  investigasi: "Dalam Investigasi",
  selesai: "Selesai",
};

const DUMMY_LAPORAN_MENTAH = [
  {
    // ID dipakai konsisten sebagai identifier utama di URL/navigasi
    // (dulu beda: "SR-0921" di insidenService vs "#SR-0921" di
    // detailLaporanService — sekarang disamakan, tanpa "#").
    id: "SR-0921",
    idLaporan: "SR-20241012-001",

    tanggalMasuk: "12 Okt 2024, 09:45 WIB",
    tanggal: "12 Okt 2024, 09:45 WIB",
    tanggalKejadian: "12 Okt 2024",
    jamKejadian: "09:15 WIB",

    jenisInsiden: "Medication Error",
    kategoriInsiden: "KTD",
    unitKerja: "Instalasi Gawat Darurat (IGD)",
    lokasiKejadian: "Ruang Resusitasi Bed 02",

    pelapor: "Ns. Dewi Anggraini",
    identitasPelapor: "Ns. Dewi Anggraini",

    kronologi:
      "Pasien datang dengan keluhan sesak napas. Terjadi kesalahan pembacaan label obat sehingga pasien menerima dosis ganda.",
    dampakPasien: "Cedera Ringan",
    tindakanLangsung:
      "Pasien segera diobservasi, dokter jaga diberitahu, dan dilakukan monitoring tanda vital.",
    jumlahLampiran: 2,

    status: "ditinjau",
    ditugaskan: "Dr. Sarah Wijaya",
    investigator: "Dr. Sarah Wijaya, Sp.PK",

    grading: "Rendah",
    severity: "High Severity",

    feedback: [],
    recentActivity: [
      {
        type: "status",
        text: "Status Berubah",
        time: "Today, 10:30 AM",
        by: "Admin",
      },
      { type: "laporan", text: "Laporan Diterima", time: "Oct 12, 09:45 AM" },
    ],
  },
  {
    id: "SR-0922",
    idLaporan: "SR-20241025-002",

    tanggalMasuk: "25 Oct 2024, 09:05 WIB",
    tanggal: "25 Oct 2024, 09:05 WIB",
    tanggalKejadian: "25 Okt 2024",
    jamKejadian: "08:40 WIB",

    jenisInsiden: "KTD (Kejadian Tidak Diharapkan)",
    kategoriInsiden: "KTD",
    unitKerja: "Rawat Inap",
    lokasiKejadian: "Ruang Rawat Inap Lantai 3, Bed 12",

    pelapor: "", // contoh: nakes memilih lapor anonim, tanpa nama
    identitasPelapor: "Anonim / Dirahasiakan",

    kronologi:
      "Pasien mengalami reaksi alergi setelah pemberian obat baru yang belum dicatat riwayat alerginya secara lengkap di rekam medis.",
    dampakPasien: "Cedera Sedang",
    tindakanLangsung:
      "Obat dihentikan, pasien diberikan penanganan anti-alergi, dan dokter penanggung jawab pasien segera dihubungi.",
    jumlahLampiran: 1,

    status: "ditinjau",
    ditugaskan: "Apt. Rina Kusuma",
    investigator: "Apt. Rina Kusuma",

    grading: "Tinggi",
    severity: "High Severity",

    // Status khusus alur form RCA di Detail Investigasi (terpisah dari
    // `status` keseluruhan laporan di atas) — lihat updateStatusRCA()
    // di bawah untuk bagaimana keduanya disinkronkan otomatis.
    // "draft" | "menunggu_persetujuan" | "disetujui"
    statusRCA: "draft",
    catatanRevisiRCA: null,

    feedback: [],
    recentActivity: [
      { type: "laporan", text: "Laporan Diterima", time: "Oct 25, 09:05 AM" },
    ],
  },
  {
    id: "SR-0923",
    idLaporan: "SR-20241026-003",

    tanggalMasuk: "26 Oct 2024, 11:40 WIB",
    tanggal: "26 Oct 2024, 11:40 WIB",
    tanggalKejadian: "26 Okt 2024",
    jamKejadian: "11:20 WIB",

    jenisInsiden: "KNC (Kejadian Nyaris Cedera)",
    kategoriInsiden: "KNC",
    unitKerja: "Farmasi",
    lokasiKejadian: "Loket Farmasi Rawat Jalan",

    pelapor: "Ns. Budi Santoso",
    identitasPelapor: "Ns. Budi Santoso",

    kronologi:
      "Petugas farmasi hampir menyerahkan obat dengan nama mirip ke pasien yang salah, namun terdeteksi saat verifikasi ganda sebelum obat diserahkan.",
    dampakPasien: "Tidak Ada Cedera",
    tindakanLangsung:
      "Obat yang salah dibatalkan, obat yang benar diverifikasi ulang dan diserahkan sesuai resep.",
    jumlahLampiran: 0,

    status: "baru",
    ditugaskan: "",
    investigator: "",

    grading: "Rendah",
    severity: "Low Severity",

    feedback: [],
    recentActivity: [
      { type: "laporan", text: "Laporan Diterima", time: "Oct 26, 11:40 AM" },
    ],
  },
];

// jenisInvestigasi dihitung otomatis dari grading (sama seperti saat
// laporan baru masuk lewat buatLaporanService.js), ditempel di sini
// supaya kalau grading berubah, jenisInvestigasi ikut benar tanpa perlu
// diedit dobel di 2 tempat.
export const DUMMY_LAPORAN = DUMMY_LAPORAN_MENTAH.map((row) => ({
  ...row,
  jenisInvestigasi: tentukanJenisInvestigasi(row.grading)?.id ?? null,
}));

/**
 * Cari satu laporan (objek asli di array, BUKAN copy) berdasarkan id.
 * Sengaja balikin referensi asli supaya fungsi mutate (updateStatus,
 * updateGrading, dst di detailLaporanService.js) bisa langsung ubah
 * object-nya di tempat, dan kelihatan di getDaftarLaporan() berikutnya.
 */
export function findLaporanById(id) {
  return DUMMY_LAPORAN.find((row) => row.id === id) || null;
}

/**
 * Hapus satu laporan dari store (dipakai deleteLaporan di
 * detailLaporanService.js), supaya laporan yang dihapus juga hilang
 * dari daftar di Manajemen Insiden, bukan cuma dari halaman detail.
 */
export function hapusLaporanById(id) {
  const idx = DUMMY_LAPORAN.findIndex((row) => row.id === id);
  if (idx !== -1) DUMMY_LAPORAN.splice(idx, 1);
}

/**
 * Update status form RCA (dipakai detailInvestigasiService.js saat
 * saveInvestigasi/putuskanPersetujuan) DAN otomatis mensinkronkan
 * `status` keseluruhan laporan supaya konsisten di mana pun laporan itu
 * ditampilkan (Manajemen Insiden, Analisis Investigasi, dst) — jadi
 * begitu Admin Utama approve di Detail Investigasi, laporan itu:
 *   - langsung hilang dari Analisis Investigasi (status jadi "selesai"),
 *   - tapi TETAP ada di Manajemen Insiden, cuma label status-nya ikut
 *     berubah jadi "Selesai".
 *
 * @param {string} id
 * @param {"draft"|"menunggu_persetujuan"|"disetujui"} statusRCA
 * @param {{ catatanRevisi?: string }} [opsi]
 * @returns Baris laporan yang sudah diupdate, atau null kalau id tidak ketemu.
 */
export function updateStatusRCA(id, statusRCA, opsi = {}) {
  const row = findLaporanById(id);
  if (!row) return null;

  row.statusRCA = statusRCA;
  if (opsi.catatanRevisi !== undefined) {
    row.catatanRevisiRCA = opsi.catatanRevisi;
  }

  if (statusRCA === "disetujui") {
    row.status = "selesai";
  } else if (statusRCA === "draft" || statusRCA === "menunggu_persetujuan") {
    // Form RCA masih berproses (baik belum dikirim maupun sudah dikirim
    // tapi belum di-approve) -> laporan keseluruhan dianggap masih
    // "Dalam Investigasi", KECUALI kalau sebelumnya sudah "selesai" lalu
    // di-revisi lagi oleh Admin Utama (status jangan mundur jadi seolah
    // belum pernah selesai diproses).
    if (row.status !== "selesai" || statusRCA === "draft") {
      row.status = "investigasi";
    }
  }

  return row;
}
