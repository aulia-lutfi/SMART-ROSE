import { useState, useEffect } from "react";
import {
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertCircle,
  RefreshCw,
  Printer,
  Filter,
  X,
} from "lucide-react";
import {
  getDaftarLaporan,
  searchLaporan,
  STATUS_LABEL,
} from "../../services/admin/insidenService";
import {
  getGradingStyle,
  tentukanJenisInvestigasiDariLaporan,
} from "../../lib/grading";
// ── Catatan: sesuaikan path import di atas dengan lokasi asli
// insidenService.js di project kamu (src/services/insidenService.js).

const ITEMS_PER_PAGE = 8;
const TABLE_COLUMNS = 8;

// ── 25 Juli 2026: flag untuk toggle "Cari di Server" ──
// Fiturnya (state, debounce effect, searchLaporan()) tetap ada & siap
// pakai — cuma checkbox-nya disembunyikan dari UI karena belum jadi
// kebutuhan admin sekarang (search client-side yang sudah ada masih
// lebih unggul, lihat komentar di deklarasi state `modeServer`).
// Nyalakan lagi nanti cukup ganti ke `true` kalau memang dibutuhkan
// (mis. jumlah laporan sudah sangat banyak).
const AKTIFKAN_TOGGLE_SEARCH_SERVER = false;

// ============================================================
// FIX 20 Juli 2026 — dua field di baris tabel sebelumnya salah nama,
// dicek langsung dari response asli GET /admin/reports lewat tab Network:
//   - row.tanggalMasuk TIDAK ADA di response → diganti row.createdAt
//     (tanggal laporan dibuat/masuk). Kalau yang dimaksud "Tanggal Masuk"
//     sebenarnya tanggal kejadian, ganti ke row.tanggalKejadian.
//   - row.grading TIDAK ADA di response → diganti row.gradingAwal
//     (nilainya spt "MERAH"/"KUNING"/dst). row.gradingFinal juga ada,
//     biasanya null sampai grading diverifikasi ulang.
//   - ID Laporan sekarang pakai row.trackingNumber ("SR-2026-000004",
//     lebih pendek & terstruktur) bukan row.id (UUID mentah). row.id
//     tetap dipakai untuk React key & navigasi ke halaman detail.
// ============================================================

// ── Helper format tanggal: "2026-07-20T02:56:02.792Z" → "20 Jul 2026" ──
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

// ── Helper warna: grading efektif ("MERAH"/"Ekstrim" dst) → className badge/dot ──
// Pakai getGradingStyle dari lib/grading supaya warna backend ("MERAH")
// dan grading id internal ("Ekstrim") dua-duanya ke-resolve dengan benar
// (sebelumnya lookup langsung ke GRADING_STYLE gagal karena keynya beda
// bahasa, makanya dot selalu jatuh ke abu-abu).
function getGradingBadgeClass(gradingEfektif) {
  const style = getGradingStyle(gradingEfektif);
  return style ? `${style.bg} ${style.text}` : "bg-slate-100 text-slate-600";
}

function getGradingDotClass(gradingEfektif) {
  const style = getGradingStyle(gradingEfektif);
  return style ? style.dot : "bg-slate-400";
}

// ── Grading efektif: gradingFinal kalau sudah ada (pernah di-regrading),
// fallback ke gradingAwal. Dipakai konsisten untuk warna badge/dot maupun
// penentuan jenis investigasi (lihat tentukanJenisInvestigasiDariLaporan).
function gradingEfektifDari(row) {
  return row.gradingFinal || row.gradingAwal;
}

// Label grading yang enak dibaca untuk area cetak (kode warna backend →
// tingkat keparahan), konsisten dengan LABEL_GRADING di
// adminDashboardService.js. Tabel di layar cukup pakai dot warna, tapi
// di atas kertas hitam-putih dot warna tidak cukup informatif, jadi
// dicetak sebagai teks.
const LABEL_GRADING_CETAK = {
  BIRU: "Rendah",
  HIJAU: "Moderat",
  KUNING: "Tinggi",
  MERAH: "Ekstrim",
};

