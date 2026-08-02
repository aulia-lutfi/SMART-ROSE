import { useState, useEffect, useCallback } from "react";
import { Search, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import * as analisisInvestigasiService from "../../services/admin/analisisInvestigasiService";
import { GRADING_STYLE } from "../../lib/grading";

function getSisaStyle(sisa) {
  if (sisa < 0)
    return { bar: "bg-red-500", text: "text-red-600", days: `${sisa} Hari` };
  if (sisa <= 4)
    return { bar: "bg-red-400", text: "text-red-500", days: `${sisa} Hari` };
  if (sisa <= 7)
    return {
      bar: "bg-orange-400",
      text: "text-orange-500",
      days: `${sisa} Hari`,
    };
  if (sisa <= 10)
    return {
      bar: "bg-yellow-400",
      text: "text-yellow-600",
      days: `${sisa} Hari`,
    };
  return { bar: "bg-green-500", text: "text-green-600", days: `${sisa} Hari` };
}

// UPDATE 21 Juli 2026: label status TIDAK lagi dihitung di sini.
// Data sekarang berasal dari laporan ASLI backend (enum uppercase:
// DRAFT/SUBMITTED/DALAM_INVESTIGASI/MENUNGGU_VERIFIKASI/SELESAI/OVERDUE/
// ARSIP), bukan lagi kode dummy lowercase Indonesia. analisisInvestigasiService.js
// sudah menyediakan `row.statusLabel` (reuse STATUS_LABEL dari
// insidenService.js), jadi tinggal dipakai langsung — satu sumber label
// status yang sama dipakai konsisten di semua halaman.

const ITEMS_PER_PAGE = 6;

export default function AnalisisInvestigasiPage({ onNavigate }) {
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // ------------------------------------------------------------
  // Ambil daftar laporan investigasi dari backend
  // GET /admin/investigasi?search=&page=&limit=
  // ------------------------------------------------------------
  const fetchData = useCallback(async (search, page) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await analisisInvestigasiService.getInvestigasiList({
        search,
        page,
        limit: ITEMS_PER_PAGE,
      });

      const list = result?.data || result || [];
      const total = result?.total ?? list.length;

      setData(Array.isArray(list) ? list : []);
      setTotalItems(total);
    } catch (err) {
      setError(err.message || "Gagal memuat data investigasi.");
      setData([]);
      setTotalItems(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Muat data pertama kali
  useEffect(() => {
    fetchData("", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce pencarian: kirim query ke backend 400ms setelah berhenti mengetik,
  // dan selalu kembali ke halaman 1 saat kata kunci berubah
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchData(searchQuery, 1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Ambil ulang data saat halaman pagination berubah
  const handleChangePage = (page) => {
    setCurrentPage(page);
    fetchData(searchQuery, page);
  };

  const totalPages = Math.max(Math.ceil(totalItems / ITEMS_PER_PAGE), 1);

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-xs text-slate-400">
        <span className="cursor-pointer hover:text-blue-600">
          Analisis & Investigasi
        </span>
        <span className="mx-1">›</span>
        <span className="font-semibold text-slate-600">
          Investigasi Lanjutan
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            onClick={() => fetchData(searchQuery, currentPage)}
            className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* Info Card — halaman ini KHUSUS jalur RCA (Kuning/Merah).
          Laporan Hijau/Biru (Sederhana) diproses di Manajemen Insiden,
          gak pernah muncul di sini — makanya cuma 1 card, bukan 2. */}
      <div className="mb-6">
        <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-600">
              Grading Kuning / Merah — Wajib RCA
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Mandatory Root Cause Analysis (RCA). Membutuhkan tim multidisiplin
              untuk investigasi mendalam terhadap insiden serius. Laporan
              grading Hijau/Biru (Investigasi Sederhana) diproses langsung di{" "}
              <button
                onClick={() => onNavigate?.("incident-management")}
                className="font-semibold text-blue-600 hover:underline"
              >
                Manajemen Insiden
              </button>
              , tidak tercantum di halaman ini.
            </p>
            <p className="mt-3 text-2xl font-extrabold text-slate-800">
              45{" "}
              <span className="text-sm font-semibold text-slate-500">
                HARI MAKSIMAL
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Header Tabel + Search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-800">
          Daftar Laporan Butuh Investigasi Lanjutan
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="search-investigasi"
              autoComplete="off"
              placeholder="Cari ID Laporan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Grading
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tanggal Masuk
              </th>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sisa Waktu
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 rounded bg-slate-100 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  Tidak ada laporan ditemukan.
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const sisaStyle = getSisaStyle(row.sisaWaktu);
                const barWidth =
                  row.sisaWaktu < 0
                    ? 100
                    : Math.min((row.sisaWaktu / 45) * 100, 100);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                  >
                    <td className="px-5 py-4">
                      {(() => {
                        const g = GRADING_STYLE[row.grading] || {};
                        return (
                          <span
                            className={`rounded-md px-3 py-1 text-xs font-bold border ${g.bg || "bg-slate-100"} ${g.text || "text-slate-600"} ${g.border || "border-slate-200"}`}
                          >
                            {row.grading}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {row.tanggalMasuk}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-semibold ${sisaStyle.text}`}
                          >
                            {row.sisaLabel}
                          </span>
                          <span
                            className={`text-xs font-bold ${sisaStyle.text}`}
                          >
                            {sisaStyle.days}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${sisaStyle.bar}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-xs font-semibold text-slate-600">
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() =>
                          onNavigate?.("detail-investigasi", row.id)
                        }
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition active:scale-95 whitespace-nowrap"
                      >
                        Lanjutkan Investigasi
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer tabel */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <p className="text-xs text-slate-400">
            Menampilkan {data.length} dari {totalItems} investigasi aktif
          </p>

          {/* Pagination */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleChangePage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1 || isLoading}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handleChangePage(page)}
                disabled={isLoading}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                  currentPage === page
                    ? "bg-blue-600 text-white"
                    : "border border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() =>
                handleChangePage(Math.min(currentPage + 1, totalPages))
              }
              disabled={currentPage === totalPages || isLoading}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-40 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
