import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronRight,
  Clock,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  Search,
  Upload,
  X,
  Plus,
  ChevronDown,
  Users,
  Info,
  Loader2,
  Trash2,
  MessageCircle,
  GitBranch,
  CalendarClock,
  ClipboardList,
  Printer,
  ExternalLink,
} from "lucide-react";
import * as detailInvestigasiService from "../../services/admin/detailInvestigasiService";
import { STATUS_RCA } from "../../services/admin/detailInvestigasiService";
import {
  getLaporanDetail,
  updateStatusLaporan,
} from "../../services/admin/detailLaporanService";
// ✅ 25 Juli 2026 (revisi kedua): Card "Tim — Penugasan Investigasi"
// SENGAJA diubah dari dropdown (pilih dari daftar akun Admin via
// userManagementService) jadi input teks manual biasa.
//
// Alasan bisnis: struktur Tim Investigasi (siapa Ketua/Sekretaris/
// Anggota) ditentukan lewat diskusi manual Tim Mutu DI LUAR sistem
// (rapat/WhatsApp), SEBELUM investigasi dimulai. Form RCA di SMART-ROSE
// baru diisi SETELAH investigasi & pengumpulan data selesai, semata-mata
// sebagai pencatatan digital — bukan alat untuk membentuk/menugaskan tim
// atau memicu notifikasi "mulai kerja" (karena pada saat form ini diisi,
// tim yang bersangkutan sudah lama tahu & sudah selesai kerja).
//
// Makanya: TIDAK perlu lagi fetch daftar akun Admin dari backend untuk
// field ini — cukup text input polos, sama seperti field manual lain
// di form ini (kronologi, akar masalah, dll). Kalau di masa depan ada
// kebutuhan lain yang benar-benar butuh assign+notifikasi real-time ke
// akun tertentu (beda dari pencatatan RCA ini), baru relevan pakai
// userManagementService.getDaftarAdminUntukAssign() lagi.
import {
  getGradingStyle,
  normalisasiGradingId,
  STATUS,
  STATUS_STEPPER_ORDER,
  STATUS_BELUM_MULAI_INVESTIGASI,
} from "../../lib/grading";
// PDF panduan pengisian "Tipe Insiden" — ditaruh di src/assets/, di-import
// sebagai module supaya build tool (Vite/CRA) otomatis meng-generate URL
// yang valid untuk file ini.
import panduanTipeInsidenPdf from "../../assets/PEDOMAN-PEGISIAN_TIPE_INSIDEN.pdf";

// ── Whitelist ekstensi lampiran RCA (Bagian 9) ──────────────────────────
// 🔧 DISELARASKAN 23 Juli 2026 dengan update tim Backend: endpoint
// POST /reports/:id/rca/attachments SEKARANG cuma menerima PDF/DOCX/XLSX
// (validasi isi file/magic bytes, bukan cuma klaim mimetype) — sebelumnya
// endpoint ini ikut whitelist global yang juga izinkan JPG/PNG, itu celah
// keamanan yang sudah ditutup di backend.
//
// Attribute `accept` di elemen <input type="file"> HANYA berlaku untuk
// dialog pilih file — TIDAK berlaku untuk drag & drop (lihat handleDrop
// di bawah), jadi validasi ekstensi manual di sini tetap wajib supaya
// drag & drop juga konsisten menolak tipe file yang salah SEBELUM
// sempat diupload ke server (bukan gagal belakangan pas Simpan).
//
// ⚠️ Ini cuma pengecekan ekstensi nama file (client-side), sekadar
// feedback cepat ke user — bukan pengganti validasi isi file/magic bytes
// yang sudah benar dilakukan backend. File yang lolos cek ekstensi di
// sini tetap bisa ditolak backend kalau isi aslinya bukan PDF/DOCX/XLSX
// asli (mis. JPG yang di-rename jadi .pdf) — itu perilaku yang benar.
const EKSTENSI_LAMPIRAN_RCA_DIIZINKAN = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".doc",
  ".xls",
];

function isEkstensiLampiranRcaValid(file) {
  const nama = (file?.name || "").toLowerCase();
  return EKSTENSI_LAMPIRAN_RCA_DIIZINKAN.some((ext) => nama.endsWith(ext));
}

// Batas ukuran lampiran RCA — samakan dengan teks yang sudah ada di UI
// ("Maks 10MB"). Sebelumnya cuma teks informatif, belum ada pengecekan
// sungguhan di kode — jadi file di atas 10MB tetap lolos masuk daftar
// upload dan baru gagal belakangan (kalau backend punya limit sendiri)
// atau malah tidak pernah ditolak sama sekali.
const MAKS_UKURAN_LAMPIRAN_RCA_BYTES = 10 * 1024 * 1024; // 10MB

function isUkuranLampiranRcaValid(file) {
  return (file?.size ?? 0) <= MAKS_UKURAN_LAMPIRAN_RCA_BYTES;
}

function formatUkuranFile(bytes) {
  if (!bytes && bytes !== 0) return "";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

// Validasi gabungan (ekstensi + ukuran) untuk 1 file lampiran RCA.
// Mengembalikan alasan penolakan (string) kalau tidak valid, atau `null`
// kalau file boleh lanjut diupload.
function alasanTolakLampiranRca(file) {
  if (!isEkstensiLampiranRcaValid(file)) {
    return `${file.name} (format tidak didukung, cuma PDF/DOCX/XLSX)`;
  }
  if (!isUkuranLampiranRcaValid(file)) {
    return `${file.name} (ukuran ${formatUkuranFile(file.size)}, maks 10MB)`;
  }
  return null;
}

// 🔧 FIX "Network Error" polos saat upload lampiran RCA (Bagian 9):
// Validasi ukuran di sisi klien (alasanTolakLampiranRca, 10MB/file) cuma
// menyaring SEBELUM file masuk daftar upload. Begitu file lolos cek itu
// dan benar-benar dikirim ke server lewat uploadLampiranInvestigasi(),
// masih ada skenario penolakan lain di luar kendali cek klien, misalnya:
//   - Ukuran TOTAL body request (bisa beberapa file sekaligus) melebihi
//     batas server/reverse-proxy (mis. nginx client_max_body_size),
//     walau tiap file sendiri sudah di bawah 10MB.
//   - Koneksi lambat/tidak stabil terputus di tengah upload file besar.
// Di kasus ini, browser/axios TIDAK PERNAH menerima response HTTP biasa
// dari server (beda dari error 4xx/5xx yang pasti punya err.response) —
// axios cuma melempar err.message = "Network Error" tanpa detail apa pun.
// Kalau dibiarkan, itulah yang lolos ke ambilPesanMentahBackend() sebagai
// fallback paling akhir dan tampil apa adanya ke admin: "Network Error",
// tanpa menyebut file mana yang gagal atau kenapa.
//
// Helper ini mendeteksi pola error tsb, lalu pemanggil (lihat
// uploadPendingLampiran di bawah) mengganti error mentahnya dengan pesan
// yang menyebut nama file, ukurannya, dan dugaan penyebab + saran — bukan
// sekadar "Network Error".
function isNetworkErrorTanpaResponse(err) {
  return (
    !err?.response &&
    (err?.message === "Network Error" || err?.code === "ERR_NETWORK")
  );
}

// ── Helper: ambil pesan error paling jelas dari axios error ─────────────
// Sebelumnya semua catch di halaman ini pakai `err.message` — untuk error
// axios itu cuma teks generik ("Request failed with status code 400"),
// BUKAN pesan spesifik yang dikirim backend di body response (mis. pesan
// baru dari tim BE: "Isi file tidak sesuai (terdeteksi: image/jpeg).
// Pemalsuan ekstensi tidak diizinkan."). Helper ini prioritaskan pesan
// dari backend (`err.response.data.message`) dulu, baru fallback ke
// `err.message`, baru ke pesan default. Dikembalikan MENTAH (belum
// diformat) — pemanggil yang memutuskan mau diparse jadi struktur
// (lihat parsePesanValidasiTerstruktur di bawah) atau dipakai apa adanya.
function ambilPesanMentahBackend(err, pesanDefault) {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    pesanDefault
  );
}

// 🔧 25 Juli 2026: sebelumnya pesan validasi mentah dari backend (format
// Zod, mis. "Validasi gagal: body.masalahAwal5Why: Invalid input: expected
// string, received object, body.timelineEntries.0.waktu: Waktu harus
// diisi, ...") ditampilkan APA ADANYA ke admin — sulit dibaca (istilah
// teknis/field backend, bukan label form) & terlalu panjang jadi satu
// paragraf DITUMPUK di kotak merah paling bawah, jauh dari kartu/Bagian
// yang sebenarnya bermasalah — admin harus scroll & menebak-nebak baris
// mana yang dimaksud.
//
// 🔧 25 Juli 2026 (revisi): daripada digabung jadi satu string panjang,
// pesan ini di-parse jadi STRUKTUR data (per field tunggal & per baris
// tiap Bagian) lewat parsePesanValidasiTerstruktur() di bawah — supaya
// tiap kartu/Bagian bisa menampilkan highlight merah + keterangan sendiri
// persis di lokasi field yang bermasalah, bukan numpuk di bawah. Kalau
// pesannya BUKAN format Zod ini (mis. pesan custom dari backend yang
// sudah manusiawi, atau error jaringan), `adaError` bernilai false —
// pemanggil fallback ke pesan mentah apa adanya di kotak error umum.

// Label field top-level (bukan bagian dari array) -> label yang dipakai
// di form. Cuma field yang WAJIB (bisa muncul di pesan validasi) yang
// perlu didaftarkan di sini.
const LABEL_FIELD_TUNGGAL = {
  masalahAwal5Why: "Insiden (uraian singkat)",
  kronologiSingkat: "Kronologi Singkat",
};

// Label bagian untuk tiap array di payload -> nomor & judul Bagian yang
// dipakai di form, supaya admin langsung tahu harus scroll ke mana.
const LABEL_BAGIAN_ARRAY = {
  timelineEntries: "Bagian 4. Peta Kronologi Kejadian",
  fiveWhyEntries: "Bagian 5. Analisis 5 Why",
  fishboneEntries: "Bagian 6. Analisis Penyebab Masalah (Fishbone)",
  rencanaPerbaikanEntries:
    "Bagian 7 & 8. Rekomendasi/Rencana Kerja & Jadwal Perbaikan",
  timePersonGridEntries: "Time-Person Grid",
};

// Label field di dalam tiap baris array -> label kolom yang dipakai di form.
const LABEL_FIELD_ARRAY = {
  waktu: "Waktu",
  kejadian: "Kejadian",
  informasiTambahan: "Informasi Tambahan",
  goodPractice: "Good Practice",
  masalahPelayanan: "Masalah Pelayanan",
  jawaban: "Jawaban",
  penyebab: "Penyebab",
  kategori: "Kategori",
  akarMasalah: "Akar Masalah",
  rekomendasiSolusi: "Rekomendasi/Solusi",
  tindakanPerbaikan: "Kegiatan Perbaikan",
  pelaksana: "Pelaksana",
  targetWaktu: "Target Waktu",
};

// Struktur kosong (dipakai kalau pesan bukan format Zod atau tidak ada
// error sama sekali) — bentuknya selalu konsisten supaya pemanggil tidak
// perlu cek null di banyak tempat.
const STRUKTUR_VALIDASI_KOSONG = {
  adaError: false,
  fieldTunggal: {}, // { masalahAwal5Why: true, kronologiSingkat: true, ... }
  perArray: {}, // { timelineEntries: { 0: ["Waktu","Kejadian"], ... }, ... }
  lainnya: [], // potongan pesan yang gagal dipetakan ke field manapun
};

function parsePesanValidasiTerstruktur(pesanMentah) {
  if (typeof pesanMentah !== "string") return STRUKTUR_VALIDASI_KOSONG;
  if (!/^validasi gagal:/i.test(pesanMentah.trim()))
    return STRUKTUR_VALIDASI_KOSONG;

  const isiPesan = pesanMentah.replace(/^validasi gagal:\s*/i, "").trim();
  if (!isiPesan) return STRUKTUR_VALIDASI_KOSONG;

  // Tiap potongan diawali "body." — split pakai lookahead supaya koma DI
  // DALAM satu pesan (mis. "Invalid input: expected string, received
  // object") tidak ikut kepotong jadi baris terpisah.
  const potongan = isiPesan.split(/,\s*(?=body\.)/);

  const hasil = {
    adaError: true,
    fieldTunggal: {},
    perArray: {},
    lainnya: [],
  };

  potongan.forEach((p) => {
    const m = p.trim().match(/^body\.([a-zA-Z0-9_.]+):\s*(.+)$/);
    if (!m) {
      hasil.lainnya.push(p.trim());
      return;
    }
    const path = m[1];
    const bagianPath = path.split(".");

    if (bagianPath.length >= 3 && /^\d+$/.test(bagianPath[1])) {
      // Field di dalam baris array, mis. timelineEntries.0.waktu — index
      // array backend SELALU sama urutan dengan array lokal di state
      // (dikirim lewat .map() langsung di buildPayload(), tidak ada
      // reorder), jadi idx di sini aman dipakai langsung untuk highlight
      // baris ke-idx di form.
      const [namaArray, idxStr] = bagianPath;
      const namaField = bagianPath.slice(2).join(".");
      const idx = Number(idxStr);
      const labelKolom = LABEL_FIELD_ARRAY[namaField] || namaField;
      if (!hasil.perArray[namaArray]) hasil.perArray[namaArray] = {};
      if (!hasil.perArray[namaArray][idx]) hasil.perArray[namaArray][idx] = [];
      if (!hasil.perArray[namaArray][idx].includes(labelKolom)) {
        hasil.perArray[namaArray][idx].push(labelKolom);
      }
    } else {
      // Field tunggal di luar array, mis. masalahAwal5Why. Pesan asli dari
      // Zod utk field ini kadang berupa "Invalid input: expected string,
      // received object" (bukan "harus diisi") — ini KHUSUS terjadi kalau
      // field "Insiden (uraian singkat)" dikosongkan, karena
      // mapPayloadKeBackend() punya fallback ke objek ringkasanLaporan
      // kalau insiden kosong (lihat detailInvestigasiService.js). Jadi
      // secara praktis akar masalahnya SAMA — field ini belum diisi —
      // makanya ditandai sama saja (fieldTunggal[path] = true) daripada
      // ikut menyimpan istilah teknis "format"/"objek" dari Zod.
      hasil.fieldTunggal[path] = true;
    }
  });

  return hasil;
}

// Kategori default untuk Analisis Penyebab Masalah (4M), bisa ditambah/diubah bebas
// ✅ DIKONFIRMASI 21 Juli 2026 lewat pesan validasi backend: kategori
// fishbone harus salah satu dari 6 nilai ini (MAN|METHOD|MATERIAL|
// MACHINE|MEASUREMENT|ENVIRONMENT, dikirim uppercase oleh mapper di
// detailInvestigasiService.js) — sebelumnya cuma 4 opsi di sini, Machine
// & Environment ditambahkan supaya form mengizinkan semua kategori yang
// backend terima.
const DEFAULT_FAKTOR_KATEGORI = [
  "Man",
  "Method",
  "Material",
  "Machine",
  "Measurement",
  "Environment",
];

// ------------------------------------------------------------
// Generator ID lokal untuk key React & referensi baris/kolom
// dinamis (bukan ID dari backend).
// ------------------------------------------------------------
let idSeq = 0;
const genId = () => `id_${Date.now()}_${idSeq++}`;

