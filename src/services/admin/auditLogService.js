// ── Service: Audit Log ──────────────────────────────────────────────────
// STATUS: terhubung ke backend REAL. GET /admin/audit-logs
//
// PENTING: backend cuma dokumentasikan filter `action` & `targetId` (tidak
// ada pencarian bebas teks) - lihat catatan di AuditLogPage.jsx. Pagination
// dilakukan server-side lewat query `page` & `limit`.
//
// 📝 UPDATE 20 Juli 2026 — field asli sudah dikonfirmasI lewat testing
// manual (cek console browser). Bentuk mentah tiap item log:
//   { id, action, createdAt, details, entity, entityId, ipAddress,
//     userAgent, userId }
// Field `details` BEDA STRUKTUR tiap `action` (bukan bentuk tetap).
//
// ⚠️ MASIH BELUM IDEAL / PERLU DIKONFIRMASI KE BACKEND:
//   - Backend TIDAK mengirim nama pengguna sama sekali, cuma `userId`
//     (UUID). Sementara ditampilkan versi singkat UUID-nya (8 karakter
//     pertama) sebagai fallback. Kalau nanti ada endpoint daftar user
//     admin, sebaiknya di-resolve jadi nama asli di sini.
//   - Backend TIDAK mengirim field role atau deskripsi siap pakai.
//     Deskripsi dirakit manual dari `action` + `details` di bawah -
//     baru dikonfirmasi untuk 3 action lewat testing manual:
//     CREATE_ADMIN, UPDATE_REPORT, REGRADE_REPORT. Action lain yang
//     belum pernah ketemu contohnya akan pakai fallback generik.
//   - Role selalu diasumsikan "ADMIN" karena semua log yang pernah
//     ketemu berasal dari aksi admin. Ini ASUMSI, bukan data eksplisit
//     dari backend - perlu dicek lagi kalau ternyata ada log dari role
//     lain juga.

import { apiClient } from "../../lib/apiClient";
import { getDaftarUserLengkap } from "./userManagementService";

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// ── 25 Juli 2026: resolve userId → nama & role asli ───────────────────────
// Sebelumnya cuma tampil versi singkat UUID (8 karakter pertama) karena
// backend audit log tidak kirim nama, dan role selalu diASUMSIkan "ADMIN".
// Sekarang endpoint GET /admin/users sudah live (list lengkap, termasuk
// akun nonaktif - penting supaya log LAMA dari user yang sudah di-suspend
// tetap bisa di-resolve namanya) - dipakai sebagai lookup map di sini.
//
// Di-cache di module-level (bukan di-fetch ulang tiap panggil
// getAuditLog()) karena daftar user jarang berubah dalam 1 sesi admin
// buka halaman Audit Log, dan halaman ini pindah page berkali-kali -
// tidak perlu request /admin/users berulang tiap ganti halaman.
let userMapCache = null;
let userMapPromise = null;

function buildUserMap(users) {
  const map = {};
  for (const u of users) {
    map[u.id] = { nama: u.nama, role: u.role };
  }
  return map;
}

async function getUserMap() {
  if (userMapCache) return userMapCache;
  if (!userMapPromise) {
    userMapPromise = getDaftarUserLengkap()
      .then((users) => {
        userMapCache = buildUserMap(users);
        return userMapCache;
      })
      .catch((err) => {
        // Kalau gagal fetch (mis. endpoint down), jangan sampai audit log
        // ikutan gagal total - fallback ke map kosong, biar mapLogItem
        // jatuh ke fallback shortUserId seperti sebelumnya. Reset promise
        // supaya percobaan berikutnya (mis. refresh halaman) coba fetch
        // lagi, bukan permanen kosong selama sesi.
        console.error("Gagal memuat daftar user untuk Audit Log:", err);
        userMapPromise = null;
        return {};
      });
  }
  return userMapPromise;
}

/**
 * Reset cache daftar user - panggil ini kalau ada perubahan data user
 * yang perlu langsung ter-refresh di Audit Log (mis. setelah admin baru
 * dibuat/dihapus), supaya tidak perlu refresh halaman/tunggu sesi baru.
 * Opsional dipakai, tidak wajib dipanggil di alur normal.
 */
export function resetUserMapCache() {
  userMapCache = null;
  userMapPromise = null;
}

// ── Label jenis aktivitas yang enak dibaca, dari kode action mentah ──────
// Tambahkan di sini kalau ketemu action baru yang belum terdaftar.
const ACTIVITY_LABELS = {
  CREATE_ADMIN: "Tambah Admin",
  UPDATE_REPORT: "Update Laporan",
  REGRADE_REPORT: "Ubah Grading",
  CREATE_PUBLIC_REPORT: "Laporan Baru",
  ASSIGN_REPORT: "Tugaskan Tim Investigasi",
};

