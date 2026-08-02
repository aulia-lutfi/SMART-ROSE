import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Lock,
  Download,
  ArrowLeft,
  User,
  ClipboardList,
  Clock,
} from "lucide-react";
import {
  getHasilInvestigasi,
  unduhLaporanInvestigasi,
} from "../../services/admin/hasilInvestigasiService";

export default function HasilInvestigasiPage({ onNavigate, laporanId }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const hasil = await getHasilInvestigasi(laporanId);
        if (isMounted) setData(hasil);
      } catch (error) {
        console.error("Gagal memuat hasil investigasi:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [laporanId]);

  const handleUnduh = async () => {
    if (!data) return;
    setIsDownloading(true);
    try {
      await unduhLaporanInvestigasi(data.id);
    } catch (error) {
      console.error("Gagal mengunduh laporan:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-sm text-slate-400">Memuat hasil investigasi...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <p className="text-sm text-slate-400">Data tidak ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      {/* Banner Sukses */}
      <div className="bg-green-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
          <div>
            <p className="text-sm font-bold text-white">Investigasi Selesai</p>
            <p className="text-xs text-green-100">
              Diselesaikan pada: {data.selesaiPada} • Penanggung Jawab:{" "}
              {data.penanggungJawab}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {/* Stepper */}
        <div className="mb-8 flex items-start">
          {data.stepperSteps.map((step, idx) => {
            const isLast = idx === data.stepperSteps.length - 1;
            return (
              <div
                key={step}
                className={`flex items-start ${isLast ? "flex-none" : "flex-1"}`}
              >
                {/* Lingkaran + Label (lebar tetap, tidak ikut melar) */}
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 border-2 border-green-500 z-10">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  <p className="mt-2 text-center text-[10px] sm:text-xs font-semibold text-green-600 whitespace-nowrap">
                    {step}
                  </p>
                </div>
                {/* Garis ke kanan - hanya mengisi ruang antar lingkaran */}
                {!isLast && <div className="mt-4 h-0.5 flex-1 bg-green-500" />}
              </div>
            );
          })}
        </div>

        {/* Header Laporan */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Laporan Insiden</p>
            <h1 className="text-xl font-bold text-slate-800">{data.id}</h1>
            <p className="mt-1 text-xs text-slate-500">{data.deskripsi}</p>
          </div>
          {/* Badge Terkunci */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <Lock className="h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-600">
                Terkunci - Tidak Dapat
              </p>
              <p className="text-xs font-bold text-slate-600">Diubah</p>
            </div>
          </div>
        </div>

        {/* Layout 2 Kolom */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Kolom Kiri */}
          <div className="space-y-5 lg:col-span-2">
            {/* Card: Informasi Pasien */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700">
                  Informasi Pasien
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Nama Pasien", value: data.pasien.nama },
                  { label: "No. Rekam Medis", value: data.pasien.noRM },
                  { label: "Usia / Jenis Kelamin", value: data.pasien.usiaJK },
                  { label: "Ruang Perawatan", value: data.pasien.ruangan },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card: Rencana Perbaikan */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700">
                  Rencana Perbaikan Komprehensif
                </h2>
              </div>
              <div className="space-y-3">
                {data.rencanaPerbaikan.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3.5"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {item.judul}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.deskripsi}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleUnduh}
                disabled={isDownloading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                {isDownloading
                  ? "Menyiapkan Unduhan..."
                  : "Unduh Laporan Investigasi (PDF)"}
              </button>
              <button
                onClick={() => onNavigate?.("analysis")}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Daftar Laporan
              </button>
            </div>
          </div>

          {/* Kolom Kanan */}
          <div className="flex flex-col gap-4 lg:col-span-1">
            {/* Card: Riwayat Lengkap */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-700">
                  Riwayat Lengkap
                </h3>
              </div>
              <div className="space-y-0">
                {data.timeline.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.color}`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>
                      {idx < data.timeline.length - 1 && (
                        <div className="w-0.5 h-8 bg-slate-200 my-0.5" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-bold text-slate-700">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Oleh: {item.oleh}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {item.tanggal}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card: Tips Kepatuhan */}
            <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-base">💡</span>
                <h3 className="text-xs font-bold text-yellow-800">
                  Tips Kepatuhan
                </h3>
              </div>
              <p className="text-xs leading-relaxed text-yellow-700">
                Pastikan semua dokumen pendukung seperti scan rekam medis dan
                foto lokasi kejadian telah dilampirkan dengan jelas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
