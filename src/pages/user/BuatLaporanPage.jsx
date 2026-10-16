import { useState, useEffect } from "react";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Upload,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import FormStep1 from "../../components/laporan/FormStep1";
import FormStep2 from "../../components/laporan/FormStep2";
import FormStep3 from "../../components/laporan/FormStep3";
import FormStep4 from "../../components/laporan/FormStep4";
import FormChatbot from "../../components/laporan/FormChatbot";
import {
  kirimLaporan,
  MAX_TOTAL_LAMPIRAN_SIZE,
  validasiLampiran,
} from "../../services/user/buatlaporanService";

export default function BuatLaporanPage() {
  const [step, setStep] = useState(1);

  // Toggle tipe insiden (true = pasien [default], false = fasilitas)
  const [melibatkanPasien, setMelibatkanPasien] = useState(true);

  // Step 1 - Pasien
  const [namaPasien, setNamaPasien] = useState("");
  const [noMR, setNoMR] = useState("");
  const [ruangan, setRuangan] = useState("");
  const [ruanganCustom, setRuanganCustom] = useState("");
  const [tanggalLahir, setTanggalLahir] = useState("");
  const [jenisKelamin, setJenisKelamin] = useState("");
  const [statusPasien, setStatusPasien] = useState("");
  const [penanggungBiaya, setPenanggungBiaya] = useState(
    "JKN (BPJS Kesehatan)",
  );
  const [penanggungBiayaCustom, setPenanggungBiayaCustom] = useState("");
  const [tanggalMasuk, setTanggalMasuk] = useState("");
  const [kategoriPelapor, setKategoriPelapor] = useState("Karyawan - Dokter");
  // ⚠️ Custom text untuk Kategori Pelapor ditangkap di sini, TAPI belum
  // ada tempat tujuan di backend — nilai kategoriPelapor selalu dipetakan
  // paksa ke enum terbatas (STAF/KELUARGA/PASIEN_SENDIRI/LAIN_LAIN) lewat
  // keKategoriPelaporBackend() di buatlaporanService.js. PERLU KONFIRMASI
  // BE apakah ada field bebas terpisah untuk ini sebelum dikirim.
  const [kategoriPelaporCustom, setKategoriPelaporCustom] = useState("");
  const [namaPelapor, setNamaPelapor] = useState("");

  // Step 1 - Fasilitas
  const [kategoriFasilitas, setKategoriFasilitas] = useState("");
  const [kategoriFasilitasCustom, setKategoriFasilitasCustom] = useState("");
  const [namaFasilitas, setNamaFasilitas] = useState("");
  const [namaFasilitasCustom, setNamaFasilitasCustom] = useState("");
  const [kodeInventaris, setKodeInventaris] = useState("");
  const [kondisiFasilitas, setKondisiFasilitas] = useState("");
  const [kondisiFasilitasCustom, setKondisiFasilitasCustom] = useState("");
  const [penanggungJawabFasilitas, setPenanggungJawabFasilitas] = useState("");
  const [penanggungJawabFasilitasCustom, setPenanggungJawabFasilitasCustom] =
    useState("");
  const [adaKorban, setAdaKorban] = useState("");

  // Step 2
  const [tanggalKejadian, setTanggalKejadian] = useState("");
  const [lokasiKejadian, setLokasiKejadian] = useState("");
  const [lokasiKejadianCustom, setLokasiKejadianCustom] = useState("");
  const [unitPenyebab, setUnitPenyebab] = useState("");
  const [unitPenyebabCustom, setUnitPenyebabCustom] = useState("");
  const [pihakTerlibat, setPihakTerlibat] = useState([]);
  const [spesialisasiTerkait, setSpesialisasiTerkait] = useState("");
  const [spesialisasiTerkaitCustom, setSpesialisasiTerkaitCustom] =
    useState("");
  const [kronologiSingkat, setKronologiSingkat] = useState("");
  const [dampakTerjadi, setDampakTerjadi] = useState("");
  const [probabilitas, setProbabilitas] = useState("");
  const [akibatInsiden, setAkibatInsiden] = useState("");
  const [gradingKeparahan, setGradingKeparahan] = useState("");
  // Step 2 - Fasilitas tambahan
  const [kategoriKerusakan, setKategoriKerusakan] = useState("");
  const [kategoriKerusakanCustom, setKategoriKerusakanCustom] = useState("");
  const [statusPenangananAwal, setStatusPenangananAwal] = useState("");
  const [tindakanDarurat, setTindakanDarurat] = useState("");

  // Step 3
  const [tindakanDilakukan, setTindakanDilakukan] = useState("");
  const [tindakanDilakukanOleh, setTindakanDilakukanOleh] = useState("");
  const [kejadianSerupaTerjadi, setKejadianSerupaTerjadi] = useState("Tidak");
  const [kejadianSerupaDetail, setKejadianSerupaDetail] = useState("");
  const [akarPenyebab, setAkarPenyebab] = useState("");
  const [rekomendasi, setRekomendasi] = useState("");

  // Step 4
  const [jenisInsiden, setJenisInsiden] = useState("");

  const [notification, setNotification] = useState(null);
  const [errors, setErrors] = useState({});

  // Step 4 - Lampiran (foto/dokumen bukti insiden, opsional)
  const [lampiran, setLampiran] = useState([]); // array of File
  const [lampiranError, setLampiranError] = useState(null);

  // Status pengiriman ke backend (sekarang API sungguhan, bukan dummy lagi
  // — bisa gagal, jadi butuh loading + error state)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // State layar sukses setelah laporan dikirim
  const [submitted, setSubmitted] = useState(false);

  // ID laporan — hanya untuk kebutuhan admin/backend, tidak ditampilkan ke user
  const [laporanId, setLaporanId] = useState("");

  useEffect(() => {
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now - tzoffset).toISOString().slice(0, 16);
    setTanggalMasuk(localISOTime);
  }, []);

  const steps = [
    { id: 1, label: "Data Insiden" },
    { id: 2, label: "Kronologi" },
    { id: 3, label: "Analisis" },
    { id: 4, label: "Review" },
  ];

  const showNotification = (message, type = "success", durationMs = 4000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), durationMs);
  };

  // ── Lampiran (foto/dokumen bukti insiden) ────────────────────────────────
  // Validasi per-file: max 5MB, jpg/png/pdf saja (aturan dari backend).
  const handleAddLampiran = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setLampiranError(null);
    const diterima = [];
    for (const file of files) {
      const pesanError = validasiLampiran(file);
      if (pesanError) {
        setLampiranError(pesanError);
        continue;
      }
      diterima.push(file);
    }
    if (diterima.length > 0) {
      setLampiran((prev) => [...prev, ...diterima]);
    }
  };

  const handleRemoveLampiran = (idx) => {
    setLampiran((prev) => prev.filter((_, i) => i !== idx));
    setLampiranError(null);
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (melibatkanPasien === null) {
      newErrors.melibatkanPasien = "Pilih tipe insiden terlebih dahulu";
    } else if (melibatkanPasien === true) {
      if (!ruangan) newErrors.ruangan = "Pilih ruangan atau unit rawat";
      else if (ruangan === "Lain-Lain" && !ruanganCustom.trim())
        newErrors.ruangan = "Tuliskan nama ruangan/unit";
      if (!tanggalLahir) newErrors.tanggalLahir = "Tanggal lahir wajib diisi";
      if (!jenisKelamin) newErrors.jenisKelamin = "Pilih jenis kelamin";
      if (!statusPasien)
        newErrors.statusPasien = "Pilih status pasien saat insiden";
      if (!tanggalMasuk)
        newErrors.tanggalMasuk = "Pilih tanggal & jam masuk RS";
    } else {
      if (!kategoriFasilitas)
        newErrors.kategoriFasilitas = "Pilih kategori fasilitas";
      else if (
        kategoriFasilitas === "Lain-lain" &&
        !kategoriFasilitasCustom.trim()
      )
        newErrors.kategoriFasilitas = "Tuliskan kategori fasilitas/alat";
      if (!namaFasilitas) newErrors.namaFasilitas = "Pilih nama fasilitas/alat";
      else if (namaFasilitas === "Lain-lain" && !namaFasilitasCustom.trim())
        newErrors.namaFasilitas = "Tuliskan nama fasilitas/alat";
      if (!kondisiFasilitas)
        newErrors.kondisiFasilitas = "Pilih kondisi fasilitas saat insiden";
      else if (
        kondisiFasilitas === "Lain-lain" &&
        !kondisiFasilitasCustom.trim()
      )
        newErrors.kondisiFasilitas = "Tuliskan kondisi saat insiden";
      if (!penanggungJawabFasilitas)
        newErrors.penanggungJawabFasilitas = "Pilih penanggung jawab";
      else if (
        penanggungJawabFasilitas === "Lain-lain" &&
        !penanggungJawabFasilitasCustom.trim()
      )
        newErrors.penanggungJawabFasilitas =
          "Tuliskan penanggung jawab area/alat";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!tanggalKejadian)
      newErrors.tanggalKejadian = "Tanggal & waktu kejadian wajib diisi";
    if (!lokasiKejadian)
      newErrors.lokasiKejadian = "Lokasi/unit kerja kejadian wajib diisi";
    else if (lokasiKejadian === "Lain-Lain" && !lokasiKejadianCustom.trim())
      newErrors.lokasiKejadian = "Tuliskan lokasi/unit kerja kejadian";
    if (!kronologiSingkat.trim())
      newErrors.kronologiSingkat = "Kronologi singkat kejadian wajib diisi";
    if (!dampakTerjadi) newErrors.dampakTerjadi = "Pilih tingkat dampak";
    if (!probabilitas) newErrors.probabilitas = "Pilih probabilitas kejadian";
    if (!jenisInsiden) newErrors.jenisInsiden = "Pilih jenis insiden";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!tindakanDilakukan.trim())
      newErrors.tindakanDilakukan = "Tindakan yang dilakukan wajib diisi";
    if (!akarPenyebab.trim())
      newErrors.akarPenyebab = "Akar penyebab masalah wajib diisi";
    if (!rekomendasi.trim())
      newErrors.rekomendasi = "Rekomendasi/Solusi wajib diisi";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else
        showNotification(
          "Harap lengkapi semua field yang wajib diisi.",
          "error",
        );
    } else if (step === 2) {
      if (validateStep2()) {
        setStep(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else
        showNotification(
          "Harap lengkapi semua field yang wajib diisi.",
          "error",
        );
    } else if (step === 3) {
      const totalUkuranLampiran = lampiran.reduce(
        (total, file) => total + file.size,
        0,
      );
      if (totalUkuranLampiran > MAX_TOTAL_LAMPIRAN_SIZE) {
        const pesanError =
          "Total ukuran lampiran melebihi 25 MB. Hapus beberapa file atau pilih file yang lebih kecil sebelum melanjutkan.";
        setLampiranError(pesanError);
        showNotification(pesanError, "error");
        return;
      }
      setLampiranError(null);

      if (validateStep3()) {
        setStep(4);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else
        showNotification(
          "Harap lengkapi semua field yang wajib diisi.",
          "error",
        );
    } else if (step === 4) {
      // Payload di sini HANYA data mentah dari form. Perhitungan
      // gradingAwal/gradingSaatIni/jenisInvestigasi & penentuan status
      // awal sengaja TIDAK dilakukan di sini — itu tanggung jawab
      // buatlaporanService.js (kirimLaporan), supaya kalau logic
      // enrichment-nya berubah nanti, cukup ubah file service tanpa
      // menyentuh halaman ini lagi.
      const payload = {
        melibatkanPasien,

        dataPasien: melibatkanPasien
          ? {
              namaPasien,
              noMR,
              ruangan,
              ruanganCustom,
              tanggalLahir,
              jenisKelamin,
              statusPasien,
              penanggungBiaya,
              penanggungBiayaCustom,
              tanggalMasuk,
              kategoriPelapor,
              kategoriPelaporCustom,
              namaPelapor,
            }
          : null,

        dataFasilitas: !melibatkanPasien
          ? {
              kategoriFasilitas,
              kategoriFasilitasCustom,
              namaFasilitas,
              namaFasilitasCustom,
              kodeInventaris,
              kondisiFasilitas,
              kondisiFasilitasCustom,
              penanggungJawabFasilitas,
              penanggungJawabFasilitasCustom,
              adaKorban,
            }
          : null,

        kronologi: {
          tanggalKejadian,
          lokasiKejadian,
          lokasiKejadianCustom,
          unitPenyebab,
          unitPenyebabCustom,
          pihakTerlibat,
          spesialisasiTerkait,
          spesialisasiTerkaitCustom,
          kronologiSingkat,
          jenisInsiden,
          // Field tambahan khusus insiden fasilitas
          ...(!melibatkanPasien && {
            kategoriKerusakan,
            kategoriKerusakanCustom,
            statusPenangananAwal,
            tindakanDarurat,
          }),
        },

        analisis: {
          tindakanDilakukan,
          tindakanDilakukanOleh,
          kejadianSerupaTerjadi,
          kejadianSerupaDetail,
          akarPenyebab,
          rekomendasi,
        },

        // Data mentah grading — dampak & probabilitas adalah sumber
        // kebenaran; gradingKeparahan ikut dikirim untuk cross-check saja.
        // Service yang menentukan gradingAwal/gradingSaatIni/jenisInvestigasi.
        grading: {
          dampak: dampakTerjadi,
          probabilitas,
          akibatInsiden,
          gradingKeparahan,
        },
      };

      setIsSubmitting(true);
      setSubmitError(null);
      try {
        const result = await kirimLaporan(payload, lampiran);
        setLaporanId(result.id);

        // ⚠️ FIX 24 Juli 2026 — SEBELUMNYA result.lampiranGagal dari
        // kirimLaporan() diabaikan total di sini: laporan tetap dianggap
        // "berhasil" (setSubmitted(true)) walau ada lampiran yang gagal
        // diupload ke backend, jadi user tidak pernah tahu foto/dokumen
        // buktinya sebenarnya tidak kesimpan. Sekarang ditampilkan
        // sebagai notifikasi terpisah supaya user sadar & bisa upload
        // ulang lampirannya nanti (mis. lewat halaman detail laporan,
        // kalau fitur itu ada — kalau belum ada, minimal user tahu harus
        // lapor manual ke admin).
        if (result.lampiranGagal && result.lampiranGagal.length > 0) {
          showNotification(
            `Laporan berhasil dikirim, tapi ${result.lampiranGagal.length} lampiran gagal diupload (${result.lampiranGagal.join(", ")}). Silakan hubungi admin untuk menambahkan lampiran tersebut.`,
            "error",
            8000,
          );
        }

        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        setSubmitError(
          err.message || "Gagal mengirim laporan. Silakan coba lagi.",
        );
        showNotification(
          "Gagal mengirim laporan. Periksa koneksi lalu coba lagi.",
          "error",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    // Di step 1 tidak ada lagi halaman "beranda" untuk dituju, jadi tombol
    // kembali tidak ditampilkan sama sekali di step 1 (lihat Footer Tombol).
  };

  const handleEditStep = (stepNumber) => {
    setStep(stepNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveDraft = () => {
    showNotification("Draft laporan berhasil disimpan sementara.", "success");
  };

  // ── RESET FORM SETELAH SUBMIT ───────────────────────────────────────────
  // Karena tidak ada lagi halaman "Laporan Saya"/"Beranda" untuk dituju,
  // setelah laporan terkirim nakes berikutnya bisa langsung mulai laporan
  // baru dari form kosong (cocok untuk pemakaian anonim/QR di satu
  // perangkat bersama, misal tablet di ruangan/unit).
  const handleReset = () => {
    setStep(1);
    setMelibatkanPasien(true);

    setNamaPasien("");
    setNoMR("");
    setRuangan("");
    setRuanganCustom("");
    setTanggalLahir("");
    setJenisKelamin("");
    setStatusPasien("");
    setPenanggungBiaya("JKN (BPJS Kesehatan)");
    setPenanggungBiayaCustom("");
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    setTanggalMasuk(new Date(now - tzoffset).toISOString().slice(0, 16));
    setKategoriPelapor("Karyawan - Dokter");
    setKategoriPelaporCustom("");
    setNamaPelapor("");

    setKategoriFasilitas("");
    setKategoriFasilitasCustom("");
    setNamaFasilitas("");
    setNamaFasilitasCustom("");
    setKodeInventaris("");
    setKondisiFasilitas("");
    setKondisiFasilitasCustom("");
    setPenanggungJawabFasilitas("");
    setPenanggungJawabFasilitasCustom("");
    setAdaKorban("");

    setTanggalKejadian("");
    setLokasiKejadian("");
    setLokasiKejadianCustom("");
    setUnitPenyebab("");
    setUnitPenyebabCustom("");
    setPihakTerlibat([]);
    setSpesialisasiTerkait("");
    setSpesialisasiTerkaitCustom("");
    setKronologiSingkat("");
    setDampakTerjadi("");
    setAkibatInsiden("");
    setGradingKeparahan("");
    setKategoriKerusakan("");
    setKategoriKerusakanCustom("");
    setStatusPenangananAwal("");
    setTindakanDarurat("");

    setTindakanDilakukan("");
    setTindakanDilakukanOleh("");
    setKejadianSerupaTerjadi("Tidak");
    setKejadianSerupaDetail("");
    setAkarPenyebab("");
    setRekomendasi("");

    setJenisInsiden("");

    setLampiran([]);
    setLampiranError(null);
    setSubmitError(null);

    setLaporanId("");
    setErrors({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      {/* Toast */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${notification.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {notification.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {submitted ? (
        /* ── Layar Sukses Setelah Laporan Terkirim ─────────────────────── */
        <div className="flex min-h-[75vh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-lg rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm sm:p-10">
            {/* Icon Sukses */}
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                <CheckCircle2 className="h-7 w-7 text-white" />
              </div>
            </div>

            <h1 className="mb-5 text-xl font-bold text-slate-800 sm:text-2xl">
              Laporan Anda Berhasil Dikirim!
            </h1>

            <p className="mb-8 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Terima kasih, laporan Anda telah kami terima dan akan segera
              ditinjau oleh Admin (Unit Mutu). Data yang Anda kirimkan bersifat
              rahasia dan hanya digunakan untuk keperluan investigasi serta
              peningkatan Mutu dan keselamatan pasien.
            </p>

            {/* Tombol Aksi */}
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-200 transition hover:bg-blue-700 active:scale-95 sm:text-sm"
              >
                <RotateCcw className="h-4 w-4" />
                Buat Laporan Baru
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Judul Halaman */}
          <div className="mb-5">
            <h1 className="text-xs font-bold text-blue-600 sm:text-sm">
              Buat Laporan Baru
            </h1>
          </div>

          {/* Stepper */}
          <div className="mb-8 w-full max-w-4xl mx-auto px-2">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-0 right-0 top-[18px] h-[2px] bg-slate-200 -translate-y-1/2 z-0" />
              <div
                className="absolute left-0 top-[18px] h-[2px] bg-blue-600 -translate-y-1/2 transition-all duration-500 z-0"
                style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
              />
              {steps.map((s) => {
                const isCurrent = s.id === step;
                const isCompleted = s.id < step;
                return (
                  <div
                    key={s.id}
                    className="relative z-10 flex flex-col items-center"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (s.id < step) setStep(s.id);
                      }}
                      disabled={s.id > step}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold border-2 transition-all cursor-pointer ${isCurrent ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200 scale-110" : isCompleted ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-400"}`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 fill-blue-600 text-white" />
                      ) : (
                        s.id
                      )}
                    </button>
                    <span
                      className={`mt-2 text-[10px] sm:text-xs font-semibold text-center whitespace-nowrap transition-colors ${isCurrent ? "text-blue-600 font-bold" : "text-slate-400"}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="mx-auto max-w-5xl">
            {step === 1 && (
              <FormStep1
                melibatkanPasien={melibatkanPasien}
                setMelibatkanPasien={setMelibatkanPasien}
                namaPasien={namaPasien}
                setNamaPasien={setNamaPasien}
                noMR={noMR}
                setNoMR={setNoMR}
                ruangan={ruangan}
                setRuangan={setRuangan}
                ruanganCustom={ruanganCustom}
                setRuanganCustom={setRuanganCustom}
                tanggalLahir={tanggalLahir}
                setTanggalLahir={setTanggalLahir}
                jenisKelamin={jenisKelamin}
                setJenisKelamin={setJenisKelamin}
                statusPasien={statusPasien}
                setStatusPasien={setStatusPasien}
                penanggungBiaya={penanggungBiaya}
                setPenanggungBiaya={setPenanggungBiaya}
                penanggungBiayaCustom={penanggungBiayaCustom}
                setPenanggungBiayaCustom={setPenanggungBiayaCustom}
                tanggalMasuk={tanggalMasuk}
                setTanggalMasuk={setTanggalMasuk}
                kategoriPelapor={kategoriPelapor}
                setKategoriPelapor={setKategoriPelapor}
                kategoriPelaporCustom={kategoriPelaporCustom}
                setKategoriPelaporCustom={setKategoriPelaporCustom}
                namaPelapor={namaPelapor}
                setNamaPelapor={setNamaPelapor}
                kategoriFasilitas={kategoriFasilitas}
                setKategoriFasilitas={setKategoriFasilitas}
                kategoriFasilitasCustom={kategoriFasilitasCustom}
                setKategoriFasilitasCustom={setKategoriFasilitasCustom}
                namaFasilitas={namaFasilitas}
                setNamaFasilitas={setNamaFasilitas}
                namaFasilitasCustom={namaFasilitasCustom}
                setNamaFasilitasCustom={setNamaFasilitasCustom}
                kodeInventaris={kodeInventaris}
                setKodeInventaris={setKodeInventaris}
                kondisiFasilitas={kondisiFasilitas}
                setKondisiFasilitas={setKondisiFasilitas}
                kondisiFasilitasCustom={kondisiFasilitasCustom}
                setKondisiFasilitasCustom={setKondisiFasilitasCustom}
                penanggungJawabFasilitas={penanggungJawabFasilitas}
                setPenanggungJawabFasilitas={setPenanggungJawabFasilitas}
                penanggungJawabFasilitasCustom={penanggungJawabFasilitasCustom}
                setPenanggungJawabFasilitasCustom={
                  setPenanggungJawabFasilitasCustom
                }
                adaKorban={adaKorban}
                setAdaKorban={setAdaKorban}
                errors={errors}
                setErrors={setErrors}
              />
            )}

            {step === 2 && (
              <FormStep2
                melibatkanPasien={melibatkanPasien}
                tanggalKejadian={tanggalKejadian}
                setTanggalKejadian={setTanggalKejadian}
                lokasiKejadian={lokasiKejadian}
                setLokasiKejadian={setLokasiKejadian}
                lokasiKejadianCustom={lokasiKejadianCustom}
                setLokasiKejadianCustom={setLokasiKejadianCustom}
                unitPenyebab={unitPenyebab}
                setUnitPenyebab={setUnitPenyebab}
                unitPenyebabCustom={unitPenyebabCustom}
                setUnitPenyebabCustom={setUnitPenyebabCustom}
                pihakTerlibat={pihakTerlibat}
                setPihakTerlibat={setPihakTerlibat}
                spesialisasiTerkait={spesialisasiTerkait}
                setSpesialisasiTerkait={setSpesialisasiTerkait}
                spesialisasiTerkaitCustom={spesialisasiTerkaitCustom}
                setSpesialisasiTerkaitCustom={setSpesialisasiTerkaitCustom}
                kronologiSingkat={kronologiSingkat}
                setKronologiSingkat={setKronologiSingkat}
                dampakTerjadi={dampakTerjadi}
                setDampakTerjadi={setDampakTerjadi}
                probabilitas={probabilitas}
                setProbabilitas={setProbabilitas}
                akibatInsiden={akibatInsiden}
                setAkibatInsiden={setAkibatInsiden}
                gradingKeparahan={gradingKeparahan}
                setGradingKeparahan={setGradingKeparahan}
                jenisInsiden={jenisInsiden}
                setJenisInsiden={setJenisInsiden}
                kategoriKerusakan={kategoriKerusakan}
                setKategoriKerusakan={setKategoriKerusakan}
                kategoriKerusakanCustom={kategoriKerusakanCustom}
                setKategoriKerusakanCustom={setKategoriKerusakanCustom}
                statusPenangananAwal={statusPenangananAwal}
                setStatusPenangananAwal={setStatusPenangananAwal}
                tindakanDarurat={tindakanDarurat}
                setTindakanDarurat={setTindakanDarurat}
                errors={errors}
                setErrors={setErrors}
              />
            )}

            {step === 3 && (
              <FormStep3
                tindakanDilakukan={tindakanDilakukan}
                setTindakanDilakukan={setTindakanDilakukan}
                tindakanDilakukanOleh={tindakanDilakukanOleh}
                setTindakanDilakukanOleh={setTindakanDilakukanOleh}
                kejadianSerupaTerjadi={kejadianSerupaTerjadi}
                setKejadianSerupaTerjadi={setKejadianSerupaTerjadi}
                kejadianSerupaDetail={kejadianSerupaDetail}
                setKejadianSerupaDetail={setKejadianSerupaDetail}
                akarPenyebab={akarPenyebab}
                setAkarPenyebab={setAkarPenyebab}
                rekomendasi={rekomendasi}
                setRekomendasi={setRekomendasi}
                lampiran={lampiran}
                lampiranError={lampiranError}
                handleAddLampiran={handleAddLampiran}
                handleRemoveLampiran={handleRemoveLampiran}
                errors={errors}
                setErrors={setErrors}
                handleNext={handleNext}
                handleBack={handleBack}
              />
            )}

            {step === 4 && (
              <>
                {/* Status pengiriman - kirimLaporan() sekarang API
                    sungguhan (bisa gagal), jadi butuh feedback loading &
                    error di sini. Tombol kirim sungguhan ada di dalam
                    FormStep4 (halaman review) - sudah menerima prop
                    isSubmitting dan tombolnya sudah otomatis ter-disable
                    + menampilkan spinner "Mengirim..." saat isSubmitting
                    true, jadi tidak bisa diklik dobel. */}
                {isSubmitting && (
                  <div className="mb-5 flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengirim laporan...
                  </div>
                )}
                {submitError && (
                  <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                <FormStep4
                  melibatkanPasien={melibatkanPasien}
                  namaPasien={namaPasien}
                  noMR={noMR}
                  ruangan={ruangan}
                  ruanganCustom={ruanganCustom}
                  tanggalLahir={tanggalLahir}
                  jenisKelamin={jenisKelamin}
                  statusPasien={statusPasien}
                  penanggungBiaya={penanggungBiaya}
                  tanggalMasuk={tanggalMasuk}
                  kategoriPelapor={kategoriPelapor}
                  namaPelapor={namaPelapor}
                  kategoriFasilitas={kategoriFasilitas}
                  kategoriFasilitasCustom={kategoriFasilitasCustom}
                  namaFasilitas={namaFasilitas}
                  namaFasilitasCustom={namaFasilitasCustom}
                  kodeInventaris={kodeInventaris}
                  kondisiFasilitas={kondisiFasilitas}
                  kondisiFasilitasCustom={kondisiFasilitasCustom}
                  penanggungJawabFasilitas={penanggungJawabFasilitas}
                  penanggungJawabFasilitasCustom={
                    penanggungJawabFasilitasCustom
                  }
                  adaKorban={adaKorban}
                  tanggalKejadian={tanggalKejadian}
                  lokasiKejadian={lokasiKejadian}
                  lokasiKejadianCustom={lokasiKejadianCustom}
                  kronologiSingkat={kronologiSingkat}
                  dampakTerjadi={dampakTerjadi}
                  probabilitas={probabilitas}
                  akibatInsiden={akibatInsiden}
                  gradingKeparahan={gradingKeparahan}
                  tindakanDilakukan={tindakanDilakukan}
                  akarPenyebab={akarPenyebab}
                  rekomendasi={rekomendasi}
                  jenisInsiden={jenisInsiden}
                  errors={errors}
                  setErrors={setErrors}
                  handleNext={handleNext}
                  handleBack={handleBack}
                  onEditStep={handleEditStep}
                  isSubmitting={isSubmitting}
                />
              </>
            )}

            {/* Footer Tombol */}
            {step !== 4 && (
              <div className="border-t border-slate-200 pt-6 mt-8 flex justify-between items-center">
                {step === 1 ? (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="border border-blue-600 text-blue-600 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold hover:bg-blue-50/50 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    Simpan sebagai Draft
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="border border-slate-200 text-slate-600 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-sm"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-blue-200 active:scale-95"
                >
                  Lanjutkan
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <FormChatbot step={step} />
    </div>
  );
}
