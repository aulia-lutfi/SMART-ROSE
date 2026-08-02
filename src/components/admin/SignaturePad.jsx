// src/components/admin/SignaturePad.jsx
// ============================================================
// Signature pad ringan berbasis <canvas>, tanpa dependency luar.
// Dipakai di InvestigasiSederhanaPage untuk field "Tanda Tangan"
// pada section Manager/Kepala Bagian/Kepala Unit.
//
// Cara pakai:
//   <SignaturePad value={base64Image} onChange={(dataUrl) => ...} />
//
// - value: string base64 (data URL) hasil tanda tangan sebelumnya,
//   atau null kalau belum ada. Kalau ada value, canvas akan
//   menampilkan gambar itu (read-only preview) — dipakai saat form
//   dibuka ulang / laporan sudah pernah ditandatangani.
// - onChange: dipanggil dengan data URL PNG setiap kali user selesai
//   menggambar (mouse up / touch end), atau null saat "Hapus" ditekan.
// ============================================================

import { useRef, useEffect, useState } from "react";
import { Eraser } from "lucide-react";

export default function SignaturePad({ value, onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(!value);

  // Render ulang preview kalau value berubah dari luar (mis. data
  // laporan yang sudah punya tanda tangan tersimpan sebelumnya)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = value;
      setIsEmpty(false);
    } else {
      setIsEmpty(true);
    }
  }, [value]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const point = e.touches ? e.touches[0] : e;
    return {
      x: (point.clientX - rect.left) * scaleX,
      y: (point.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (disabled) return;
    e.preventDefault();
    isDrawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(x, y);
    ctx.stroke();
    setIsEmpty(false);
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    onChange?.(canvas.toDataURL("image/png"));
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange?.(null);
  };

  return (
    <div>
      <div className="rounded-lg border border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          className={`w-full touch-none ${disabled ? "cursor-not-allowed bg-slate-50" : "cursor-crosshair"}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {disabled
            ? "Tanda tangan terkunci"
            : "Gambar tanda tangan di area di atas"}
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-500 transition"
          >
            <Eraser className="h-3 w-3" />
            Hapus
          </button>
        )}
      </div>
    </div>
  );
}
