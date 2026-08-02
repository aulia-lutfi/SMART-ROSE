import { useState } from "react";
import {
  CheckCircle2,
  Lock,
  Download,
  ArrowLeft,
  ClipboardList,
  Clock,
  FileText,
} from "lucide-react";

export default function LaporanBerhasilPage({ onNavigate }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const data = {
    id: "SR-20241012-001",
    deskripsi:
      "Laporan insiden telah berhasil diproses dan seluruh perubahan telah disimpan ke dalam sistem.",

    selesaiPada: "16 Juli 2026 • 14:35 WIB",

    penanggungJawab: "Admin SMART-ROSE",

    stepperSteps: ["Baru", "Ditinjau", "Investigasi", "Selesai"],

    informasi: {
      tanggalMasuk: "12 Okt 2024",
      tanggalKejadian: "12 Okt 2024",
      unitKerja: "Instalasi Gawat Darurat (IGD)",
      kategori: "KTD",
      jenis: "Medication Error",
      lokasi: "Ruang Resusitasi Bed 02",
      grading: "Tinggi",
      status: "Selesai",
    },

    ringkasan: [
      "Investigasi telah diselesaikan",
      "Grading akhir telah ditetapkan",
      "Seluruh perubahan berhasil disimpan",
      "Laporan telah dikunci",
      "Audit Log berhasil diperbarui",
    ],

    timeline: [
      {
        label: "Laporan Diselesaikan",
        oleh: "Admin SMART-ROSE",
        tanggal: "16 Jul 2026 14:35",
        color: "bg-green-500",
      },
      {
        label: "Grading Diperbarui",
        oleh: "Admin SMART-ROSE",
        tanggal: "16 Jul 2026 14:10",
        color: "bg-blue-500",
      },
      {
        label: "Investigasi",
        oleh: "Admin SMART-ROSE",
        tanggal: "16 Jul 2026 13:20",
        color: "bg-blue-500",
      },
      {
        label: "Laporan Ditinjau",
        oleh: "Komite Mutu",
        tanggal: "16 Jul 2026 11:15",
        color: "bg-blue-500",
      },
      {
        label: "Laporan Dibuat",
        oleh: "Perawat",
        tanggal: "16 Jul 2026 09:20",
        color: "bg-slate-400",
      },
    ],
  };

  const handleUnduh = async () => {
    setIsDownloading(true);

    setTimeout(() => {
      setIsDownloading(false);
    }, 1500);
  };

  return (
    <div className="min-h-full bg-white">
      {/* Banner */}
      <div className="bg-green-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-white" />

          <div>
            <p className="text-sm font-bold text-white">
              Laporan Berhasil Diselesaikan
            </p>

            <p className="text-xs text-green-100">
              Diselesaikan pada: {data.selesaiPada}
              {" • "}
              Penanggung Jawab: {data.penanggungJawab}
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
                className={`flex items-start ${
                  isLast ? "flex-none" : "flex-1"
                }`}
              >
                <div className="flex w-8 shrink-0 flex-col items-center">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>

                  <p className="mt-2 text-xs font-semibold text-green-600 whitespace-nowrap">
                    {step}
                  </p>
                </div>

                {!isLast && <div className="mt-4 h-0.5 flex-1 bg-green-500" />}
              </div>
            );
          })}
        </div>
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">Laporan Insiden</p>

            <h1 className="text-2xl font-bold text-slate-800">{data.id}</h1>

            <p className="mt-1 text-sm text-slate-500">{data.deskripsi}</p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Lock className="h-4 w-4 text-slate-500" />

            <div>
              <p className="text-xs font-bold text-slate-700">Terkunci</p>

              <p className="text-xs text-slate-500">Tidak Dapat Diubah</p>
            </div>
          </div>
        </div>{" "}
        {/* Layout 2 Kolom */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* ================= LEFT ================= */}
          <div className="space-y-6 lg:col-span-2">
            {/* Informasi Laporan */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">
                  Informasi Laporan
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs text-slate-500">ID Laporan</p>

                  <p className="font-semibold text-slate-800">{data.id}</p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Status</p>

                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {data.informasi.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Tanggal Masuk</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.tanggalMasuk}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Tanggal Kejadian</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.tanggalKejadian}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Unit Kerja</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.unitKerja}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Kategori Insiden</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.kategori}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Jenis Insiden</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.jenis}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Lokasi Kejadian</p>

                  <p className="font-medium text-slate-700">
                    {data.informasi.lokasi}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Grading Akhir</p>

                  <p className="font-semibold text-red-600">
                    {data.informasi.grading}
                  </p>
                </div>
              </div>
            </div>

            {/* Ringkasan Penyelesaian */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />

                <h2 className="text-lg font-bold text-slate-800">
                  Ringkasan Penyelesaian
                </h2>
              </div>

              <div className="space-y-4">
                {data.ringkasan.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-600" />

                    <p className="text-sm font-medium text-slate-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* ================= RIGHT ================= */}
          <div className="space-y-6">
            {/* Timeline */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">
                  Riwayat Aktivitas
                </h2>
              </div>

              <div className="space-y-4">
                {data.timeline.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center ${item.color}`}
                      >
                        <CheckCircle2 className="h-4 w-4 text-white" />
                      </div>

                      {index !== data.timeline.length - 1 && (
                        <div className="h-10 w-0.5 bg-slate-200"></div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {item.label}
                      </p>

                      <p className="text-xs text-slate-500">
                        Oleh : {item.oleh}
                      </p>

                      <p className="text-xs text-slate-400">{item.tanggal}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Informasi */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
              <h3 className="mb-2 font-bold text-blue-700">Informasi</h3>

              <p className="text-sm leading-relaxed text-blue-700">
                Laporan telah berhasil diselesaikan. Seluruh perubahan telah
                dikunci dan hanya dapat diubah kembali oleh Super Admin melalui
                Audit Log apabila diperlukan.
              </p>
            </div>
          </div>
        </div>
        {/* Tombol */}
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            onClick={handleUnduh}
            disabled={isDownloading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-white font-semibold hover:bg-blue-700 transition"
          >
            <Download className="h-5 w-5" />

            {isDownloading ? "Menyiapkan..." : "Unduh Laporan (PDF)"}
          </button>

          <button
            onClick={() => onNavigate?.("incident-management")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 py-3 font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            <ArrowLeft className="h-5 w-5" />
            Kembali ke Daftar Laporan
          </button>
        </div>
      </div>
    </div>
  );
}