// ── Helper warna: status ("Baru" dst, sudah label rapi dari insidenService) ──
const STATUS_TEXT_COLOR = {
  Baru: "text-red-600",
  "Menunggu Verifikasi": "text-blue-600",
  "Dalam Investigasi": "text-orange-600",
  Selesai: "text-green-600",
  Arsip: "text-slate-400",
};
function getStatusColorClass(status) {
  return STATUS_TEXT_COLOR[status] || "text-slate-600";
}

// ── Sub-komponen: badge jenis investigasi (RCA / Sederhana / -) ──
// jenisInvestigasi di sini adalah hasil tentukanJenisInvestigasiDariLaporan(row),
// bukan field mentah dari API (field itu tidak ada di response).
function JenisInvestigasiBadge({ jenisInvestigasi }) {
  if (!jenisInvestigasi) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-400">
        -
      </span>
    );
  }
  const isRca = jenisInvestigasi.id === "RCA";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${
        isRca ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
      }`}
    >
      {isRca ? "RCA" : "Sederhana"}
    </span>
  );
}

// ── Sub-komponen: satu baris data laporan ──
function LaporanRow({ row, onLihatDetail }) {
  const gradingEfektif = gradingEfektifDari(row);
  const jenisInvestigasi = tentukanJenisInvestigasiDariLaporan(row);
  return (
    // ── Baris bisa diklik langsung untuk buka detail ──────────────────
    // Sebelumnya klik detail cuma bisa lewat tombol Eye di kolom Aksi.
    // Sekarang seluruh baris jadi area klik (cursor-pointer + onClick di
    // <tr>), tombol Eye tetap ada sebagai penanda visual "baris ini bisa
    // dibuka", bukan satu-satunya titik klik lagi.
    <tr
      onClick={() => onLihatDetail(row.id)}
      className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 transition"
    >
      <td className="px-5 py-4 font-medium text-slate-700">
        {row.trackingNumber || row.id}
      </td>
      <td className="px-5 py-4 text-slate-600">
        {formatTanggal(row.createdAt)}
      </td>
      <td className="px-5 py-4">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getGradingBadgeClass(gradingEfektif)}`}
        >
          {row.jenisInsiden}
        </span>
      </td>
      <td className="px-5 py-4 text-slate-600">{row.unitKerja}</td>
      <td className="px-5 py-4 text-center">
        <div
          className={`h-3 w-3 rounded-full mx-auto ${getGradingDotClass(gradingEfektif)}`}
        />
      </td>
      <td className="px-5 py-4 text-center">
        <JenisInvestigasiBadge jenisInvestigasi={jenisInvestigasi} />
      </td>
      <td
        className={`px-5 py-4 font-semibold ${getStatusColorClass(row.status)}`}
      >
        {row.status}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={(e) => {
              // stopPropagation: cegah klik tombol ini memicu onClick <tr>
              // dua kali (sebenarnya tidak masalah karena aksinya sama,
              // tapi lebih aman & jadi kebiasaan yang benar kalau nanti
              // ada tombol aksi lain ditambah di kolom ini yang beda logic)
              e.stopPropagation();
              onLihatDetail(row.id);
            }}
            className="rounded-lg p-1.5 hover:bg-slate-100 text-slate-600"
            title="Lihat detail laporan"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Sub-komponen: baris skeleton saat loading ──