const emptyInterview = () => ({ id: genId(), value: "" });
const emptyKronologiKolom = () => ({
  id: genId(),
  waktu: "",
  kejadian: "",
  informasiTambahan: "",
  goodPractice: "",
  masalahPelayanan: "",
});
const emptyWhyPoin = () => ({ id: genId(), value: "" });
const emptyWhyRow = () => ({ id: genId(), poin: [emptyWhyPoin()] });
const emptyFaktor = (kategori = "") => ({
  id: genId(),
  kategori,
  deskripsi: "",
});
// 🔧 FIX bug "rencanaPerbaikanEntries kepasangan salah index": sebelumnya
// "Rekomendasi & Rencana Kerja" (Bagian 7) dan "Jadwal Perbaikan" (Bagian 8)
// masing-masing PUNYA STATE ARRAY SENDIRI (rekomendasiList terpisah dari
// jadwalPerbaikan), bebas ditambah/dihapus independen. Backend gabungkan
// keduanya per-INDEX jadi 1 entry rencanaPerbaikanEntries (lihat
// detailInvestigasiService.js) — begitu jumlah baris di 2 bagian ini beda
// (mis. 2 baris di Jadwal Perbaikan tapi cuma 1 di Rekomendasi), baris
// tambahan itu jadi entry SETENGAH KOSONG ("akarMasalah"/"rekomendasiSolusi"
// tetap "" walau "kegiatan"/"pelaksana"/"target" terisi) — DIKONFIRMASI
// lewat pesan error backend asli: "body.rencanaPerbaikanEntries.1.akarMasalah:
// Akar masalah harus diisi".
//
// Sekarang cuma ada SATU array (`rencanaPerbaikan`) berisi kelima field
// sekaligus per baris. Bagian 7 & 8 tetap ditampilkan sebagai 2 SectionCard
// terpisah (mengikuti struktur dokumen resmi), tapi keduanya me-render
// array yang SAMA — jadi jumlah baris di kedua bagian itu otomatis selalu
// identik, tidak mungkin lagi beda index.
// Gabungkan rekomendasiRencanaKerja[] + jadwalPerbaikan[] (dua array
// TERPISAH dari service, hasil split balik dari rencanaPerbaikanEntries
// backend — lihat splitRencanaPerbaikanEntriesDariBackend di
// detailInvestigasiService.js) jadi satu daftar `rencanaPerbaikan`
// gabungan. Dipasangkan per-index seperti sebelumnya, TAPI kalau kedua
// array itu beda panjang (data lama yang kadung tersimpan sebelum fix
// ini), baris yang "pincang" tetap ditampilkan apa adanya (bukan hilang)
// supaya user sadar & bisa lengkapi manual — bukan diam-diam dibuang.
function gabungkanRencanaPerbaikan(
  rekomendasiRencanaKerja = [],
  jadwalPerbaikan = [],
) {
  const panjang = Math.max(
    rekomendasiRencanaKerja.length,
    jadwalPerbaikan.length,
    1,
  );
  return Array.from({ length: panjang }, (_, idx) => {
    const r = rekomendasiRencanaKerja[idx] || {};
    const j = jadwalPerbaikan[idx] || {};
    return {
      id: genId(),
      akarMasalah: r.akarMasalah || "",
      rekomendasi: r.rekomendasi || "",
      kegiatan: j.kegiatan || "",
      pelaksana: j.pelaksana || "",
      target: j.target || "",
    };
  });
}

const emptyRencanaPerbaikan = () => ({
  id: genId(),
  akarMasalah: "",
  rekomendasi: "",
  kegiatan: "",
  pelaksana: "",
  target: "",
});

// ------------------------------------------------------------
// 🔧 FIX 23 Juli 2026 — validasi sebelum submit untuk Bagian 7/8.
// Karena Bagian 7 (Akar Masalah & Rekomendasi) dan Bagian 8 (Jadwal
// Perbaikan) sekarang berbagi SATU array `rencanaPerbaikan` per baris
// (lihat catatan fix index-mismatch di atas), gampang kejadian user cuma
// isi salah satu bagian untuk baris yang baru ditambah lalu langsung
// klik "Selesaikan & Kirim" — backend baru menolak lewat pesan seperti
// "body.rencanaPerbaikanEntries.1.akarMasalah: Akar masalah harus
// diisi" SETELAH request dikirim, jadi user harus scroll & menebak baris
// mana yang belum lengkap.
//
// cekBarisRencanaPerbaikanLengkap: true kalau kelima field baris itu
// terisi (bukan cuma whitespace).
// validasiSemuaRencanaPerbaikan: dipanggil sebelum handleFinalizeSubmit
// mengirim apa pun ke backend — kalau ada baris yang belum lengkap,
// kembalikan daftar nomor baris (1-based) & id barisnya (untuk highlight
// visual di kedua SectionCard) supaya user langsung tahu tanpa perlu
// submit dulu.
// ------------------------------------------------------------
const cekBarisRencanaPerbaikanLengkap = (r) =>
  Boolean(
    r.akarMasalah?.trim() &&
    r.rekomendasi?.trim() &&
    r.kegiatan?.trim() &&
    r.pelaksana?.trim() &&
    r.target?.trim(),
  );

function validasiSemuaRencanaPerbaikan(rencanaPerbaikan) {
  const barisBelumLengkap = rencanaPerbaikan
    .map((r, idx) => ({ r, nomor: idx + 1 }))
    .filter(({ r }) => !cekBarisRencanaPerbaikanLengkap(r));

  return {
    lengkap: barisBelumLengkap.length === 0,
    idBarisBelumLengkap: new Set(barisBelumLengkap.map(({ r }) => r.id)),
    nomorBarisBelumLengkap: barisBelumLengkap.map(({ nomor }) => nomor),
  };
}

// ------------------------------------------------------------
// Adapter: ubah response mentah GET /admin/reports/:id (dikonfirmasi
// 21 Juli 2026 lewat tab Network) jadi bentuk yang dipakai JSX di bawah.
// Field mentah backend BEDA nama & tidak ada versi "siap tampil"-nya
// (mis. tidak ada judul/gradingLabel/gradingStyle/sisaLabel/progres/
// timeline/lampiran) — semua field turunan itu dihitung di sini, SATU
// tempat, supaya kalau field mentah backend berubah nanti, cukup
// disesuaikan di fungsi ini saja, JSX di bawah tidak perlu diubah.
//
// Field mentah yang dikonfirmasi ADA: id, trackingNumber, createdAt
// (ISO), tanggalKejadian (ISO), kronologi, lokasi, isAnonim, pelapor,
// gradingAwal/gradingFinal ("MERAH"/"KUNING"/dst), jenisInsiden
// ("SENTINEL" dst, uppercase), status (SUBMITTED/dst, uppercase),
// attachments ([]), histories ([]), pihakTerlibat ([]),
// deadlineInvestigasi (null kalau belum di-set backend).
// ------------------------------------------------------------
const SLA_HARI_INVESTIGASI = 45;
const MS_PER_HARI = 1000 * 60 * 60 * 24;

const STATUS_STEP_LABEL = {
  [STATUS.SUBMITTED]: "Laporan Diterima",
  [STATUS.MENUNGGU_VERIFIKASI]: "Menunggu Verifikasi",
  [STATUS.DALAM_INVESTIGASI]: "Dalam Investigasi",
  [STATUS.SELESAI]: "Investigasi Selesai",
};

function formatTanggalIndo(iso, withTime = false) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function mapLaporanUntukTampilan(row) {
  if (!row) return {};

  // Grading: backend kirim format warna (MERAH/KUNING/dst), UI ini butuh
  // grading id internal (Ekstrim/Tinggi/dst) + style Tailwind siap pakai.
  const gradingSumber = row.gradingFinal || row.gradingAwal;
  const gradingLabel = normalisasiGradingId(gradingSumber) || "-";
  const gStyle = getGradingStyle(gradingSumber);
  const gradingStyle = gStyle
    ? `${gStyle.bg} ${gStyle.text} border ${gStyle.border}`
    : "bg-slate-100 text-slate-600 border border-slate-200";

  // Judul: backend belum punya field judul laporan tersendiri — susun
  // dari jenis insiden + lokasi supaya tetap informatif.
  const jenisInsidenLabel = row.jenisInsiden
    ? row.jenisInsiden.charAt(0).toUpperCase() +
      row.jenisInsiden.slice(1).toLowerCase()
    : "Insiden";
  const judul = `Laporan ${jenisInsidenLabel}${row.lokasi ? ` — ${row.lokasi}` : ""}`;

  const identitasPelapor = row.isAnonim
    ? "Anonim / Dirahasiakan"
    : row.pelapor || "-";

  // Lampiran: ✅ DIKONFIRMASI lewat console.log GET /admin/reports/:id
  // sungguhan (22 Jul 2026) — field asli objek attachment adalah:
  //   fileUrl (bukan "url"), tipeFile (bukan "type", isinya string
  //   ekstensi mis. "JPG" — bukan "image"/"pdf" generik), objectPath,
  //   reportId, id, createdAt. Sebelumnya "url" TIDAK PERNAH diambil ke
  //   objek hasil mapping (cuma dipakai buat nebak ekstensi dari string
  //   kosong), makanya bagian render selalu jatuh ke tampilan teks label
  //   generik, bukan gambar aslinya.
  const lampiran = (row.attachments || []).map((item, idx) => ({
    id: item?.id ?? idx,
    url: item?.fileUrl || item?.url,
    type:
      item?.tipeFile?.toLowerCase() === "pdf" ||
      String(item?.fileUrl || item?.objectPath || "")
        .toLowerCase()
        .endsWith(".pdf")
        ? "pdf"
        : "image",
    label: item?.label || item?.name || item?.filename || `File ${idx + 1}`,
  }));

  // SLA & progres investigasi. Pakai deadlineInvestigasi dari backend
  // kalau sudah di-set; kalau masih null, hitung mandiri: 45 hari sejak
  // tanggal kejadian (fallback ke createdAt kalau tanggalKejadian kosong).
  const tglAcuanRaw = row.tanggalKejadian || row.createdAt;
  const tglAcuan = tglAcuanRaw ? new Date(tglAcuanRaw) : null;
  let sisaLabel = "-";
  let deadlineInvestigasi = row.deadlineInvestigasi
    ? formatTanggalIndo(row.deadlineInvestigasi)
    : null;

  if (tglAcuan && !isNaN(tglAcuan.getTime())) {
    const deadlineDate = row.deadlineInvestigasi
      ? new Date(row.deadlineInvestigasi)
      : new Date(tglAcuan.getTime() + SLA_HARI_INVESTIGASI * MS_PER_HARI);
    if (!deadlineInvestigasi) {
      deadlineInvestigasi = formatTanggalIndo(deadlineDate.toISOString());
    }
    const sisaHari = Math.ceil((deadlineDate - new Date()) / MS_PER_HARI);
    if (sisaHari < 0) sisaLabel = `Terlambat ${Math.abs(sisaHari)} Hari`;
    else if (sisaHari <= 4) sisaLabel = `Kritis — ${sisaHari} Hari Lagi`;
    else if (sisaHari <= 10) sisaLabel = `Berjalan — ${sisaHari} Hari Lagi`;
    else sisaLabel = `Aman — ${sisaHari} Hari Lagi`;
  }

  // Progres & timeline stepper: berbasis STATUS_STEPPER_ORDER (satu-
  // satunya urutan resmi, lib/grading.js) — bukan histori aktivitas
  // (field `histories` backend masih [] di semua data uji, jadi tidak
  // dipakai sebagai sumber timeline).
  const stepIndex = STATUS_STEPPER_ORDER.indexOf(row.status);
  const progres =
    stepIndex >= 0
      ? Math.round(((stepIndex + 1) / STATUS_STEPPER_ORDER.length) * 100)
      : 0;
  const timeline = STATUS_STEPPER_ORDER.map((s, idx) => ({
    label: STATUS_STEP_LABEL[s] || s,
    done: stepIndex > idx,
    active: stepIndex === idx,
    tanggal:
      idx === 0 && row.createdAt
        ? formatTanggalIndo(row.createdAt)
        : stepIndex >= idx
          ? "-"
          : "",
  }));

  return {
    ...row,
    // Tampilkan trackingNumber (mis. "SR-2026-000002") sebagai ID, BUKAN
    // UUID mentah — aman karena semua panggilan API di halaman ini pakai
    // prop `laporanId` (UUID asli), bukan `data.id`, lihat `laporanId ??
    // data?.id` di tiap pemanggilan service.
    id: row.trackingNumber || row.id,
    judul,
    unitPelapor: row.lokasi || "-",
    identitasPelapor,
    kronologi: row.kronologi || "-",
    tanggalKejadian: formatTanggalIndo(row.tanggalKejadian),
    gradingLabel,
    gradingStyle,
    lampiran,
    timeline,
    sisaLabel,
    progres,
    deadlineInvestigasi: deadlineInvestigasi || "-",
    deadlineNote: row.deadlineInvestigasi
      ? "Sesuai tenggat yang ditetapkan admin."
      : `Dihitung otomatis: ${SLA_HARI_INVESTIGASI} hari sejak tanggal kejadian.`,
    investigatorList: row.pihakTerlibat || [],
  };
}

const ChevronIcon = () => (
  <svg
    className="h-4 w-4 text-slate-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

// ------------------------------------------------------------
// Pecah teks panjang jadi beberapa baris pendek supaya muat di
// dalam kotak SVG (perkiraan kasar berbasis jumlah karakter,
// cukup untuk kebutuhan diagram — bukan pengukuran font presisi).
// ------------------------------------------------------------
const wrapSvgText = (text, maxCharsPerLine = 22, maxLines = 5) => {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
    if (lines.length === maxLines - 1) break;
  }
  if (current) lines.push(current);
  if (lines.length > maxLines) lines.length = maxLines;
  const consumedWords = lines.join(" ").split(/\s+/).length;
  if (consumedWords < words.length && lines.length > 0) {
    lines[lines.length - 1] += " …";
  }
  return lines.length > 0 ? lines : ["-"];
};

// ------------------------------------------------------------
// Diagram Fishbone (Tulang Ikan) — digenerate otomatis dari daftar
// kategori & deskripsi pada Bagian 6 "Analisis Penyebab Masalah".
// Gaya visual mengikuti format cetak resmi Laporan RCA rumah sakit:
// ekor bulan sabit & tulang punggung solid hitam, kepala berbentuk
// panah solid hitam TANPA teks (insiden sudah tertulis terpisah di
// Bagian 1), dan kotak kategori hanya diletakkan di ATAS tulang
// punggung (tidak berselang-seling). Kalau kategori lebih dari
// ROW_MAX_ITEMS, sisanya otomatis lanjut ke baris fishbone berikutnya
// di bawahnya.
// ------------------------------------------------------------
const ROW_MAX_ITEMS = 6;

