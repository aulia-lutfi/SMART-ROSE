import { useEffect, useRef, useState } from "react";
import { Clock, Lock, ShieldCheck, ArrowRight } from "lucide-react";

// ── Landing Page Pelaporan Insiden (untuk Nakes) ───────────────────────────
// Dipakai sebagai halaman pertama yang dibuka setelah nakes scan QR code.
// Tampil sebentar untuk memberi konteks (apa laporan ini, kenapa penting,
// dan bahwa laporan bersifat rahasia) sebelum nakes lanjut ke form
// pelaporan insiden.
//
// Cara pakai:
//   <LandingLaporanPage onMulai={() => navigate("/lapor/form")} />
//
// Semua teks (brand, badge, judul, deskripsi, tombol) bisa dioverride
// lewat props kalau nanti dipakai instansi lain.

export default function LandingLaporanPage({
  taglineBrand = "INCIDENT REPORTING",
  badgeText = "From Reporting to Learning",
  judulAwal = "Keselamatan Pasien Dimulai Dengan",
  judulAksen = "Laporan Anda",
  deskripsi = "Laporkan insiden keselamatan pasien dengan cepat, aman, dan efisien. Setiap laporan berkontribusi pada peningkatan kualitas layanan kesehatan dan keselamatan pasien.",
  teksTombol = "Mulai Laporan Insiden",
  onMulai = () => {},
  autoAdvanceSeconds,
}) {
  const [tampil, setTampil] = useState(false);
  const [hitungMundur, setHitungMundur] = useState(autoAdvanceSeconds || 0);
  const [ripples, setRipples] = useState([]);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [ditekan, setDitekan] = useState(false);

  // Efek "tilt" 3D pada card — card sedikit miring mengikuti posisi jari/
  // kursor saat disentuh, lalu balik halus ke posisi normal saat dilepas.
  // Ngasih kesan card itu seperti kartu fisik yang bisa diraba, bukan
  // gambar datar.
  const gerakkanTilt = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = -(py - 0.5) * 10;
    setTilt({ x: rotateX, y: rotateY });
  };

  const mulaiSentuh = (e) => {
    setDitekan(true);
    gerakkanTilt(e);
  };

  const lepasSentuh = () => {
    setDitekan(false);
    setTilt({ x: 0, y: 0 });
  };

  // Efek "ripple" saat tombol disentuh/diklik — lingkaran kecil muncul dari
  // titik sentuh lalu membesar & memudar. Dipakai lewat onPointerDown biar
  // langsung terasa responsif di layar sentuh (tidak menunggu event click).
  const munculkanRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ukuran = Math.max(rect.width, rect.height) * 2.2;
    const x =
      (e.clientX ?? rect.left + rect.width / 2) - rect.left - ukuran / 2;
    const y = (e.clientY ?? rect.top + rect.height / 2) - rect.top - ukuran / 2;
    const id = Date.now() + Math.random();

    setRipples((prev) => [...prev, { id, x, y, ukuran }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 650);
  };

  useEffect(() => {
    const t = requestAnimationFrame(() => setTampil(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!autoAdvanceSeconds) return;
    if (hitungMundur <= 0) {
      onMulai();
      return;
    }
    const timer = setTimeout(() => setHitungMundur((s) => s - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitungMundur, autoAdvanceSeconds]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-white to-rose-50/50 flex items-center justify-center px-4 py-10">
      <style>{`
        @keyframes ripple {
          from { transform: scale(0); opacity: 0.55; }
          to { transform: scale(1); opacity: 0; }
        }
      `}</style>

      {/* ── Watermark dekoratif: motif mawar mekar, menegaskan identitas
          "SMART-ROSE" tanpa mengganggu keterbacaan konten ── */}
      <svg
        className="pointer-events-none absolute -top-16 -right-20 h-80 w-80 opacity-[0.35] blur-[1px]"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="kelopak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#93C5FD" />
            <stop offset="100%" stopColor="#FDA4AF" />
          </linearGradient>
        </defs>
        <g fill="url(#kelopak)">
          {Array.from({ length: 6 }).map((_, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="60"
              rx="26"
              ry="46"
              transform={`rotate(${i * 60} 100 100)`}
            />
          ))}
        </g>
      </svg>
      <svg
        className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 opacity-[0.18] blur-[1px]"
        viewBox="0 0 200 200"
        aria-hidden="true"
      >
        <g fill="url(#kelopak)">
          {Array.from({ length: 5 }).map((_, i) => (
            <ellipse
              key={i}
              cx="100"
              cy="65"
              rx="24"
              ry="42"
              transform={`rotate(${i * 72} 100 100)`}
            />
          ))}
        </g>
      </svg>

      <div
        className={`relative w-full max-w-md transition-all duration-700 ease-out ${
          tampil ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        {/* Card */}
        <div
          ref={cardRef}
          onPointerDown={mulaiSentuh}
          onPointerMove={gerakkanTilt}
          onPointerUp={lepasSentuh}
          onPointerLeave={lepasSentuh}
          onPointerCancel={lepasSentuh}
          style={{
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${
              ditekan ? 0.985 : 1
            })`,
            transition: ditekan
              ? "transform 80ms ease-out"
              : "transform 500ms cubic-bezier(0.22,1,0.36,1)",
          }}
          className="relative rounded-[36px] bg-white/90 backdrop-blur-sm p-8 text-center shadow-[0_20px_60px_-15px_rgba(30,64,175,0.25)] ring-1 ring-black/5 touch-manipulation [-webkit-tap-highlight-color:transparent]"
        >
          {/* Tagline */}
          <p className="text-[10px] font-bold tracking-[0.18em] text-slate-400 mb-4">
            {taglineBrand}
          </p>

          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {badgeText}
          </span>

          {/* Judul: dua nada, frasa kunci diwarnai aksen biru */}
          <h1 className="text-[26px] font-black text-slate-900 leading-[1.2] tracking-tight mb-4">
            {judulAwal}{" "}
            <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
              {judulAksen}
            </span>
          </h1>

          {/* Deskripsi */}
          <p className="text-sm text-slate-500 leading-relaxed mb-7">
            {deskripsi}
          </p>

          {/* Info strip: 3 fakta singkat, dipisah garis tipis (bukan
              kotak-kotak terpisah) supaya terasa satu kesatuan info */}
          <div className="flex items-stretch justify-center divide-x divide-slate-200 rounded-2xl bg-slate-50/80 py-4 mb-8">
            <div className="flex flex-1 flex-col items-center gap-1.5 px-2">
              <Clock className="h-4 w-4 text-blue-600" strokeWidth={2.25} />
              <span className="text-[11px] font-bold text-slate-600">
                ± 3 Menit
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1.5 px-2">
              <Lock className="h-4 w-4 text-blue-600" strokeWidth={2.25} />
              <span className="text-[11px] font-bold text-slate-600">
                Rahasia
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-1.5 px-2">
              <ShieldCheck
                className="h-4 w-4 text-blue-600"
                strokeWidth={2.25}
              />
              <span className="text-[11px] font-bold text-slate-600">Aman</span>
            </div>
          </div>

          {/* Tombol Mulai */}
          <button
            onClick={onMulai}
            onPointerDown={munculkanRipple}
            className="group relative w-full flex items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 rounded-2xl text-sm font-bold shadow-lg shadow-blue-600/30 transition-all active:scale-[0.97] active:shadow-md active:shadow-blue-600/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 [-webkit-tap-highlight-color:transparent] touch-manipulation select-none"
          >
            {ripples.map((r) => (
              <span
                key={r.id}
                className="pointer-events-none absolute rounded-full bg-white/40 animate-[ripple_650ms_ease-out]"
                style={{
                  left: r.x,
                  top: r.y,
                  width: r.ukuran,
                  height: r.ukuran,
                }}
              />
            ))}
            <span className="relative z-10 flex items-center gap-2">
              {autoAdvanceSeconds
                ? `${teksTombol} (${hitungMundur}s)`
                : teksTombol}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
          {/* Footer note */}
          <p className="text-center text-[11px] text-slate-400 mt-5">
            Identitas pelapor tidak akan dipublikasikan.
          </p>
        </div>
      </div>
    </div>
  );
}
