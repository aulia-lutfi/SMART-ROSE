// src/pages/admin/InvestigasiSederhanaPage.jsx
// ============================================================
// Form "Investigasi Sederhana" — jalur ringkas untuk laporan
// grading Rendah/Moderat (Biru/Hijau), alternatif dari RCA.
//
// Mengikuti struktur form kertas resmi "LEMBAR KERJA INVESTIGASI
// SEDERHANA untuk Bands Risiko BIRU/HIJAU" (IMRK):
//   1. Penyebab langsung insiden
//   2. Penyebab yang melatarbelakangi / akar masalah insiden
//   3. Rekomendasi (list: teks + PIC + tanggal)
//   4. Tindakan yang akan dilakukan (list: teks + PIC + tanggal)
//   5. Manager/Kepala Bagian/Kepala Unit (nama, tanda tangan,
//      tanggal mulai & selesai investigasi)
//   6. Manajemen Risiko (investigasi lengkap, perlu lanjut,
//      grading ulang)
//
// CATATAN:
// - Field "Investigasi Lengkap: Ya/Tidak" DIPAKAI SEBAGAI status
//   selesai/belum laporan ini — begitu dipilih "Ya" dan disimpan,
//   updateStatusLaporan(id, "SELESAI") ikut dipanggil (lewat
//   investigasiSederhanaService), TANPA approval Admin Utama.
//   Ini menggantikan field "Status Selesai/Belum" terpisah supaya
//   selaras dengan form kertas asli (gak ada 2 field yang tumpang
//   tindih artinya).
// - Fitur "Unduh PDF" (html2pdf.js) sudah dihapus — cukup pakai tombol
//   "Cetak" (window.print()), yang punya opsi "Save as PDF" lewat
//   dialog print browser. Area cetak (#sederhana-print-area) tetap
//   dipakai untuk styling khusus print, mengikuti pola yang sama
//   dengan DetailLaporanPageAdmin.jsx / DetailInvestigasiPage.jsx.
// - "Grading ulang: Biru/Hijau/Kuning/Merah" DIBUAT TERPISAH dari sistem
//   grading utama (GRADING_IDS di lib/grading.js) sesuai keputusan —
//   field ini murni pencatatan hasil re-assessment di form kertas.
// ============================================================

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Printer,
} from "lucide-react";
import * as investigasiSederhanaService from "../../services/admin/investigasiSederhanaService";
import SignaturePad from "../../components/admin/SignaturePad";

// ── Deadline pengerjaan (asumsi, admin bisa sesuaikan angka ini) ───────
// Rendah dikasih waktu lebih longgar dibanding Moderat karena risikonya
// lebih kecil. ASUMSI, bukan dari dokumen — kalau kebijakan RS beda,
// tinggal ubah angka di sini.
// Key dipakai LANGSUNG kode warna grading asli backend (BIRU/HIJAU),
// bukan label "Rendah"/"Moderat" — supaya cocok dengan field
// gradingAwal/gradingFinal yang balikin kode warna, bukan teks label.
const DEADLINE_HARI = { BIRU: 14, HIJAU: 7 };
const DEFAULT_DEADLINE_HARI = 14;

// Label tampilan untuk kode warna grading (selaras dengan mapping yang
// sudah dipakai di AdminDashboardPage.jsx & buatlaporanService.js).
const LABEL_GRADING = {
  BIRU: "Rendah",
  HIJAU: "Moderat",
  KUNING: "Tinggi",
  MERAH: "Ekstrim",
};

const BULAN_INDO = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  Mei: 4,
  Jun: 5,
  Jul: 6,
  Agu: 7,
  Sep: 8,
  Okt: 9,
  Nov: 10,
  Des: 11,
};

// Parse tanggal format "12 Okt 2024" -> Date object. Return null kalau
// gagal parse (jangan crash halaman gara-gara format tanggal beda).
function parseTanggalIndo(str) {
  if (!str) return null;
  const parts = str.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const [tgl, bulanStr, tahun] = parts;
  const bulan = BULAN_INDO[bulanStr];
  if (bulan === undefined) return null;
  const date = new Date(Number(tahun), bulan, Number(tgl));
  return isNaN(date.getTime()) ? null : date;
}