const FishboneRow = ({ items, rowWidth, rowHeight, offsetY }) => {
  const n = Math.max(items.length, 1);
  const boxWidth = 168;
  const boxHeight = 92;
  // Tulang punggung sekarang di TENGAH baris (bukan di 0.62 ke bawah lagi),
  // supaya ada ruang yang cukup buat kotak kategori di kedua sisi — atas
  // MAUPUN bawah — bukan cuma di atas semua seperti sebelumnya.
  const spineY = offsetY + rowHeight / 2;
  const spineStartX = 90;
  const spineEndX = rowWidth - 110;
  const segmentWidth = (spineEndX - spineStartX) / (n + 1);
  // Jarak kotak ke tulang punggung (dulu pakai boxY tetap dari atas baris).
  const gapDariTulang = 14;

  return (
    <g>
      {/* Ekor ikan — bulan sabit solid hitam */}
      <path
        d={`M ${spineStartX} ${spineY - 32} Q ${spineStartX - 42} ${spineY} ${spineStartX} ${spineY + 32} Q ${spineStartX - 16} ${spineY} ${spineStartX} ${spineY - 32} Z`}
        fill="#000000"
      />
      {/* Tulang punggung — bar tebal solid hitam */}
      <rect
        x={spineStartX}
        y={spineY - 7}
        width={spineEndX - spineStartX}
        height={14}
        rx={7}
        fill="#000000"
      />
      {/* Kepala ikan — panah solid hitam, sengaja tanpa teks */}
      <polygon
        points={`${spineEndX - 5},${spineY - 45} ${spineEndX + 55},${spineY} ${spineEndX - 5},${spineY + 45}`}
        fill="#000000"
      />

      {/* Kategori penyebab — BERSELANG-SELING: index genap (0,2,4,...) di
          ATAS tulang punggung, index ganjil (1,3,5,...) di BAWAH — bentuk
          fishbone/Ishikawa yang sebenarnya, bukan ditumpuk searah semua. */}
      {items.map((item, i) => {
        const anchorX = spineStartX + segmentWidth * (i + 1);
        const boxX = Math.min(
          Math.max(anchorX - boxWidth / 2, 10),
          rowWidth - boxWidth - 10,
        );
        const diAtas = i % 2 === 0;
        const boxY = diAtas
          ? spineY - gapDariTulang - boxHeight
          : spineY + gapDariTulang;
        const kategoriLines = wrapSvgText(item.kategori || "Kategori", 18, 1);
        const deskripsiLines = wrapSvgText(item.deskripsi || "-", 20, 4);

        return (
          <g key={item.id}>
            <line
              x1={boxX + boxWidth / 2}
              y1={diAtas ? boxY + boxHeight : boxY}
              x2={anchorX}
              y2={diAtas ? spineY - 8 : spineY + 8}
              stroke="#000000"
              strokeWidth="1.25"
            />
            <rect
              x={boxX}
              y={boxY}
              width={boxWidth}
              height={boxHeight}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth="1.25"
            />
            <text
              x={boxX + boxWidth / 2}
              y={boxY + 20}
              textAnchor="middle"
              fontSize="10.5"
              fontWeight="700"
              fill="#000000"
            >
              {kategoriLines[0]}
            </text>
            <text
              x={boxX + boxWidth / 2}
              y={boxY + 36}
              textAnchor="middle"
              fontSize="9.5"
              fill="#000000"
            >
              {deskripsiLines.map((line, li) => (
                <tspan key={li} x={boxX + boxWidth / 2} dy={li === 0 ? 0 : 12}>
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </g>
  );
};

const FishboneDiagram = ({ items }) => {
  const validItems = items.filter((it) => it.kategori || it.deskripsi);

  // Pecah jadi beberapa baris kalau kategori lebih dari ROW_MAX_ITEMS —
  // tiap baris jadi fishbone lengkap (ekor + tulang punggung + kepala)
  // tersendiri, disusun ke bawah.
  const rows = [];
  for (let i = 0; i < validItems.length; i += ROW_MAX_ITEMS) {
    rows.push(validItems.slice(i, i + ROW_MAX_ITEMS));
  }
  if (rows.length === 0) rows.push([]);

  const maxN = Math.max(...rows.map((r) => r.length), 1);
  const width = Math.max(760, maxN * 150 + 260);
  const rowHeight = 260;
  const rowGap = 40;
  const height = rows.length * rowHeight + (rows.length - 1) * rowGap;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      xmlns="http://www.w3.org/2000/svg"
    >
      {rows.map((rowItems, ri) => (
        <FishboneRow
          key={ri}
          items={rowItems}
          rowWidth={width}
          rowHeight={rowHeight}
          offsetY={ri * (rowHeight + rowGap)}
        />
      ))}
    </svg>
  );
};

// Wrapper kartu section form, dipakai berulang di seluruh halaman
const SectionCard = ({ icon: Icon, title, subtitle, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-blue-600" />
      <h2 className="text-sm font-bold text-slate-700">{title}</h2>
    </div>
    {subtitle && (
      <p className="-mt-3 mb-4 text-xs text-slate-400">{subtitle}</p>
    )}
    {children}
  </div>
);

// Tombol kecil untuk menambah baris/kolom dinamis
const AddRowButton = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-300 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
  >
    <Plus className="h-3.5 w-3.5" />
    {label}
  </button>
);

// Tombol hapus baris/kolom dinamis
const RemoveRowButton = ({ onClick, srLabel }) => (
  <button
    type="button"
    onClick={onClick}
    className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition"
  >
    <span className="sr-only">{srLabel || "Hapus"}</span>
    <Trash2 className="h-4 w-4" />
  </button>
);

const inputClass =
  "w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";
const textareaClass = `${inputClass} resize-none`;
const fieldLabelClass = "mb-1.5 block text-xs font-bold text-slate-600";

export default function DetailInvestigasiPage({ onNavigate, laporanId, user }) {
  // Gating role pakai pola yang sama persis dengan AdminNavMenu.jsx.
  const isSuperAdmin = user?.role === "ADMIN_UTAMA";

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // true kalau laporan ini belum pernah punya RCA tersimpan sama sekali —
  // dipakai supaya saveInvestigasi() tahu harus POST (create) bukan PUT.
  const [isNewRca, setIsNewRca] = useState(false);

  // ------------------------------------------------------------
  // Ambil detail laporan investigasi. Ini SEKARANG dua sumber yang
  // digabung jadi satu objek `data` (supaya sisa komponen di bawah ini
  // tidak perlu diubah lagi satu-satu):
  //   1. getLaporanDetail(id) - konteks laporan read-only (judul,
  //      kronologi, grading, timeline, dst.) dari detailLaporanService.js
  //   2. getInvestigasiDetail(id) - data RCA-nya sendiri (status,
  //      catatanRevisi, isi form kalau sudah pernah disimpan)
  // Kalau (2) balikin null, artinya laporan ini belum pernah punya RCA -
  // status awal dianggap DRAFT dan isNewRca jadi true.
  // ------------------------------------------------------------
  // 🔧 FIX 23 Juli 2026 (investigasi bug "form kosong setelah reload"):
  // fetchDetail() SEBELUMNYA tidak punya penjaga terhadap request ganda/
  // out-of-order. Network tab menunjukkan GET /reports/:id/rca kadang
  // terpanggil lebih dari sekali saat halaman dibuka (kemungkinan besar
  // React StrictMode double-invoke effect di dev, tapi bisa juga sebab
  // lain di parent/router) — TANPA penjaga ini, kalau ada 2 request
  // berjalan bersamaan dan yang SELESAI TERAKHIR bukan yang seharusnya
  // (out-of-order network response), hasilnya BISA menimpa balik hydrate
  // yang sudah benar dari request satunya, termasuk kemungkinan menimpa
  // dengan rca yang salah/tidak lengkap.
  //
  // requestIdRef melacak nomor urut pemanggilan fetchDetail() yang
  // TERAKHIR. Begitu sebuah panggilan selesai (resolve/reject), ia cuma
  // boleh mengubah state kalau requestId miliknya MASIH yang terbaru —
  // kalau sudah ada panggilan lebih baru yang dimulai sesudahnya, hasil
  // panggilan lama ini dibuang begitu saja (bukan dipakai untuk apa pun).
  const requestIdRef = useRef(0);

  const fetchDetail = useCallback(async (id) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const [laporanRes, rca] = await Promise.all([
        getLaporanDetail(id),
        detailInvestigasiService.getInvestigasiDetail(id),
      ]);

      // 🔍 DEBUG SEMENTARA — hapus lagi setelah isu "form kosong setelah
      // reload" ini selesai didiagnosis. Ringkasan field mana saja yang
      // TERISI (bukan seluruh objek) supaya gampang dibaca sekali lihat.
      // eslint-disable-next-line no-console
      console.log("[DEBUG fetchDetail] requestId:", requestId, "id:", id, {
        rcaNull: rca === null,
        insiden: !!rca?.insiden,
        metodeAnalisis: !!rca?.metodeAnalisis,
        tim: !!(rca?.investigatorUtama || rca?.tim?.ketuaTim),
        petaKronologi: rca?.petaKronologi?.length ?? 0,
        analisisLimaWhy: rca?.analisisLimaWhy?.length ?? 0,
        analisisPenyebabMasalah: rca?.analisisPenyebabMasalah?.length ?? 0,
        rekomendasiRencanaKerja: rca?.rekomendasiRencanaKerja?.length ?? 0,
        lampiran: rca?.lampiran?.length ?? 0,
      });

      // Kalau sudah ada panggilan fetchDetail() lain yang dimulai SETELAH
      // panggilan ini (mis. dobel-invoke StrictMode atau id berubah cepat
      // sebelum request pertama selesai), buang hasil ini — jangan sentuh
      // state sama sekali, biar tidak menimpa balik hasil yang lebih baru.
      if (requestId !== requestIdRef.current) {
        // eslint-disable-next-line no-console
        console.log(
          "[DEBUG fetchDetail] requestId",
          requestId,
          "sudah usang (current:",
          requestIdRef.current,
          ") — hasil dibuang.",
        );
        return;
      }

      setIsNewRca(rca === null);

      // getLaporanDetail() mengembalikan objek laporan flat langsung
      // (dikonfirmasi 21 Juli 2026 lewat tab Network — bukan ter-nest
      // { laporan: {...} } seperti dugaan awal). mapLaporanUntukTampilan()
      // menerjemahkan field mentahnya jadi field yang dipakai JSX di bawah.
      const laporanTampil = mapLaporanUntukTampilan(laporanRes);

      setData({
        ...laporanTampil,
        // 🔧 FIX (bug "lampiran bukti hilang di detail investigasi"):
        // laporanTampil.lampiran adalah lampiran BUKTI AWAL dari laporan
        // yang dikirim pelapor (row.attachments). rca.lampiran adalah
        // lampiran RCA/Bagian 9 (dokumen investigasi yang diupload admin)
        // — DUA HAL BERBEDA yang kebetulan sama-sama pakai nama key
        // `lampiran`. Sebelumnya ini digabung dengan `...(rca || {})` di
        // bawah, jadi begitu laporan sudah pernah punya RCA tersimpan,
        // rca.lampiran MENIMPA laporanTampil.lampiran — card "Lampiran
        // Bukti" jadi ikut nampilin (atau malah kehilangan) lampiran RCA,
        // bukan lampiran laporan aslinya lagi.
        //
        // Simpan lampiran laporan di key terpisah (`lampiranBukti`)
        // SEBELUM di-spread rca, supaya tidak mungkin ketimpa apa pun.
        lampiranBukti: laporanTampil.lampiran,
        // 🔧 FIX: laporanTampil.status di sini adalah status LAPORAN asli
        // (SUBMITTED/MENUNGGU_VERIFIKASI/DALAM_INVESTIGASI/dst dari
        // row.status di mapLaporanUntukTampilan), tapi field `status` di
        // bawah lalu ditimpa jadi status RCA (DRAFT/MENUNGGU_PERSETUJUAN/
        // dst). Simpan salinannya di key terpisah SEBELUM ketimpa, supaya
        // handleSaveDraft tahu status laporan yang sesungguhnya saat ini
        // (dipakai untuk memutuskan apakah perlu dimajukan ke
        // DALAM_INVESTIGASI atau tidak — lihat handleSaveDraft di bawah).
        statusLaporanAsli: laporanTampil.status,
        ...(rca || {}),
        // `lampiran` di sini SEKARANG SENGAJA selalu berarti lampiran RCA
        // (Bagian 9), konsisten dengan pemakaian rca.lampiran di tempat
        // lain (lihat hydrateFormFromRca & buatEntriLampiranBaru). Kalau
        // rca null/belum ada lampiran, default ke array kosong — bukan
        // ikut fallback ke lampiran laporan seperti sebelumnya.
        lampiran: rca?.lampiran || [],
        status: rca?.status || STATUS_RCA.DRAFT,
        catatanRevisi: rca?.catatanRevisi ?? null,
      });

      // 🔧 FIX bug "data RCA tersimpan tidak dimuat ulang ke form": kalau
      // laporan ini SUDAH pernah punya RCA tersimpan (rca !== null), isi
      // ulang semua field form individual dari situ. Sebelumnya cuma
      // investigatorList (lihat efek pencocokan nama di bawah) & beberapa
      // field laporan awal yang di-prefill — isian RCA sendiri (5 Why,
      // fishbone, rekomendasi, lampiran, dst) hilang setiap reload
      // walau datanya sebenarnya tersimpan di backend/in-memory store.
      hydrateFormFromRca(rca);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message || "Gagal memuat detail investigasi.");
      setData(null);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDetail(laporanId);
  }, [laporanId, fetchDetail]);

  // ------------------------------------------------------------
  // Form state — mengikuti struktur resmi Laporan RCA:
  // 1. Insiden, 2. Tim, 3. Data & Informasi, 4. Peta Kronologi,
  // 5. Analisis 5 Why, 6. Analisis Penyebab Masalah (Fishbone),
  // 7. Rekomendasi & Rencana Kerja, 8. Jadwal Perbaikan, 9. Lampiran
  // ------------------------------------------------------------
  const [metodeAnalisis, setMetodeAnalisis] = useState("");

  // 1. Insiden
  const [insiden, setInsiden] = useState("");

  // 2. Tim (Ketua Tim & Anggota dipakai juga oleh kartu "Tugaskan")
  const [investigatorUtama, setInvestigatorUtama] = useState(""); // Ketua Tim — ID akun
  const [sekretarisTim, setSekretarisTim] = useState(""); // ID akun
  const [timAnggota, setTimAnggota] = useState([]); // Anggota — array ID akun
  // Input teks sementara untuk field "Tambah Anggota Tim" manual —
  // diketik lalu ditambahkan sebagai tag ke `timAnggota`.
  const [anggotaBaruInput, setAnggotaBaruInput] = useState("");

  // 3. Mengumpulkan data dan informasi
  const [observasi, setObservasi] = useState("");
  const [dokumentasi, setDokumentasi] = useState("");
  // Kronologi singkat & Ringkasan Laporan — mengikuti struktur form RCA resmi
  // (bagian "b. Dokumentasi" > "Kronologi singkat" + "Ringkasan Laporan").
  // Semua field di bawah ini diisi MANUAL oleh admin investigasi (bukan lagi
  // read-only dari `data`), mengacu ke tabel standar (grading matrix, bands/
  // level, tipe insiden) — lihat tombol "Lihat Panduan" di sebelah judul
  // "Ringkasan Laporan" pada form.
  const [kronologiSingkat, setKronologiSingkat] = useState("");
  const [jenisInsiden, setJenisInsiden] = useState("");
  const [tipeSubInsiden, setTipeSubInsiden] = useState("");
  const [tanggalInsiden, setTanggalInsiden] = useState("");
  const [riskGradingMatrix, setRiskGradingMatrix] = useState("");
  const [tindakanBandsLevel, setTindakanBandsLevel] = useState("");
  const [interviewList, setInterviewList] = useState([emptyInterview()]);

  // 4. Peta Kronologi Kejadian (tabular timeline)
  const [kronologiKolom, setKronologiKolom] = useState([emptyKronologiKolom()]);

  // 5. Analisis Informasi 5 WHY
  const [fiveWhy, setFiveWhy] = useState([emptyWhyRow()]);

  // 6. Analisis Penyebab Masalah (Fishbone / 4M+)
  const [faktorPenyebab, setFaktorPenyebab] = useState(
    DEFAULT_FAKTOR_KATEGORI.map((k) => emptyFaktor(k)),
  );

  // 7 & 8. Rekomendasi Dan Rencana Kerja + Jadwal Perbaikan — SATU array
  // (lihat catatan di emptyRencanaPerbaikan()), dipakai bareng oleh kedua
  // SectionCard supaya jumlah barisnya tidak mungkin lagi berbeda.
  const [rencanaPerbaikan, setRencanaPerbaikan] = useState([
    emptyRencanaPerbaikan(),
  ]);

  // 9. Lampiran
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  // Pesan penolakan file lampiran (format tidak didukung / ukuran lebih
  // dari batas) — DIPISAH dari `saveError` supaya keterangannya bisa
  // langsung tampil DI DALAM Card "9. Lampiran" (dekat dropzone), bukan
  // menumpuk di banner error umum yang letaknya jauh di bawah halaman.
  const [lampiranError, setLampiranError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [agreeConfirm, setAgreeConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // 🔧 FIX 23 Juli 2026: id baris `rencanaPerbaikan` yang belum lengkap
  // (lihat validasiSemuaRencanaPerbaikan) — dipakai untuk highlight visual
  // baris terkait di Bagian 7 & 8 supaya user tidak perlu menebak baris
  // mana yang bikin validasi backend gagal.
  const [incompleteRencanaIds, setIncompleteRencanaIds] = useState(
    () => new Set(),
  );
  // 🔧 25 Juli 2026: hasil parsePesanValidasiTerstruktur() dari pesan
  // validasi backend (kalau ada) — dipakai untuk menandai merah field
  // & baris yang bermasalah LANGSUNG di kartu/Bagian masing-masing,
  // supaya tidak numpuk jadi satu daftar panjang di kotak bawah. null
  // kalau belum pernah submit / error terakhir bukan error validasi.
  const [validasiStruktur, setValidasiStruktur] = useState(null);

  // Keputusan Admin Utama saat status laporan "menunggu_persetujuan"
  const [isDeciding, setIsDeciding] = useState(false);
  const [catatanRevisi, setCatatanRevisi] = useState("");

  // ------------------------------------------------------------
  // Prefill awal field Tim dari data.investigatorList (nama-nama pihak
  // terlibat yang sudah tercatat di laporan awal, lihat mapping baris
  // ~425 `investigatorList: row.pihakTerlibat`) — sekadar starting
  // point yang bisa diedit manual oleh admin, bukan sumber kebenaran
  // final. Field ini teks manual, jadi tidak perlu lookup/pencocokan ID
  // apapun — nama dari backend langsung dipakai apa adanya.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!data) return;
    // Jangan timpa pilihan yang sudah pernah diisi/diubah admin
    if (investigatorUtama) return;

    const daftarNama = (data.investigatorList || []).filter(Boolean);
    if (daftarNama.length === 0) return;

    setInvestigatorUtama(daftarNama[0]);
    setTimAnggota(daftarNama);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ------------------------------------------------------------
  // Prefill "Kronologi Singkat" & field Ringkasan Laporan dari data laporan
  // awal (kalau backend sudah pernah mengirim nilainya), begitu detail
  // laporan siap. Admin investigasi tetap bisa menyunting semua field ini;
  // jangan timpa kalau sudah pernah diubah.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!data) return;
    if (!kronologiSingkat && data.kronologi)
      setKronologiSingkat(data.kronologi);
    if (!jenisInsiden && data.jenisInsiden) setJenisInsiden(data.jenisInsiden);
    if (!tipeSubInsiden && data.tipeSubInsiden)
      setTipeSubInsiden(data.tipeSubInsiden);
    if (!tanggalInsiden && data.tanggalKejadian)
      setTanggalInsiden(data.tanggalKejadian);
    if (!riskGradingMatrix && data.gradingLabel)
      setRiskGradingMatrix(data.gradingLabel);
    if (!tindakanBandsLevel && data.tindakanBandsLevel)
      setTindakanBandsLevel(data.tindakanBandsLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ------------------------------------------------------------
  // 🔧 FIX bug "isian RCA hilang setelah reload": kebalikan dari
  // buildPayload() di bawah — menerjemahkan payload RCA yang sudah
  // tersimpan (hasil getInvestigasiDetail()) balik jadi state form
  // individual. Dipanggil dari fetchDetail() setiap kali data RCA
  // (bukan RCA baru) berhasil diambil.
  //
  // Sengaja pakai `if (kondisi) setX(...)` per field (bukan menimpa semua
  // sekaligus tanpa syarat) supaya field yang memang belum pernah diisi
  // di backend tidak menimpa nilai lokal dengan kosong secara tidak
  // sengaja. Untuk RCA baru (rca === null), fungsi ini tidak melakukan
  // apa-apa — form tetap kosong seperti semula, dan fallback pencocokan
  // nama investigator (efek di atas) yang mengambil alih.
  // ------------------------------------------------------------
  const hydrateFormFromRca = (rca) => {
    // 🔍 DEBUG SEMENTARA — hapus lagi setelah isu "form kosong setelah
    // reload" ini selesai didiagnosis.
    // eslint-disable-next-line no-console
    console.log("[DEBUG hydrate v2] dipanggil dengan rca:", rca);
    if (!rca) {
      // eslint-disable-next-line no-console
      console.log("[DEBUG hydrate v2] rca NULL/kosong — hydrate dibatalkan.");
      return;
    }

    if (rca.metodeAnalisis) setMetodeAnalisis(rca.metodeAnalisis);
    if (rca.insiden) setInsiden(rca.insiden);

    // Tim — utamakan struktur nested `tim.{ketuaTim,sekretaris,anggota}`
    // (dari saveInvestigasi, format yang dipakai form ini sekarang).
    // Fallback ke field flat investigatorUtama/sekretarisTim/timAnggota
    // tetap dijaga untuk kompatibilitas data lama, dari saat fitur
    // "Tugaskan" (assignInvestigators) masih ada sebelum dihapus 25 Juli
    // 2026 — lihat catatan di dekat import statement kenapa dihapus.
    const ketuaTim = rca.tim?.ketuaTim || rca.investigatorUtama;
    const sekretaris = rca.tim?.sekretaris || rca.sekretarisTim;
    const anggota = rca.tim?.anggota || rca.timAnggota;
    if (ketuaTim) setInvestigatorUtama(ketuaTim);
    if (sekretaris) setSekretarisTim(sekretaris);
    if (Array.isArray(anggota) && anggota.length > 0) setTimAnggota(anggota);

    // 3. Data & Informasi
    const di = rca.dataInformasi;
    if (di) {
      if (di.observasi) setObservasi(di.observasi);
      if (di.dokumentasi) setDokumentasi(di.dokumentasi);
      if (di.kronologiSingkat) setKronologiSingkat(di.kronologiSingkat);
      const rl = di.ringkasanLaporan;
      if (rl) {
        if (rl.jenisInsiden) setJenisInsiden(rl.jenisInsiden);
        if (rl.tipeSubInsiden) setTipeSubInsiden(rl.tipeSubInsiden);
        if (rl.tanggalInsiden) setTanggalInsiden(rl.tanggalInsiden);
        if (rl.riskGradingMatrix) setRiskGradingMatrix(rl.riskGradingMatrix);
        if (rl.tindakanBandsLevel) setTindakanBandsLevel(rl.tindakanBandsLevel);
      }
      if (Array.isArray(di.interview) && di.interview.length > 0) {
        setInterviewList(di.interview.map((value) => ({ id: genId(), value })));
      }
    }

    // 4. Peta Kronologi
    if (Array.isArray(rca.petaKronologi) && rca.petaKronologi.length > 0) {
      setKronologiKolom(rca.petaKronologi);
    }

    // 5. Analisis 5 Why — disimpan sebagai poin string polos (tanpa id),
    // rekonstruksi jadi baris ber-ID lagi supaya bisa disunting di form.
    if (Array.isArray(rca.analisisLimaWhy) && rca.analisisLimaWhy.length > 0) {
      setFiveWhy(
        rca.analisisLimaWhy.map((row) => ({
          id: genId(),
          poin:
            (row.poin || []).length > 0
              ? row.poin.map((value) => ({ id: genId(), value }))
              : [emptyWhyPoin()],
        })),
      );
    }

    // 6. Analisis Penyebab Masalah (Fishbone / 4M+)
    if (
      Array.isArray(rca.analisisPenyebabMasalah) &&
      rca.analisisPenyebabMasalah.length > 0
    ) {
      setFaktorPenyebab(rca.analisisPenyebabMasalah);
    }

    // 7 & 8. Rekomendasi Dan Rencana Kerja + Jadwal Perbaikan — gabungkan
    // 2 array dari service jadi 1 daftar `rencanaPerbaikan` (lihat
    // gabungkanRencanaPerbaikan()). Tetap dijalankan meski salah satu
    // array kosong, supaya baris "pincang" dari data lama (sebelum fix
    // sinkronisasi ini) tetap kelihatan, bukan hilang diam-diam.
    if (
      (Array.isArray(rca.rekomendasiRencanaKerja) &&
        rca.rekomendasiRencanaKerja.length > 0) ||
      (Array.isArray(rca.jadwalPerbaikan) && rca.jadwalPerbaikan.length > 0)
    ) {
      setRencanaPerbaikan(
        gabungkanRencanaPerbaikan(
          rca.rekomendasiRencanaKerja,
          rca.jadwalPerbaikan,
        ),
      );
    }

    // 9. Lampiran — hanya metadata (nama/url/ukuran) yang tersimpan di
    // backend. TIDAK ada objek File asli untuk lampiran yang sudah pernah
    // diupload sebelumnya (biner-nya sudah ada di server/store, cukup
    // direferensikan lewat url) — objek File hanya ada untuk lampiran BARU
    // yang belum diupload, lihat handleDrop/handleFileSelect di bawah.
    if (Array.isArray(rca.lampiran) && rca.lampiran.length > 0) {
      setUploadedFiles(
        rca.lampiran.map((item) =>
          typeof item === "string"
            ? { id: genId(), nama: item, file: null, url: null, ukuran: 0 }
            : {
                id: genId(),
                nama: item.nama,
                file: null,
                url: item.url ?? null,
                ukuran: item.ukuran ?? 0,
              },
        ),
      );
    }
  };

  const buildPayload = (status, lampiranOverride) => ({
    metodeAnalisis,
    insiden,
    tim: {
      ketuaTim: investigatorUtama,
      sekretaris: sekretarisTim,
      anggota: timAnggota,
    },
    dataInformasi: {
      observasi,
      dokumentasi,
      kronologiSingkat,
      ringkasanLaporan: {
        jenisInsiden,
        tipeSubInsiden,
        tanggalInsiden,
        riskGradingMatrix,
        tindakanBandsLevel,
      },
      interview: interviewList.map((i) => i.value).filter(Boolean),
    },
    petaKronologi: kronologiKolom,
    analisisLimaWhy: fiveWhy.map((row) => ({
      poin: row.poin.map((p) => p.value).filter(Boolean),
    })),
    analisisPenyebabMasalah: faktorPenyebab,
    // Diturunkan dari SATU array `rencanaPerbaikan` (bukan 2 state
    // terpisah lagi) — dijamin selalu sama panjang, jadi backend tidak
    // akan lagi terima entry yang setengah kosong akibat mismatch index.
    rekomendasiRencanaKerja: rencanaPerbaikan.map(
      ({ id, akarMasalah, rekomendasi }) => ({ id, akarMasalah, rekomendasi }),
    ),
    jadwalPerbaikan: rencanaPerbaikan.map(
      ({ id, kegiatan, pelaksana, target }, idx) => ({
        id,
        kegiatan,
        pelaksana,
        target,
        no: idx + 1,
      }),
    ),
    // Hanya metadata yang ikut payload JSON RCA — objek File asli TIDAK
    // bisa (dan tidak boleh) di-serialize ke sini. Biner asli diupload
    // terpisah lewat uploadPendingLampiran()/uploadLampiranInvestigasi()
    // ke POST /reports/:id/rca/attachments sebelum payload ini dikirim.
    lampiran: (lampiranOverride ?? uploadedFiles).map(
      ({ nama, url, ukuran }) => ({ nama, url, ukuran }),
    ),
    status, // salah satu nilai STATUS_RCA (lihat detailInvestigasiService.js)
  });

  // ------------------------------------------------------------
  // 🔧 FIX bug "file lampiran tidak pernah disimpan sebagai file asli":
  // upload semua lampiran yang masih berupa objek File lokal (belum
  // pernah diupload — ditandai file != null && belum ada url) ke
  // endpoint attachment asli, lalu ganti entry lokalnya dengan metadata
  // hasil upload (nama/url/ukuran dari server). Dipanggil sebelum
  // saveInvestigasi() supaya payload RCA yang disimpan mereferensikan
  // lampiran yang beneran sudah ada di server.
  // ------------------------------------------------------------
  const uploadPendingLampiran = async (reportId) => {
    const pending = uploadedFiles.filter((f) => f.file && !f.url);
    if (pending.length === 0) return uploadedFiles;

    const hasilUpload = await Promise.all(
      pending.map((item) =>
        detailInvestigasiService
          .uploadLampiranInvestigasi(reportId, item.file)
          .then((res) => ({ ...item, ...res, file: null }))
          .catch((err) => {
            // Lihat catatan di isNetworkErrorTanpaResponse() di atas: kalau
            // errornya tipe ini, "Network Error" mentah TIDAK informatif
            // untuk admin — ganti dengan pesan yang menyebut file mana
            // yang gagal, ukurannya, dan dugaan penyebab + saran konkret.
            // Error lain (mis. 4xx/5xx dari server, yang PASTI punya
            // err.response dengan pesan spesifik) dibiarkan lewat apa
            // adanya supaya tetap ditangani ambilPesanMentahBackend().
            if (isNetworkErrorTanpaResponse(err)) {
              // File kecil (jauh dari batas 10MB) hampir pasti gagal karena
              // koneksi, BUKAN karena ukuran — jadi jangan sebut ukuran
              // sebagai dugaan penyebab kalau filenya memang kecil (lihat
              // kasus nyata: file 1.1MB gagal, pesan lama tetap menuduh
              // ukuran padahal jelas bukan itu). Ambang batas 5MB dipakai
              // sebagai potongan kasar "mendekati batas 10MB". Pesan
              // sengaja dibuat pendek — cukup 1 baris, tanpa penjelasan
              // teknis panjang.
              const kemungkinanUkuran = item.ukuran > 5 * 1024 * 1024;
              throw new Error(
                kemungkinanUkuran
                  ? `"${item.nama}" gagal diupload — ukuran terlalu besar (${formatUkuranFile(item.ukuran)}).`
                  : `"${item.nama}" gagal diupload. Coba lagi.`,
              );
            }
            throw err;
          }),
      ),
    );

    const merged = uploadedFiles.map(
      (item) => hasilUpload.find((u) => u.id === item.id) || item,
    );
    setUploadedFiles(merged);
    return merged;
  };

  // ------------------------------------------------------------
  // 🔧 FIX bug "Request failed with status code 404" saat Simpan Draft /
  // Selesaikan pada RCA yang BELUM PERNAH tersimpan (isNewRca === true):
  // backend menolak POST /rca/attachments dengan 404 "RCA tidak ditemukan
  // untuk laporan ini" kalau baris RCA-nya sendiri belum ada di database
  // (endpoint attachment butuh RCA sudah exist lebih dulu). Urutan lama
  // (upload lampiran -> baru saveInvestigasi) cuma valid untuk RCA yang
  // SUDAH ada. Untuk RCA baru, urutannya harus dibalik:
  //   1. saveInvestigasi() dulu TANPA lampiran yang masih pending (belum
  //      diupload) -> RCA baris kosong resmi tercatat di backend
  //   2. baru uploadPendingLampiran() -> sekarang endpoint attachment
  //      punya RCA untuk direferensikan, tidak lagi 404
  //   3. kalau ada lampiran yang baru terupload di langkah 2, susulkan
  //      saveInvestigasi() sekali lagi (PUT, isNew:false) supaya metadata
  //      lampirannya ikut tersimpan di RCA
  // Untuk RCA yang sudah ada (isNewRca === false), urutan lama tetap
  // dipakai (upload dulu, baru satu kali save) — tidak ada masalah di
  // situ karena baris RCA-nya memang sudah pasti ada.
  // ------------------------------------------------------------
  const simpanRcaDenganLampiran = async (status) => {
    const reportId = laporanId ?? data?.id;

    if (isNewRca) {
      // Langkah 1: buat RCA dulu, lampiran pending (belum ada url) belum
      // ikut disebut di payload awal ini.
      await detailInvestigasiService.saveInvestigasi(
        reportId,
        buildPayload(
          status,
          uploadedFiles.filter((f) => f.url),
        ),
        { isNew: true },
      );
      setIsNewRca(false);

      // Langkah 2: sekarang RCA sudah ada di backend, aman upload lampiran.
      const lampiranTerbaru = await uploadPendingLampiran(reportId);

      // Langkah 3: kalau ada lampiran baru yang barusan terupload, susulkan
      // update supaya metadatanya ikut tersimpan di RCA.
      const adaLampiranBaru = lampiranTerbaru.some(
        (f, idx) => f.url && f.url !== uploadedFiles[idx]?.url,
      );
      if (adaLampiranBaru) {
        await detailInvestigasiService.saveInvestigasi(
          reportId,
          buildPayload(status, lampiranTerbaru),
          { isNew: false },
        );
      }
      return;
    }

    // RCA sudah ada — urutan lama tetap aman.
    const lampiranTerbaru = await uploadPendingLampiran(reportId);
    await detailInvestigasiService.saveInvestigasi(
      reportId,
      buildPayload(status, lampiranTerbaru),
      { isNew: false },
    );
  };

  // 🔧 25 Juli 2026: dipakai bareng oleh handleSaveDraft & handleFinalizeSubmit
  // supaya perilakunya konsisten — parse pesan error backend, lalu:
  // - kalau formatnya validasi Zod yang bisa dipetakan ke field/baris
  //   (adaError true): simpan strukturnya ke validasiStruktur (dipakai
  //   tiap kartu untuk highlight merah sendiri-sendiri) + tampilkan
  //   banner PENDEK yang mengarahkan admin ke bagian yang ditandai merah
  //   (bukan daftar panjang semua field yang belum diisi).
  // - kalau bukan (mis. error jaringan/server, atau pesan custom yang
  //   sudah manusiawi dari backend): validasiStruktur dikosongkan lagi
  //   (supaya highlight lama tidak nyangkut) & pesan mentahnya dipakai
  //   apa adanya di banner, sama seperti sebelumnya.
  const terapkanErrorBackend = (err, pesanDefault) => {
    const pesanMentah = ambilPesanMentahBackend(err, pesanDefault);
    const struktur = parsePesanValidasiTerstruktur(pesanMentah);

    if (!struktur.adaError) {
      setValidasiStruktur(null);
      setSaveError(pesanMentah);
      return;
    }

    setValidasiStruktur(struktur);
    setSaveError(
      struktur.lainnya.length > 0
        ? "Beberapa data belum lengkap, mohon dilengkapi dulu:\n" +
            struktur.lainnya.map((b) => `• ${b}`).join("\n")
        : "Beberapa data belum lengkap — bagian yang ditandai merah di bawah perlu dilengkapi dulu sebelum bisa disimpan.",
    );
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveError(null);
    setValidasiStruktur(null);
    try {
      await simpanRcaDenganLampiran(STATUS_RCA.DRAFT);
      setData((prev) => (prev ? { ...prev, status: STATUS_RCA.DRAFT } : prev));

      // 🔧 FIX: begitu admin mulai isi & simpan draft RCA, majukan status
      // laporan keseluruhan ke DALAM_INVESTIGASI — supaya stepper di
      // Manajemen Insiden / Daftar Laporan langsung mencerminkan bahwa
      // laporan ini sedang dikerjakan, tanpa perlu menunggu sampai RCA-nya
      // diajukan untuk persetujuan (handleFinalizeSubmit sudah melakukan
      // ini, tapi Simpan Draft sebelumnya belum sama sekali).
      //
      // Penjaga: HANYA dilakukan kalau status laporan saat ini masih tahap
      // awal (SUBMITTED/MENUNGGU_VERIFIKASI — lihat
      // STATUS_BELUM_MULAI_INVESTIGASI di lib/grading.js). Kalau laporan
      // ternyata sudah DALAM_INVESTIGASI/SELESAI/dst (mis. admin membuka
      // ulang RCA yang sudah lama untuk sekadar mengecek/edit kecil),
      // SENGAJA tidak disentuh — supaya tidak "memundurkan" status laporan
      // yang sudah lebih maju.
      //
      // Tidak menggagalkan penyimpanan draft kalau panggilan ini gagal —
      // draft RCA-nya sendiri sudah aman tersimpan, jadi cukup dicatat
      // sebagai warning (sama seperti pola di handleFinalizeSubmit /
      // handleKeputusanPersetujuan).
      if (STATUS_BELUM_MULAI_INVESTIGASI.includes(data?.statusLaporanAsli)) {
        try {
          await updateStatusLaporan(
            laporanId ?? data?.id,
            STATUS.DALAM_INVESTIGASI,
          );
          setData((prev) =>
            prev
              ? { ...prev, statusLaporanAsli: STATUS.DALAM_INVESTIGASI }
              : prev,
          );
        } catch (errStatus) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DetailInvestigasiPage] Draft RCA sudah tersimpan, tapi gagal " +
              "menyinkronkan status laporan keseluruhan jadi Dalam " +
              "Investigasi otomatis — mungkin perlu diubah manual lewat " +
              "Daftar Laporan.",
            errStatus,
          );
        }
      }
    } catch (err) {
      terapkanErrorBackend(err, "Gagal menyimpan draft.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalizeSubmit = async () => {
    // 🔧 FIX 23 Juli 2026: cek kelengkapan Bagian 7/8 di sisi frontend
    // dulu SEBELUM kirim apa pun ke backend. Sebelumnya baris yang baru
    // ditambah lewat "+Tambah Akar Masalah" / "+Tambah Kegiatan" tapi
    // cuma diisi separuh (mis. Bagian 8 keisi, Bagian 7 kelupaan) baru
    // ketahuan SETELAH backend menolak dengan pesan validasi mentah
    // ("body.rencanaPerbaikanEntries.1.akarMasalah: Akar masalah harus
    // diisi") — user harus scroll & menebak baris mana yang dimaksud.
    const { lengkap, idBarisBelumLengkap, nomorBarisBelumLengkap } =
      validasiSemuaRencanaPerbaikan(rencanaPerbaikan);

    if (!lengkap) {
      setIncompleteRencanaIds(idBarisBelumLengkap);
      const daftarNomor = nomorBarisBelumLengkap.join(", ");
      setSaveError(
        `Baris ke-${daftarNomor} di Bagian 7 (Rekomendasi & Rencana Kerja) ` +
          `dan Bagian 8 (Jadwal Perbaikan) belum lengkap — kelima kolom ` +
          `(Akar Masalah, Rekomendasi/Solusi, Kegiatan, Pelaksana, Target) ` +
          `harus diisi semua untuk baris yang sama. Baris terkait ditandai ` +
          `merah di bawah.`,
      );
      return;
    }
    setIncompleteRencanaIds(new Set());

    setIsSaving(true);
    setSaveError(null);
    setValidasiStruktur(null);
    try {
      // Simpan dulu sebagai MENUNGGU_PERSETUJUAN apapun rolenya — approval
      // (termasuk yang dilakukan Admin Utama sendiri) selalu lewat endpoint
      // /persetujuan, bukan lewat set status "DISETUJUI" langsung di sini.
      await simpanRcaDenganLampiran(STATUS_RCA.MENUNGGU_PERSETUJUAN);

      // ASUMSI (PERLU DIKONFIRMASI ke backend): kalau yang submit adalah
      // Admin Utama sendiri, langsung susulkan approval otomatis supaya
      // laporan tertutup seketika, sama seperti perilaku versi lama.
      if (isSuperAdmin) {
        await detailInvestigasiService.putuskanPersetujuan(
          laporanId ?? data?.id,
          { keputusan: "setuju", catatan: "" },
        );

        // 🔧 FIX 23 Juli 2026: RCA yang baru saja di-auto-approve di atas
        // cuma mengubah status RCA-nya sendiri (STATUS_RCA.DISETUJUI/
        // FINAL) — status laporan keseluruhan (laporan.status, yang
        // dipakai stepper di DetailLaporanPageAdmin.jsx / Daftar Laporan)
        // TIDAK ikut berubah otomatis kalau tidak disusulkan di sini.
        // Sebelumnya admin harus buka lagi laporan lewat Daftar Laporan
        // dan geser stepper manual ke "Selesai" walau RCA-nya sudah
        // benar-benar kelar dikerjakan & disetujui dari halaman Analisis
        // ini. Disusulkan agar keduanya langsung sinkron dalam satu aksi.
        //
        // Sengaja tidak menggagalkan seluruh proses submit RCA kalau
        // panggilan ini gagal (mis. endpoint status laporan lagi
        // bermasalah) — RCA-nya sendiri sudah tersimpan & disetujui,
        // jadi cukup dicatat sebagai warning, bukan error blocking, biar
        // admin tidak kehilangan hasil kerja RCA yang sudah beres.
        try {
          await updateStatusLaporan(laporanId ?? data?.id, STATUS.SELESAI);
        } catch (errStatus) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DetailInvestigasiPage] RCA sudah disetujui, tapi gagal " +
              "menyinkronkan status laporan keseluruhan jadi Selesai " +
              "otomatis — mungkin perlu diubah manual lewat Daftar Laporan.",
            errStatus,
          );
        }
      } else {
        // 🔧 FIX 23 Juli 2026: kalau yang submit BUKAN Admin Utama, RCA-nya
        // masih MENUNGGU_PERSETUJUAN (belum boleh langsung Selesai — cuma
        // Admin Utama yang boleh menyetujui, lihat gating di
        // DetailLaporanPageAdmin.jsx). Tapi status laporan keseluruhan
        // JANGAN dibiarkan diam di tahap lama (mis. "Baru") — laporan ini
        // sekarang sudah benar-benar dikerjakan & dikirim untuk direview,
        // jadi majukan ke "Investigasi" (DALAM_INVESTIGASI) supaya
        // tercermin di stepper Daftar Laporan bahwa laporan sedang
        // ditangani & menunggu keputusan Admin Utama. Begitu Admin Utama
        // approve lewat handleKeputusanPersetujuan(), baru status ini naik
        // lagi jadi SELESAI.
        try {
          await updateStatusLaporan(
            laporanId ?? data?.id,
            STATUS.DALAM_INVESTIGASI,
          );
        } catch (errStatus) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DetailInvestigasiPage] RCA sudah dikirim untuk persetujuan, " +
              "tapi gagal menyinkronkan status laporan keseluruhan jadi " +
              "Investigasi otomatis — mungkin perlu diubah manual lewat " +
              "Daftar Laporan.",
            errStatus,
          );
        }
      }

      setShowModal(false);
      // Jangan asumsikan status baru dari sisi frontend — re-fetch supaya
      // konsisten dengan backend (baik data laporan maupun data RCA).
      await fetchDetail(laporanId ?? data?.id);
      if (!isSuperAdmin) {
        onNavigate?.("analysis");
      }
    } catch (err) {
      terapkanErrorBackend(err, "Gagal mengirim laporan investigasi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Keputusan Admin Utama atas laporan yang statusnya
  // MENUNGGU_PERSETUJUAN — reuse pattern dari panel Feedback di
  // DetailLaporanPageAdmin.jsx.
  const handleKeputusanPersetujuan = async (keputusan) => {
    if (keputusan === "revisi" && !catatanRevisi.trim()) {
      setSaveError("Catatan revisi wajib diisi kalau meminta perbaikan.");
      return;
    }
    setIsDeciding(true);
    setSaveError(null);
    try {
      await detailInvestigasiService.putuskanPersetujuan(
        laporanId ?? data?.id,
        { keputusan, catatan: catatanRevisi.trim() },
      );

      // 🔧 FIX 23 Juli 2026: sama seperti di handleFinalizeSubmit — kalau
      // keputusannya "setuju", ikut sinkronkan status laporan keseluruhan
      // jadi Selesai di sini juga, supaya admin tidak perlu pindah ke
      // Daftar Laporan dulu buat geser stepper manual. Kalau "revisi",
      // SENGAJA tidak disentuh — laporan memang belum selesai, masih
      // menunggu perbaikan dari tim investigasi.
      if (keputusan === "setuju") {
        try {
          await updateStatusLaporan(laporanId ?? data?.id, STATUS.SELESAI);
        } catch (errStatus) {
          // eslint-disable-next-line no-console
          console.warn(
            "[DetailInvestigasiPage] RCA sudah disetujui, tapi gagal " +
              "menyinkronkan status laporan keseluruhan jadi Selesai " +
              "otomatis — mungkin perlu diubah manual lewat Daftar Laporan.",
            errStatus,
          );
        }
      }

      setCatatanRevisi("");
      // Jangan asumsikan status baru dari sisi frontend (dulu: langsung
      // set "disetujui"/"draft" lokal) — re-fetch supaya status yang
      // ditampilkan (DISETUJUI/FINAL/PERLU_REVISI) sungguhan berasal dari
      // backend, termasuk kemungkinan status laporan keseluruhan yang ikut
      // berubah otomatis saat approval.
      await fetchDetail(laporanId ?? data?.id);
      // Sengaja TIDAK navigate ke halaman lain di sini — baik "setuju"
      // maupun "revisi", Admin Utama tetap di halaman Detail Investigasi ini.
    } catch (err) {
      setSaveError(err.message || "Gagal menyimpan keputusan persetujuan.");
    } finally {
      setIsDeciding(false);
    }
  };

  // Anggota Tim Multidisiplin — tag nama manual, ditambah/dihapus
  // berdasarkan teks (bukan lagi ID akun, karena field ini sekarang
  // input bebas, lihat catatan di atas import statement).
  const handleRemoveAnggota = (nama) =>
    setTimAnggota(timAnggota.filter((m) => m !== nama));
  const handleTambahAnggota = () => {
    const nama = anggotaBaruInput.trim();
    if (!nama) return;
    if (!timAnggota.includes(nama)) setTimAnggota([...timAnggota, nama]);
    setAnggotaBaruInput("");
  };

  // 🔧 FIX bug "file lampiran tidak pernah disimpan sebagai file asli":
  // sebelumnya cuma f.name (string) yang disimpan ke state, objek File
  // aslinya langsung dibuang — jadi tidak ada biner yang bisa benar-benar
  // diupload ke POST /rca/attachments. Sekarang tiap entry menyimpan objek
  // File utuh di properti `file`, sampai berhasil diupload (lihat
  // uploadPendingLampiran) dan diganti dengan metadata dari server (url).
  const buatEntriLampiranBaru = (files) =>
    files.map((f) => ({
      id: genId(),
      nama: f.name,
      file: f,
      url: null,
      ukuran: f.size,
    }));

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const alasanTolak = files
      .map((f) => alasanTolakLampiranRca(f))
      .filter(Boolean);
    const valid = files.filter((f) => !alasanTolakLampiranRca(f));

    // Keterangan lengkap kenapa file ditolak (format salah / kelebihan
    // ukuran) ditampilkan LANGSUNG di Card "9. Lampiran", bukan di banner
    // error umum di bawah halaman — supaya admin tidak perlu scroll untuk
    // tahu file mana yang bermasalah dan kenapa.
    setLampiranError(
      alasanTolak.length > 0
        ? `${alasanTolak.length} file ditolak — ${alasanTolak.join("; ")}.`
        : null,
    );

    if (valid.length > 0) {
      setUploadedFiles((prev) => [...prev, ...buatEntriLampiranBaru(valid)]);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const alasanTolak = files
      .map((f) => alasanTolakLampiranRca(f))
      .filter(Boolean);
    const valid = files.filter((f) => !alasanTolakLampiranRca(f));

    setLampiranError(
      alasanTolak.length > 0
        ? `${alasanTolak.length} file ditolak — ${alasanTolak.join("; ")}.`
        : null,
    );

    if (valid.length > 0) {
      setUploadedFiles((prev) => [...prev, ...buatEntriLampiranBaru(valid)]);
    }
    e.target.value = ""; // reset supaya bisa pilih file yang sama lagi
  };

  const handleRemoveFile = (id) => {
    setUploadedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // ------------------------------------------------------------
  // Helper CRUD generik untuk daftar dinamis (interview, kronologi,
  // faktor penyebab, rekomendasi, jadwal perbaikan)
  // ------------------------------------------------------------
  const updateListField = (setter, id, field, value) =>
    setter((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  const removeListItem = (setter, id) =>
    setter((prev) => prev.filter((item) => item.id !== id));

  // Interview
  const updateInterview = (id, value) =>
    setInterviewList((prev) =>
      prev.map((i) => (i.id === id ? { ...i, value } : i)),
    );
  const addInterview = () =>
    setInterviewList((prev) => [...prev, emptyInterview()]);
  const removeInterview = (id) => removeListItem(setInterviewList, id);

  // 🔧 25 Juli 2026: begitu user mengedit baris yang ditandai merah lewat
  // validasiStruktur (Bagian 4/6/7/8), lepas highlight kolom terkait di
  // baris itu — sama seperti pola incompleteRencanaIds sebelumnya, supaya
  // highlight tidak nyangkut selamanya walau user sudah mulai memperbaiki.
  // Validasi ulang yang sebenarnya tetap terjadi tiap kali Simpan/Kirim.
  const clearErrorBaris = (namaArray, idx) => {
    setValidasiStruktur((prev) => {
      if (!prev?.perArray?.[namaArray]?.[idx]) return prev;
      const arrCopy = { ...prev.perArray[namaArray] };
      delete arrCopy[idx];
      return { ...prev, perArray: { ...prev.perArray, [namaArray]: arrCopy } };
    });
  };

  // Peta Kronologi
  const updateKronologi = (id, field, value) => {
    updateListField(setKronologiKolom, id, field, value);
    const idx = kronologiKolom.findIndex((k) => k.id === id);
    if (idx !== -1) clearErrorBaris("timelineEntries", idx);
  };
  const addKronologiKolom = () =>
    setKronologiKolom((prev) => [...prev, emptyKronologiKolom()]);
  const removeKronologiKolom = (id) => removeListItem(setKronologiKolom, id);

  // 5 Why (nested: baris > poin)
  const addWhyRow = () => setFiveWhy((prev) => [...prev, emptyWhyRow()]);
  const removeWhyRow = (rowId) =>
    setFiveWhy((prev) => prev.filter((row) => row.id !== rowId));
  const updateWhyPoin = (rowId, poinId, value) =>
    setFiveWhy((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              poin: row.poin.map((p) =>
                p.id === poinId ? { ...p, value } : p,
              ),
            }
          : row,
      ),
    );
  const addWhyPoin = (rowId) =>
    setFiveWhy((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, poin: [...row.poin, emptyWhyPoin()] }
          : row,
      ),
    );
  const removeWhyPoin = (rowId, poinId) =>
    setFiveWhy((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? { ...row, poin: row.poin.filter((p) => p.id !== poinId) }
          : row,
      ),
    );

  // Faktor Penyebab (Fishbone)
  const updateFaktor = (id, field, value) => {
    updateListField(setFaktorPenyebab, id, field, value);
    const idx = faktorPenyebab.findIndex((f) => f.id === id);
    if (idx !== -1) clearErrorBaris("fishboneEntries", idx);
  };
  const addFaktor = () =>
    setFaktorPenyebab((prev) => [...prev, emptyFaktor("")]);
  const removeFaktor = (id) => removeListItem(setFaktorPenyebab, id);

  // Rekomendasi & Rencana Kerja + Jadwal Perbaikan — 1 set handler untuk
  // array gabungan `rencanaPerbaikan`, dipakai oleh Bagian 7 & 8 sekaligus
  // (lihat catatan di emptyRencanaPerbaikan()).
  const updateRencanaPerbaikan = (id, field, value) => {
    updateListField(setRencanaPerbaikan, id, field, value);
    // 🔧 FIX 23 Juli 2026: begitu user mengedit baris yang tadinya
    // ditandai belum lengkap, lepas highlight merahnya — validasi ulang
    // yang sebenarnya tetap terjadi tiap kali "Selesaikan & Kirim"
    // ditekan, ini cuma supaya highlight tidak nyangkut selamanya walau
    // user sudah mulai memperbaiki baris itu.
    setIncompleteRencanaIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    // Baris ini bisa juga ditandai lewat validasiStruktur (pesan validasi
    // backend, bukan cuma cek client-side di atas) — backend memvalidasi
    // Bagian 7 & 8 sebagai SATU array gabungan "rencanaPerbaikanEntries"
    // (lihat LABEL_BAGIAN_ARRAY), sama seperti array lokal `rencanaPerbaikan`
    // di sini, jadi index-nya selaras 1:1.
    const idx = rencanaPerbaikan.findIndex((r) => r.id === id);
    if (idx !== -1) clearErrorBaris("rencanaPerbaikanEntries", idx);
  };
  const addRencanaPerbaikan = () =>
    setRencanaPerbaikan((prev) => [...prev, emptyRencanaPerbaikan()]);
  const removeRencanaPerbaikan = (id) => {
    removeListItem(setRencanaPerbaikan, id);
    setIncompleteRencanaIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleCetak = () => window.print();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-100" />
          <div className="h-8 w-72 rounded bg-slate-100" />
          <div className="h-4 w-96 rounded bg-slate-100" />
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-48 rounded-xl bg-slate-100" />
              <div className="h-64 rounded-xl bg-slate-100" />
            </div>
            <div className="space-y-4">
              <div className="h-48 rounded-xl bg-slate-100" />
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

  if (!data) return null;

  // Laporan yang sudah DISETUJUI Admin Utama (atau sudah FINAL) TERTUTUP &
  // TERKUNCI — read-only total. Satu-satunya aksi yang masih tersedia
  // setelah ini adalah Unduh PDF / Cetak (pola sama seperti Investigasi
  // Sederhana).
  // PERLU DIKONFIRMASI: bedanya DISETUJUI vs FINAL belum jelas dari
  // dokumen backend — untuk sekarang keduanya dianggap terkunci.
  const isLocked =
    data.status === STATUS_RCA.DISETUJUI || data.status === STATUS_RCA.FINAL;

  // Konten laporan RCA gaya dokumen resmi — dipakai DUA kali: (1) offscreen
  // untuk Cetak/Unduh PDF (selalu, apapun status), (2) inline & terlihat
  // sebagai tampilan read-only begitu status laporan "disetujui" (terkunci).
  const rcaReportBody = (
    <>
      <p className="italic mb-4">Lampiran</p>
      <h1 className="mb-4 text-center text-[14px] font-bold">
        A. <span className="italic">Root Cause Analysis</span> (RCA){" "}
        {data.judul}
      </h1>
      <p className="mb-4 text-justify">
        {data.unitPelapor} sudah melakukan <i>root cause analysis</i> pada suatu
        kasus, adapun uraian dari insiden tersebut adalah sebagai berikut:
      </p>

      <p className="mb-2">
        <b>1. Insiden</b> : {insiden || "-"}
      </p>

      <p className="mb-1">
        <b>2. Tim</b> :
      </p>
      <div className="ml-6 mb-3 space-y-0.5">
        <p>Ketua Tim : {investigatorUtama || "-"}</p>
        <p>Sekretaris : {sekretarisTim || "-"}</p>
        <p>Anggota : {timAnggota.length > 0 ? timAnggota.join(", ") : "-"}</p>
      </div>

      <p className="mb-1">
        <b>3. Mengumpulkan data dan informasi</b>:
      </p>
      <div className="ml-6 mb-3 space-y-1">
        <p>a. Observasi : {observasi || "-"}</p>
        <p>b. Dokumentasi : {dokumentasi || "-"}</p>
        <div className="ml-6 mt-2">
          <p className="font-bold">Kronologi singkat :</p>
          <p className="text-justify">{kronologiSingkat || "-"}</p>
          <p className="font-bold mt-2">Ringkasan Laporan</p>
          <p>Jenis Insiden : {jenisInsiden || "-"}</p>
          <p>Tipe/Sub Insiden : {tipeSubInsiden || "-"}</p>
          <p>Tanggal Insiden : {tanggalInsiden || "-"}</p>
          <p>
            <i>Risk Grading Matrix</i> : {riskGradingMatrix || "-"}
          </p>
          <p>
            Tindakan sesuai <i>Bands/Level</i> : {tindakanBandsLevel || "-"}
          </p>
        </div>
        <p className="mt-2">c. Interview :</p>
        <div className="ml-6">
          {interviewList.filter((i) => i.value).length === 0 ? (
            <p>-</p>
          ) : (
            interviewList
              .filter((i) => i.value)
              .map((i, idx) => (
                <p key={i.id}>
                  {String.fromCharCode(97 + idx)}. {i.value}
                </p>
              ))
          )}
        </div>
      </div>

      <p className="font-bold mb-1">4. Peta Kronologi Kejadian</p>
      <p className="mb-2 italic">a. Kronologi Kejadian dan Tabular Timeline</p>
      <table className="w-full border-collapse border border-black text-[10px] mb-4">
        <thead>
          <tr>
            <th className="border border-black p-1 text-left align-top">
              WAKTU / KEJADIAN
            </th>
            {kronologiKolom.map((k) => (
              <th
                key={k.id}
                className="border border-black p-1 text-left align-top"
              >
                {k.waktu || "-"}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1 font-bold align-top">
              KEJADIAN
            </td>
            {kronologiKolom.map((k) => (
              <td key={k.id} className="border border-black p-1 align-top">
                {k.kejadian || "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold align-top">
              INFORMASI TAMBAHAN
            </td>
            {kronologiKolom.map((k) => (
              <td key={k.id} className="border border-black p-1 align-top">
                {k.informasiTambahan || "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold align-top">
              GOOD PRACTICE
            </td>
            {kronologiKolom.map((k) => (
              <td key={k.id} className="border border-black p-1 align-top">
                {k.goodPractice || "-"}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold align-top">
              MASALAH PELAYANAN
            </td>
            {kronologiKolom.map((k) => (
              <td key={k.id} className="border border-black p-1 align-top">
                {k.masalahPelayanan || "-"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <p className="font-bold mb-1">5. Analisis Informasi 5 WHY</p>
      <table className="w-full border-collapse border border-black text-[10px] mb-4">
        <tbody>
          <tr>
            <td className="border border-black p-1 font-bold align-top w-28">
              Insiden
            </td>
            <td className="border border-black p-1 align-top">
              {insiden || "-"}
            </td>
          </tr>
          {fiveWhy.map((row) => (
            <tr key={row.id}>
              <td className="border border-black p-1 font-bold align-top">
                Mengapa
              </td>
              <td className="border border-black p-1 align-top">
                {row.poin.filter((p) => p.value).length === 0
                  ? "-"
                  : row.poin
                      .filter((p) => p.value)
                      .map((p) => <p key={p.id}>{p.value}</p>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-bold mb-1">6. Analisis Penyebab Masalah</p>
      <div className="ml-6 mb-4 space-y-1">
        {faktorPenyebab.map((f) => (
          <p key={f.id}>
            <span className="italic font-semibold">{f.kategori || "-"}</span> :{" "}
            {f.deskripsi || "-"}
          </p>
        ))}
      </div>

      <p className="mb-2 text-center italic font-bold">
        Fish bone / Analisis Tulang Ikan
      </p>
      <div className="mb-4 flex justify-center">
        <FishboneDiagram
          items={faktorPenyebab}
          headLabel={insiden || "Masalah Utama"}
        />
      </div>

      <p className="font-bold mb-1">
        7. Rekomendasi Dan Rencana Kerja Untuk Improvement
      </p>
      <table className="w-full border-collapse border border-black text-[10px] mb-4">
        <thead>
          <tr>
            <th className="border border-black p-1 text-left">Akar Masalah</th>
            <th className="border border-black p-1 text-left">
              Rekomendasi/Solusi
            </th>
          </tr>
        </thead>
        <tbody>
          {rencanaPerbaikan.map((r) => (
            <tr key={r.id}>
              <td className="border border-black p-1 align-top">
                {r.akarMasalah || "-"}
              </td>
              <td className="border border-black p-1 align-top whitespace-pre-line">
                {r.rekomendasi || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-bold mb-1">Jadwal Perbaikan</p>
      <table className="w-full border-collapse border border-black text-[10px] mb-4">
        <thead>
          <tr>
            <th className="border border-black p-1 w-8">No</th>
            <th className="border border-black p-1 text-left">Kegiatan</th>
            <th className="border border-black p-1 text-left">Pelaksana</th>
            <th className="border border-black p-1 text-left">Target</th>
          </tr>
        </thead>
        <tbody>
          {rencanaPerbaikan.map((j, idx) => (
            <tr key={j.id}>
              <td className="border border-black p-1 text-center align-top">
                {idx + 1}
              </td>
              <td className="border border-black p-1 align-top">
                {j.kegiatan || "-"}
              </td>
              <td className="border border-black p-1 align-top">
                {j.pelaksana || "-"}
              </td>
              <td className="border border-black p-1 align-top">
                {j.target || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="font-bold mb-1">LAMPIRAN</p>
      <div className="ml-6">
        {uploadedFiles.length === 0 ? (
          <p>-</p>
        ) : (
          uploadedFiles.map((f, i) => (
            <p key={f.id}>
              {i + 1}.{" "}
              {/* 🔧 FIX 23 Juli 2026: sebelumnya nama lampiran cuma teks
                  polos (tidak bisa diklik). Sekarang dibungkus <a href>
                  kalau ada url — tombol "Cetak" (window.print(), dilanjut
                  "Save as PDF" di dialog print browser) MEMPERTAHANKAN
                  hyperlink asli jadi link yang bisa diklik di PDF hasilnya
                  (dikonfirmasi perilaku Chrome/Edge). CATATAN: tombol
                  "Unduh PDF" (html2pdf.js) TIDAK bisa ikut perbaikan ini —
                  itu merender area cetak jadi GAMBAR (html2canvas), link
                  apa pun otomatis hilang di situ, cuma jalur "Cetak" yang
                  bisa punya link hidup. CATATAN LAIN: f.url dari lampiran
                  lama adalah signed URL Supabase yang kedaluwarsa ~1 jam —
                  kalau PDF dibuka lama setelah dicetak, link bisa saja
                  sudah tidak berlaku lagi (bukan bug baru, sudah pernah
                  dicatat sebelumnya). */}
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  {f.nama}
                </a>
              ) : (
                f.nama
              )}
            </p>
          ))
        )}
      </div>
    </>
  );

  return (
    <>
      {/*
        Area laporan (#rca-print-area) SENGAJA selalu dirender di DOM
        (bukan display:none) — html2pdf.js/html2canvas butuh elemen benar-benar
        ter-render untuk bisa menangkapnya jadi PDF. Di layar biasa area ini
        digeser jauh ke luar viewport (offscreen) sehingga tidak terlihat
        pengguna. Saat window.print() dipanggil, posisinya dikembalikan normal
        dan seluruh UI editor disembunyikan.
      */}
      <style>{`
        @media print {
          @page { size: A4; margin: 2cm; }
          body * { visibility: hidden; }
          #rca-print-area, #rca-print-area * { visibility: visible; }
          #rca-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8 print:hidden">
        {/* Breadcrumb */}
        <div className="mb-4 flex items-center gap-1 text-xs text-slate-400">
          <span
            className="cursor-pointer hover:text-blue-600"
            onClick={() => onNavigate?.("analysis")}
          >
            Analisis & Investigasi
          </span>
          <ChevronRight className="h-3 w-3" />
          <span
            className="cursor-pointer hover:text-blue-600"
            onClick={() => onNavigate?.("analysis")}
          >
            Investigasi Lanjutan
          </span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-semibold text-slate-600">Detail {data.id}</span>
        </div>

        {/* Banner Menunggu Persetujuan — cuma tampil kalau statusnya
            memang lagi nunggu, dan isi/aksinya beda tergantung role.
            Admin biasa cuma lihat info (biar tau progresnya di mana),
            Admin Utama dapet form buat mutusin. */}
        {data.status === STATUS_RCA.MENUNGGU_PERSETUJUAN && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            {isSuperAdmin ? (
              <>
                <div className="mb-3 flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-800">
                    Tim sudah menyelesaikan &amp; mengirim laporan RCA ini.
                    Sebagai Admin Utama, review laporannya lalu putuskan di
                    bawah.
                  </p>
                </div>
                <textarea
                  rows={2}
                  value={catatanRevisi}
                  onChange={(e) => setCatatanRevisi(e.target.value)}
                  placeholder="Catatan revisi (wajib diisi kalau meminta perbaikan)..."
                  className="mb-3 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs resize-none focus:border-blue-500 focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={isDeciding}
                    onClick={() => handleKeputusanPersetujuan("setuju")}
                    className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-white transition"
                  >
                    {isDeciding ? "Memproses..." : "Setujui & Selesaikan"}
                  </button>
                  <button
                    disabled={isDeciding}
                    onClick={() => handleKeputusanPersetujuan("revisi")}
                    className="rounded-lg border border-amber-400 bg-white hover:bg-amber-100 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-amber-700 transition"
                  >
                    {isDeciding ? "Memproses..." : "Minta Revisi"}
                  </button>
                </div>
                {saveError && (
                  <p className="mt-2 whitespace-pre-line text-xs text-red-600">
                    {saveError}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  Laporan ini sudah dikirim dan sedang{" "}
                  <b>menunggu persetujuan Admin Utama</b> sebelum benar-benar
                  tertutup.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Kalau Admin Utama tadi minta revisi, tunjukin catatannya di
            sini supaya tim tau apa yang perlu diperbaiki sebelum
            submit ulang. */}
        {data.status === STATUS_RCA.PERLU_REVISI && data.catatanRevisi && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div>
              <p className="text-xs font-bold text-red-700 mb-1">
                Perlu Revisi — catatan dari Admin Utama:
              </p>
              <p className="text-xs leading-relaxed text-red-700">
                {data.catatanRevisi}
              </p>
            </div>
          </div>
        )}

        {/* Laporan sudah disetujui Admin Utama — form terkunci total,
            hanya Cetak yang masih bisa dilakukan. */}
        {isLocked && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-xs leading-relaxed text-green-800">
              Laporan ini sudah <b>disetujui Admin Utama</b> dan berstatus{" "}
              <b>Selesai</b>.
            </p>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">{data.id}</h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${data.gradingStyle}`}
              >
                {data.gradingLabel}
              </span>
              {isLocked && (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Selesai
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{data.judul}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-start gap-3">
              {/* Tombol Cetak — merender area laporan resmi via window.print().
                  Style biru ini sebelumnya dipakai tombol "Unduh PDF" (yang
                  sudah dihapus, fitur html2pdf.js tidak dipakai lagi) —
                  dipindah ke sini supaya "Cetak" jadi aksi utama yang menonjol. */}
              <button
                onClick={handleCetak}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 transition active:scale-95"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {/* Sisa Waktu & Progress */}
            <div className="flex flex-col items-end gap-1 min-w-[180px]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.sisaLabel}
              </div>
              <div className="flex w-full items-center gap-2">
                <div className="h-2 flex-1 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${data.progres}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {data.progres}% Progress
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Layout 2 kolom — form editable HANYA tampil kalau laporan
            belum terkunci. Begitu status "disetujui", ganti dengan
            ringkasan read-only (isi sama dengan yang dipakai versi
            cetak/PDF) supaya form benar-benar tidak bisa disentuh lagi. */}
        {isLocked ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="w-[794px] max-w-none px-4 py-4 text-[12px] leading-relaxed text-black">
              {rcaReportBody}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Card: Informasi Laporan */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700">
                  Informasi Laporan
                </h2>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Kiri info */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tanggal Kejadian
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {data.tanggalKejadian}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Unit Pelapor
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {data.unitPelapor}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Identitas Pelapor
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {data.identitasPelapor}
                    </p>
                  </div>
                </div>
                {/* Kanan info: Kronologi */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                    Kronologi Singkat
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {data.kronologi}
                  </p>
                </div>
              </div>

              {/* Lampiran bukti awal (dari laporan masuk).
                  🔧 FIX: dulu baca dari `data.lampiran` — key itu SEKARANG
                  khusus lampiran RCA (Bagian 9), lihat catatan di setData()
                  pada fetchDetail(). Lampiran bukti laporan disimpan
                  terpisah di `data.lampiranBukti` supaya tidak pernah
                  ketimpa oleh lampiran RCA. */}
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Lampiran Bukti ({data.lampiranBukti.length} Files)
                </p>
                <div className="flex flex-wrap gap-3">
                  {data.lampiranBukti.map((item) => (
                    <a
                      key={item.id}
                      href={item.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={item.label}
                      className={`flex h-20 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 ${item.type === "pdf" ? "bg-slate-50" : "bg-gradient-to-br from-blue-100 to-blue-50"}`}
                    >
                      {item.type === "pdf" ? (
                        <FileText className="h-7 w-7 text-slate-400" />
                      ) : item.url ? (
                        <img
                          src={item.url}
                          alt={item.label}
                          className="h-full w-full object-cover"
                          // Fallback kalau URL gagal dimuat (mis. link sudah
                          // expired — fileUrl dari Supabase Storage yang
                          // bertipe "signed URL" biasanya ada masa berlaku),
                          // ganti ke teks label lagi supaya tidak jadi ikon
                          // gambar pecah/kosong.
                          onError={(e) => {
                            const img = e.currentTarget;
                            const fallback = document.createElement("span");
                            fallback.className = "text-[10px] text-slate-400";
                            fallback.textContent = item.label;
                            img.replaceWith(fallback);
                          }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {item.label}
                        </span>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Card: Status & Tenggat Waktu */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-700">
                Status & Tenggat Waktu
              </h3>

              {/* Timeline */}
              <div className="space-y-0">
                {data.timeline.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${step.done ? "border-blue-600 bg-blue-600" : step.active ? "border-blue-600 bg-white" : "border-slate-200 bg-white"}`}
                      >
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : step.active ? (
                          <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300" />
                        )}
                      </div>
                      {idx < data.timeline.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 my-0.5 h-6 ${step.done ? "bg-blue-600" : "bg-slate-200"}`}
                        />
                      )}
                    </div>
                    <div className="pb-4">
                      <p
                        className={`text-xs font-bold ${step.done || step.active ? "text-slate-800" : "text-slate-400"}`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-[10px] ${step.active ? "text-blue-600 font-semibold" : "text-slate-400"}`}
                      >
                        {step.tanggal}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Deadline */}
              <div className="mt-2 rounded-lg bg-yellow-50 border border-yellow-100 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-yellow-700 mb-0.5">
                  Tanggal Waktu Investigasi (45 Hari)
                </p>
                <p className="text-sm font-bold text-yellow-800">
                  {data.deadlineInvestigasi}
                </p>
                <p className="mt-0.5 text-[10px] text-yellow-600">
                  {data.deadlineNote}
                </p>
              </div>
            </div>

            {/* Keterangan tanda wajib — supaya admin tahu SEJAK AWAL kolom
                mana yang harus diisi, bukan cuma tahu setelah gagal Simpan/
                Kirim dan baru dikasih tahu "Wajib diisi" di kolom masing-
                masing (lihat validasiStruktur). */}
            <p className="-mt-2 text-xs text-slate-400">
              <span className="text-red-500">*</span> Kolom wajib diisi
            </p>

            {/* Card: 1. Insiden & Metode Analisis */}
            <SectionCard icon={Search} title="1. Insiden & Metode Analisis">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={fieldLabelClass}>Metode Analisis</label>
                  <input
                    type="text"
                    value={metodeAnalisis}
                    onChange={(e) => setMetodeAnalisis(e.target.value)}
                    placeholder="Tulis metode analisis, mis. Fishbone Diagram (Ishikawa)"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={fieldLabelClass}>
                    Insiden (uraian singkat){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={insiden}
                    onChange={(e) => {
                      setInsiden(e.target.value);
                      if (validasiStruktur?.fieldTunggal?.masalahAwal5Why) {
                        setValidasiStruktur((prev) =>
                          prev
                            ? {
                                ...prev,
                                fieldTunggal: {
                                  ...prev.fieldTunggal,
                                  masalahAwal5Why: false,
                                },
                              }
                            : prev,
                        );
                      }
                    }}
                    placeholder="Contoh: Kondisi IGD crowded, pasien terjatuh dari brankar"
                    className={`${textareaClass} ${
                      validasiStruktur?.fieldTunggal?.masalahAwal5Why
                        ? "border-red-400 bg-red-50"
                        : ""
                    }`}
                  />
                  {validasiStruktur?.fieldTunggal?.masalahAwal5Why && (
                    <p className="mt-1 text-xs font-semibold text-red-600">
                      Wajib diisi
                    </p>
                  )}
                </div>
              </div>
            </SectionCard>

            {/* Card: 2. Tim — Tim Investigasi (pencatatan manual, lihat
                catatan di dekat import statement — struktur tim sudah
                difinalisasi lewat diskusi manual Tim Mutu di luar sistem,
                form ini cuma mencatatnya, bukan alat assign/notifikasi). */}
            <SectionCard icon={Users} title="2. Tim Investigasi">
              <div className="space-y-4">
                <div>
                  <label className={fieldLabelClass}>Ketua Tim</label>
                  <input
                    type="text"
                    value={investigatorUtama}
                    onChange={(e) => setInvestigatorUtama(e.target.value)}
                    placeholder="Nama Ketua Tim"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={fieldLabelClass}>Sekretaris</label>
                  <input
                    type="text"
                    value={sekretarisTim}
                    onChange={(e) => setSekretarisTim(e.target.value)}
                    placeholder="Nama Sekretaris"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={fieldLabelClass}>
                    Anggota Tim Multidisiplin
                  </label>
                  {timAnggota.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {timAnggota.map((nama) => (
                        <span
                          key={nama}
                          className="flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                        >
                          {nama}
                          <button
                            type="button"
                            onClick={() => handleRemoveAnggota(nama)}
                            className="hover:text-blue-200 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={anggotaBaruInput}
                      onChange={(e) => setAnggotaBaruInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleTambahAnggota();
                        }
                      }}
                      placeholder="Ketik nama anggota lalu tekan Enter"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={handleTambahAnggota}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-blue-400 px-3 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                    >
                      <Plus className="h-3 w-3" />
                      Tambah
                    </button>
                  </div>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">
                    Pastikan perwakilan dari setiap unit terkait tercatat sesuai
                    struktur tim yang sudah disepakati.
                  </p>
                </div>
              </div>
            </SectionCard>

            {/* Card: 3. Mengumpulkan Data dan Informasi */}
            <SectionCard
              icon={ClipboardList}
              title="3. Mengumpulkan Data dan Informasi"
            >
              <div className="space-y-4">
                <div>
                  <label className={fieldLabelClass}>a. Observasi</label>
                  <textarea
                    rows={2}
                    value={observasi}
                    onChange={(e) => setObservasi(e.target.value)}
                    placeholder="Hasil observasi langsung di lapangan (isi '-' bila tidak ada)"
                    className={textareaClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>b. Dokumentasi</label>
                  <textarea
                    rows={2}
                    value={dokumentasi}
                    onChange={(e) => setDokumentasi(e.target.value)}
                    placeholder="Contoh: Dokumentasi dari berkas RM pasien"
                    className={textareaClass}
                  />

                  {/* Kronologi Singkat — bagian dari "b. Dokumentasi" pada format RCA resmi */}
                  <div className="mt-3">
                    <label className={fieldLabelClass}>
                      Kronologi Singkat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={kronologiSingkat}
                      onChange={(e) => {
                        setKronologiSingkat(e.target.value);
                        if (validasiStruktur?.fieldTunggal?.kronologiSingkat) {
                          setValidasiStruktur((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  fieldTunggal: {
                                    ...prev.fieldTunggal,
                                    kronologiSingkat: false,
                                  },
                                }
                              : prev,
                          );
                        }
                      }}
                      placeholder="Uraian singkat kronologi kejadian, mis. Pada pukul 15.30 WIB pasien rujukan..."
                      className={`${textareaClass} ${
                        validasiStruktur?.fieldTunggal?.kronologiSingkat
                          ? "border-red-400 bg-red-50"
                          : ""
                      }`}
                    />
                    {validasiStruktur?.fieldTunggal?.kronologiSingkat && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        Wajib diisi
                      </p>
                    )}
                  </div>

                  {/* Ringkasan Laporan — diisi manual oleh admin investigasi,
                      mengacu ke tabel standar (Tipe Insiden, Risk Grading
                      Matrix, Bands/Level) */}
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Ringkasan Laporan
                      </p>
                      <a
                        href={panduanTipeInsidenPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Lihat Panduan Tabel Tipe Insiden
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={fieldLabelClass}>Jenis Insiden</label>
                        <input
                          type="text"
                          value={jenisInsiden}
                          onChange={(e) => setJenisInsiden(e.target.value)}
                          placeholder="Contoh: Kejadian Tidak Diharapkan"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Tipe/Sub Insiden
                        </label>
                        <input
                          type="text"
                          value={tipeSubInsiden}
                          onChange={(e) => setTipeSubInsiden(e.target.value)}
                          placeholder="Contoh: Jatuh / Keterlibatan saat jatuh"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          Tanggal Insiden
                        </label>
                        <input
                          type="text"
                          value={tanggalInsiden}
                          onChange={(e) => setTanggalInsiden(e.target.value)}
                          placeholder="Contoh: 30 Maret 2010"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={fieldLabelClass}>
                          <i>Risk Grading Matrix</i>
                        </label>
                        <input
                          type="text"
                          value={riskGradingMatrix}
                          onChange={(e) => setRiskGradingMatrix(e.target.value)}
                          placeholder="Contoh: Kuning (high)"
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={fieldLabelClass}>
                          Tindakan sesuai <i>Bands/Level</i>
                        </label>
                        <textarea
                          rows={2}
                          value={tindakanBandsLevel}
                          onChange={(e) =>
                            setTindakanBandsLevel(e.target.value)
                          }
                          placeholder="Contoh: Dilakukan RCA paling lama 45 hari, kaji dengan detail & perlu tindakan segera"
                          className={textareaClass}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={fieldLabelClass}>c. Interview</label>
                  <div className="space-y-2">
                    {interviewList.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="w-5 shrink-0 text-xs font-semibold text-slate-400">
                          {String.fromCharCode(97 + idx)}.
                        </span>
                        <input
                          type="text"
                          value={item.value}
                          onChange={(e) =>
                            updateInterview(item.id, e.target.value)
                          }
                          placeholder="Contoh: Ka. Instalasi IGD"
                          className={inputClass}
                        />
                        <RemoveRowButton
                          onClick={() => removeInterview(item.id)}
                          srLabel="Hapus pihak interview"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <AddRowButton
                      onClick={addInterview}
                      label="Tambah Pihak Interview"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Card: 4. Peta Kronologi Kejadian */}
            <SectionCard
              icon={CalendarClock}
              title="4. Peta Kronologi Kejadian"
              subtitle="Tabular timeline — tambahkan satu blok untuk tiap titik waktu kejadian."
            >
              <div className="space-y-4">
                {kronologiKolom.map((k, idx) => {
                  const kolomBelumDiisi =
                    validasiStruktur?.perArray?.timelineEntries?.[idx];
                  return (
                    <div
                      key={k.id}
                      className={`rounded-lg border p-3 ${
                        kolomBelumDiisi
                          ? "border-red-400 bg-red-50"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-600">
                          Waktu #{idx + 1}
                        </span>
                        {kolomBelumDiisi && (
                          <span className="text-xs font-semibold text-red-600">
                            {kolomBelumDiisi.join(", ")} belum diisi
                          </span>
                        )}
                        {kronologiKolom.length > 1 && (
                          <RemoveRowButton
                            onClick={() => removeKronologiKolom(k.id)}
                            srLabel="Hapus kolom waktu"
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className={fieldLabelClass}>
                            Waktu / Tanggal
                          </label>
                          <input
                            type="text"
                            value={k.waktu}
                            onChange={(e) =>
                              updateKronologi(k.id, "waktu", e.target.value)
                            }
                            placeholder="Contoh: 30/03/2025 jam 15.00 (IGD)"
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>Kejadian</label>
                          <textarea
                            rows={2}
                            value={k.kejadian}
                            onChange={(e) =>
                              updateKronologi(k.id, "kejadian", e.target.value)
                            }
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>
                            Informasi Tambahan
                          </label>
                          <textarea
                            rows={2}
                            value={k.informasiTambahan}
                            onChange={(e) =>
                              updateKronologi(
                                k.id,
                                "informasiTambahan",
                                e.target.value,
                              )
                            }
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>
                            Good Practice
                          </label>
                          <textarea
                            rows={2}
                            value={k.goodPractice}
                            onChange={(e) =>
                              updateKronologi(
                                k.id,
                                "goodPractice",
                                e.target.value,
                              )
                            }
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>
                            Masalah Pelayanan
                          </label>
                          <textarea
                            rows={2}
                            value={k.masalahPelayanan}
                            onChange={(e) =>
                              updateKronologi(
                                k.id,
                                "masalahPelayanan",
                                e.target.value,
                              )
                            }
                            className={textareaClass}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <AddRowButton
                  onClick={addKronologiKolom}
                  label="Tambah Titik Waktu"
                />
              </div>
            </SectionCard>

            {/* Card: 5. Analisis Informasi 5 WHY */}
            <SectionCard
              icon={MessageCircle}
              title="5. Analisis Informasi 5 WHY"
            >
              <div className="mb-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">
                  Insiden (mengikuti isian di Bagian 1)
                </p>
                <p className="text-sm text-slate-600">{insiden || "-"}</p>
              </div>

              <div className="space-y-3">
                {fiveWhy.map((row, rowIdx) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-blue-600">
                        Mengapa #{rowIdx + 1}
                      </span>
                      {fiveWhy.length > 1 && (
                        <RemoveRowButton
                          onClick={() => removeWhyRow(row.id)}
                          srLabel="Hapus baris mengapa"
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      {row.poin.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={p.value}
                            onChange={(e) =>
                              updateWhyPoin(row.id, p.id, e.target.value)
                            }
                            placeholder="Jawaban / temuan pada level ini"
                            className={inputClass}
                          />
                          {row.poin.length > 1 && (
                            <RemoveRowButton
                              onClick={() => removeWhyPoin(row.id, p.id)}
                              srLabel="Hapus poin"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <AddRowButton
                        onClick={() => addWhyPoin(row.id)}
                        label="Tambah Poin"
                      />
                    </div>
                  </div>
                ))}
                <AddRowButton
                  onClick={addWhyRow}
                  label="Tambah Baris Mengapa"
                />
              </div>
            </SectionCard>

            {/* Card: 6. Analisis Penyebab Masalah (Fishbone) */}
            <SectionCard
              icon={GitBranch}
              title="6. Analisis Penyebab Masalah (Fishbone)"
              subtitle="Kategori bisa disesuaikan — bawaan mengikuti 4M (Man, Method, Measurement, Material)."
            >
              <div className="space-y-3">
                {faktorPenyebab.map((f, idx) => {
                  const kolomBelumDiisi =
                    validasiStruktur?.perArray?.fishboneEntries?.[idx];
                  return (
                    <div
                      key={f.id}
                      className={`rounded-lg p-2 ${
                        kolomBelumDiisi ? "border border-red-400 bg-red-50" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* 🔧 FIX: sebelumnya <input type="text"> bebas ketik —
                        baris tambahan lewat "Tambah Kategori" mulai dari
                        kategori kosong ("") dan bisa diisi teks APA SAJA,
                        padahal backend cuma terima 6 nilai enum tertentu
                        (MAN|METHOD|MATERIAL|MACHINE|MEASUREMENT|
                        ENVIRONMENT, lihat DEFAULT_FAKTOR_KATEGORI). Baris
                        bawaan (6 kategori pertama) kebetulan sudah benar
                        karena di-prefill dari DEFAULT_FAKTOR_KATEGORI, tapi
                        baris TAMBAHAN lolos validasi client-side lalu baru
                        ditolak backend saat Simpan/Kirim ("Invalid option:
                        expected one of..."). Sekarang jadi <select> yang
                        dibatasi ke 6 nilai yang sama — tidak mungkin lagi
                        kirim kategori di luar itu. */}
                        <select
                          value={f.kategori}
                          onChange={(e) =>
                            updateFaktor(f.id, "kategori", e.target.value)
                          }
                          className={`${inputClass} sm:w-40 shrink-0 cursor-pointer appearance-none`}
                        >
                          <option value="" disabled>
                            Pilih kategori
                          </option>
                          {DEFAULT_FAKTOR_KATEGORI.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <textarea
                          rows={2}
                          value={f.deskripsi}
                          onChange={(e) =>
                            updateFaktor(f.id, "deskripsi", e.target.value)
                          }
                          placeholder="Uraian faktor penyebab pada kategori ini"
                          className={textareaClass}
                        />
                        <RemoveRowButton
                          onClick={() => removeFaktor(f.id)}
                          srLabel="Hapus kategori"
                        />
                      </div>
                      {kolomBelumDiisi && (
                        <p className="mt-1 text-xs font-semibold text-red-600">
                          {kolomBelumDiisi.join(", ")} belum diisi
                        </p>
                      )}
                    </div>
                  );
                })}
                <AddRowButton onClick={addFaktor} label="Tambah Kategori" />
              </div>
              {/*
                Catatan: preview diagram Fish Bone sengaja tidak ditampilkan di sini.
                Admin cukup mengisi kategori & deskripsi di atas; diagram tulang ikan
                akan otomatis digenerate hanya pada bagian export/print (lihat
                <FishboneDiagram> di area #rca-print-area lebih bawah).
              */}
            </SectionCard>

            {/* Card: 7. Rekomendasi Dan Rencana Kerja Untuk Improvement */}
            <SectionCard
              icon={CheckCircle2}
              title="7. Rekomendasi Dan Rencana Kerja Untuk Improvement"
              subtitle="Tiap baris di sini otomatis berpasangan dengan baris yang sama di Bagian 8 (Jadwal Perbaikan) — tambah/hapus baris di sini ikut berlaku di sana."
            >
              <div className="space-y-3">
                {rencanaPerbaikan.map((r, idx) => {
                  const kolomBelumDiisi =
                    validasiStruktur?.perArray?.rencanaPerbaikanEntries?.[idx];
                  const belumLengkap =
                    incompleteRencanaIds.has(r.id) || Boolean(kolomBelumDiisi);
                  return (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-3 ${
                        belumLengkap
                          ? "border-red-400 bg-red-50"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-600">
                          Akar Masalah #{idx + 1}
                        </span>
                        {belumLengkap && (
                          <span className="text-xs font-semibold text-red-600">
                            {kolomBelumDiisi
                              ? `${kolomBelumDiisi.join(", ")} belum diisi`
                              : "Belum lengkap"}
                          </span>
                        )}
                        {rencanaPerbaikan.length > 1 && (
                          <RemoveRowButton
                            onClick={() => removeRencanaPerbaikan(r.id)}
                            srLabel="Hapus baris rekomendasi"
                          />
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={fieldLabelClass}>
                            Akar Masalah
                          </label>
                          <textarea
                            rows={3}
                            value={r.akarMasalah}
                            onChange={(e) =>
                              updateRencanaPerbaikan(
                                r.id,
                                "akarMasalah",
                                e.target.value,
                              )
                            }
                            className={textareaClass}
                          />
                        </div>
                        <div>
                          <label className={fieldLabelClass}>
                            Rekomendasi / Solusi
                          </label>
                          <textarea
                            rows={3}
                            value={r.rekomendasi}
                            onChange={(e) =>
                              updateRencanaPerbaikan(
                                r.id,
                                "rekomendasi",
                                e.target.value,
                              )
                            }
                            placeholder={"1. ...\n2. ...\n3. ..."}
                            className={textareaClass}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <AddRowButton
                  onClick={addRencanaPerbaikan}
                  label="Tambah Akar Masalah"
                />
              </div>
            </SectionCard>

            {/* Card: 8. Jadwal Perbaikan */}
            <SectionCard
              icon={Clock}
              title="8. Jadwal Perbaikan"
              subtitle="Baris di sini berpasangan 1:1 dengan Bagian 7 (Rekomendasi & Rencana Kerja)."
            >
              <div className="space-y-3">
                {rencanaPerbaikan.map((j, idx) => {
                  const kolomBelumDiisi =
                    validasiStruktur?.perArray?.rencanaPerbaikanEntries?.[idx];
                  const belumLengkap =
                    incompleteRencanaIds.has(j.id) || Boolean(kolomBelumDiisi);
                  return (
                    <div
                      key={j.id}
                      className={`flex items-start gap-2 rounded-lg p-1.5 ${
                        belumLengkap ? "bg-red-50" : ""
                      }`}
                    >
                      <span className="mt-2.5 w-5 shrink-0 text-center text-xs font-bold text-slate-400">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={j.kegiatan}
                        onChange={(e) =>
                          updateRencanaPerbaikan(
                            j.id,
                            "kegiatan",
                            e.target.value,
                          )
                        }
                        placeholder="Kegiatan"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={j.pelaksana}
                        onChange={(e) =>
                          updateRencanaPerbaikan(
                            j.id,
                            "pelaksana",
                            e.target.value,
                          )
                        }
                        placeholder="Pelaksana"
                        className={inputClass}
                      />
                      <input
                        type="text"
                        value={j.target}
                        onChange={(e) =>
                          updateRencanaPerbaikan(j.id, "target", e.target.value)
                        }
                        placeholder="Target (mis. September 2026)"
                        className={inputClass}
                      />
                      {rencanaPerbaikan.length > 1 && (
                        <RemoveRowButton
                          onClick={() => removeRencanaPerbaikan(j.id)}
                          srLabel="Hapus baris jadwal"
                        />
                      )}
                    </div>
                  );
                })}
                <AddRowButton
                  onClick={addRencanaPerbaikan}
                  label="Tambah Kegiatan"
                />
              </div>
            </SectionCard>

            {/* Card: 9. Lampiran */}
            <SectionCard icon={Upload} title="9. Lampiran">
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer ${isDragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-slate-50 hover:bg-slate-100"}`}
              >
                <Upload className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-500">
                  Klik atau seret file RCA untuk upload
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Format didukung: PDF, DOCX, XLSX, DOC, XLS — maksimal 10MB per
                  file
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.xlsx,.doc,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 justify-center">
                    {uploadedFiles.map((f) => (
                      <span
                        key={f.id}
                        className="flex items-center gap-1.5 rounded-full bg-blue-100 pl-2.5 pr-1.5 py-1 text-xs font-medium text-blue-700"
                      >
                        {f.nama}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            handleRemoveFile(f.id);
                          }}
                          className="rounded-full hover:bg-blue-200 p-0.5 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </label>

              {/* Keterangan file ditolak — tampil LANGSUNG di sini (dekat
                  dropzone) begitu admin drag&drop atau memilih file di luar
                  format/ukuran yang ditentukan, supaya jelas file mana yang
                  bermasalah dan kenapa, tanpa perlu scroll ke banner error
                  umum di bawah halaman. */}
              {lampiranError && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{lampiranError}</span>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* Error simpan — 🔧 25 Juli 2026 (revisi): dulu kotak ini menumpuk
            SEMUA field/baris yang belum diisi jadi satu daftar panjang di
            bawah (jauh dari kartu aslinya). Sekarang tiap kartu/Bagian
            menandai sendiri field/barisnya yang merah (lihat validasiStruktur
            & terapkanErrorBackend di atas) — kotak ini cuma tampil sebagai
            (a) banner PENDEK yang mengarahkan admin ke bagian merah di atas,
            atau (b) fallback pesan error apa adanya kalau errornya BUKAN
            validasi per-field (mis. gagal jaringan/server). whitespace-pre-line
            tetap dipakai untuk kasus (a) yang masih bisa berupa beberapa
            butir "• ..." kalau ada field yang tidak berhasil dipetakan ke
            kartu manapun (validasiStruktur.lainnya). */}
        {!isLocked && saveError && (
          <div className="mt-6 flex items-start gap-2 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Footer Tombol — cuma tampil kalau laporan belum terkunci.
            Setelah "disetujui", satu-satunya aksi tersisa adalah
            Unduh PDF / Cetak di header. */}
        {!isLocked && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            >
              {isSaving ? "Menyimpan..." : "Simpan sebagai Draft"}
            </button>
            <button
              onClick={() => {
                setShowModal(true);
                setAgreeConfirm(false);
              }}
              disabled={isSaving}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition active:scale-95 disabled:opacity-50"
            >
              Selesaikan & Kirim Laporan Investigasi
            </button>
          </div>
        )}

        {/* ── Modal Konfirmasi ── */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              {/* Icon */}
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
              </div>

              {/* Judul */}
              <h2 className="mb-2 text-center text-base font-bold text-slate-800">
                Selesaikan Laporan Investigasi?
              </h2>
              <p className="mb-4 text-center text-xs leading-relaxed text-slate-500">
                Laporan{" "}
                <span className="font-bold text-slate-700">{data.id}</span> akan
                ditandai selesai dan tidak dapat diubah kembali.
              </p>

              {/* Info box */}
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2.5">
                <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
                <p className="text-xs text-blue-700">
                  {isSuperAdmin
                    ? "Anda login sebagai Admin Utama — laporan akan langsung ditandai selesai."
                    : "Laporan akan dikirim untuk menunggu persetujuan Admin Utama. Belum benar-benar tertutup sampai disetujui."}
                </p>
              </div>

              {/* Ringkasan data */}
              <div className="mb-4 rounded-xl border border-slate-200 divide-y divide-slate-100">
                {[
                  { label: "Metode Analisis", value: metodeAnalisis },
                  {
                    label: "Tim Investigasi",
                    value: `${timAnggota.length} Anggota`,
                  },
                  {
                    label: "Akar Masalah Teridentifikasi",
                    value: `${rencanaPerbaikan.filter((r) => r.akarMasalah).length} Item`,
                  },
                  {
                    label: "Tanggal Penyelesaian",
                    value: new Date().toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-semibold text-slate-700">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Checkbox konfirmasi */}
              <label className="mb-5 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={agreeConfirm}
                  onChange={(e) => setAgreeConfirm(e.target.checked)}
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-600"
                />
                <span className="text-xs leading-relaxed text-slate-600">
                  Saya memastikan seluruh data investigasi sudah benar dan
                  lengkap.
                </span>
              </label>

              {/* Tombol */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
                >
                  Batal
                </button>
                <button
                  disabled={!agreeConfirm || isSaving}
                  onClick={handleFinalizeSubmit}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-95 ${
                    agreeConfirm && !isSaving
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "cursor-not-allowed bg-slate-200 text-slate-400"
                  }`}
                >
                  {isSaving ? "Mengirim..." : "Ya, Selesaikan Laporan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          AREA CETAK / EXPORT PDF — dipakai oleh window.print() (tombol
          "Cetak") maupun html2pdf.js (tombol "Unduh PDF"). Ditaruh
          offscreen supaya tidak terlihat di layar biasa, tapi tetap
          benar-benar dirender (bukan display:none) agar bisa ditangkap
          html2canvas. Layout meniru dokumen resmi "LAPORAN RCA".
         ============================================================ */}
      {/* ✅ Fix scrollbar ganda (lanjutan): `position: fixed` + `top: 0`
          ternyata TETAP dihitung Chrome ke document.documentElement
          .scrollHeight ketika elemen ini tinggi (laporan RCA panjang),
          walau sudah digeser jauh ke kiri (left:-9999px) dan lepas dari
          document flow. Terverifikasi lewat console:
          document.documentElement.scrollHeight jauh lebih besar dari
          window.innerHeight, sementara document.body.scrollHeight normal
          — selisihnya persis setinggi #rca-print-area. `top` juga digeser
          jauh ke luar viewport (bukan cuma `left`) supaya elemen ini benar-
          benar berada di luar area yang dihitung browser sebagai bagian
          dari tinggi dokumen. print:top-0 tetap mengembalikan posisi
          normal saat window.print() aktif, jadi tidak mengubah perilaku
          print/PDF sama sekali. */}
      <div
        id="rca-print-area"
        aria-hidden="true"
        className="fixed -left-[9999px] -top-[9999px] print:relative print:left-0 print:top-0 w-[794px] bg-white px-8 py-8 text-[12px] leading-relaxed text-black"
      >
        {rcaReportBody}
      </div>
    </>
  );
}
