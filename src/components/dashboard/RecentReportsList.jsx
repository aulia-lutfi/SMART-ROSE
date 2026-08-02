import { FileWarning, Pill, Stethoscope, ChevronRight } from "lucide-react";

function formatTanggal(isoDate) {
  return new Date(isoDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Pemetaan kategori insiden ke icon, biar konsisten dengan tampilan di gambar
function getIconForKategori(kategori) {
  const k = (kategori || "").toLowerCase();
  if (k.includes("medis")) return Stethoscope;
  if (k.includes("obat")) return Pill;
  return FileWarning;
}

// Pemetaan status ke warna badge, konsisten dengan LaporanSayaPage & DetailLaporanPage
function getStatusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("ditinjau")) {
    return "bg-yellow-100 text-yellow-700";
  }
  if (s.includes("investigasi")) {
    return "bg-rose-100 text-rose-700";
  }
  if (s.includes("terkirim")) {
    return "bg-blue-100 text-blue-700";
  }
  if (s.includes("selesai")) {
    return "bg-green-100 text-green-700";
  }
  return "bg-slate-100 text-slate-600";
}

export default function RecentReportsList({ laporan, onLihatDetail }) {
  if (!laporan || laporan.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        Belum ada laporan yang dibuat.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {laporan.map((item) => {
        const Icon = getIconForKategori(item.kategori);
        return (
          <div
            key={item.id}
            onClick={() => onLihatDetail?.(item.id)}
            className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 hover:bg-slate-50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Icon className="h-4.5 w-4.5 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-600">{item.id}</p>
                <p className="truncate text-sm font-semibold text-slate-700">
                  {item.deskripsi}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(
                  item.status,
                )}`}
              >
                {item.status}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
