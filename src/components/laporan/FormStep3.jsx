import { Info, Upload, X } from "lucide-react";

export default function FormStep3({
  tindakanDilakukan,
  setTindakanDilakukan,
  tindakanDilakukanOleh,
  setTindakanDilakukanOleh,
  kejadianSerupaTerjadi,
  setKejadianSerupaTerjadi,
  kejadianSerupaDetail,
  setKejadianSerupaDetail,
  akarPenyebab,
  setAkarPenyebab,
  rekomendasi,
  setRekomendasi,
  errors,
  setErrors,
  handleNext,
  handleBack,
  // Lampiran — state & handler ini HARUS datang dari parent (BuatLaporanPage.jsx)
  // supaya file yang dipilih di sini benar-benar terkirim saat submit laporan.
  lampiran = [],
  lampiranError,
  handleAddLampiran,
  handleRemoveLampiran,
}) {
  const tindakanOptions = ["Tim", "Dokter", "Perawat", "Petugas Lainnya"];

  const handleValidate = () => {
    const newErrors = {};
    if (!tindakanDilakukan.trim())
      newErrors.tindakanDilakukan = "Tindakan yang dilakukan wajib diisi";
    if (!akarPenyebab.trim())
      newErrors.akarPenyebab = "Akar penyebab masalah wajib diisi";
    if (!rekomendasi.trim())
      newErrors.rekomendasi = "Rekomendasi/Solusi wajib diisi";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (handleValidate()) {
      handleNext();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800">
          Tindakan & Analisis
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Lengkapi rincian tindakan insiden segera dah analisis penyebab
          masalah.
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-blue-800">
          Bagian ini penting untuk analisis Komite Keselamatan Pasien (KKP),
          mohon diisi dengan lengkap dan objektif.
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-5">
        {/* Tindakan yang Dilakukan */}
        <div>
          <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-2">
            Tindakan yang Dilakukan Segera Setelah Kejadian dan Hasilnya
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={tindakanDilakukan}
            onChange={(e) => {
              setTindakanDilakukan(e.target.value);
              if (errors.tindakanDilakukan)
                setErrors({ ...errors, tindakanDilakukan: null });
            }}
            placeholder="Jelaskan tindakan langsung medis atau administratif yang segera diambil akibat kejadian ini..."
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.tindakanDilakukan
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
            rows="4"
          />
          {errors.tindakanDilakukan && (
            <p className="text-xs text-red-500 mt-1">
              {errors.tindakanDilakukan}
            </p>
          )}
        </div>

        {/* Kejadian Serupa */}
        <div>
          <label className="text-sm font-semibold text-slate-700 mb-3 block">
            Apakah Kejadian Serupa Pernah Terjadi di Unit Kerja Lain?
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kejadianSerupa"
                value="Ya"
                checked={kejadianSerupaTerjadi === "Ya"}
                onChange={(e) => setKejadianSerupaTerjadi(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-slate-700">Ya</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="kejadianSerupa"
                value="Tidak"
                checked={kejadianSerupaTerjadi === "Tidak"}
                onChange={(e) => setKejadianSerupaTerjadi(e.target.value)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-slate-700">Tidak</span>
            </label>
          </div>

          {/* Detail Kejadian Serupa */}
          {kejadianSerupaTerjadi === "Ya" && (
            <div className="mt-3">
              <textarea
                value={kejadianSerupaDetail}
                onChange={(e) => setKejadianSerupaDetail(e.target.value)}
                placeholder="Kapan terjadi dan langkah/tindakan apa yang telah diambil pada unit kerja tersebut untuk mencegah terulangnya kejadian yang sama?"
                className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
              />
            </div>
          )}
        </div>

        {/* Dokumentasi — satu area upload */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Dokumentasi Pendukung
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Lampirkan bukti insiden dalam format JPG, PNG, atau PDF. Maksimal 5
            MB per file dan 25 MB untuk seluruh lampiran.
          </p>

          <div className="rounded-xl border-2 border-dashed border-blue-300 bg-slate-50/60 px-6 py-8 text-center transition hover:bg-blue-50/40">
            {/* Area klik upload */}
            <label className="block cursor-pointer">
              <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                Klik atau seret file ke sini
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Format: JPG, PNG, PDF · Maks. 5 MB per file · Maks. 25 MB total
              </p>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf"
                onChange={(e) => {
                  const files = Array.from(e.target.files);
                  if (handleAddLampiran) {
                    handleAddLampiran(files);
                  }
                  // reset value supaya bisa pilih file yang sama lagi kalau perlu
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>

            {/* Daftar file yang sudah diupload */}
            {lampiran.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {lampiran.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5"
                  >
                    <span
                      className="max-w-[220px] truncate text-xs font-medium text-blue-700"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveLampiran && handleRemoveLampiran(idx)
                      }
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-700 transition"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {lampiranError && (
              <p className="mt-2 text-xs text-red-500">{lampiranError}</p>
            )}
          </div>
        </div>
        {/* Akar Penyebab Masalah */}
        <div>
          <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-2">
            Akar Penyebab Masalah
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={akarPenyebab}
            onChange={(e) => {
              setAkarPenyebab(e.target.value);
              if (errors.akarPenyebab)
                setErrors({ ...errors, akarPenyebab: null });
            }}
            placeholder="Jelaskan analisis akar penyebab/root cause dari insiden ini..."
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.akarPenyebab
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
            rows="4"
          />
          {errors.akarPenyebab && (
            <p className="text-xs text-red-500 mt-1">{errors.akarPenyebab}</p>
          )}
        </div>

        {/* Rekomendasi */}
        <div>
          <label className="flex items-center gap-1 text-sm font-semibold text-slate-700 mb-2">
            Rekomendasi / Solusi / Saran
            <span className="text-red-500">*</span>
          </label>
          <textarea
            value={rekomendasi}
            onChange={(e) => {
              setRekomendasi(e.target.value);
              if (errors.rekomendasi)
                setErrors({ ...errors, rekomendasi: null });
            }}
            placeholder="Berikan rekomendasi perbaikan untuk mencegah kejadian serupa..."
            className={`w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.rekomendasi
                ? "border-red-400 bg-red-50"
                : "border-slate-200 bg-white"
            }`}
            rows="4"
          />
          {errors.rekomendasi && (
            <p className="text-xs text-red-500 mt-1">{errors.rekomendasi}</p>
          )}
        </div>
      </div>
    </div>
  );
}