function formatTanggalIndo(date) {
  const bulanLabel = Object.keys(BULAN_INDO).find(
    (k) => BULAN_INDO[k] === date.getMonth(),
  );
  return `${date.getDate()} ${bulanLabel} ${date.getFullYear()}`;
}

// Terima format Indo ("12 Okt 2024") ATAU format lain yang dikenali
// Date() (mis. ISO "2024-10-12T00:00:00.000Z") — supaya kalau backend
// ternyata balikin ISO, parsing tidak diam-diam gagal jadi null.
function parseTanggalFleksibel(str) {
  if (!str) return null;
  const indo = parseTanggalIndo(str);
  if (indo) return indo;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Untuk ditampilkan ke user: selalu tampil format Indo yang rapi kalau
// bisa di-parse, fallback ke string mentah kalau format tak dikenali
// (supaya tidak hilang total, cuma kurang rapi).
function tampilkanTanggal(str) {
  const parsed = parseTanggalFleksibel(str);
  return parsed ? formatTanggalIndo(parsed) : str || "\u2014";
}

function buatIdBaris() {
  return Math.random().toString(36).slice(2, 10);
}

const KOSONG_RIWAYAT_BARIS = () => ({
  id: buatIdBaris(),
  teks: "",
  pic: "",
  tanggal: "",
});

export default function InvestigasiSederhanaPage({ onNavigate, laporanId }) {
  const [laporan, setLaporan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // ── Form state ──────────────────────────────────────────────────────
  const [penyebabLangsung, setPenyebabLangsung] = useState("");
  const [penyebabAkarMasalah, setPenyebabAkarMasalah] = useState("");
  const [rekomendasi, setRekomendasi] = useState([KOSONG_RIWAYAT_BARIS()]);
  const [tindakan, setTindakan] = useState([KOSONG_RIWAYAT_BARIS()]);

  const [managerNama, setManagerNama] = useState("");
  const [tandaTangan, setTandaTangan] = useState(null);
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState(null);

  const [investigasiLengkap, setInvestigasiLengkap] = useState(""); // "Ya" | "Tidak" | ""
  const [tanggalInvestigasiLengkap, setTanggalInvestigasiLengkap] =
    useState("");
  const [perluLanjut, setPerluLanjut] = useState(""); // "Ya" | "Tidak" | ""
  const [gradingUlang, setGradingUlang] = useState(""); // "Biru" | "Hijau" | "Kuning" | "Merah" | ""

  // ── Popup konfirmasi penyelesaian investigasi ──────────────────────
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [agreeFinish, setAgreeFinish] = useState(false);

  // Field asli backend adalah gradingAwal/gradingFinal (bukan
  // "grading"), sama seperti sudah dikonfirmasi di DetailLaporanPageAdmin.
  // gradingFinal dipakai kalau sudah ada (hasil re-grading), fallback
  // ke gradingAwal.
  const gradingEfektif = laporan?.gradingFinal || laporan?.gradingAwal || null;
  const gradingLabel = gradingEfektif
    ? LABEL_GRADING[gradingEfektif] || gradingEfektif
    : "\u2014";

  // Field asli backend buat "kode" laporan ternyata trackingNumber
  // (mis. "SR-2026-000011"), BUKAN idLaporan — sudah dikonfirmasi lewat
  // console.log Raw detailResult. Fallback ke idLaporan tetap dijaga
  // kalau-kalau ada endpoint lain yang masih balikin field itu.
  const idLaporanTampil =
    laporan?.trackingNumber || laporan?.idLaporan || "\u2014";

  // ── Halaman jadi read-only total (cuma tombol Cetak yang aktif)
  // begitu laporan sudah berstatus "SELESAI" — baik karena diselesaikan
  // dari halaman ini sendiri, maupun sudah selesai lewat jalur lain.
  // Enum status backend uppercase (sudah dikonfirmasi di DetailLaporanPageAdmin).
  const isReadOnly = laporan?.status === "SELESAI";

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  // ------------------------------------------------------------
  // Fetch detail laporan (reuse) + draft investigasi sederhana
  // yang sudah pernah disimpan (kalau ada).
  // ------------------------------------------------------------
  const fetchData = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      const [detailResult, draft] = await Promise.all([
        investigasiSederhanaService.getLaporanDetail(id),
        investigasiSederhanaService.getInvestigasiSederhana(id),
      ]);

      // Defensif: detailLaporanService bisa balikin { laporan: {...} }
      // ATAU objek laporan langsung (flat) — pola yang sama pernah bikin
      // DetailLaporanPageAdmin.jsx blank total tanpa error di console.
      console.log(
        "[InvestigasiSederhanaPage] Raw detailResult (buat cek nama field):",
        detailResult,
      );
      setLaporan(detailResult?.laporan || detailResult || null);

      if (draft) {
        setPenyebabLangsung(draft.penyebabLangsung || "");
        setPenyebabAkarMasalah(draft.penyebabAkarMasalah || "");
        setRekomendasi(
          draft.rekomendasi?.length
            ? draft.rekomendasi
            : [KOSONG_RIWAYAT_BARIS()],
        );
        setTindakan(
          draft.tindakan?.length ? draft.tindakan : [KOSONG_RIWAYAT_BARIS()],
        );
        setManagerNama(draft.manager?.nama || "");
        setTandaTangan(draft.manager?.tandaTangan || null);
        setTanggalMulai(draft.manager?.tanggalMulai || "");
        setTanggalSelesai(draft.manager?.tanggalSelesai || null);
        setInvestigasiLengkap(draft.manajemenRisiko?.investigasiLengkap || "");
        setTanggalInvestigasiLengkap(
          draft.manajemenRisiko?.tanggalInvestigasiLengkap || "",
        );
        setPerluLanjut(draft.manajemenRisiko?.perluLanjut || "");
        setGradingUlang(draft.manajemenRisiko?.gradingUlang || "");
      } else {
        // Belum pernah diisi -> tanggal mulai investigasi = hari ini
        setTanggalMulai(formatTanggalIndo(new Date()));
      }
    } catch (err) {
      setError(err.message || "Gagal memuat detail laporan.");
      setLaporan(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(laporanId);
  }, [laporanId, fetchData]);

  // ------------------------------------------------------------
  // Deadline badge — murni tampilan, bukan hard block.
  // ------------------------------------------------------------
  const deadlineInfo = useMemo(() => {
    if (!laporan) return null;
    const tanggalKejadian = parseTanggalFleksibel(laporan.tanggalKejadian);
    if (!tanggalKejadian) return null;

    const hariDeadline =
      DEADLINE_HARI[laporan.gradingFinal || laporan.gradingAwal] ??
      DEFAULT_DEADLINE_HARI;
    const batas = new Date(tanggalKejadian);
    batas.setDate(batas.getDate() + hariDeadline);

    const now = new Date();
    const sisaHari = Math.ceil((batas - now) / (1000 * 60 * 60 * 24));

    return {
      batasLabel: formatTanggalIndo(batas),
      sisaHari,
      lewatDeadline: sisaHari < 0,
    };
  }, [laporan]);

  // ------------------------------------------------------------
  // Helper untuk list dinamis (Rekomendasi & Tindakan)
  // ------------------------------------------------------------
  const tambahBaris = (setter) => {
    setter((prev) => [...prev, KOSONG_RIWAYAT_BARIS()]);
  };

  const hapusBaris = (setter, id) => {
    setter((prev) =>
      prev.length > 1 ? prev.filter((row) => row.id !== id) : prev,
    );
  };

  const updateBaris = (setter, id, field, value) => {
    setter((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  // ------------------------------------------------------------
  // Simpan
  // ------------------------------------------------------------
  const handleCetak = () => window.print();

  // Tombol "Simpan" di form tidak langsung nyimpen kalau tujuannya
  // menyelesaikan investigasi ("Investigasi Lengkap" = "Ya") — wajib
  // konfirmasi dulu lewat popup, karena aksi ini bakal mengunci laporan
  // jadi read-only dan mengirim status "selesai" ke pelapor.
  const handleSaveClick = () => {
    if (investigasiLengkap === "Ya") {
      setAgreeFinish(false);
      setShowFinishModal(true);
    } else {
      handleSimpan();
    }
  };

  const handleSimpan = async () => {
    const statusSelesai = investigasiLengkap === "Ya";

    setIsSaving(true);
    try {
      const tanggalSelesaiBaru = statusSelesai
        ? tanggalSelesai || formatTanggalIndo(new Date())
        : null;

      const payload = {
        penyebabLangsung,
        penyebabAkarMasalah,
        rekomendasi,
        tindakan,
        manager: {
          nama: managerNama,
          tandaTangan,
          tanggalMulai,
          tanggalSelesai: tanggalSelesaiBaru,
        },
        manajemenRisiko: {
          investigasiLengkap,
          tanggalInvestigasiLengkap,
          perluLanjut,
          gradingUlang,
        },
        statusSelesai,
      };

      await investigasiSederhanaService.simpanInvestigasiSederhana(
        laporan.id,
        payload,
      );

      if (statusSelesai) {
        setTanggalSelesai(tanggalSelesaiBaru);
        showNotif(
          "success",
          "Investigasi Sederhana disimpan & laporan ditandai selesai.",
        );
        await new Promise((resolve) => setTimeout(resolve, 900));
        onNavigate?.("incident-management");
      } else {
        showNotif("success", "Investigasi Sederhana berhasil disimpan.");
      }
    } catch (err) {
      showNotif(
        "info",
        err.message || "Gagal menyimpan Investigasi Sederhana.",
      );
    } finally {
      setIsSaving(false);
      setShowFinishModal(false);
      setAgreeFinish(false);
    }
  };

  // ------------------------------------------------------------
  // Render states
  // ------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-100" />
          <div className="h-32 rounded-xl bg-slate-100" />
          <div className="h-64 rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={() => fetchData(laporanId)}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!laporan) return null;

  // ── Guard: halaman ini KHUSUS jalur Sederhana ────────────────────────
  // Kalau laporan ternyata jenisInvestigasi-nya RCA (mis. dibuka lewat
  // link lama / laporanId ditebak manual), jangan biarkan diproses di
  // sini — wajib lewat DetailInvestigasiPage (RCA), bukan alternatif
  // yang lebih ringkas ini.
  if (laporan.jenisInvestigasi === "RCA_LENGKAP") {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
          <h2 className="mb-2 text-sm font-bold text-slate-800">
            Laporan Ini Wajib RCA
          </h2>
          <p className="mb-5 text-xs leading-relaxed text-amber-700">
            Grading laporan {idLaporanTampil} adalah <b>{gradingLabel}</b>, yang
            mewajibkan Investigasi Komprehensif (RCA) — bukan Investigasi
            Sederhana.
          </p>
          <button
            onClick={() => onNavigate?.("detail-investigasi", laporan.id)}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            Buka Detail Investigasi (RCA)
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Area cetak (#sederhana-print-area) selalu dirender di DOM, tapi
          digeser jauh ke luar viewport (offscreen) di layar biasa sehingga
          tidak terlihat pengguna. Saat window.print() dipanggil, posisinya
          dikembalikan normal dan seluruh UI editor disembunyikan lewat
          class print:hidden. Pola sama dengan DetailLaporanPageAdmin.jsx. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 2cm; }
          body * { visibility: hidden; }
          #sederhana-print-area, #sederhana-print-area * { visibility: visible; }
          #sederhana-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8 print:hidden">
        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 rounded-lg p-4 ${
              notification.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-blue-50 text-blue-700 border border-blue-200"
            }`}
          >
            {notification.message}
          </div>
        )}

        {/* Breadcrumb + Aksi Cetak */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <button
              onClick={() => onNavigate?.("incident-management")}
              className="hover:text-slate-800"
            >
              Incident Management
            </button>
            <ChevronRight className="h-4 w-4" />
            <button
              onClick={() => onNavigate?.("detail-laporan", laporan.id)}
              className="hover:text-slate-800"
            >
              Detail Laporan
            </button>
            <ChevronRight className="h-4 w-4" />
            <span className="font-semibold text-slate-800">
              Investigasi Sederhana
            </span>
            {isReadOnly && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                Selesai
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Badge tenggat waktu — dipindah ke sini (paling atas, di
                samping tombol Cetak) sesuai permintaan, bukan lagi
                di sidebar kiri. Tampilan saja, bukan hard block. */}
            {deadlineInfo && (
              <div
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  deadlineInfo.lewatDeadline
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
                title={`Target selesai: ${deadlineInfo.batasLabel}`}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  {deadlineInfo.lewatDeadline
                    ? "Lewat deadline"
                    : `Sisa ${deadlineInfo.sisaHari} hari`}
                </span>
                <span className="hidden font-normal text-slate-500 sm:inline">
                  · Target: {deadlineInfo.batasLabel}
                </span>
              </div>
            )}
            <button
              onClick={handleCetak}
              className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak
            </button>
          </div>
        </div>

        {isReadOnly && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
            <p className="text-xs leading-relaxed text-green-700">
              Investigasi Sederhana laporan ini sudah <b>selesai</b> dan
              terkunci. Isi form tidak bisa diubah lagi — Anda hanya bisa
              melihat atau mencetaknya (bisa disimpan sebagai PDF lewat dialog
              print).
            </p>
          </div>
        )}

        <div className="space-y-6">
          {/* ── Ringkasan Laporan — strip horizontal di atas form (bukan
              sidebar lagi), supaya form di bawahnya bisa penuh selebar
              halaman. ── */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold text-slate-800">
                Ringkasan Laporan
              </h2>
              <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Grading: {gradingLabel}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  ID LAPORAN
                </p>
                <p className="font-semibold text-slate-800">
                  {idLaporanTampil}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  TANGGAL KEJADIAN
                </p>
                <p className="font-semibold text-slate-800">
                  {tampilkanTanggal(laporan.tanggalKejadian)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  UNIT KERJA
                </p>
                <p className="font-semibold text-slate-800">
                  {laporan.unitKerja}
                </p>
              </div>
            </div>
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="mb-1 text-xs font-semibold text-slate-500">
                KRONOLOGI SINGKAT
              </p>
              <p className="text-sm text-slate-700">{laporan.kronologi}</p>
            </div>
          </div>

          {/* ── Form — sekarang penuh selebar halaman ── */}
          <div className="space-y-6">
            {/* 1 & 2. Penyebab — berdampingan di layar lebar supaya lebar
                penuh halaman termanfaatkan, tetap bertumpuk di mobile. */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Penyebab Langsung Insiden
                  </label>
                  <textarea
                    rows={5}
                    value={penyebabLangsung}
                    onChange={(e) => setPenyebabLangsung(e.target.value)}
                    placeholder="Jelaskan penyebab langsung terjadinya insiden..."
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-800 mb-2">
                    Penyebab yang Melatarbelakangi / Akar Masalah Insiden
                  </label>
                  <textarea
                    rows={5}
                    value={penyebabAkarMasalah}
                    onChange={(e) => setPenyebabAkarMasalah(e.target.value)}
                    placeholder="Jelaskan akar masalah di balik insiden ini..."
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* 3. Rekomendasi */}
            <RiwayatList
              title="Rekomendasi"
              rows={rekomendasi}
              onAdd={() => tambahBaris(setRekomendasi)}
              onRemove={(id) => hapusBaris(setRekomendasi, id)}
              onChange={(id, field, value) =>
                updateBaris(setRekomendasi, id, field, value)
              }
              teksLabel="Rekomendasi"
              teksPlaceholder="Tuliskan rekomendasi..."
              readOnly={isReadOnly}
            />

            {/* 4. Tindakan */}
            <RiwayatList
              title="Tindakan yang Akan Dilakukan"
              rows={tindakan}
              onAdd={() => tambahBaris(setTindakan)}
              onRemove={(id) => hapusBaris(setTindakan, id)}
              onChange={(id, field, value) =>
                updateBaris(setTindakan, id, field, value)
              }
              teksLabel="Tindakan"
              teksPlaceholder="Tuliskan tindakan yang akan dilakukan..."
              readOnly={isReadOnly}
            />

            {/* 5. Manager/Kepala Bagian/Kepala Unit */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                Manager / Kepala Bagian / Kepala Unit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Nama
                  </label>
                  <input
                    type="text"
                    value={managerNama}
                    onChange={(e) => setManagerNama(e.target.value)}
                    placeholder="Nama manager/kepala bagian/kepala unit"
                    disabled={isReadOnly}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  />

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tanggal Mulai Investigasi
                      </label>
                      <p className="text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        {tanggalMulai || "—"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Tanggal Selesai Investigasi
                      </label>
                      <p className="text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                        {tanggalSelesai || "Belum selesai"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Tanda Tangan
                  </label>
                  {isReadOnly ? (
                    tandaTangan ? (
                      <img
                        src={tandaTangan}
                        alt="Tanda tangan"
                        className="h-24 rounded-lg border border-slate-200 bg-slate-50 p-2"
                      />
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400">
                        Tidak ada tanda tangan
                      </div>
                    )
                  ) : (
                    <SignaturePad
                      value={tandaTangan}
                      onChange={setTandaTangan}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* 6. Manajemen Risiko */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                Manajemen Risiko
              </h3>

              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      Investigasi Lengkap
                    </label>
                    <div className="flex gap-2">
                      {["Ya", "Tidak"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          disabled={isReadOnly}
                          onClick={() => {
                            setInvestigasiLengkap(opt);
                            if (opt === "Ya" && !tanggalInvestigasiLengkap) {
                              setTanggalInvestigasiLengkap(
                                formatTanggalIndo(new Date()),
                              );
                            }
                          }}
                          className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                            investigasiLengkap === opt
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      Tanggal
                    </label>
                    <input
                      type="text"
                      value={tanggalInvestigasiLengkap}
                      onChange={(e) =>
                        setTanggalInvestigasiLengkap(e.target.value)
                      }
                      placeholder="cth: 18 Jul 2026"
                      disabled={investigasiLengkap !== "Ya" || isReadOnly}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                </div>

                {investigasiLengkap === "Ya" && !isReadOnly && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5" />
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Karena "Investigasi Lengkap" dipilih <b>Ya</b>, laporan
                      ini akan otomatis ditandai <b>Selesai</b> saat disimpan
                      (tanpa perlu approval Admin Utama).
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Diperlukan Investigasi Lebih Lanjut
                  </label>
                  <div className="flex gap-2">
                    {["Ya", "Tidak"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setPerluLanjut(opt)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          perluLanjut === opt
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-2">
                    Investigasi Setelah Grading Ulang
                  </label>
                  <div className="flex gap-2">
                    {[
                      { value: "Biru", cls: "bg-blue-600 border-blue-600" },
                      { value: "Hijau", cls: "bg-green-600 border-green-600" },
                      {
                        value: "Kuning",
                        cls: "bg-yellow-500 border-yellow-500",
                      },
                      { value: "Merah", cls: "bg-red-600 border-red-600" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isReadOnly}
                        onClick={() => setGradingUlang(opt.value)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          gradingUlang === opt.value
                            ? `${opt.cls} text-white`
                            : "border-slate-300 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {opt.value}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Catatan hasil re-assessment risiko pada form ini — terpisah
                    dari grading utama laporan.
                  </p>
                </div>
              </div>
            </div>

            {/* Save button — disembunyikan total begitu laporan sudah
                selesai & read-only; hanya tombol Cetak yang tersisa. */}
            {!isReadOnly && (
              <button
                onClick={handleSaveClick}
                disabled={isSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                {isSaving
                  ? "Menyimpan..."
                  : investigasiLengkap === "Ya"
                    ? "Simpan & Selesaikan Investigasi"
                    : "Simpan Investigasi Sederhana"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Area Cetak ────────────────────────────────────────────────────
          Offscreen di layar normal, cuma "muncul" saat window.print().
          Layout mengikuti format resmi "LEMBAR KERJA INVESTIGASI
          SEDERHANA untuk Bands Risiko BIRU/HIJAU". */}
      <div
        id="sederhana-print-area"
        style={{ position: "absolute", left: "-9999px", top: 0 }}
        className="w-[210mm] bg-white p-10 font-serif text-slate-900"
      >
        {/* Kop judul — persis form asli: judul tengah, logo pojok kanan.
            Placeholder lingkaran logo di bawah WAJIB diganti dengan
            <img src="/logo-rs.png" .../> begitu aset logo RS tersedia. */}
        <div className="mb-4 -mt-4 text-center">
          <h1 className="text-[15px] font-bold uppercase tracking-wide">
            Lembar Kerja Investigasi Sederhana
          </h1>
          <p className="text-[13px]">
            untuk <i>Bands</i> Risiko <b>BIRU / HIJAU</b>
          </p>
        </div>

        <p className="mb-3 text-[11px]">
          ID Laporan: <b>{idLaporanTampil}</b> &nbsp;|&nbsp; Tanggal Kejadian:{" "}
          <b>{tampilkanTanggal(laporan.tanggalKejadian)}</b> &nbsp;|&nbsp; Unit:{" "}
          <b>{laporan.unitKerja}</b>
        </p>

        {/* 1. Penyebab langsung insiden — kotak besar persis form asli */}
        <div className="mb-4 min-h-[110px] border-2 border-slate-800 p-2">
          <p className="mb-1 text-[12px] font-bold underline">
            Penyebab langsung insiden :
          </p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
            {penyebabLangsung}
          </p>
        </div>

        {/* 2. Penyebab akar masalah — kotak besar */}
        <div className="mb-4 min-h-[130px] border-2 border-slate-800 p-2">
          <p className="mb-1 text-[12px] font-bold underline">
            Penyebab yang melatarbelakangi / akar masalah insiden :
          </p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed">
            {penyebabAkarMasalah}
          </p>
        </div>

        {/* 3. Rekomendasi — tabel 3 kolom persis form asli */}
        <table className="mb-4 w-full border-collapse border-2 border-slate-800 text-[12px]">
          <thead>
            <tr>
              <th className="w-1/2 border-2 border-slate-800 p-1.5 text-left font-bold underline">
                Rekomendasi :
              </th>
              <th className="w-1/4 border-2 border-slate-800 p-1.5 text-left font-bold">
                Penanggung jawab
              </th>
              <th className="w-1/4 border-2 border-slate-800 p-1.5 text-left font-bold">
                Tanggal :
              </th>
            </tr>
          </thead>
          <tbody>
            {rekomendasi.map((row) => (
              <tr key={row.id}>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.teks}
                </td>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.pic}
                </td>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.tanggal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 4. Tindakan yang akan dilakukan — tabel 3 kolom */}
        <table className="mb-4 w-full border-collapse border-2 border-slate-800 text-[12px]">
          <thead>
            <tr>
              <th className="w-1/2 border-2 border-slate-800 p-1.5 text-left font-bold underline">
                Tindakan yang akan dilakukan :
              </th>
              <th className="w-1/4 border-2 border-slate-800 p-1.5 text-left font-bold">
                Penanggung jawab :
              </th>
              <th className="w-1/4 border-2 border-slate-800 p-1.5 text-left font-bold">
                Tanggal :
              </th>
            </tr>
          </thead>
          <tbody>
            {tindakan.map((row) => (
              <tr key={row.id}>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.teks}
                </td>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.pic}
                </td>
                <td className="border-2 border-slate-800 p-1.5 align-top">
                  {row.tanggal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 5. Manager/Kepala Bagian/Kepala Unit — header abu-abu persis
            form asli, lalu 2 kolom: Nama/Tanda tangan | Tanggal mulai/selesai */}
        <div className="mb-4 border-2 border-slate-800">
          <div className="border-b-2 border-slate-800 bg-slate-300 px-2 py-1 text-[12px] font-bold">
            Manager / Kepala Bagian / Kepala Unit
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-3 text-[12px]">
            <p>Nama &nbsp;&nbsp;: {managerNama || "\u00A0"}</p>
            <p>Tanggal mulai Investigasi &nbsp;: {tanggalMulai}</p>
            <div>
              <p className="mb-1">Tanda tangan :</p>
              {tandaTangan ? (
                <img
                  src={tandaTangan}
                  alt="Tanda tangan"
                  className="h-14 border-b border-slate-400"
                />
              ) : (
                <div className="h-14 w-36 border-b border-slate-400" />
              )}
            </div>
            <p>
              Tanggal selesai Investigasi &nbsp;: {tanggalSelesai || "\u00A0"}
            </p>
          </div>
        </div>

        {/* 6. Manajemen Risiko — kotak label kiri (rowspan) + isi kanan,
            persis form asli */}
        <table className="w-full border-collapse border-2 border-slate-800 text-[12px]">
          <tbody>
            <tr>
              <td
                rowSpan={3}
                className="w-28 border-2 border-slate-800 p-2 align-top font-bold"
              >
                Manajemen
                <br />
                Risiko :
              </td>
              <td className="border-2 border-slate-800 p-2">
                <i className="font-bold">Investigasi Lengkap</i> :{" "}
                <b>{investigasiLengkap || "\u00A0"}</b>
                &nbsp;&nbsp;&nbsp;&nbsp; Tanggal :{" "}
                {tanggalInvestigasiLengkap || "\u00A0"}
              </td>
            </tr>
            <tr>
              <td className="border-2 border-slate-800 p-2">
                Diperlukan Investigasi lebih lanjut : {perluLanjut || "\u00A0"}
              </td>
            </tr>
            <tr>
              <td className="border-2 border-slate-800 p-2">
                Investigasi setelah <i>Grading</i> ulang :{" "}
                {gradingUlang || "\u00A0"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Modal Konfirmasi Penyelesaian Investigasi Sederhana ──
          Muncul saat admin memilih "Investigasi Lengkap: Ya" lalu klik
          simpan. Setelah dikonfirmasi, laporan otomatis ditandai
          "selesai" dan halaman ini terkunci jadi read-only. */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <h2 className="mb-2 text-center text-lg font-bold text-slate-800">
              Selesaikan Investigasi Sederhana?
            </h2>

            <p className="mb-5 text-center text-sm leading-relaxed text-slate-500">
              Laporan{" "}
              <span className="font-semibold text-slate-700">
                {idLaporanTampil}
              </span>{" "}
              akan ditandai <b>SELESAI</b>. Setelah ini, form Investigasi
              Sederhana akan <b>terkunci (read-only)</b> dan tidak bisa diubah
              lagi.
            </p>

            <div className="mb-5 rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">Status</span>
                <span className="font-semibold text-green-600">Selesai</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">Grading</span>
                <span className="font-semibold text-slate-700">
                  {gradingLabel}
                </span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">
                  Tanggal Penyelesaian
                </span>
                <span className="font-semibold text-slate-700">
                  {tanggalInvestigasiLengkap || formatTanggalIndo(new Date())}
                </span>
              </div>
            </div>

            <label className="mb-5 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeFinish}
                onChange={(e) => setAgreeFinish(e.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span className="text-xs leading-relaxed text-slate-600">
                Saya memastikan seluruh isian Investigasi Sederhana sudah benar
                dan siap dikirim ke pelapor.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFinishModal(false);
                  setAgreeFinish(false);
                }}
                disabled={isSaving}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
              >
                Batal
              </button>

              <button
                disabled={!agreeFinish || isSaving}
                onClick={handleSimpan}
                className={`flex-1 rounded-xl py-2.5 font-semibold transition ${
                  agreeFinish && !isSaving
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                {isSaving ? "Menyimpan..." : "Ya, Selesaikan Investigasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// Sub-komponen: list dinamis untuk Rekomendasi & Tindakan
// (teks + PIC + tanggal per baris, bisa tambah/hapus baris)
// ============================================================
function RiwayatList({
  title,
  rows,
  onAdd,
  onRemove,
  onChange,
  teksLabel,
  teksPlaceholder,
  readOnly = false,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {!readOnly && (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah Baris
          </button>
        )}
      </div>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div
            key={row.id}
            className="rounded-lg border border-slate-200 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400">
                #{idx + 1}
              </span>
              {!readOnly && rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(row.id)}
                  className="text-slate-400 hover:text-red-600 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <textarea
              rows={2}
              value={row.teks}
              onChange={(e) => onChange(row.id, "teks", e.target.value)}
              placeholder={teksPlaceholder}
              disabled={readOnly}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={row.pic}
                onChange={(e) => onChange(row.id, "pic", e.target.value)}
                placeholder="PIC (nama + unit)"
                disabled={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
              <input
                type="text"
                value={row.tanggal}
                onChange={(e) => onChange(row.id, "tanggal", e.target.value)}
                placeholder="Tanggal (cth: 18 Jul 2026)"
                disabled={readOnly}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
