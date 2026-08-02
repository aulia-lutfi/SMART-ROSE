import { useState } from "react";
import {
  User,
  Calendar,
  FileText,
  Activity,
  Stethoscope,
  BarChart2,
  Shield,
  CheckCircle2,
  PenLine,
  Wrench,
  Loader2,
} from "lucide-react";

export default function FormStep5({
  // Toggle
  melibatkanPasien,
  // Step 1 - Pasien
  namaPasien,
  noMR,
  ruangan,
  ruanganCustom,
  tanggalLahir,
  jenisKelamin,
  statusPasien,
  penanggungBiaya,
  tanggalMasuk,
  kategoriPelapor,
  namaPelapor,
  // Step 1 - Fasilitas
  kategoriFasilitas,
  kategoriFasilitasCustom,
  namaFasilitas,
  namaFasilitasCustom,
  kodeInventaris,
  kondisiFasilitas,
  kondisiFasilitasCustom,
  penanggungJawabFasilitas,
  penanggungJawabFasilitasCustom,
  adaKorban,
  // Step 2
  tanggalKejadian,
  lokasiKejadian,
  lokasiKejadianCustom,
  kronologiSingkat,
  dampakTerjadi,
  akibatInsiden,
  gradingKeparahan,
  // Step 3
  tindakanDilakukan,
  akarPenyebab,
  rekomendasi,
  // Jenis Insiden
  jenisInsiden,
  // State
  errors,
  setErrors,
  handleNext,
  handleBack,
  onEditStep,
  // Status pengiriman ke backend (dikirim dari BuatLaporanPage.jsx) —
  // dipakai supaya tombol "Kirim Laporan" tidak bisa diklik dobel selagi
  // request masih berjalan.
  isSubmitting = false,
}) {
  const [agreeTerms, setAgreeTerms] = useState(false);

  const handleValidate = () => {
    const newErrors = {};
    if (!agreeTerms)
      newErrors.agreeTerms = "Anda harus menyetujui pernyataan kebenaran data";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    if (handleValidate()) handleNext();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return (
      new Date(dateString).toLocaleString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " WIB"
    );
  };

  const gradingStyle = {
    Rendah: "bg-green-100 text-green-700",
    Moderat: "bg-blue-100 text-blue-700",
    Tinggi: "bg-yellow-100 text-yellow-700",
    Ekstrem: "bg-red-100 text-red-700",
  };

  const gradingDot = {
    Rendah: "bg-green-500",
    Moderat: "bg-blue-500",
    Tinggi: "bg-yellow-500",
    Ekstrem: "bg-red-500",
  };

  const insidenStyle =
    jenisInsiden === "Sentinel"
      ? "bg-red-100 text-red-700"
      : jenisInsiden === "KTD (Kejadian Tidak Diharapkan)"
        ? "bg-orange-100 text-orange-700"
        : "bg-blue-100 text-blue-700";

  const ruanganFinal =
    ruangan === "Lain-Lain" && ruanganCustom ? ruanganCustom : ruangan;

  const kategoriFasilitasFinal =
    kategoriFasilitas === "Lain-lain" && kategoriFasilitasCustom
      ? kategoriFasilitasCustom
      : kategoriFasilitas;

  const namaFasilitasFinal =
    namaFasilitas === "Lain-lain" && namaFasilitasCustom
      ? namaFasilitasCustom
      : namaFasilitas;

  const kondisiFasilitasFinal =
    kondisiFasilitas === "Lain-lain" && kondisiFasilitasCustom
      ? kondisiFasilitasCustom
      : kondisiFasilitas;

  const penanggungJawabFasilitasFinal =
    penanggungJawabFasilitas === "Lain-lain" && penanggungJawabFasilitasCustom
      ? penanggungJawabFasilitasCustom
      : penanggungJawabFasilitas;

  const lokasiKejadianFinal =
    lokasiKejadian === "Lain-Lain" && lokasiKejadianCustom
      ? lokasiKejadianCustom
      : lokasiKejadian;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">
          Tinjau Laporan Sebelum Dikirim
        </h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Silakan periksa kembali semua informasi sebelum mengirim laporan ini
          ke Komite Keselamatan Pasien Rumah Sakit.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Card 1: Data Pasien ATAU Data Fasilitas */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {melibatkanPasien ? (
                <User className="h-4 w-4 text-blue-600" />
              ) : (
                <Wrench className="h-4 w-4 text-orange-500" />
              )}
              <h3 className="text-sm font-bold text-slate-700">
                {melibatkanPasien ? "Data Pasien" : "Data Fasilitas"}
              </h3>
            </div>
            <button
              onClick={() => onEditStep(1)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>

          {melibatkanPasien ? (
            <div className="space-y-2 text-sm">
              {[
                { label: "Nama", value: namaPasien },
                { label: "No. MR", value: noMR },
                { label: "Ruangan", value: ruanganFinal },
                {
                  label: "Tanggal Lahir",
                  value: tanggalLahir
                    ? new Date(`${tanggalLahir}T00:00:00`).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "long", year: "numeric" },
                      )
                    : null,
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-slate-500">{label}:</span>
                  <span className="font-semibold text-slate-700">
                    {value || "-"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {[
                { label: "Kategori", value: kategoriFasilitasFinal },
                { label: "Nama Fasilitas", value: namaFasilitasFinal },
                {
                  label: "Kode Inventaris",
                  value: kodeInventaris || "Tidak diisi",
                },
                { label: "Kondisi", value: kondisiFasilitasFinal },
                {
                  label: "Penanggung Jawab",
                  value: penanggungJawabFasilitasFinal,
                },
                { label: "Ada Korban", value: adaKorban },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-slate-50 pb-1.5 last:border-0 last:pb-0"
                >
                  <span className="text-slate-500">{label}:</span>
                  <span className="font-semibold text-slate-700 text-right max-w-[60%]">
                    {value || "-"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Jenis Insiden */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">
                Jenis Insiden
              </h3>
            </div>
            <button
              onClick={() => onEditStep(4)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>
          <p className="mb-1.5 text-xs text-slate-500">Kategori:</p>
          <span
            className={`inline-block rounded-lg px-3 py-1.5 text-xs font-bold ${insidenStyle}`}
          >
            {jenisInsiden || "-"}
          </span>
        </div>

        {/* Card 3: Tanggal & Lokasi */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">
                Tanggal & Lokasi
              </h3>
            </div>
            <button
              onClick={() => onEditStep(2)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-700">
              {formatDate(tanggalKejadian)}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Unit:</span>
              <span className="font-semibold text-slate-700">
                {lokasiKejadianFinal || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Kronologi & Dampak */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">
                Kronologi & Dampak
              </h3>
            </div>
            <button
              onClick={() => onEditStep(2)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>
          <div className="space-y-3">
            <p className="border-l-4 border-blue-400 pl-3 text-xs italic text-slate-600 line-clamp-3">
              "{kronologiSingkat || "Tidak ada kronologi"}"
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Dampak:</span>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${melibatkanPasien ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}
              >
                {akibatInsiden || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 5: Tindakan & Akar Masalah */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">
                Tindakan & Akar Masalah
              </h3>
            </div>
            <button
              onClick={() => onEditStep(3)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <p className="mb-0.5 font-semibold text-slate-500">
                Tindakan Langsung:
              </p>
              <p className="text-slate-700 line-clamp-2">
                {tindakanDilakukan || "-"}
              </p>
            </div>
            <div>
              <p className="mb-0.5 font-semibold text-slate-500">
                Akar Masalah:
              </p>
              <p className="text-slate-700 line-clamp-2">
                {akarPenyebab || "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Card 6: Grading Awal */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-700">Grading Awal</h3>
            </div>
            <button
              onClick={() => onEditStep(2)}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <PenLine className="h-3 w-3" /> EDIT
            </button>
          </div>
          {gradingKeparahan ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${gradingStyle[gradingKeparahan] ?? "bg-slate-100 text-slate-600"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${gradingDot[gradingKeparahan] ?? "bg-slate-400"}`}
              />
              {gradingKeparahan === "Tinggi"
                ? "Risiko Sedang"
                : `Risiko ${gradingKeparahan}`}
            </span>
          ) : (
            <span className="text-slate-400 text-sm">-</span>
          )}
        </div>
      </div>

      {/* Status Identitas Pelapor */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-700">
              Status Identitas Pelapor
            </h3>
          </div>
          <button
            onClick={() => onEditStep(1)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            <PenLine className="h-3 w-3" /> EDIT
          </button>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <div>
            <p className="text-sm text-slate-600">
              {namaPelapor
                ? "Dilaporkan oleh"
                : "Laporan dikirim secara anonim, tanpa nama pelapor"}
            </p>
            <p className="text-sm font-bold text-blue-600">
              {namaPelapor || kategoriPelapor || "Kategori pelapor tidak diisi"}
            </p>
            {namaPelapor && kategoriPelapor && (
              <p className="text-xs text-slate-500">{kategoriPelapor}</p>
            )}
          </div>
        </div>
      </div>

      {/* Checkbox Pernyataan */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => {
              setAgreeTerms(e.target.checked);
              if (errors.agreeTerms) setErrors({ ...errors, agreeTerms: null });
            }}
            className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 accent-blue-600"
          />
          <span className="text-sm leading-relaxed text-slate-700">
            Saya menyatakan informasi yang diisi sudah benar dan sesuai kejadian
            sebenarnya. Saya memahami bahwa laporan ini bersifat rahasia dan
            akan digunakan untuk peningkatan keselamatan pasien.
          </span>
        </label>
        {errors.agreeTerms && (
          <p className="mt-2 text-xs text-red-500">{errors.agreeTerms}</p>
        )}
      </div>

      {/* Tombol Navigasi */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={isSubmitting}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!agreeTerms || isSubmitting}
          className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm active:scale-95 ${agreeTerms && !isSubmitting ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200" : "cursor-not-allowed bg-slate-200 text-slate-400"}`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim...
            </>
          ) : (
            "Kirim Laporan →"
          )}
        </button>
      </div>
    </div>
  );
}
