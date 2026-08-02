import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Trash2,
  MessageSquare,
  Info,
  X,
  FileText,
  Printer,
} from "lucide-react";
import * as detailLaporanService from "../../services/admin/detailLaporanService";
import {
  GRADING_IDS,
  STATUS,
  STATUS_STEPPER_ORDER,
  jenisInvestigasiTerkunci,
  normalisasiGradingId,
  getGradingStyle,
  tentukanJenisInvestigasiDariLaporan,
  gradingIdKeWarna,
} from "../../lib/grading";

// ── Helper format tanggal: "2026-07-21T00:00:00.000Z" → "21 Jul 2026" ──
// Field tanggal dari backend (createdAt, tanggalKejadian, dst) selalu
// ISO string mentah — ditampilkan apa adanya sebelumnya bikin tampilan
// gak jelas/berantakan. Sama seperti helper di ManajemenInsidenPage.jsx.
function formatTanggal(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Helper format waktu lengkap (tanggal + jam) untuk entri Aktivitas
// Terakhir, mis. "24 Jul 2026, 14:22".
function formatWaktuAktivitas(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS = {
  [STATUS.SUBMITTED]: "Baru",
  [STATUS.MENUNGGU_VERIFIKASI]: "Ditinjau",
  [STATUS.DALAM_INVESTIGASI]: "Investigasi",
  [STATUS.SELESAI]: "Selesai",
};

// ── Helper: normalisasi 1 entri histori aktivitas ke bentuk internal
// { text, time, by } yang dipakai render (lihat komponen Aktivitas
// Terakhir), TIDAK PEDULI entri itu datang dari mana:
//   (a) GET /admin/reports/:id → laporan.histories[] (bentuk ASLI
//       backend, dikonfirmasi 24 Juli 2026 dari response nyata):
//       { aksi: "UPDATE", perubahan: {...field yang dikirim di body PUT},
//       timestamp: isoString, actor: { nama } }. INI BUKAN kalimat siap
//       tampil — sebelumnya kode di sini langsung baca item.text/.time/
//       .by dari entri ini, yang selalu undefined, makanya bullet
//       "Aktivitas Terakhir" muncul tapi teksnya kosong semua.
//   (b) entri optimistic lokal dari tambahAktivitas() — SUDAH dalam
//       bentuk final { text, time, by }, ditambahkan ke state sebelum
//       refetch supaya terasa instan setelah aksi admin berhasil.
//
// ⚠️ Field `perubahan` dari backend TIDAK SELALU diff bersih 1 field —
// kadang isinya seluruh payload PUT yang dikirim (mis. dari
// saveLaporan(), yang mengirim seluruh objek laporan). Jadi 1 entri
// histori TIDAK BISA diasumsikan = 1 perubahan spesifik. Untuk sekarang
// dibedakan 2 kasus paling jelas & sering terjadi (status berubah
// sendirian, atau ada perubahan grading) → kalimat spesifik; sisanya
// fallback ke kalimat generik "Detail laporan diperbarui" — TIDAK
// menebak-nebak field spesifik mana yang berubah, karena data yang ada
// memang tidak menyediakan before/after per field.
function normalizeHistoryItem(raw) {
  if (!raw) return null;

  // (b) entri optimistic lokal — sudah final, pakai apa adanya.
  if (raw.text) return raw;

  const perubahan = raw.perubahan || {};
  const keys = Object.keys(perubahan);
  const pelaku = raw.actor?.nama || null;
  const waktu = formatWaktuAktivitas(raw.timestamp);

  let text;
  if (keys.length === 1 && keys[0] === "status") {
    const label = STATUS_LABELS[perubahan.status] || perubahan.status;
    text = `Status diubah menjadi "${label}"`;
  } else if (keys.includes("gradingFinal") || keys.includes("gradingBaru")) {
    text = "Grading laporan diperbarui";
  } else if (keys.length > 0) {
    text = "Detail laporan diperbarui";
  } else {
    text = raw.aksi || "Aktivitas tercatat";
  }

  return { text, time: waktu, by: pelaku, rawWaktu: raw.timestamp || null };
}

// ── Helper: ubah 1 entri feedback (sudah dinormalisasi normalizeFeedback)
// jadi bentuk aktivitas { text, time, by, rawWaktu } supaya bisa digabung
// & diurutkan bareng histori dari backend di daftar "Aktivitas Terakhir".
//
// KENAPA INI PERLU: pengiriman feedback (POST /reports/:id/feedback)
// TIDAK tercatat sama sekali di `histories` milik laporan (dikonfirmasi
// 24 Juli 2026 dari response asli — endpoint feedback beda total dari
// endpoint yang menghasilkan entri histories/audit UPDATE). Sebelumnya
// entri "Catatan ditambahkan oleh Admin Utama" cuma ditambah optimistic
// di tambahAktivitas() saat feedback baru dikirim, lalu HILANG lagi
// setelah halaman di-refresh (karena fetchDetail cuma pakai histories,
// yang memang tidak pernah punya entri feedback). Feedback sendiri sudah
// reliable diambil lewat getFeedbackList(), jadi digabung di sini supaya
// tetap muncul konsisten kapan pun halaman dibuka ulang.
function feedbackKeAktivitas(fbMentah) {
  const fb = normalizeFeedback(fbMentah);
  if (!fb) return null;
  const jenisLabel = fb.jenis === "MENGIKAT" ? "revisi (mengikat)" : "catatan";
  return {
    text: `Feedback (${jenisLabel}) dikirim oleh Admin Utama`,
    time: formatWaktuAktivitas(fb.waktu),
    by: fb.oleh || "Admin Utama",
    rawWaktu: fb.waktu || null,
  };
}

// ── Helper: normalisasi 1 entri feedback ke bentuk internal yang konsisten
// dipakai di render, TIDAK PEDULI entri itu datang dari mana:
//   (a) GET /admin/reports/:id → laporan.feedback[] (bentuk ASLI backend,
//       field `catatan` + `jenis` enum "MENGIKAT"/"ADVISORY", sesuai
//       detailLaporanService.js), atau
//   (b) hasil optimistic-append dari respons POST .../feedback tepat
//       setelah handleKirimFeedback berhasil (kemungkinan besar bentuknya
//       SAMA dengan (a), karena itu respons endpoint yang sama, TAPI
//       belum pernah dikonfirmasi langsung ke payload asli backend).
//
// BUG LAMA yang diperbaiki di sini: render sebelumnya baca fb.isi /
// fb.oleh / fb.jenis==="revisi" — itu nama field dummy lama yang TIDAK
// PERNAH cocok dengan field asli backend (catatan/jenis MENGIKAT|
// ADVISORY), jadi daftar feedback yang datang dari backend (bukan hasil
// optimistic lokal) akan tampil kosong/undefined.
//
// ⚠️ Field pengirim (`oleh`) masih TEBAKAN — spec tidak dokumentasikan
// nama field ini di response backend. Daftar kandidat di bawah dicoba
// berurutan; kalau semua kosong, baris "— oleh siapa" sengaja disembunyikan
// (lihat pemakaian di render) daripada tampil "— undefined". PERLU
// DIKONFIRMASI ke tim BE field yang benar begitu contoh response asli ada.
function normalizeFeedback(fb) {
  if (!fb) return null;
  return {
    catatan: fb.catatan ?? fb.isi ?? "",
    // Terima kedua kemungkinan nilai ("MENGIKAT" dari backend ATAU
    // "revisi" dari data lama/lokal) supaya tidak putus kalau ada data
    // campuran selama transisi.
    jenis:
      fb.jenis === "MENGIKAT" || fb.jenis === "revisi"
        ? "MENGIKAT"
        : "ADVISORY",
    waktu: fb.waktu ?? fb.createdAt ?? fb.tanggalDibuat ?? fb.tanggal ?? null,
    oleh:
      fb.oleh ??
      fb.dibuatOleh ??
      fb.pengirim ??
      fb.adminNama ??
      fb.namaAdmin ??
      fb.admin?.nama ??
      fb.createdBy?.nama ??
      null,
  };
}

// ── Label level "Dampak terhadap Pasien" — field backend cuma balikin
// angka mentah (1-5), padahal itu skala Dampak Klinis/Konsekuensi/
// Severity standar RS (sesuai matriks grading risiko resmi). Dipetakan
// di sini biar gak cuma nampilin angka doang tanpa konteks.
const DAMPAK_LEVELS = {
  1: {
    label: "Insignificant",
    deskripsi: "Tidak ada cedera, kerugian keuangan kecil",
  },
  2: {
    label: "Minor",
    deskripsi: "Dapat diatasi dengan pertolongan pertama",
  },
  3: {
    label: "Moderate",
    deskripsi:
      "Berkurangnya fungsi motorik/sensorik/psikologis atau intelektual secara semipermanen/reguler, tidak berhubungan dengan penyakit",
  },
  4: {
    label: "Major",
    deskripsi:
      "Cedera luas; kehilangan fungsi utama permanen (motorik, sensorik, psikologis, intelektual), tidak berhubungan dengan penyakit",
  },
  5: {
    label: "Catastrophic",
    deskripsi: "Kematian yang tidak berhubungan dengan perjalanan penyakit",
  },
};

function labelDampak(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  return DAMPAK_LEVELS[Number(nilai)] || null;
}

// ── Helper tampilan: satu pasang label-nilai, dipakai berulang di seksi
// "Informasi Lengkap Laporan" supaya markup-nya konsisten & tidak
// berulang-ulang. `fullWidth` dipakai untuk nilai yang berupa paragraf
// panjang (kronologi, tindakan, dsb) supaya tidak dipaksa 2 kolom.
function Field({ label, value, fullWidth = false }) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-xs text-slate-500 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-slate-800 whitespace-pre-line break-words">
        {value || value === 0 ? value : "-"}
      </p>
    </div>
  );
}

