import { useState } from "react";
import {
  Download,
  X,
  FileText,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { exportDashboard } from "../../services/admin/adminDashboardService";

// CATATAN: nilai string yang dikirim di `cakupan` (id di bawah ini:
// "ringkasanStatistik", dst) MASIH ASUMSI — spec cuma bilang
// `cakupan: string[]` tanpa daftar nilai yang valid. Sesuaikan begitu
// backend kasih tau nilai enum yang sebenarnya diterima.
export default function ExportDialog({ isOpen, onClose, selectedPeriode }) {
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [selectedData, setSelectedData] = useState({
    ringkasanStatistik: true,
    grafikDistribusi: true,
    grafikKeparahan: true,
    trenInsiden: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const exportOptions = [
    { id: "ringkasanStatistik", label: "Ringkasan Statistik" },
    { id: "grafikDistribusi", label: "Grafik Distribusi Jenis Insiden" },
    { id: "grafikKeparahan", label: "Grafik Tingkat Keparahan" },
    { id: "trenInsiden", label: "Tren Insiden Bulanan" },
  ];

  const handleToggleData = (id) => {
    setSelectedData((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // ------------------------------------------------------------
  // POST /admin/dashboard/export lewat adminDashboardService.
  // Response berupa file (Blob), bukan JSON — begitu diterima, langsung
  // dipicu jadi download di browser lewat elemen <a> sementara.
  // ------------------------------------------------------------
  const handleDownload = async () => {
    const cakupan = Object.keys(selectedData).filter((id) => selectedData[id]);
    if (cakupan.length === 0) {
      setExportError("Pilih minimal satu cakupan data untuk diekspor.");
      return;
    }

    setIsExporting(true);
    setExportError("");
    try {
      const blob = await exportDashboard({ format: selectedFormat, cakupan });
      const extension = selectedFormat === "excel" ? "xlsx" : "pdf";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dashboard-smart-rose-${Date.now()}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setExportError(err.message || "Gagal mengekspor dashboard. Coba lagi.");
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed right-6 top-1/2 z-50 w-full max-w-md -translate-y-1/2 rounded-xl bg-white shadow-lg sm:right-8 lg:right-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Ekspor Dashboard</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-5">
          {/* Format Selection */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Pilih Format Ekspor
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={selectedFormat === "pdf"}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="hidden"
                />
                <div
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    selectedFormat === "pdf"
                      ? "border-red-500 bg-red-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <FileText className="h-8 w-8 text-red-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    PDF
                  </span>
                </div>
              </label>

              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  value="excel"
                  checked={selectedFormat === "excel"}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="hidden"
                />
                <div
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition ${
                    selectedFormat === "excel"
                      ? "border-green-500 bg-green-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    Excel
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Data Coverage */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Cakupan Data
            </h3>
            <div className="space-y-2">
              {exportOptions.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedData[option.id]}
                    onChange={() => handleToggleData(option.id)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                  <span className="text-sm text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Period Info */}
          <div className="rounded-lg  px-4 py-3">
            <p className="text-xs text-blue-700">
              Data sesuai periode:{" "}
              <span className="font-semibold">{selectedPeriode}</span>
            </p>
          </div>

          {/* Export Error */}
          {exportError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {exportError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-60"
          >
            Batal
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-60"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isExporting ? "Mengekspor..." : "Unduh Sekarang"}
          </button>
        </div>
      </div>
    </>
  );
}
