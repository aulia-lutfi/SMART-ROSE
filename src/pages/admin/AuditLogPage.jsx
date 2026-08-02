import { useState, useEffect, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { getAuditLog } from "../../services/admin/auditLogService";

const ITEMS_PER_PAGE = 10;

export default function AuditLogPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // ── State data audit log - diambil lewat service, pagination SEKARANG
  // dilakukan di backend (kirim page & limit ke getAuditLog), bukan potong
  // array di client lagi seperti versi dummy dulu ───────────────────────────
  const [dataLog, setDataLog] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const fetchAuditLog = useCallback(async (page) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await getAuditLog({ page, limit: ITEMS_PER_PAGE });
      setDataLog(result.items);
      setTotal(result.total);
    } catch (err) {
      console.error("Gagal memuat audit log:", err);
      setLoadError("Gagal memuat audit log. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditLog(currentPage);
  }, [currentPage, fetchAuditLog]);

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: "bg-blue-100 text-blue-700",
      SUPPORT: "bg-green-100 text-green-700",
      SYSTEM: "bg-slate-100 text-slate-700",
      DOKTER: "bg-purple-100 text-purple-700",
      USER: "bg-amber-100 text-amber-700",
    };
    return colors[role] || "bg-slate-100 text-slate-700";
  };

  const getActivityColor = (activity) => {
    const colors = {
      "Tambah Admin": "bg-purple-100 text-purple-700",
      "Update Laporan": "bg-blue-100 text-blue-700",
      "Ubah Grading": "bg-orange-100 text-orange-700",
      "Tugaskan Tim Investigasi": "bg-teal-100 text-teal-700",
    };
    return colors[activity] || "bg-slate-100 text-slate-700";
  };

  // (Sempat ada handler navigasi ke halaman detail laporan di sini, tapi
  // 27 Juli 2026 diputuskan user cukup tampilkan info ID/nomor laporan
  // sebagai teks saja — tidak perlu bisa diklik pindah halaman.)

  // ── PENTING: backend Audit Log cuma support filter `action` & `targetId`
  // (lihat auditLogService.js), TIDAK ADA param pencarian bebas teks. Jadi
  // search box ini SEKARANG cuma menyaring data yang sudah ke-load di
  // halaman yang lagi ditampilkan (10 baris), bukan across semua data lagi
  // seperti versi dummy dulu. Kalau butuh pencarian across semua log,
  // ini perlu ditanyakan ke backend (mis. minta tambah param `q`).
  const filteredData = dataLog.filter(
    (item) =>
      (item.pengguna ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.jenisAktivitas ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (item.deskripsi ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };

  const generatePageNumbers = () => {
    const pages = [];
    const maxVisible = 3;
    let start = Math.max(1, currentPage - 1);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari di halaman ini (pengguna, jenis aktivitas, atau deskripsi)..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* State: Error */}
      {loadError ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-base font-semibold text-slate-600">{loadError}</p>
          <button
            onClick={() => fetchAuditLog(currentPage)}
            className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          {/* Table Section */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto mb-6">
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Waktu
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Pengguna
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Jenis Aktivitas
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Deskripsi Perubahan
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-700">
                      Alamat IP
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {/* State: Loading */}
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx} className="border-b border-slate-100">
                        {Array.from({ length: 5 }).map((__, colIdx) => (
                          <td key={colIdx} className="px-5 py-4">
                            <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredData.length > 0 ? (
                    /* State: Data List */
                    filteredData.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 hover:bg-slate-50 transition"
                      >
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">
                          {row.waktu}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800">
                              {row.pengguna}
                            </span>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${getRoleColor(row.role)}`}
                            >
                              {row.role}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getActivityColor(row.jenisAktivitas)}`}
                          >
                            {row.jenisAktivitas}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 max-w-sm">
                          {/* line-clamp-2 + title: ringkasan tetap ringkas
                              di tabel, tapi hover nampilin teks lengkap
                              (termasuk kronologi kalau ada) lewat tooltip
                              browser bawaan - tidak perlu buka halaman lain
                              cuma buat baca deskripsi penuh. */}
                          <p
                            className="line-clamp-2"
                            title={row.deskripsiLengkap || row.deskripsi}
                          >
                            {row.deskripsi}
                          </p>
                          {row.reportId && (
                            // ✅ 27 Juli 2026: sengaja teks info polos, BUKAN
                            // link/tombol yang bisa diklik pindah halaman
                            // (keputusan user — cukup info ID laporannya
                            // saja untuk audit trail, tidak perlu navigasi).
                            <p className="mt-1 text-xs text-slate-400">
                              ID Laporan: {row.trackingNumber || row.reportId}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-xs font-mono">
                          {row.alamatIP}
                        </td>
                      </tr>
                    ))
                  ) : (
                    /* State: Kosong */
                    <tr>
                      <td
                        colSpan="5"
                        className="px-5 py-8 text-center text-slate-500"
                      >
                        Tidak ada data yang sesuai di halaman ini
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination - dari backend (total & page asli), bukan hitungan
              client lagi */}
          <div className="mb-8 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {isLoading
                ? "Memuat data..."
                : `Menampilkan ${total === 0 ? 0 : startIndex + 1}-${Math.min(
                    startIndex + ITEMS_PER_PAGE,
                    total,
                  )} dari ${total} log`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {generatePageNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
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
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={currentPage === totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