// Field pihakTerlibat dari backend berbentuk array (checkbox multi-pilih
// di form) — gabungkan jadi teks biar gampang ditampilkan.
function formatDaftar(nilai) {
  if (!nilai) return null;
  if (Array.isArray(nilai)) return nilai.length ? nilai.join(", ") : null;
  return nilai;
}

// ── Helper: format field boolean asli dari backend (mis. `adaKorban`) jadi
// "Ya"/"Tidak" yang enak dibaca. WAJIB dipakai untuk field boolean, JANGAN
// dikirim langsung ke <Field value=... /> — komponen Field itu treat
// `false` sebagai "kosong" (pakai `value || value === 0`) jadi tampil "-"
// alih-alih "Tidak", dan `true` akan tampil literal teks "true" kalau tidak
// dilewatkan lewat sini dulu. `null`/`undefined` (field belum diisi/bukan
// laporan fasilitas) tetap dibiarkan null supaya Field tampilkan "-" seperti
// biasa.
function formatBoolean(nilai) {
  if (nilai === null || nilai === undefined) return null;
  return nilai ? "Ya" : "Tidak";
}

export default function DetailLaporanPage({ onNavigate, laporanId, user }) {
  // Gating role pakai pola yang sama persis dengan AdminNavMenu.jsx —
  // supaya konsisten dengan cara "Manajemen Pengguna" di-gate di sana.
  const isSuperAdmin = user?.role === "ADMIN_UTAMA";

  // ── State Laporan - diambil dari backend (fetch by ID) ──
  const [laporan, setLaporan] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [notification, setNotification] = useState(null);
  const [investigatorInput, setInvestigatorInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [originalStatus, setOriginalStatus] = useState(null);

  const [newGrading, setNewGrading] = useState("");
  const [gradingReason, setGradingReason] = useState("");

  const [feedbackInput, setFeedbackInput] = useState("");

  const [showFinishModal, setShowFinishModal] = useState(false);
  const [agreeFinish, setAgreeFinish] = useState(false);

  // ------------------------------------------------------------
  // Ambil detail laporan + aktivitas terakhir.
  // Sumber data sekarang: dummy (lihat detailLaporanService.js).
  // ------------------------------------------------------------
  const fetchDetail = useCallback(async (id) => {
    setIsLoading(true);
    setError(null);
    try {
      // PENTING: detailLaporanService.getLaporanDetail() mengembalikan
      // objek laporan LANGSUNG (hasil unwrap res.data.data), bukan
      // dibungkus { laporan, recentActivity }. Field aktivitas juga
      // namanya `histories` di response asli, bukan `recentActivity`.
      // (Sebelumnya di sini baca result.laporan — selalu undefined,
      // makanya halaman selalu render kosong walau fetch-nya sukses.)
      // laporan.jenisInvestigasi TIDAK ADA di response API — backend
      // tidak menyimpan field ini sama sekali (dikonfirmasi di komentar
      // updateGrading() pada detailLaporanService.js). Makanya field ini
      // dihitung SEKALI di sini saat fetch, lalu disimpan sebagai field
      // biasa di state `laporan` — supaya bisa "dikunci" (tidak ikut
      // berubah otomatis) setelah investigasi berjalan, sesuai
      // terapkanRegrading(). Kalau field ini dihitung ulang dari grading
      // di setiap render (bukan disimpan), mekanisme lock jadi tidak ada
      // artinya — regrading pas status terkunci akan tetap mengubah
      // jalur investigasi di layar, padahal UI menjanjikan sebaliknya.
      const result = await detailLaporanService.getLaporanDetail(id);

      // 🔧 FIX 23 Juli 2026 (bug "feedback yang dikirim Admin Utama tidak
      // muncul di sisi admin biasa"): sebelumnya di sini feedback CUMA
      // diambil dari `result.feedback` — field yang diasumsikan ikut
      // terbawa dari GET /admin/reports/:id, padahal asumsi itu SENDIRI
      // belum pernah dikonfirmasi ke payload asli backend (lihat komentar
      // normalizeFeedback di atas). Kenapa bug ini tidak ketahuan dari
      // sisi Admin Utama: begitu Admin Utama kirim feedback, hasilnya
      // di-APPEND OPTIMISTIS ke state lokal (lihat handleKirimFeedback),
      // BUKAN dari fetch ulang — jadi selalu kelihatan berhasil di layar
      // Admin Utama sendiri, walau ternyata field `result.feedback` dari
      // GET report memang kosong/tidak ada. Begitu admin biasa buka
      // laporan yang sama (fetch dari awal, tanpa append optimistis),
      // feedback yang sudah tersimpan di backend tidak pernah ketarik.
      //
      // Fix: tarik feedback dari endpoint KHUSUS yang memang dibuat untuk
      // ini (GET /reports/:reportId/feedback, lihat getFeedbackList() di
      // detailLaporanService.js) sebagai sumber utama. Fallback ke
      // `result.feedback` cuma kalau endpoint khusus ini gagal (mis.
      // belum ada di backend / 404) — supaya halaman tetap bisa jalan
      // walau endpointnya ternyata belum tersedia.
      let feedbackList = result?.feedback || [];
      try {
        const feedbackDariBackend =
          await detailLaporanService.getFeedbackList(id);
        if (Array.isArray(feedbackDariBackend)) {
          feedbackList = feedbackDariBackend;
        }
      } catch (errFeedback) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DetailLaporanPageAdmin] Gagal mengambil daftar feedback dari " +
            "GET /reports/:reportId/feedback — pakai field feedback dari " +
            "GET laporan (kalau ada) sebagai fallback.",
          errFeedback,
        );
      }

      const jenisInvestigasiAwal = tentukanJenisInvestigasiDariLaporan(result);
      setLaporan({
        ...result,
        jenisInvestigasi: jenisInvestigasiAwal?.id ?? null,
        // Normalisasi feedback dari backend (field catatan/jenis MENGIKAT|
        // ADVISORY) ke bentuk internal konsisten — lihat normalizeFeedback().
        feedback: feedbackList.map(normalizeFeedback).filter(Boolean),
      });
      const historyActivities = (result?.histories || [])
        .map(normalizeHistoryItem)
        .filter(Boolean);
      const feedbackActivities = feedbackList
        .map(feedbackKeAktivitas)
        .filter(Boolean);
      const semuaAktivitas = [...historyActivities, ...feedbackActivities].sort(
        (a, b) => new Date(b.rawWaktu || 0) - new Date(a.rawWaktu || 0),
      );
      setRecentActivity(semuaAktivitas);
      setOriginalStatus(result?.status ?? null);
    } catch (err) {
      setError(err.message || "Gagal memuat detail laporan.");
      setLaporan(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetail(laporanId);
  }, [laporanId, fetchDetail]);

  // Value pakai enum asli backend (lihat STATUS di lib/grading.js) —
  // sebelumnya di sini pakai "baru"/"ditinjau"/dst lowercase Indonesia,
  // yang gak pernah match dengan field laporan.status dari API
  // ("SUBMITTED" dst), makanya stepper & handleStatusChange dulu salah.
  //
  // Cuma 4 tahap ini yang direpresentasikan di stepper. Tiga nilai enum
  // lain SENGAJA tidak dimasukkan, sesuai keputusan produk:
  //   - DRAFT: dikonfirmasi tidak pernah muncul di halaman admin ini
  //     (laporan draft belum di-submit pelapor) — aman diabaikan,
  //     tidak butuh penanganan.
  //   - OVERDUE: bukan tahap terpisah, cuma badge/label tambahan di atas
  //     tahap yang sedang berjalan (lihat badge Overdue di bawah).
  //   - ARSIP: selalu terjadi SETELAH Selesai — direpresentasikan sebagai
  //     progress penuh + badge "Diarsipkan" (lihat statusUntukStepper &
  //     badge ARSIP di bawah), bukan tahap ke-5.
  const statusOptions = [
    { value: STATUS.SUBMITTED, label: "Baru", icon: AlertCircle },
    { value: STATUS.MENUNGGU_VERIFIKASI, label: "Ditinjau", icon: Clock },
    {
      value: STATUS.DALAM_INVESTIGASI,
      label: "Investigasi",
      icon: MessageSquare,
    },
    { value: STATUS.SELESAI, label: "Selesai", icon: CheckCircle2 },
  ];

  // ── Helper: tambah entri baru ke daftar aktivitas terakhir ──
  const tambahAktivitas = (text) => {
    const waktuSekarang = new Date().toLocaleString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    setRecentActivity((prev) => [
      { type: "status", text, time: `Hari ini, ${waktuSekarang}`, by: "Admin" },
      ...prev,
    ]);
  };

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleStatusChange = (newStatus) => {
    // Laporan yang sudah diarsip dianggap final — tidak boleh digeser
    // lagi lewat stepper (ARSIP selalu terjadi setelah Selesai, jadi
    // menggeser mundur ke tahap lain tidak masuk akal di alur ini).
    if (sudahDiarsip) {
      showNotif(
        "info",
        "Laporan ini sudah diarsipkan dan tidak bisa diubah lagi.",
      );
      return;
    }

    // Gating approval: laporan jalur RCA gak boleh ditutup ("selesai")
    // kecuali oleh Admin Utama. Admin biasa tetap bisa gerakin status
    // lain (baru/ditinjau/investigasi) seperti biasa.
    if (
      newStatus === STATUS.SELESAI &&
      laporan.jenisInvestigasi === "RCA" &&
      !isSuperAdmin
    ) {
      showNotif(
        "info",
        "Laporan RCA butuh persetujuan Admin Utama sebelum bisa diselesaikan. Tinggalkan feedback / minta Admin Utama untuk mereview.",
      );
      return;
    }

    // Perubahan tahap di sini masih lokal (belum tersimpan & belum masuk
    // Aktivitas Terakhir). Baru benar-benar disimpan & tercatat saat
    // admin klik "Simpan Perubahan" (lihat handleSimpanPerubahan).
    setLaporan({ ...laporan, status: newStatus });
  };

  const handleKirimFeedback = async () => {
    if (!feedbackInput.trim()) {
      showNotif("info", "Tuliskan isi feedback terlebih dahulu.");
      return;
    }
    try {
      // 🔧 FIX 23 Juli 2026: panel ini sekarang HANYA untuk pesan/catatan
      // biasa ke tim (jenis "catatan"/ADVISORY) — dropdown "Revisi" sudah
      // dihapus dari sini supaya tidak tumpang tindih/rancu dengan alur
      // approval RCA yang sesungguhnya (tombol "Setuju & Selesaikan" /
      // "Minta Revisi" di halaman Analisis Investigasi, lihat
      // handleKeputusanPersetujuan di DetailInvestigasiPage.jsx). Kalau
      // RCA butuh direvisi, itu keputusan resmi lewat alur approval sana,
      // bukan lewat kotak feedback bebas di sini.
      const hasil = await detailLaporanService.kirimFeedback(laporan.id, {
        isi: feedbackInput.trim(),
        oleh: user?.name || "Admin Utama",
        jenis: "catatan",
      });
      // Normalisasi hasil dari backend (jangan asumsikan field isi/oleh —
      // backend kemungkinan balikin catatan/jenis MENGIKAT|ADVISORY, lihat
      // catatan di detailLaporanService.js). Kalau backend TIDAK balikin
      // nama pengirim, fallback ke nama admin yang sedang login supaya
      // baris "— oleh" tidak hilang begitu saja setelah dikirim.
      const feedbackBaru = normalizeFeedback(hasil.feedback) || {
        catatan: feedbackInput.trim(),
        jenis: "ADVISORY",
        waktu: new Date().toISOString(),
        oleh: user?.name || "Admin Utama",
      };
      if (!feedbackBaru.oleh) {
        feedbackBaru.oleh = user?.name || "Admin Utama";
      }
      setLaporan({
        ...laporan,
        feedback: [feedbackBaru, ...(laporan.feedback || [])],
      });
      tambahAktivitas("Catatan ditambahkan oleh Admin Utama");
      showNotif("success", "Feedback berhasil dikirim.");
      setFeedbackInput("");
    } catch (err) {
      showNotif("info", err.message || "Gagal mengirim feedback.");
    }
  };

  const handleTugaskan = async () => {
    if (!investigatorInput.trim()) {
      showNotif("info", "Tuliskan nama investigator terlebih dahulu.");
      return;
    }
    const nama = investigatorInput.trim();
    try {
      await detailLaporanService.assignInvestigator(laporan.id, nama);
      setLaporan({ ...laporan, investigator: nama });
      tambahAktivitas(`Investigator ditugaskan: ${nama}`);
      showNotif(
        "success",
        `${nama} berhasil ditugaskan sebagai investigator utama.`,
      );
      setInvestigatorInput("");
    } catch (err) {
      showNotif("info", err.message || "Gagal menugaskan investigator.");
    }
  };

  const handleReGrading = async () => {
    if (!newGrading) {
      showNotif("info", "Silakan pilih grading baru.");
      return;
    }

    if (newGrading === gradingEfektifId) {
      showNotif("info", "Grading baru sama dengan grading saat ini.");
      return;
    }

    // Backend mewajibkan alasan minimal 10 karakter (dikonfirmasi di
    // detailLaporanService.js) — dicek di sini juga supaya admin dapat
    // feedback langsung, bukan nunggu request ditolak backend.
    if (gradingReason.trim().length < 10) {
      showNotif(
        "info",
        "Alasan perubahan grading wajib diisi, minimal 10 karakter.",
      );
      return;
    }

    try {
      const hasil = await detailLaporanService.updateGrading(
        laporan.id,
        newGrading,
        gradingReason,
        {
          statusSaatIni: laporan.status,
          jenisInvestigasiLama: laporan.jenisInvestigasi,
          jenisInsiden: laporan.jenisInsiden,
        },
      );

      const gradingLama = gradingEfektifId;
      setLaporan({
        ...laporan,
        // Field asli di laporan adalah gradingFinal (bukan "grading"),
        // dan backend simpan dalam format warna (MERAH/KUNING/dst), sama
        // seperti gradingAwal — jadi dikonversi dulu lewat
        // gradingIdKeWarna() supaya konsisten dengan format yang sudah
        // ada. jenisInvestigasi diambil dari hasil terapkanRegrading()
        // di service (sudah menghormati lock), BUKAN dihitung ulang di
        // sini dari grading baru.
        gradingFinal: gradingIdKeWarna(newGrading) || newGrading,
        jenisInvestigasi: hasil.jenisInvestigasi,
      });

      tambahAktivitas(`Re-Grading: ${gradingLama} → ${newGrading}`);

      if (hasil.terkunci) {
        showNotif(
          "success",
          "Grading berhasil diperbarui. Jenis investigasi tidak berubah karena investigasi sudah berjalan.",
        );
      } else if (hasil.berubahJalur) {
        showNotif(
          "success",
          `Grading berhasil diperbarui. Jenis investigasi otomatis berubah menjadi ${
            hasil.jenisInvestigasi === "RCA"
              ? "RCA (Komprehensif)"
              : "Sederhana"
          }.`,
        );
      } else {
        showNotif("success", "Grading berhasil diperbarui.");
      }

      setNewGrading("");
      setGradingReason("");
    } catch (err) {
      showNotif("info", err.message || "Gagal memperbarui grading.");
    }
  };

  const handleSimpanPerubahan = async () => {
    setIsSaving(true);
    const statusChanged = laporan.status !== originalStatus;
    try {
      if (statusChanged) {
        await detailLaporanService.updateStatusLaporan(
          laporan.id,
          laporan.status,
        );
      }
      await detailLaporanService.saveLaporan(laporan.id, laporan);

      if (statusChanged) {
        const label = statusOptions.find(
          (s) => s.value === laporan.status,
        )?.label;
        tambahAktivitas(`Status diubah menjadi "${label}"`);
        setOriginalStatus(laporan.status);
      }

      if (laporan.status === STATUS.SELESAI) {
        showNotif(
          "success",
          "Laporan berhasil diselesaikan dan dikirim ke pelapor.",
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        onNavigate?.("laporan-berhasil");
      } else {
        showNotif("success", "Perubahan laporan berhasil disimpan!");
      }
    } catch (err) {
      showNotif("info", err.message || "Gagal menyimpan perubahan laporan.");
    } finally {
      setIsSaving(false);
    }
  };

  // "Cetak" = pakai dialog print bawaan browser — admin bisa pilih printer
  // fisik, atau pilih "Save as PDF" di dialog itu untuk simpan sebagai
  // file PDF. Karena opsi "Save as PDF" ini sudah tersedia lewat sini,
  // tombol "Unduh PDF" terpisah (dulu pakai html2pdf.js) DIHAPUS —
  // fungsinya sudah tercakup oleh tombol Cetak ini, jadi tidak perlu ada
  // 2 tombol yang menghasilkan output serupa (redundan, dan versi
  // html2pdf-nya punya keterbatasan sendiri: link lampiran ikut hilang
  // karena dirender jadi gambar, lihat catatan lama di dokumen progres).
  const handleCetak = () => {
    window.print();
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Nama fungsi & state (showDeleteModal, isDeleting, dst) sengaja TIDAK
  // di-rename biar diff minimal - yang penting perilaku & teks yang
  // ditampilkan ke admin sudah benar (arsipkan, bukan hapus permanen).
  // Endpoint yang dipanggil (deleteLaporan -> DELETE /admin/reports/:id)
  // MENGARSIPKAN laporan sesuai konfirmasi tim BE, bukan hapus permanen.
  const handleConfirmHapusPermanen = async () => {
    setIsDeleting(true);
    try {
      await detailLaporanService.deleteLaporan(laporan.id);
      // Berhasil diarsipkan -> langsung kembali ke halaman Manajemen Insiden
      onNavigate?.("incident-management");
    } catch (err) {
      setIsDeleting(false);
      showNotif("info", err.message || "Gagal mengarsipkan laporan.");
    }
  };

  // ARSIP selalu terjadi SETELAH Selesai (dikonfirmasi) — jadi untuk
  // keperluan visual stepper, ARSIP diperlakukan sama seperti Selesai
  // (progress bar penuh, label "Selesai" ke-highlight). Status ASLI
  // (laporan.status === "ARSIP") tetap dipakai apa adanya di tempat lain
  // yang butuh tahu laporan ini benar-benar sudah diarsip (mis. badge
  // "Diarsipkan" & kunci stepper di bawah).
  const statusUntukStepper =
    laporan?.status === STATUS.ARSIP ? STATUS.SELESAI : laporan?.status;

  const getStatusProgressIndex = () => {
    return STATUS_STEPPER_ORDER.indexOf(statusUntukStepper);
  };

  const sudahDiarsip = laporan?.status === STATUS.ARSIP;

  // ⚠️ BELUM DIKONFIRMASI ke backend: spec API (smartrose-api-spec.json)
  // tidak mendokumentasikan schema respons GET /admin/reports/:id sama
  // sekali, jadi tidak diketahui apakah ada field lain (mis.
  // `previousStatus`/`deadline`) yang ikut tersimpan saat job
  // POST /admin/jobs/sla-check menandai laporan overdue. Makanya di sini
  // sengaja TIDAK menebak laporan sedang overdue di tahap mana — stepper
  // dibiarkan tanpa highlight (bukan salah tebak) sampai ada kepastian.
  const laporanOverdue = laporan?.status === STATUS.OVERDUE;
  const progressIndexAman = Math.max(0, getStatusProgressIndex());

  // laporan.grading tidak pernah ada di response API — harus dihitung
  // dari gradingAwal/gradingFinal. gradingAwal = grading asli dari
  // pelapor (dipakai khusus di panel "Grading Awal (Pelapor)"), sementara
  // gradingEfektif = gradingFinal kalau sudah pernah di-regrading admin,
  // fallback ke gradingAwal kalau belum — dipakai di teks-teks lain yang
  // merujuk "grading laporan ini" secara umum (termasuk Grading Akhir di
  // modal penyelesaian). Beda dengan jenisInvestigasi, grading TIDAK
  // punya mekanisme lock, jadi aman dihitung ulang tiap render.
  const gradingAwalId = normalisasiGradingId(laporan?.gradingAwal);
  const gradingEfektifId = normalisasiGradingId(
    laporan?.gradingFinal || laporan?.gradingAwal,
  );
  const gradingAwalStyle =
    getGradingStyle(laporan?.gradingAwal) || getGradingStyle("BIRU");
  const statusTerkunci = jenisInvestigasiTerkunci(laporan?.status);

  // Field asli backend buat "kode" laporan adalah trackingNumber (mis.
  // "SR-2026-000011"), BUKAN idLaporan — field itu memang tidak ada di
  // response (sudah dikonfirmasi lewat console.log di halaman lain yang
  // pakai endpoint sama). Fallback ke idLaporan tetap dijaga untuk
  // kompatibilitas kalau ada endpoint lama yang masih pakai field itu.
  const idLaporanTampil =
    laporan?.trackingNumber || laporan?.idLaporan || "\u2014";

  // Tidak ada field eksplisit "melibatkanPasien" di response backend,
  // jadi tipe insiden dideteksi dari ADA/TIDAKNYA field terkait di objek
  // laporan itu sendiri — lebih aman daripada menebak dari jenisInsiden
  // (yang isinya kategori insiden, bukan penanda pasien/fasilitas).
  const adaDataPasien = Boolean(
    laporan?.namaPasien || laporan?.noRekamMedis || laporan?.ruanganPasien,
  );
  const adaDataFasilitas = Boolean(
    laporan?.kategoriFasilitas ||
    laporan?.namaFasilitas ||
    laporan?.kodeInventaris,
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-100" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-32 rounded-xl bg-slate-100" />
              <div className="h-64 rounded-xl bg-slate-100" />
            </div>
            <div className="space-y-4">
              <div className="h-40 rounded-xl bg-slate-100" />
              <div className="h-32 rounded-xl bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={() => fetchDetail(laporanId)}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!laporan) return null;

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Fix supaya konten print tidak terpotong di 1 halaman doang.
          Penyebabnya BUKAN di card ini, tapi ancestor layout (shell app,
          biasanya <html>/<body>/#root atau container dengan
          h-screen + overflow-y-auto buat scroll SPA) yang bikin isi di
          luar viewport ke-clip pas print, bukan mengalir ke halaman
          berikutnya. Kalau setelah ini masih ada bagian yang kepotong,
          berarti selector layout aslinya beda dari #root — perlu file
          layout/shell (mis. AdminLayout.jsx) buat disesuaikan. */}
      {/* Fix supaya konten print tidak terpotong & scrollbar asli
          browser tidak ikut ter-print. Awalnya cuma reset html/body/#root
          tapi TERBUKTI belum cukup (scrollbar masih muncul di hasil PDF),
          jadi sekarang overflow di-reset ke "visible" untuk SEMUA elemen
          saat print — supaya kontainer scroll manapun penyebabnya (mis.
          wrapper "flex-1 overflow-y-auto" di layout/shell yang belum
          saya lihat file-nya) ikut ke-reset tanpa perlu tahu nama
          class-nya persis. */}
      <style>{`
        @media print {
          html, body, #root {
            height: auto !important;
            overflow: visible !important;
          }
          * {
            overflow: visible !important;
          }
        }
      `}</style>
      {/* Notification */}
      {notification && (
        <div
          className={`print:hidden mb-6 rounded-lg p-4 ${notification.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}
        >
          {notification.message}
        </div>
      )}

      {/* Breadcrumb + Tombol Cetak — keduanya disembunyikan saat print
          (print:hidden), diganti dengan letterhead sederhana di bawah
          yang cuma muncul pas dicetak/di-print-preview. */}
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Incident Management</span>
          <ChevronRight className="h-4 w-4" />
          <span className="font-semibold text-slate-800">Detail Laporan</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCetak}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition active:scale-95"
          >
            <Printer className="h-4 w-4" />
            Cetak
          </button>
        </div>
      </div>

      {/* Letterhead khusus print — tidak kelihatan di layar, cuma
          muncul di halaman cetak/PDF (lihat class "hidden print:block"),
          supaya hasil cetaknya jelas ini laporan apa & nomor berapa
          tanpa ikut menyertakan breadcrumb navigasi web. */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
        <h1 className="text-lg font-bold text-slate-900">
          Laporan Insiden Keselamatan Pasien
        </h1>
        <p className="text-sm text-slate-600">
          Nomor Laporan: {idLaporanTampil} &nbsp;•&nbsp; Dicetak pada{" "}
          {new Date().toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Main Content Grid — "print:block" bikin grid ini jadi susunan
          normal (bukan grid 3 kolom) pas dicetak, supaya kolom kanan
          (yang di-sembunyikan lewat print:hidden di bawah) tidak
          menyisakan ruang kosong di hasil cetak. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block">
        {/* Left Column - Detail Laporan */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress Status */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
            {sudahDiarsip && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                🗄️ Laporan Diarsipkan — sudah final, tidak bisa diubah lagi.
              </div>
            )}
            {laporanOverdue && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                ⏰ Laporan Overdue — melewati deadline SLA. Tahap yang sedang
                berjalan belum bisa ditampilkan (data belum dikonfirmasi ke
                backend).
              </div>
            )}
            <div
              className={`relative mb-8 ${sudahDiarsip ? "opacity-70" : ""}`}
            >
              {/* Background line */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-slate-300">
                <div
                  className="h-full bg-blue-600 transition-all"
                  style={{
                    width: `${(progressIndexAman / (statusOptions.length - 1)) * 100}%`,
                  }}
                />
              </div>

              {/* Status circles - clickable (kecuali laporan sudah diarsip) */}
              <div className="flex items-center justify-between">
                {statusOptions.map((status, idx) => (
                  <button
                    key={status.value}
                    onClick={() => handleStatusChange(status.value)}
                    disabled={sudahDiarsip}
                    className="flex flex-col items-center group disabled:cursor-not-allowed"
                  >
                    <div
                      className={`relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full transition ${
                        getStatusProgressIndex() >= idx
                          ? "bg-blue-600 text-white group-hover:bg-blue-700"
                          : "bg-slate-200 text-slate-500 group-hover:bg-slate-300"
                      }`}
                    >
                      <status.icon className="h-5 w-5" />
                    </div>
                    <p
                      className={`text-xs font-semibold transition ${
                        statusUntukStepper === status.value
                          ? "text-blue-600"
                          : "text-slate-700"
                      }`}
                    >
                      {status.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Detail Laporan — sebelumnya juga jadi target ref="printAreaRef"
              untuk fitur "Unduh PDF" (html2pdf.js), TAPI fitur itu sudah
              DIHAPUS (23 Juli 2026) karena tombol "Cetak" di bawah sudah
              cukup — dialog print bawaan browser punya opsi "Save as PDF"
              sendiri, jadi 2 tombol dengan hasil serupa jadi redundan.
              🔧 FIX 23 Juli 2026: khusus SAAT DICETAK, tampilan "kartu UI"
              (border, shadow, sudut membulat, kotak abu-abu di dalamnya,
              plus judul "Detail Laporan" yang jadi ganda dengan letterhead
              "Laporan Insiden Keselamatan Pasien" di atasnya) dihilangkan
              lewat class print:* di bawah — supaya hasil cetak/PDF terlihat
              seperti dokumen laporan formal biasa (rata, tanpa kotak), BUKAN
              tampak seperti screenshot komponen kartu dari halaman web. Di
              layar (non-print) tampilannya TIDAK berubah sama sekali. */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0 print:bg-transparent">
            <h2 className="text-lg font-bold text-slate-800 mb-4 print:hidden">
              Detail Laporan
            </h2>

            <p className="text-xs text-slate-500 mb-4">
              {/* ✅ Field asli backend: "createdAt", bukan "tanggal" (yang
                  tidak pernah ada di response — makanya sebelumnya baris
                  ini selalu tampil kosong). */}
              Dilaporkan pada {formatTanggal(laporan.createdAt)}
            </p>

            <div className="rounded-lg bg-slate-50 p-4 mb-6 space-y-4 print:bg-transparent print:rounded-none print:p-0 print:space-y-5">
              {/* Informasi Umum */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="ID LAPORAN" value={idLaporanTampil} />
                <Field
                  label="TANGGAL KEJADIAN"
                  value={formatTanggal(laporan.tanggalKejadian)}
                />
                <Field label="UNIT KERJA" value={laporan.unitKerja} />
                <Field label="JENIS INSIDEN" value={laporan.jenisInsiden} />
                {/* Laporan bersifat anonim (isAnonim: true) — identitas
                    pelapor sengaja tidak dipakai/ditampilkan. Diganti
                    dengan kategori pelapor (mis. "Karyawan - Dokter"),
                    field asli backend: "kategoriPelaporPertama". */}
                <Field
                  label="KATEGORI PELAPOR"
                  value={laporan.kategoriPelaporPertama}
                />
                {/* ✅ Field asli backend: "lokasi", bukan "lokasiKejadian". */}
                <Field label="LOKASI KEJADIAN" value={laporan.lokasi} />
              </div>

              {/* Data Pasien — cuma ditampilkan kalau laporan ini tipe
                  insiden pasien (ada field terkait pasien dari backend).
                  Field-field ini SUDAH DIKONFIRMASI ada sebagai kolom asli
                  (lihat catatan buatlaporanService.js). */}
              {adaDataPasien && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-600 mb-2">
                    DATA PASIEN
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Nama Pasien" value={laporan.namaPasien} />
                    <Field
                      label="No. Rekam Medis"
                      value={laporan.noRekamMedis}
                    />
                    <Field label="Ruangan" value={laporan.ruanganPasien} />
                    <Field
                      label="Jenis Kelamin"
                      value={laporan.jenisKelaminPasien}
                    />
                    <Field
                      label="Status Saat Insiden"
                      value={laporan.statusPasienSaatInsiden}
                    />
                    <Field
                      label="Tanggal/Jam Masuk RS"
                      value={
                        laporan.tanggalJamMasukRs
                          ? formatTanggal(laporan.tanggalJamMasukRs)
                          : null
                      }
                    />
                    <Field
                      label="Penanggung Biaya"
                      value={laporan.penanggungBiaya}
                    />
                  </div>
                </div>
              )}

              {/* Data Fasilitas — untuk laporan tipe insiden fasilitas.
                  ✅ 27 Juli 2026: DIKONFIRMASI tim BE — 9 kolom ini sudah
                  ditambahkan ke skema database (nullable) dan live di
                  production. POST /reports menyimpan, GET /admin/reports
                  & GET /admin/reports/:id mengembalikan semua field ini
                  secara konsisten (null kalau kosong, terisi kalau
                  laporan tipe fasilitas) — sudah dites end-to-end BE untuk
                  laporan fasilitas maupun laporan pasien biasa. Deteksi
                  adaDataFasilitas di atas tidak perlu diubah, sudah cocok
                  dengan field asli. */}
              {adaDataFasilitas && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-bold text-slate-600 mb-2">
                    DATA FASILITAS
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label="Kategori Fasilitas"
                      value={laporan.kategoriFasilitas}
                    />
                    <Field
                      label="Nama Fasilitas"
                      value={laporan.namaFasilitas}
                    />
                    <Field
                      label="Kode Inventaris"
                      value={laporan.kodeInventaris}
                    />
                    <Field
                      label="Kondisi Fasilitas"
                      value={laporan.kondisiFasilitas}
                    />
                    <Field
                      label="Penanggung Jawab"
                      value={laporan.penanggungJawabFasilitas}
                    />
                    {/* ✅ 27 Juli 2026: adaKorban field BOOLEAN asli dari
                        BE (bukan string) — WAJIB lewat formatBoolean(),
                        lihat catatan di definisi fungsinya kenapa tidak
                        boleh dikirim langsung ke Field. */}
                    <Field
                      label="Ada Korban"
                      value={formatBoolean(laporan.adaKorban)}
                    />
                    <Field
                      label="Kategori Kerusakan"
                      value={laporan.kategoriKerusakan}
                    />
                    <Field
                      label="Status Penanganan Awal"
                      value={laporan.statusPenangananAwal}
                    />
                    <Field
                      label="Tindakan Darurat"
                      value={laporan.tindakanDarurat}
                      fullWidth
                    />
                  </div>
                </div>
              )}

              {/* Pihak Terlibat & Spesialisasi */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                <Field
                  label="PIHAK TERLIBAT"
                  value={formatDaftar(laporan.pihakTerlibat)}
                />
                <Field
                  label="SPESIALISASI TERKAIT"
                  value={laporan.kasusSpesialisasi}
                />
              </div>

              {/* Dampak */}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  DAMPAK TERHADAP PASIEN
                </p>

                {/* ✅ Field asli backend: "dampak", bukan "dampakPasien".
                    Cuma angka level (1-5) — dikasih label & deskripsi
                    lewat labelDampak() sesuai matriks Dampak Klinis/
                    Konsekuensi/Severity RS biar jelas artinya. */}
                <p className="text-sm font-semibold text-slate-800">
                  Level {laporan.dampak}
                  {labelDampak(laporan.dampak) && (
                    <span> — {labelDampak(laporan.dampak).label}</span>
                  )}
                </p>
                {labelDampak(laporan.dampak) && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {labelDampak(laporan.dampak).deskripsi}
                  </p>
                )}
                {laporan.akibatTerhadapPasien && (
                  <p className="mt-2 text-sm text-slate-700 whitespace-pre-line break-words">
                    <span className="font-semibold text-slate-500">
                      Akibat:{" "}
                    </span>
                    {laporan.akibatTerhadapPasien}
                  </p>
                )}
              </div>

              {/* Kejadian Serupa */}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  KEJADIAN SERUPA PERNAH TERJADI?
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {laporan.apakahKejadianSerupaPernahTerjadi ? "Ya" : "Tidak"}
                </p>
                {laporan.apakahKejadianSerupaPernahTerjadi &&
                  laporan.kejadianSerupaDetail && (
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-line break-words">
                      {laporan.kejadianSerupaDetail}
                    </p>
                  )}
              </div>

              {/* Analisis & Tindak Lanjut dari Pelapor
                  ✅ Field tindakanDilakukan / akarPenyebab / rekomendasi
                  SUDAH DIKONFIRMASI backend (update 24 Juli 2026): sudah
                  muncul dengan benar di GET /admin/reports/:id,
                  terverifikasi end-to-end di production. Nama field di FE
                  sudah sama persis, tidak perlu diubah.

                  ⚠️ Field "TINDAKAN DILAKUKAN OLEH" (tindakanDilakukanOleh)
                  SENGAJA DIHAPUS dari tampilan (24 Juli 2026) — datanya
                  kelihatan tertukar dengan "TINDAKAN LANGSUNG" (isinya
                  malah daftar nama/jabatan, bukan aksi yang dilakukan),
                  jadi sementara tidak ditampilkan sampai akar masalahnya
                  di form sisi pelapor (BuatLaporanPage.jsx / step
                  Analisis) ketemu & diperbaiki. Lihat catatan progres. */}
              <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-4">
                <Field
                  label="TINDAKAN LANGSUNG"
                  value={laporan.tindakanDilakukan}
                  fullWidth
                />
                <Field
                  label="AKAR PENYEBAB"
                  value={laporan.akarPenyebab}
                  fullWidth
                />
                <Field
                  label="REKOMENDASI/SOLUSI"
                  value={laporan.rekomendasi}
                  fullWidth
                />
              </div>

              {/* Kronologi */}
              <div className="pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-semibold mb-1">
                  KRONOLOGI KEJADIAN
                </p>
                <p className="text-sm text-slate-800 whitespace-pre-line break-words">
                  {laporan.kronologi || "-"}
                </p>
              </div>

              {/* Lampiran — ditampilkan langsung sebagai thumbnail gambar,
                  bukan lagi link "Lihat Lampiran (n)" yang buka modal.
                  Klik 1 gambar tetap bisa buka versi ukuran penuh di tab
                  baru (pakai <a target="_blank">). Field & logika deteksi
                  tipe file (fileUrl + tipeFile) sama seperti sebelumnya. */}
              <div className="pt-3 border-t border-slate-200 print:break-inside-avoid">
                <p className="text-xs text-slate-500 font-semibold mb-2">
                  LAMPIRAN ({laporan.attachments?.length ?? 0})
                </p>

                {/* ✅ Field gambar asli "fileUrl" (bukan "url"), field lain
                    di objek attachment: id, objectPath, reportId, tipeFile
                    (mis. "JPG", bukan "image"/"pdf" generik), createdAt.
                    fileUrl dari Supabase Storage berbentuk SIGNED URL yang
                    biasanya ada masa berlaku — kalau gambar tiba-tiba tidak
                    muncul lagi padahal sebelumnya bisa, kemungkinan besar
                    link-nya sudah kedaluwarsa, bukan bug baru. */}
                {!laporan.attachments?.length ? (
                  <p className="text-sm text-slate-800">-</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {laporan.attachments.map((item, idx) => {
                      const url = item?.fileUrl || item?.url;
                      const isPdf =
                        item?.tipeFile?.toLowerCase() === "pdf" ||
                        String(url || "")
                          .toLowerCase()
                          .split("?")[0]
                          .endsWith(".pdf");
                      const label =
                        item?.label || item?.name || `File ${idx + 1}`;

                      return (
                        <a
                          key={item?.id ?? idx}
                          href={url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={label}
                          className={`flex h-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 transition hover:opacity-90 ${isPdf ? "bg-slate-50" : "bg-gradient-to-br from-blue-100 to-blue-50"} ${url ? "cursor-pointer" : "cursor-default"}`}
                        >
                          {isPdf ? (
                            <div className="flex flex-col items-center gap-1">
                              <FileText className="h-6 w-6 text-slate-400" />
                              <span className="px-2 text-center text-[10px] text-slate-500">
                                {label}
                              </span>
                            </div>
                          ) : url ? (
                            <img
                              src={url}
                              alt={label}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const img = e.currentTarget;
                                const fallback = document.createElement("span");
                                fallback.className =
                                  "px-2 text-center text-[10px] text-slate-400";
                                fallback.textContent = label;
                                img.replaceWith(fallback);
                              }}
                            />
                          ) : (
                            <span className="px-2 text-center text-[10px] text-slate-400">
                              {label}
                            </span>
                          )}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Info Jenis Investigasi + tombol masuk ke halaman
                investigasi — SENGAJA baru muncul begitu laporan udah
                dipindah ke tahap "investigasi" (bukan lagi
                "baru"/"ditinjau"). Selama masih ditinjau, admin cuma
                lihat data & grading dulu; begitu status digeser ke
                "Investigasi" (lihat panel Tahap Laporan), baru tombol
                buat lanjut ke RCA/Sederhana ini nongol, berdasarkan
                jenisInvestigasi yang udah ditentukan dari grading. */}
            {laporan.status !== STATUS.SUBMITTED &&
              laporan.status !== STATUS.MENUNGGU_VERIFIKASI && (
                <div className="print:hidden">
                  {laporan.jenisInvestigasi === "RCA" ? (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm text-red-800 mb-3">
                        Grading laporan ini ({gradingEfektifId || "-"})
                        mewajibkan <b>Investigasi Komprehensif (RCA)</b>.
                        Laporan sudah otomatis tercantum di halaman Analisis &
                        Investigasi.
                      </p>
                      <button
                        onClick={() =>
                          onNavigate?.("detail-investigasi", laporan.id)
                        }
                        className="w-full bg-white border border-red-300 text-red-700 hover:bg-red-100 py-2.5 rounded-lg text-sm font-semibold transition"
                      >
                        Buka Detail Investigasi (RCA)
                      </button>
                    </div>
                  ) : (
                    laporan.jenisInvestigasi === "Sederhana" && (
                      <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
                        <p className="text-sm text-green-800 mb-3">
                          Grading laporan ini ({gradingEfektifId || "-"}) cukup
                          ditangani lewat <b>Investigasi Sederhana</b> oleh unit
                          terkait, tanpa RCA formal.
                        </p>
                        <button
                          onClick={() =>
                            onNavigate?.("investigasi-sederhana", laporan.id)
                          }
                          className="w-full bg-white border border-green-300 text-green-700 hover:bg-green-100 py-2.5 rounded-lg text-sm font-semibold transition"
                        >
                          Isi Investigasi Sederhana
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

            {/* Status masih baru/ditinjau -> kasih tau admin apa yang
                perlu dilakuin dulu, bukan diem tanpa penjelasan. Panel
                ini panduan kerja admin, bukan info laporan -> disembunyikan
                saat print. */}
            {(laporan.status === STATUS.SUBMITTED ||
              laporan.status === STATUS.MENUNGGU_VERIFIKASI) && (
              <div className="print:hidden mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-sm text-slate-600">
                  Grading laporan ini ({gradingEfektifId || "-"}) menunjukkan
                  jalur{" "}
                  <b>
                    {laporan.jenisInvestigasi === "RCA"
                      ? "RCA"
                      : "Investigasi Sederhana"}
                  </b>
                  . Geser Tahap Laporan ke <b>"Investigasi"</b> di panel sebelah
                  kalau data laporan sudah lengkap & siap diproses.
                </p>
              </div>
            )}

            {/* Save Button */}
            <button
              onClick={() => {
                if (laporan.status === STATUS.SELESAI) {
                  setShowFinishModal(true);
                } else {
                  handleSimpanPerubahan();
                }
              }}
              disabled={isSaving || sudahDiarsip}
              className="print:hidden w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
            >
              {isSaving
                ? "Menyimpan..."
                : laporan.status === STATUS.SELESAI
                  ? "Simpan Perubahan & Kirim Laporan"
                  : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        {/* Right Column - Info Panel — disembunyikan seluruhnya saat
            print/PDF, karena isinya panel kerja admin (aktivitas,
            re-grading, feedback), bukan informasi laporan dari pelapor. */}
        <div className="print:hidden space-y-6">
          {/* Aktivitas Terakhir - otomatis bertambah setiap ada perubahan */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Aktivitas Terakhir
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {recentActivity.map((activity, idx) => (
                <div
                  key={idx}
                  className="flex gap-3 pb-3 border-b border-slate-100 last:border-0"
                >
                  <div className="h-2 w-2 bg-blue-600 rounded-full mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {activity.text}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {activity.time} {activity.by ? `by ${activity.by}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pembaruan Grading Risiko */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">
              Pembaruan Grading Risiko
            </h3>

            {/* Grading Awal */}
            <div
              className={`rounded-lg ${gradingAwalStyle.bg} border ${gradingAwalStyle.border} p-4 mb-5`}
            >
              <p className="text-xs font-semibold text-slate-500 mb-2">
                Grading Awal (Pelapor)
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`h-8 w-8 rounded-full ${gradingAwalStyle.dot} flex items-center justify-center`}
                >
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>

                <p className={`text-sm font-bold ${gradingAwalStyle.text}`}>
                  {gradingAwalId || "-"}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  JENIS INVESTIGASI
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    laporan.jenisInvestigasi === "RCA"
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {laporan.jenisInvestigasi === "RCA" ? "RCA" : "Sederhana"}
                </span>
              </div>
              {statusTerkunci && (
                <p className="mt-1.5 text-[10px] text-slate-500 italic">
                  🔒 Terkunci — investigasi sudah berjalan, jenis investigasi
                  tidak berubah otomatis walau grading diubah.
                </p>
              )}
            </div>

            {/* Re-Grading */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Re-Grading
              </label>

              <select
                value={newGrading}
                onChange={(e) => setNewGrading(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Pilih Grading Baru</option>
                {GRADING_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>

            {/* Alasan */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-600 mb-2">
                Alasan Perubahan
              </label>

              <textarea
                rows={4}
                value={gradingReason}
                onChange={(e) => setGradingReason(e.target.value)}
                placeholder="Jelaskan alasan mengapa grading perlu diubah..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* Informasi */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-4">
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Semua perubahan grading akan tercatat pada <b>Audit Log</b>,
                termasuk grading awal, grading baru, nama admin yang melakukan
                perubahan, waktu perubahan, dan alasan perubahan.
              </p>
            </div>

            {/* Tombol */}
            <button
              onClick={handleReGrading}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-semibold transition"
            >
              Simpan Re-Grading
            </button>
          </div>

          {/* Feedback Admin Utama */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3">
              Feedback Admin Utama
            </h3>

            <div className="space-y-3 max-h-56 overflow-y-auto mb-4">
              {(laporan.feedback || []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Belum ada feedback untuk laporan ini.
                </p>
              ) : (
                laporan.feedback.map((fb, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          fb.jenis === "MENGIKAT"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {fb.jenis === "MENGIKAT" ? "Revisi" : "Catatan"}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {/* fb.waktu bisa berupa ISO string (dari backend)
                            atau string jam lokal (fallback optimistic) —
                            formatTanggal() aman dipakai untuk keduanya
                            karena akan balik "-" kalau bukan tanggal valid. */}
                        {fb.waktu && !Number.isNaN(new Date(fb.waktu).getTime())
                          ? formatTanggal(fb.waktu)
                          : fb.waktu || ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{fb.catatan}</p>
                    {fb.oleh && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        — {fb.oleh}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {isSuperAdmin ? (
              <div className="space-y-2 pt-3 border-t border-slate-200">
                <textarea
                  rows={3}
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  placeholder="Tulis pesan untuk tim..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs resize-none focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleKirimFeedback}
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2 text-xs font-semibold transition"
                >
                  Kirim Feedback
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic pt-3 border-t border-slate-200">
                Hanya Admin Utama yang bisa memberikan feedback di sini.
              </p>
            )}
          </div>

          {/* Tindakan Lanjutan */}
          {/* ✅ 27 Juli 2026: DIPERBAIKI 2 hal —
              1. Label & teks sebelumnya "Hapus Permanen" MENYESATKAN:
                 detailLaporanService.deleteLaporan() memanggil
                 DELETE /admin/reports/:id, yang menurut tim BE cuma
                 MENGARSIPKAN laporan (tidak ada hard-delete beneran di
                 endpoint manapun). Label & modal sekarang disesuaikan
                 supaya tidak bikin admin kira laporan hilang selamanya.
              2. Sebelumnya TIDAK ADA gating role sama sekali - semua
                 admin (bukan cuma Admin Utama) bisa melihat & memencet
                 tombol ini. Sekarang di-gate pakai `isSuperAdmin`, pola
                 yang sama seperti gating feedback Admin Utama di atas.
              Tombol juga disembunyikan kalau laporan sudah diarsip
              (sudahDiarsip) - tidak ada gunanya arsipkan ulang. */}
          {isSuperAdmin && !sudahDiarsip && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-slate-800 mb-3">
                Tindakan Lanjutan
              </h3>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition"
              >
                <Trash2 className="h-4 w-4" />
                Arsipkan Laporan
              </button>
              <p className="text-[11px] text-slate-400 text-center pt-1">
                Hanya Admin Utama yang bisa mengarsipkan laporan.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Konfirmasi Arsipkan Laporan ── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-7 w-7 text-red-500" />
              </div>
            </div>
            <h2 className="mb-2 text-center text-base font-bold text-slate-800">
              Arsipkan Laporan Ini?
            </h2>
            <p className="mb-5 text-center text-xs leading-relaxed text-slate-500">
              Laporan{" "}
              <span className="font-bold text-slate-700">
                {idLaporanTampil}
              </span>{" "}
              akan diarsipkan. Laporan yang diarsipkan tidak akan tampil di
              daftar laporan aktif, tapi datanya tetap tersimpan dan tidak
              dihapus secara permanen.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmHapusPermanen}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? "Mengarsipkan..." : "Ya, Arsipkan Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Modal Konfirmasi Penyelesaian Laporan ── */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {/* Icon */}
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </div>

            {/* Judul */}
            <h2 className="mb-2 text-center text-lg font-bold text-slate-800">
              Konfirmasi Penyelesaian
            </h2>

            <p className="mb-5 text-center text-sm leading-relaxed text-slate-500">
              Laporan
              <span className="font-semibold text-slate-700">
                {" "}
                {idLaporanTampil}
              </span>{" "}
              akan ditandai sebagai <b>SELESAI</b> dan proses investigasi akan
              dikunci sehingga tidak dapat diubah kembali.
            </p>

            {/* Ringkasan */}
            <div className="mb-5 rounded-xl border border-slate-200 divide-y divide-slate-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">Status</span>

                <span className="font-semibold text-green-600">Selesai</span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">Grading Akhir</span>

                <span className="font-semibold text-slate-700">
                  {gradingEfektifId || "-"}
                </span>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-slate-500">
                  Tanggal Penyelesaian
                </span>

                <span className="font-semibold text-slate-700">
                  {new Date().toLocaleDateString("id-ID")}
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Info className="mt-0.5 h-4 w-4 text-blue-600" />

              <p className="text-xs leading-relaxed text-blue-700">
                Setelah laporan diselesaikan, data investigasi akan dikunci dan
                seluruh perubahan yang telah dilakukan akan disimpan ke dalam
                sistem.
              </p>
            </div>

            {laporan.jenisInvestigasi === "RCA" && (
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Info className="mt-0.5 h-4 w-4 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-700">
                  Laporan ini jalur <b>RCA</b> — status "Selesai" cuma bisa
                  dipilih oleh Admin Utama. Kalau Anda melihat modal ini,
                  berarti login sebagai Admin Utama.
                </p>
              </div>
            )}

            {/* Checkbox */}
            <label className="mb-5 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={agreeFinish}
                onChange={(e) => setAgreeFinish(e.target.checked)}
                className="mt-1 h-4 w-4 accent-blue-600"
              />

              <span className="text-xs leading-relaxed text-slate-600">
                Saya memastikan seluruh proses investigasi telah selesai dan
                data laporan sudah benar.
              </span>
            </label>

            {/* Button */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>

              <button
                disabled={!agreeFinish || isSaving}
                onClick={handleSimpanPerubahan}
                className={`flex-1 rounded-xl py-2.5 font-semibold transition ${
                  agreeFinish && !isSaving
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "cursor-not-allowed bg-slate-200 text-slate-400"
                }`}
              >
                {isSaving ? "Menyimpan..." : "Ya, Selesaikan Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
