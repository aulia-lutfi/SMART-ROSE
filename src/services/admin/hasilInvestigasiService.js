// ── Service: Hasil Investigasi ─────────────────────────────────────────────
// Pola mengikuti dashboardService.js (async function yang me-return Promise).
// Saat backend sudah siap, isi function ini diganti dengan fetch/axios ke API.
// Contoh nanti:
//   export async function getHasilInvestigasi(laporanId) {
//     const res = await fetch(`/api/investigasi/${laporanId}/hasil`);
//     if (!res.ok) throw new Error("Gagal memuat hasil investigasi");
//     return res.json();
//   }

const DUMMY_HASIL_INVESTIGASI = {
  id: "#INC-2024-015",
  selesaiPada: "28 Oct 2023, 14:20 WIB",
  penanggungJawab: "Admin Rose",
  deskripsi: "Detail investigasi komprehensif dan rencana tindak lanjut.",
  pasien: {
    nama: "Budi Santoso",
    noRM: "RM-9902182",
    usiaJK: "45 Tahun / Laki-laki",
    ruangan: "ICU - Bed 04",
  },
  rencanaPerbaikan: [
    {
      id: 1,
      judul: "Audit Kelengkapan Alat Fiksasi",
      deskripsi: "Memastikan semua ventilator memiliki holder yang kaku.",
    },
    {
      id: 2,
      judul: "Refreshment Training Alarm Management",
      deskripsi: "Pelatihan ulang respon alarm untuk staf ICU.",
    },
  ],
  timeline: [
    {
      label: "Investigasi Diselesaikan",
      oleh: "Admin Rose",
      tanggal: "28 Oct 2023, 14:20",
      done: true,
      color: "bg-green-600",
    },
    {
      label: "RCA Diperbarui",
      oleh: "dr. Sarah Sp.An",
      tanggal: "27 Oct 2023, 10:45",
      done: true,
      color: "bg-blue-600",
    },
    {
      label: "Laporan Ditinjau",
      oleh: "Komite Mutu",
      tanggal: "26 Oct 2023, 09:15",
      done: true,
      color: "bg-blue-500",
    },
    {
      label: "Laporan Dibuat",
      oleh: "Perawat Ani",
      tanggal: "25 Oct 2023, 02:46",
      done: true,
      color: "bg-slate-400",
    },
  ],
  stepperSteps: ["Baru", "Ditinjau", "Investigasi", "Selesai"],
};

/**
 * Ambil data hasil investigasi berdasarkan ID laporan.
 * Saat ini masih mengembalikan data dummy. Nanti diganti fetch ke backend.
 * @param {string} laporanId
 * @returns {Promise<object>}
 */
export async function getHasilInvestigasi(laporanId) {
  // Simulasi delay jaringan supaya loading state bisa dites di UI
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    ...DUMMY_HASIL_INVESTIGASI,
    id: laporanId || DUMMY_HASIL_INVESTIGASI.id,
  };
}

/**
 * Trigger unduh laporan investigasi dalam format PDF.
 * Saat ini hanya placeholder. Nanti diganti request ke endpoint export backend.
 * @param {string} laporanId
 */
export async function unduhLaporanInvestigasi(laporanId) {
  // Nanti: const res = await fetch(`/api/investigasi/${laporanId}/export-pdf`)
  console.log("Unduh laporan investigasi:", laporanId);
  return true;
}
