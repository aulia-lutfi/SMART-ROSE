import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { getModulEdukasi } from "../../services/user/edukasiService";
// ── Catatan: sesuaikan path import di atas dengan lokasi asli
// edukasiService.js di project kamu (src/services/user/edukasiService.js).
// Ini adalah service LIST modul edukasi (dipakai juga oleh EdukasiPage.jsx),
// BUKAN detailEdukasiService.js yang dipakai DetailEdukasiPage.jsx.

export default function ModulEdukasi({ onLihatDetail, onEksplorasi }) {
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ambil 1 modul rekomendasi teratas dari service yang sama dengan
  // halaman Edukasi, supaya datanya selalu konsisten/sinkron.
  useEffect(() => {
    let isMounted = true;

    const fetchRekomendasi = async () => {
      setIsLoading(true);
      try {
        const data = await getModulEdukasi({});
        if (!isMounted) return;
        const rekomendasi = data.slice(0, 1).map((m) => ({
          id: m.id,
          title: m.judul,
          badge: m.selesai ? "Selesai" : "Rekomendasi",
        }));
        setModules(rekomendasi);
      } catch (err) {
        console.error("Gagal memuat rekomendasi modul edukasi:", err);
        if (isMounted) setModules([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchRekomendasi();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-700">Modul Edukasi</h2>
        <button
          onClick={onEksplorasi}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Eksplorasi
        </button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          // State: Loading (skeleton)
          <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        ) : modules.length > 0 ? (
          modules.map((module) => (
            <div
              key={module.id}
              onClick={() => onLihatDetail?.(module.id)}
              className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white hover:shadow-md transition"
            >
              {/* Thumbnail dengan BookOpen */}
              <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                <BookOpen className="h-25 w-25 text-blue-200" />
                {module.badge && (
                  <span className="absolute left-2 top-2 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {module.badge}
                  </span>
                )}
              </div>

              <div className="p-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  {module.title}
                </h3>
              </div>
            </div>
          ))
        ) : (
          // State: Kosong
          <p className="py-6 text-center text-xs font-semibold text-slate-400">
            Belum ada rekomendasi modul.
          </p>
        )}
      </div>
    </div>
  );
}
