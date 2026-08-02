import { useState } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  Search,
  ClipboardCheck,
  ClipboardList,
} from "lucide-react";
import {
  cariLaporanUntukUnduh,
  unduhLaporanStandar,
  unduhHasilInvestigasiSederhana,
  unduhHasilInvestigasiRCA,
} from "../../services/admin/eksporLaporanService";
// ── Catatan: sesuaikan path import di atas dengan lokasi asli
// eksporLaporanService.js di project kamu
// (src/services/admin/eksporLaporanService.js).

// Helper: memicu proses download file di browser dari { blob, filename }
// yang dikembalikan oleh service.
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EksporLaporanPage() {
  // ── State Cari Laporan ──────────────────────────────────────────────────
  const [kodeCari, setKodeCari] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [insidenDitemukan, setInsidenDitemukan] = useState(null);

  // Format file yang dipilih (pdf/excel), berlaku untuk ketiga jenis unduhan
  const [formatTerpilih, setFormatTerpilih] = useState("pdf");

  // Menyimpan jenis mana yang lagi diunduh, biar cuma tombol itu yang
  // nampilin loading spinner (bukan semua tombol sekaligus)
  const [jenisSedangDiunduh, setJenisSedangDiunduh] = useState(null);

  const handleCariLaporan = async (e) => {
    e.preventDefault();
    if (!kodeCari.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setInsidenDitemukan(null);
    try {
      const hasil = await cariLaporanUntukUnduh(kodeCari.trim());
      setInsidenDitemukan(hasil);
    } catch (err) {
      console.error("Gagal mencari laporan:", err);
      setSearchError(err.message || "Laporan tidak ditemukan.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleUnduhJenis = async (jenis) => {
    if (!insidenDitemukan) return;
    setJenisSedangDiunduh(jenis);
    try {
      const fungsiUnduh = {
        standar: unduhLaporanStandar,
        sederhana: unduhHasilInvestigasiSederhana,
        rca: unduhHasilInvestigasiRCA,
      }[jenis];
      const { blob, filename } = await fungsiUnduh(
        insidenDitemukan.id,
        formatTerpilih,
      );
      triggerDownload(blob, filename);
    } catch (err) {
      console.error("Gagal mengunduh laporan:", err);
      alert(err.message || "Gagal mengunduh laporan. Silakan coba lagi.");
    } finally {
      setJenisSedangDiunduh(null);
    }
  };

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Unduh Ulang Laporan per Insiden */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-800 mb-1">
            Unduh Ulang Laporan per Insiden
          </h2>
          <p className="text-xs text-slate-500">
            Cari 1 insiden spesifik untuk mengunduh Laporan Standar, atau hasil
            investigasinya (Sederhana/RCA) kalau sudah selesai.
          </p>
        </div>

        {/* Form pencarian */}
        <form onSubmit={handleCariLaporan} className="flex gap-3 mb-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={kodeCari}
              onChange={(e) => setKodeCari(e.target.value)}
              placeholder="Cari kode laporan, contoh: INC-2024-001"
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !kodeCari.trim()}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-95 disabled:opacity-60"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Cari"
            )}
          </button>
        </form>

        {/* State: tidak ditemukan / error */}
        {searchError && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{searchError}</p>
          </div>
        )}

        {/* State: laporan ditemukan */}
        {insidenDitemukan && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            {/* Info insiden */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {insidenDitemukan.kodeLaporan}
                </p>
                <p className="text-xs text-slate-500">
                  {insidenDitemukan.jenisInsiden} · {insidenDitemukan.unitKerja}{" "}
                  · {insidenDitemukan.tanggalKejadian}
                </p>
              </div>
              {insidenDitemukan.jenisInvestigasi && (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                    insidenDitemukan.statusInvestigasi === "Selesai"
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {insidenDitemukan.jenisInvestigasi} ·{" "}
                  {insidenDitemukan.statusInvestigasi}
                </span>
              )}
            </div>

            {/* Pilihan format file — berlaku untuk semua jenis unduhan */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                Format:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setFormatTerpilih("pdf")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    formatTerpilih === "pdf"
                      ? "bg-red-50 text-red-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setFormatTerpilih("excel")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    formatTerpilih === "excel"
                      ? "bg-green-50 text-green-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </button>
              </div>
            </div>

            {/* Tombol unduh per jenis */}
            <div className="flex flex-wrap gap-2.5">
              {/* Laporan Standar — selalu tersedia */}
              <button
                onClick={() => handleUnduhJenis("standar")}
                disabled={jenisSedangDiunduh !== null}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 active:scale-95 disabled:opacity-60"
              >
                {jenisSedangDiunduh === "standar" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 text-slate-500" />
                )}
                Laporan Standar
              </button>

              {/* Hasil Investigasi Sederhana — cuma kalau memenuhi syarat */}
              {insidenDitemukan.jenisInvestigasi === "Sederhana" &&
                insidenDitemukan.statusInvestigasi === "Selesai" && (
                  <button
                    onClick={() => handleUnduhJenis("sederhana")}
                    disabled={jenisSedangDiunduh !== null}
                    className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-xs font-semibold text-green-700 transition hover:bg-green-100 active:scale-95 disabled:opacity-60"
                  >
                    {jenisSedangDiunduh === "sederhana" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    )}
                    Hasil Investigasi Sederhana
                  </button>
                )}

              {/* Hasil Investigasi RCA — cuma kalau memenuhi syarat */}
              {insidenDitemukan.jenisInvestigasi === "RCA" &&
                insidenDitemukan.statusInvestigasi === "Selesai" && (
                  <button
                    onClick={() => handleUnduhJenis("rca")}
                    disabled={jenisSedangDiunduh !== null}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 active:scale-95 disabled:opacity-60"
                  >
                    {jenisSedangDiunduh === "rca" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ClipboardList className="h-3.5 w-3.5" />
                    )}
                    Hasil Investigasi RCA
                  </button>
                )}

              {/* Pesan kalau investigasi belum selesai */}
              {insidenDitemukan.jenisInvestigasi &&
                insidenDitemukan.statusInvestigasi !== "Selesai" && (
                  <p className="flex items-center text-[11px] text-slate-400">
                    Hasil investigasi belum bisa diunduh — status masih "
                    {insidenDitemukan.statusInvestigasi}"
                  </p>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