// ── Label status laporan yang enak dibaca, dari kode status mentah ───────
// Dipakai buat rapiin deskripsi UPDATE_REPORT. Tambahkan status baru di
// sini kalau backend punya nilai lain yang belum terdaftar (fallback di
// bawah tetap aman - cuma ganti underscore jadi spasi + title case).
const STATUS_LABELS = {
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  DALAM_INVESTIGASI: "Dalam Investigasi",
  SELESAI: "Selesai",
  DITOLAK: "Ditolak",
  DIARSIPKAN: "Diarsipkan",
};

// ── Label grading (warna) yang enak dibaca ────────────────────────────────
const GRADING_LABELS = {
  HIJAU: "Hijau",
  BIRU: "Biru",
  KUNING: "Kuning",
  MERAH: "Merah",
};

// Fallback umum: ubah SNAKE_CASE/UPPERCASE ATAU camelCase jadi "Title Case"
// biar tetap enak dibaca walau belum ada mapping manual di atas.
//
// 🔧 25 Juli 2026: sebelumnya fungsi ini cuma menangani SNAKE_CASE (cocok
// untuk kode ACTION/status dari backend, mis. DALAM_INVESTIGASI), tapi
// juga dipakai sebagai fallback label untuk KEY dari `details` yang
// bentuknya camelCase (mis. "timAnggota", "sekretarisTim" — nama field
// JS biasa, bukan kode backend). Karena langsung .toLowerCase() semua
// duluan, camelCase-nya hilang & hasilnya jadi 1 kata nempel semua
// ("Timanggota") — sekarang camelCase dipecah dulu jadi kata terpisah
// SEBELUM di-lowercase, baru digabung sama proses SNAKE_CASE yang lama.
function titleCaseFromCode(value) {
  if (!value) return "-";
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase -> camel_Case
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatStatusLabel(status) {
  if (!status) return "-";
  return STATUS_LABELS[status] || titleCaseFromCode(status);
}

function formatGradingLabel(grading) {
  if (!grading) return "-";
  return GRADING_LABELS[grading] || titleCaseFromCode(grading);
}

// ── Label field "details" mentah → label enak dibaca, dipakai fallback
// generik supaya key seperti "kronologi" tampil "Kronologi" bukan mentah.
const FIELD_LABELS = {
  dampak: "Dampak",
  lokasi: "Lokasi",
  kronologi: "Kronologi",
  jenisInsiden: "Jenis Insiden",
  investigatorUtama: "Ketua Tim",
  sekretarisTim: "Sekretaris Tim",
  timAnggota: "Anggota Tim",
};

function formatWaktu(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ⚠️ 27 Juli 2026: untuk action CREATE_PUBLIC_REPORT, userId memang selalu
// kosong dari backend (laporan diajukan publik tanpa login) — sebelumnya
// tampil "-" yang membingungkan, sekarang ditulis "Pelapor" biar jelas ini
// bukan aksi admin. Kalau nanti ada action publik lain yang juga tidak
// punya userId, tambahkan action-nya ke PUBLIC_ACTIONS di bawah.
const PUBLIC_ACTIONS = new Set(["CREATE_PUBLIC_REPORT"]);

// ✅ 25 Juli 2026: sekarang coba resolve nama asli dulu lewat userMap
// (dari GET /admin/users). Fallback ke shortUserId TETAP dipertahankan
// untuk 2 kasus: (1) userMap gagal dimuat (lihat getUserMap di atas),
// atau (2) user itu sudah tidak ada lagi di GET /admin/users - meskipun
// endpoint ini sengaja menyertakan akun nonaktif/suspended supaya kasus
// ini seharusnya jarang terjadi, tetap dijaga sebagai jaring pengaman
// (mis. akun yang benar-benar dihapus permanen dari database, bukan
// cuma nonaktif).
function displayPengguna(item, userMap) {
  if (!item.userId && PUBLIC_ACTIONS.has(item.action)) {
    return "Pelapor";
  }
  const namaAsli = userMap?.[item.userId]?.nama;
  return namaAsli || shortUserId(item.userId);
}

function shortUserId(userId) {
  return userId ? userId.slice(0, 8) : "-";
}

// Rakit kalimat deskripsi dari action + details. `details` strukturnya
// beda-beda tiap action (lihat catatan di atas), jadi tiap action yang
// sudah dikonfirmasi dapat handling sendiri. Action yang belum dikenal
// jatuh ke fallback generik supaya tetap ada info, bukan kosong total.
//
// 🔧 25 Juli 2026: sekarang terima `userMap` (sama map userId→{nama,role}
// yang dipakai buat kolom Pengguna) sebagai parameter ketiga — dibutuhkan
// action ASSIGN_REPORT di bawah untuk resolve id anggota tim jadi nama
// asli, bukan tampil UUID mentah.
function buildDeskripsi(action, details, userMap = {}) {
  const d = details || {};

  // Resolve satu id user jadi nama asli lewat userMap, fallback ke versi
  // pendek UUID-nya kalau tidak ketemu (id user yang benar-benar terhapus
  // dari database) — pola sama persis dengan displayPengguna() di atas.
  const resolveNamaUser = (id) =>
    id ? userMap?.[id]?.nama || shortUserId(id) : null;

  switch (action) {
    case "CREATE_ADMIN":
      return `Membuat akun admin baru "${d.nama ?? "-"}" (${d.email ?? "-"})`;

    case "UPDATE_REPORT":
      return `Mengubah status laporan menjadi "${formatStatusLabel(d.status)}"${
        d.lokasi ? ` di ${d.lokasi}` : ""
      }`;

    case "REGRADE_REPORT":
      return `Mengubah grading laporan menjadi "${formatGradingLabel(d.gradingBaru)}"${
        d.alasan ? ` — alasan: ${d.alasan}` : ""
      }`;

    case "CREATE_PUBLIC_REPORT": {
      // ✅ 27 Juli 2026: sebelumnya jatuh ke fallback generik (rangkaian
      // "key: value" mentah dari details, termasuk kronologi yang panjang
      // dan bikin ringkasan kepotong jelek di tabel). Sekarang dirakit
      // jadi 1 kalimat ringkas; kronologi sengaja TIDAK dimasukkan ke
      // ringkasan (terlalu panjang untuk 1 baris), tapi tetap disimpan
      // utuh di field terpisah (lihat mapLogItem) untuk ditampilkan lewat
      // tooltip/detail kalau dibutuhkan.
      const parts = [];
      if (d.lokasi) parts.push(`lokasi ${d.lokasi}`);
      if (d.jenisInsiden) parts.push(`jenis ${d.jenisInsiden}`);
      if (d.dampak !== undefined && d.dampak !== null) {
        parts.push(`tingkat dampak ${d.dampak}`);
      }
      return parts.length > 0
        ? `Laporan insiden baru dibuat — ${parts.join(", ")}`
        : "Laporan insiden baru dibuat";
    }

    // 🔧 25 Juli 2026: sebelumnya BELUM ADA case ini — jatuh ke fallback
    // generik yang (a) memberi label kacau untuk key camelCase
    // ("Timanggota", "Sekretaristim", lihat fix titleCaseFromCode di
    // atas) dan (b) menampilkan UUID mentah id anggota tim, bukan nama.
    // ASUMSI bentuk `details` (BELUM dikonfirmasi lewat dokumentasi
    // resmi backend, cuma dari data yang pernah muncul di Audit Log):
    // { investigatorUtama, sekretarisTim, timAnggota } — ketiganya id
    // user (string UUID). `timAnggota` diasumsikan BISA berupa satu id
    // tunggal ATAU array id (kalau anggota lebih dari satu) — ditangani
    // dua-duanya di sini supaya aman. Field yang kosong/tidak diisi
    // (mis. Sekretaris Tim belum di-assign) SENGAJA disembunyikan dari
    // kalimat, bukan ikut ditampilkan sebagai "Sekretaris Tim: " kosong.
    case "ASSIGN_REPORT": {
      const parts = [];
      const namaKetua = resolveNamaUser(d.investigatorUtama);
      if (namaKetua) parts.push(`Ketua Tim: ${namaKetua}`);

      const namaSekretaris = resolveNamaUser(d.sekretarisTim);
      if (namaSekretaris) parts.push(`Sekretaris: ${namaSekretaris}`);

      const idAnggota = Array.isArray(d.timAnggota)
        ? d.timAnggota
        : [d.timAnggota];
      const namaAnggota = idAnggota
        .filter(Boolean)
        .map(resolveNamaUser)
        .join(", ");
      if (namaAnggota) parts.push(`Anggota: ${namaAnggota}`);

      return parts.length > 0
        ? `Menugaskan tim investigasi — ${parts.join("; ")}`
        : "Menugaskan tim investigasi";
    }

    default: {
      // Fallback generik: rangkai beberapa key pertama dari `details` jadi
      // kalimat "Label: value" (bukan key mentah lagi), supaya action baru
      // yang belum kita kenal tetap tampil info-nya dengan cukup rapi.
      // 🔧 25 Juli 2026: sekarang skip entry yang value-nya kosong/blank
      // (dulu tetap ikut ditampilkan sebagai "Label: " tanpa isi).
      const entries = Object.entries(d)
        .filter(
          ([, value]) => value !== null && value !== undefined && value !== "",
        )
        .slice(0, 3);
      if (entries.length === 0) return ACTIVITY_LABELS[action] || action || "-";
      return entries
        .map(
          ([key, value]) =>
            `${FIELD_LABELS[key] || titleCaseFromCode(key)}: ${value}`,
        )
        .join(", ");
    }
  }
}

// Ubah satu item mentah dari backend jadi bentuk yang dipakai
// AuditLogPage.jsx (waktu, pengguna, role, jenisAktivitas, deskripsi,
// alamatIP).
//
// ✅ 25 Juli 2026: role sekarang diambil dari userMap (data asli dari
// GET /admin/users) kalau tersedia - TIDAK lagi diasumsikan "ADMIN"
// begitu saja untuk semua aksi non-publik. Fallback ke "ADMIN" tetap
// dipertahankan HANYA untuk kasus userMap gagal dimuat/user tidak
// ketemu (lihat displayPengguna), supaya tidak tiba-tiba tampil role
// kosong/undefined kalau lookup gagal.
function mapLogItem(item, userMap = {}) {
  const details = item.details || {};
  const isPublic = PUBLIC_ACTIONS.has(item.action);
  return {
    id: item.id,
    waktu: formatWaktu(item.createdAt),
    pengguna: displayPengguna(item, userMap),
    role: isPublic ? "USER" : userMap?.[item.userId]?.role || "ADMIN",
    jenisAktivitas: ACTIVITY_LABELS[item.action] || item.action || "-",
    deskripsi: buildDeskripsi(item.action, item.details, userMap),
    // Versi lengkap termasuk kronologi (kalau ada) - dipakai sebagai
    // tooltip (title attribute) di AuditLogPage supaya info yang sengaja
    // tidak dimasukkan ke ringkasan 1-baris tetap bisa dilihat penuh
    // tanpa perlu buka halaman lain.
    deskripsiLengkap: details.kronologi
      ? `${buildDeskripsi(item.action, item.details, userMap)}. Kronologi: ${details.kronologi}`
      : buildDeskripsi(item.action, item.details, userMap),
    alamatIP: item.ipAddress || "-",
    // ✅ BARU 27 Juli 2026: field reportId & trackingNumber dari update BE
    // — cuma tersedia untuk action UPDATE_REPORT/REGRADE_REPORT, dan CUMA
    // untuk audit log yang dibuat SETELAH fitur ini live di backend (entry
    // lama tidak di-backfill, jadi details.reportId bisa saja tidak ada
    // sama sekali). Sengaja default ke null (bukan dipaksa ada) supaya
    // AuditLogPage bisa sembunyikan tombol "Lihat Laporan Terkait" kalau
    // memang tidak tersedia, bukan nampilin tombol rusak/kosong.
    reportId: details.reportId ?? null,
    trackingNumber: details.trackingNumber ?? null,
  };
}

/**
 * Ambil daftar audit log dari backend, dengan pagination server-side.
 * GET /admin/audit-logs
 *
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @param {string} [params.action] - filter opsional, kalau backend dukung
 * @param {string} [params.targetId] - filter opsional, kalau backend dukung
 * @returns {Promise<{ items: object[], total: number }>}
 */
export async function getAuditLog({
  page = 1,
  limit = 10,
  action,
  targetId,
} = {}) {
  const params = { page, limit };
  if (action) params.action = action;
  if (targetId) params.targetId = targetId;

  // Ambil dulu lookup nama/role user (cached setelah panggilan pertama,
  // lihat getUserMap) SEBELUM fetch audit log, supaya bisa jalan paralel
  // dengan request audit log itu sendiri alih-alih menunggu berurutan.
  const [res, userMap] = await Promise.all([
    apiClient.get("/admin/audit-logs", { params }),
    getUserMap(),
  ]);
  const data = unwrap(res);

  // Fallback berlapis - jaga-jaga kalau backend balikin array langsung
  // (bukan { items, total }), supaya AuditLogPage tidak crash lagi.
  const rawItems = Array.isArray(data) ? data : (data?.items ?? []);
  const total = Array.isArray(data)
    ? data.length
    : typeof data?.total === "number"
      ? data.total
      : 0;

  return {
    items: rawItems.map((item) => mapLogItem(item, userMap)),
    total,
  };
}

export default {
  getAuditLog,
};