function LoadingRows({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, idx) => (
        <tr key={idx} className="border-b border-slate-100">
          {Array.from({ length: TABLE_COLUMNS }).map((__, colIdx) => (
            <td key={colIdx} className="px-5 py-4">
              <div className="h-3.5 w-full max-w-[100px] animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Sub-komponen: baris "tidak ada data" ──
function EmptyRow({
  message = "Tidak ada laporan yang cocok dengan pencarian Anda.",
}) {
  return (
    <tr>
      <td
        colSpan={TABLE_COLUMNS}
        className="px-5 py-10 text-center text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}

// ── Sub-komponen: state gagal memuat ──
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 text-center shadow-sm">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <AlertCircle className="h-8 w-8 text-red-400" />
      </div>
      <p className="text-base font-semibold text-slate-600">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Coba Lagi
      </button>
    </div>
  );
}

// ── Sub-komponen: kontrol pagination ──
function PaginationControls({
  currentPage,
  totalPages,
  isLoading,
  onChangePage,
}) {
  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 3;
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => onChangePage(Math.max(1, currentPage - 1))}
        className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={currentPage === 1 || isLoading}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {generatePageNumbers().map((page) => (
        <button
          key={page}
          onClick={() => onChangePage(page)}
          disabled={isLoading}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            currentPage === page
              ? "bg-blue-600 text-white"
              : "border border-slate-200 hover:bg-slate-50"
          }`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onChangePage(Math.min(totalPages, currentPage + 1))}
        className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={currentPage === totalPages || isLoading}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Sub-komponen: satu grup checkbox filter (Status / Grading / Jenis Investigasi) ──
function FilterCheckboxGroup({ label, options, selected, onToggle }) {
  if (options.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                isActive
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-komponen: modal filter cetak ──
// Muncul saat tombol "Cetak" diklik, supaya user bisa pilih laporan
// mana saja (status, grading, jenis investigasi, rentang tanggal) yang
// mau ikut dicetak, sebelum window.print() dipanggil.
function ModalFilterCetak({
  isOpen,
  onClose,
  onCetak,
  filters,
  onToggleFilter,
  onChangeTanggal,
  onResetFilter,
  opsiStatus,
  opsiGrading,
  opsiJenisInvestigasi,
  jumlahHasil,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="text-base font-bold text-slate-800">
              Filter Laporan untuk Dicetak
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rentang Tanggal Masuk
          </p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.tanggalMulai}
              onChange={(e) => onChangeTanggal("tanggalMulai", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={filters.tanggalSelesai}
              onChange={(e) =>
                onChangeTanggal("tanggalSelesai", e.target.value)
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <FilterCheckboxGroup
          label="Status"
          options={opsiStatus}
          selected={filters.status}
          onToggle={(val) => onToggleFilter("status", val)}
        />
        <FilterCheckboxGroup
          label="Grading"
          options={opsiGrading}
          selected={filters.grading}
          onToggle={(val) => onToggleFilter("grading", val)}
        />
        <FilterCheckboxGroup
          label="Jenis Investigasi"
          options={opsiJenisInvestigasi}
          selected={filters.jenisInvestigasi}
          onToggle={(val) => onToggleFilter("jenisInvestigasi", val)}
        />

        <p className="mb-4 mt-1 text-xs text-slate-500">
          {jumlahHasil} laporan cocok dengan filter ini dan akan dicetak.
        </p>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onResetFilter}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            Reset Filter
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              onClick={onCetak}
              disabled={jumlahHasil === 0}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              Cetak Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Komponen utama
// ============================================================
export default function ManajemenInsidenPage({ onNavigate }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [dataLaporan, setDataLaporan] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── 27 Juli 2026: laporan berstatus ARSIP disembunyikan dari tabel
  // utama secara default (supaya tidak nyampur dengan laporan aktif yang
  // masih perlu ditindaklanjuti), tapi tetap bisa ditampilkan lagi lewat
  // toggle ini kalau admin memang butuh cari laporan lama yang sudah
  // diarsipkan.
  //
  // ⚠️ UPDATE: backend sekarang menyembunyikan laporan ARSIP dari
  // response default GET /admin/reports (dan GET /admin/reports/search).
  // Jadi toggle ini TIDAK LAGI cuma filter client-side dari data yang
  // sudah ke-fetch — mengubah toggle ini men-trigger REQUEST BARU ke
  // backend dengan param `includeArchived: true` (lihat useEffect
  // fetchLaporan & useEffect search di bawah). Filter status ARSIP di
  // `filteredDataLocal`/`filteredData` tetap dipertahankan sebagai lapisan
  // kedua (extra safety), bukan lagi satu-satunya mekanisme.
  const [tampilkanArsip, setTampilkanArsip] = useState(false);

  // ── 25 Juli 2026: mode search server (opsional, default OFF) ──
  // Search lama (client-side, di bawah) tetap jadi default karena masih
  // lebih unggul: 6 field vs 3, hasil tidak dibatasi vs maks 20, instan
  // vs perlu network request tiap ketik (lihat perbandingan di dokumen
  // "Update Backend untuk FE - Profil dan Search Laporan", 25 Juli 2026).
  // Toggle ini disediakan supaya endpoint GET /admin/reports/search
  // (searchLaporan() di insidenService.js) tetap terpasang & bisa dipakai
  // admin kalau perlu, dan siap dijadikan default nanti kalau suatu saat
  // getDaftarLaporan() tidak lagi preload semua data (mis. karena jumlah
  // laporan sudah sangat besar).
  const [modeServer, setModeServer] = useState(false);
  const [serverResults, setServerResults] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [isServerSearching, setIsServerSearching] = useState(false);
  const [serverSearchError, setServerSearchError] = useState(null);

  // ── State filter cetak: dipisah dari searchQuery supaya user bisa
  // pilih laporan mana saja yang mau dicetak tanpa mengubah tampilan
  // tabel di layar. Dibuka lewat modal saat tombol "Cetak" diklik.
  const [showFilterCetak, setShowFilterCetak] = useState(false);
  const [filterCetak, setFilterCetak] = useState({
    status: [],
    grading: [],
    jenisInvestigasi: [],
    tanggalMulai: "",
    tanggalSelesai: "",
  });

  // ── 27 Juli 2026: fetchLaporan sekarang menerima `params` dan
  // meneruskannya ke getDaftarLaporan() (mis. { includeArchived: true }).
  // Ini WAJIB sejak backend menyembunyikan laporan ARSIP dari response
  // default GET /admin/reports — filter client-side saja tidak cukup
  // karena datanya memang tidak ikut dikembalikan backend kalau param
  // ini tidak dikirim. Lihat catatan di insidenService.js.
  const fetchLaporan = async (params = {}) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getDaftarLaporan(params);
      setDataLaporan(data);
    } catch (err) {
      console.error("Gagal memuat daftar laporan:", err);
      setLoadError("Gagal memuat daftar laporan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── 27 Juli 2026: refetch tiap kali toggle "Tampilkan Laporan
  // Diarsipkan" berubah — bukan cuma sekali saat mount seperti
  // sebelumnya. Dulu cukup filter di client karena getDaftarLaporan()
  // memang mengembalikan semua status termasuk ARSIP; sekarang backend
  // sudah menyembunyikan ARSIP secara default, jadi kalau toggle
  // dinyalakan, request baru dengan includeArchived:true wajib dikirim
  // supaya datanya benar-benar ada di dataLaporan (bukan cuma soal
  // tampil/sembunyi di UI).
  useEffect(() => {
    fetchLaporan(tampilkanArsip ? { includeArchived: true } : {});
  }, [tampilkanArsip]);

  // ── Contoh nanti kalau filter/pagination dipindah ke backend ──────────────
  // useEffect(() => {
  //   getDaftarLaporan({ search: searchQuery, page: currentPage }).then((res) => {
  //     setDataLaporan(res.items);
  //     setTotalData(res.total);
  //   });
  // }, [searchQuery, currentPage]);

  // ── 25 Juli 2026: pemanggil searchLaporan() saat modeServer aktif ──
  // Di-debounce 400ms supaya tidak fire request di setiap ketukan tombol.
  // `q` wajib diisi di backend (400 kalau kosong) — jadi kalau searchQuery
  // kosong, sengaja TIDAK memanggil endpoint sama sekali, cukup kosongkan
  // hasil di state lokal.
  useEffect(() => {
    if (!modeServer) return;

    const query = searchQuery.trim();
    if (!query) {
      setServerResults([]);
      setServerTotal(0);
      setServerSearchError(null);
      setIsServerSearching(false);
      return;
    }

    setIsServerSearching(true);
    setServerSearchError(null);

    const timeoutId = setTimeout(async () => {
      try {
        // ── 27 Juli 2026: teruskan includeArchived sesuai toggle
        // "Tampilkan Laporan Diarsipkan", sama alasannya dengan
        // getDaftarLaporan() — backend sekarang menyembunyikan ARSIP
        // secara default, jadi filter client-side di bawah (filteredData)
        // saja tidak cukup kalau data ARSIP-nya tidak ikut ke-fetch.
        const { total, results } = await searchLaporan(query, {
          includeArchived: tampilkanArsip,
        });
        setServerResults(results);
        setServerTotal(total);
      } catch (err) {
        console.error("Gagal mencari laporan di server:", err);
        setServerSearchError("Gagal mencari laporan di server. Coba lagi.");
        setServerResults([]);
        setServerTotal(0);
      } finally {
        setIsServerSearching(false);
      }
    }, 400);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeServer, searchQuery, tampilkanArsip]);

  // ── Filter berdasarkan search query ──
  // Saat backend sudah siap dengan query params server-side, filter ini
  // bisa dipindah ke API (lihat contoh useEffect di atas) dan baris di
  // bawah ini bisa dihapus.
  //
  // ✅ 27 Juli 2026: ditambah exclude status ARSIP kecuali toggle
  // tampilkanArsip aktif (lihat penjelasan di deklarasi state-nya).
  // Dicek SEBELUM search query supaya konsisten - kalau toggle mati,
  // laporan arsip tidak akan muncul walau kebetulan cocok kata kunci
  // pencarian juga.
  const filteredDataLocal = dataLaporan.filter((row) => {
    if (!tampilkanArsip && row.status === STATUS_LABEL.ARSIP) return false;

    const query = searchQuery.toLowerCase();
    const jenisInvestigasiLabel =
      tentukanJenisInvestigasiDariLaporan(row)?.id || "";
    return (
      (row.jenisInsiden || "").toLowerCase().includes(query) ||
      (row.unitKerja || "").toLowerCase().includes(query) ||
      (row.ditugaskan || "").toLowerCase().includes(query) ||
      (row.status || "").toLowerCase().includes(query) ||
      jenisInvestigasiLabel.toLowerCase().includes(query) ||
      (row.trackingNumber || "").toLowerCase().includes(query)
    );
  });

  // ── 25 Juli 2026: sumber data tabel tergantung modeServer ──
  // OFF (default): filteredDataLocal, sama persis seperti sebelumnya.
  // ON: hasil dari searchLaporan() (server), tetap disaring status ARSIP
  // di client supaya konsisten dengan toggle "Tampilkan Laporan
  // Diarsipkan" — backend search tidak filter status apapun.
  const filteredData = modeServer
    ? serverResults.filter(
        (row) => tampilkanArsip || row.status !== STATUS_LABEL.ARSIP,
      )
    : filteredDataLocal;

  // ── Opsi filter cetak: diambil unik dari seluruh dataLaporan (bukan
  // cuma yang lagi tampil), supaya pilihan checkbox tetap lengkap
  // walaupun user sedang mencari sesuatu di search bar.
  const opsiStatus = [
    ...new Set(dataLaporan.map((row) => row.status).filter(Boolean)),
  ];
  const opsiGrading = [
    ...new Set(
      dataLaporan
        .map((row) => LABEL_GRADING_CETAK[gradingEfektifDari(row)])
        .filter(Boolean),
    ),
  ];
  const opsiJenisInvestigasi = ["RCA", "Sederhana"];

  // ── Data yang benar-benar akan dicetak: hasil pencarian (filteredData)
  // disaring lagi dengan filterCetak (status/grading/jenis investigasi/
  // rentang tanggal). Kalau sebuah kategori filter kosong (tidak ada yang
  // dicentang), kategori itu dianggap "tampilkan semua".
  const dataUntukCetak = filteredData.filter((row) => {
    const labelGrading = LABEL_GRADING_CETAK[gradingEfektifDari(row)];
    const jenisInvestigasi = tentukanJenisInvestigasiDariLaporan(row);
    const labelJenisInvestigasi = jenisInvestigasi
      ? jenisInvestigasi.id === "RCA"
        ? "RCA"
        : "Sederhana"
      : null;

    if (
      filterCetak.status.length > 0 &&
      !filterCetak.status.includes(row.status)
    ) {
      return false;
    }
    if (
      filterCetak.grading.length > 0 &&
      !filterCetak.grading.includes(labelGrading)
    ) {
      return false;
    }
    if (
      filterCetak.jenisInvestigasi.length > 0 &&
      !filterCetak.jenisInvestigasi.includes(labelJenisInvestigasi)
    ) {
      return false;
    }
    if (filterCetak.tanggalMulai || filterCetak.tanggalSelesai) {
      const tanggalRow = row.createdAt ? new Date(row.createdAt) : null;
      if (!tanggalRow || Number.isNaN(tanggalRow.getTime())) return false;
      if (
        filterCetak.tanggalMulai &&
        tanggalRow < new Date(filterCetak.tanggalMulai)
      ) {
        return false;
      }
      if (filterCetak.tanggalSelesai) {
        const batasAkhir = new Date(filterCetak.tanggalSelesai);
        batasAkhir.setHours(23, 59, 59, 999); // inklusif sampai akhir hari
        if (tanggalRow > batasAkhir) return false;
      }
    }
    return true;
  });

  const toggleFilterCetak = (kategori, value) => {
    setFilterCetak((prev) => {
      const sudahAda = prev[kategori].includes(value);
      return {
        ...prev,
        [kategori]: sudahAda
          ? prev[kategori].filter((v) => v !== value)
          : [...prev[kategori], value],
      };
    });
  };

  const ubahTanggalFilterCetak = (field, value) => {
    setFilterCetak((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilterCetak = () => {
    setFilterCetak({
      status: [],
      grading: [],
      jenisInvestigasi: [],
      tanggalMulai: "",
      tanggalSelesai: "",
    });
  };

  const totalData = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalData / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1); // reset ke halaman 1 setiap kali search berubah
  };

  const handleLihatDetail = (id) => onNavigate("detail-laporan", id);

  // Cetak daftar laporan (mengikuti hasil pencarian yang sedang aktif,
  // SEMUA baris yang cocok — bukan cuma yang tampil di halaman saat ini).
  // Sama seperti pola cetak di halaman lain: window.print() + area cetak
  // terpisah yang di-render offscreen, dipakai supaya opsi "Save as PDF"
  // di dialog print browser juga otomatis tersedia.
  const handleBukaFilterCetak = () => setShowFilterCetak(true);

  const handleCetakSekarang = () => {
    setShowFilterCetak(false);
    // Kasih sedikit jeda supaya modal sempat hilang dari DOM sebelum
    // dialog print browser muncul (mencegah modal ikut "terpotong" di
    // print preview sesaat sebelum print:hidden diterapkan).
    setTimeout(() => window.print(), 50);
  };

  return (
    <>
      {/* Area cetak (#laporan-print-area) selalu dirender di DOM, tapi
          digeser jauh ke luar viewport (offscreen) di layar biasa sehingga
          tidak terlihat pengguna. Saat window.print() dipanggil, posisinya
          dikembalikan normal dan seluruh UI halaman (search bar, tabel
          interaktif, pagination) disembunyikan lewat class print:hidden.
          Pola sama dengan InvestigasiSederhanaPage.jsx /
          DetailLaporanPageAdmin.jsx. Landscape dipakai karena kolomnya
          cukup banyak (7 kolom) supaya tidak terlalu sempit di kertas. */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.5cm; }
          body * { visibility: hidden; }
          #laporan-print-area, #laporan-print-area * { visibility: visible; }
          #laporan-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8 print:hidden">
        {/* Search Bar + toggle Arsip + tombol Cetak */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                modeServer
                  ? "Cari di server berdasarkan No. Tracking, Nama Fasilitas, atau Unit Kerja..."
                  : "Cari laporan berdasarkan jenis insiden, unit kerja, atau status..."
              }
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
          </div>
          {AKTIFKAN_TOGGLE_SEARCH_SERVER && (
            <label
              title="Kalau aktif: pencarian dikirim ke server (hanya No. Tracking, Nama Fasilitas, Unit Kerja; maks 20 hasil). Kalau nonaktif: pencarian instan di data yang sudah dimuat (6 field, tanpa batas hasil)."
              className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition select-none"
            >
              <input
                type="checkbox"
                checked={modeServer}
                onChange={(e) => {
                  setModeServer(e.target.checked);
                  setCurrentPage(1); // reset ke halaman 1 - sumber data berubah
                }}
                className="h-4 w-4 accent-blue-600"
              />
              Cari di Server
            </label>
          )}
          <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition select-none">
            <input
              type="checkbox"
              checked={tampilkanArsip}
              onChange={(e) => {
                setTampilkanArsip(e.target.checked);
                setCurrentPage(1); // reset ke halaman 1 - jumlah data berubah
              }}
              className="h-4 w-4 accent-blue-600"
            />
            Tampilkan Laporan Diarsipkan
          </label>
          <button
            onClick={handleBukaFilterCetak}
            disabled={isLoading || !!loadError}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            <Printer className="h-4 w-4" />
            Cetak
          </button>
        </div>

        {modeServer && (
          <p className="mb-4 -mt-3 text-xs text-slate-500">
            {serverSearchError ? (
              <span className="text-red-500">{serverSearchError}</span>
            ) : searchQuery.trim() ? (
              <>
                Mode server aktif — mencari di No. Tracking, Nama Fasilitas, dan
                Unit Kerja saja.{" "}
                {serverTotal > serverResults.length
                  ? `Menampilkan ${serverResults.length} dari total ${serverTotal} hasil yang cocok (dibatasi maks 20 oleh server).`
                  : null}
              </>
            ) : (
              "Mode server aktif — ketik kata kunci untuk mencari (No. Tracking, Nama Fasilitas, atau Unit Kerja)."
            )}
          </p>
        )}

        <ModalFilterCetak
          isOpen={showFilterCetak}
          onClose={() => setShowFilterCetak(false)}
          onCetak={handleCetakSekarang}
          filters={filterCetak}
          onToggleFilter={toggleFilterCetak}
          onChangeTanggal={ubahTanggalFilterCetak}
          onResetFilter={resetFilterCetak}
          opsiStatus={opsiStatus}
          opsiGrading={opsiGrading}
          opsiJenisInvestigasi={opsiJenisInvestigasi}
          jumlahHasil={dataUntukCetak.length}
        />

        {loadError ? (
          <ErrorState
            message={loadError}
            onRetry={() =>
              fetchLaporan(tampilkanArsip ? { includeArchived: true } : {})
            }
          />
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      ID Laporan
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Tanggal Masuk
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Jenis Insiden
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Unit Kerja
                    </th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-700">
                      Grading
                    </th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-700">
                      Jenis Investigasi
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-5 py-3 text-center font-semibold text-slate-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading || (modeServer && isServerSearching) ? (
                    <LoadingRows />
                  ) : paginatedData.length > 0 ? (
                    paginatedData.map((row) => (
                      <LaporanRow
                        key={row.id}
                        row={row}
                        onLihatDetail={handleLihatDetail}
                      />
                    ))
                  ) : (
                    <EmptyRow
                      message={
                        modeServer && !searchQuery.trim()
                          ? "Ketik kata kunci di kolom pencarian untuk mulai mencari di server."
                          : undefined
                      }
                    />
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination - otomatis mengikuti jumlah data & hasil pencarian */}
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                {isLoading
                  ? "Memuat data..."
                  : `Menampilkan ${totalData === 0 ? 0 : startIndex + 1}-${Math.min(
                      startIndex + ITEMS_PER_PAGE,
                      totalData,
                    )} dari ${totalData} laporan`}
              </p>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                isLoading={isLoading}
                onChangePage={setCurrentPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Area Cetak — daftar laporan yang cocok dengan pencarian (searchQuery)
          DAN filter cetak (filterCetak: status/grading/jenis investigasi/
          rentang tanggal) yang dipilih user lewat ModalFilterCetak.
          dataUntukCetak dipakai, bukan paginatedData, supaya hasil cetak
          tidak cuma 1 halaman tabel yang sedang dilihat di layar. Kolom
          "Aksi" sengaja tidak ikut dicetak karena tidak relevan di atas kertas. */}
      {/* ✅ Fix scrollbar ganda: sebelumnya `position: "absolute"`. Elemen
          absolute tanpa ancestor position:relative di atasnya tetap ikut
          dihitung ke scrollable height dokumen walau digeser jauh ke
          kiri (left:-9999px) — kalau daftar laporan yang dicetak
          panjang, tinggi elemen ini diam-diam menambah tinggi total
          halaman, memicu scrollbar KEDUA dari browser/body di luar
          scrollbar normal shell aplikasi. `position: fixed` dipakai
          sebagai gantinya karena elemen fixed lepas dari document flow
          dan tidak dihitung ke scrollable area ancestor manapun, jadi
          tidak mempengaruhi tinggi halaman sama sekali. */}
      <div
        id="laporan-print-area"
        aria-hidden="true"
        style={{ position: "fixed", left: "-9999px", top: 0 }}
        className="w-[297mm] bg-white p-10 font-sans text-slate-900"
      >
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold">Daftar Laporan Insiden</h1>
          <p className="text-xs text-slate-500">
            {formatTanggal(new Date().toISOString())}
            {searchQuery ? ` — Pencarian: "${searchQuery}"` : ""}
          </p>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b-2 border-slate-800">
              <th className="px-2 py-2 text-left">ID Laporan</th>
              <th className="px-2 py-2 text-left">Tanggal Masuk</th>
              <th className="px-2 py-2 text-left">Jenis Insiden</th>
              <th className="px-2 py-2 text-left">Unit Kerja</th>
              <th className="px-2 py-2 text-left">Grading</th>
              <th className="px-2 py-2 text-left">Jenis Investigasi</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {dataUntukCetak.length > 0 ? (
              dataUntukCetak.map((row) => {
                const jenisInvestigasi =
                  tentukanJenisInvestigasiDariLaporan(row);
                return (
                  <tr key={row.id} className="border-b border-slate-300">
                    <td className="px-2 py-1.5">
                      {row.trackingNumber || row.id}
                    </td>
                    <td className="px-2 py-1.5">
                      {formatTanggal(row.createdAt)}
                    </td>
                    <td className="px-2 py-1.5">{row.jenisInsiden}</td>
                    <td className="px-2 py-1.5">{row.unitKerja}</td>
                    <td className="px-2 py-1.5">
                      {LABEL_GRADING_CETAK[gradingEfektifDari(row)] ||
                        gradingEfektifDari(row) ||
                        "-"}
                    </td>
                    <td className="px-2 py-1.5">
                      {jenisInvestigasi
                        ? jenisInvestigasi.id === "RCA"
                          ? "RCA"
                          : "Sederhana"
                        : "-"}
                    </td>
                    <td className="px-2 py-1.5">{row.status}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center">
                  Tidak ada laporan untuk dicetak.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
