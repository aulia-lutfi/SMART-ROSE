import { User, Info, Building2, Wrench, X } from "lucide-react";

const roomOptions = [
  "ICU (Intensive Care Unit)",
  "IGD (Instalasi Gawat Darurat)",
  "Ruang Melati (Rawat Inap Nifas/Melahirkan)",
  "Ruang Mawar (Rawat Inap Bedah)",
  "Ruang Dahlia (Rawat Inap Anak)",
  "Ruang Cendrawasih (Rawat Inap VIP)",
  "HCU (High Care Unit)",
  "NICU / PICU",
  "Poliklinik Kebidanan & Kandungan",
  "Poliklinik Penyakit Dalam",
  "Poliklinik Anak",
  "Poliklinik Bedah",
  "Laboratorium Utama",
  "Instalasi Farmasi/Apotek",
  "Pintu Masuk Utama",
  "Area Parkir",
  "Lorong/Koridor",
  "Toilet/Kamar Mandi",
  "Tangga/Lift",
  "Rooftop/Atap",
  "Lain-Lain",
];

const financeOptions = [
  "JKN (BPJS Kesehatan)",
  "Umum (Mandiri/Bayar Sendiri)",
  "Asuransi Swasta",
  "Jaminan Perusahaan",
  "Lain-lain",
];

const reporterCategories = [
  "Karyawan - Dokter",
  "Karyawan - Perawat",
  "Karyawan - Bidan",
  "Karyawan - Apoteker/Farmasi",
  "Karyawan - Tenaga Medis Lainnya",
  "Karyawan - Administrasi & Umum",
  "Karyawan - Teknisi/IPSRS",
  "Karyawan - Petugas Kebersihan",
  "Keluarga / Pengunjung Pasien",
  "Pasien Sendiri",
  "Lain-lain",
];

// Kategori fasilitas
const kategoriFasilitasOptions = [
  "Infrastruktur Bangunan",
  "Alat Medis",
  "Sanitasi & Utilitas",
  "Furnitur & Perlengkapan",
  "Sistem Kelistrikan",
  "Sistem IT & Komunikasi",
  "Lain-lain",
];

// Nama fasilitas per kategori
const namaFasilitasOptions = {
  "Infrastruktur Bangunan": [
    "Atap/Rooftop",
    "Dinding",
    "Lantai",
    "Tangga",
    "Lift/Elevator",
    "Pintu",
    "Jendela",
    "Saluran Air/Drainase",
    "Koridor",
    "Lain-lain",
  ],
  "Alat Medis": [
    "Ventilator",
    "Infus Pump",
    "Syringe Pump",
    "Monitor Pasien",
    "Defibrillator",
    "Nebulizer",
    "Inkubator Bayi",
    "USG",
    "EKG",
    "Lampu Operasi",
    "Meja Operasi",
    "Lain-lain",
  ],
  "Sanitasi & Utilitas": [
    "Toilet/WC",
    "Wastafel",
    "Saluran Pembuangan",
    "Instalasi Air Bersih",
    "Sistem HVAC/AC",
    "Lain-lain",
  ],
  "Furnitur & Perlengkapan": [
    "Tempat Tidur Pasien",
    "Kursi Roda",
    "Brankar/Stretcher",
    "Tiang Infus",
    "Lemari Pasien",
    "Kursi Tunggu",
    "Lain-lain",
  ],
  "Sistem Kelistrikan": [
    "Panel Listrik",
    "Genset",
    "Stop Kontak/Saklar",
    "Lampu Penerangan",
    "Sistem Grounding",
    "Lain-lain",
  ],
  "Sistem IT & Komunikasi": [
    "Komputer/Laptop",
    "Server",
    "Jaringan Internet/LAN",
    "Sistem Rekam Medis Elektronik",
    "Telepon",
    "Lain-lain",
  ],
  "Lain-lain": ["Lain-lain"],
};

const kondisiOptions = [
  "Rusak / Tidak Berfungsi",
  "Bocor / Rembes",
  "Tergenang Air / Licin",
  "Tidak Tersedia / Hilang",
  "Kadaluarsa / Expired",
  "Salah Penggunaan",
  "Tidak Terpasang dengan Benar",
  "Lain-lain",
];

const penanggungJawabOptions = [
  "Bagian Umum",
  "IPSRS (Instalasi Pemeliharaan Sarana RS)",
  "Instalasi Farmasi",
  "Laboratorium",
  "IT / Sistem Informasi",
  "Keperawatan",
  "Lain-lain",
];

const ChevronIcon = () => (
  <svg
    className="h-4 w-4 text-slate-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

export default function FormStep1({
  // Toggle
  melibatkanPasien,
  setMelibatkanPasien,
  // Step 1 Pasien
  namaPasien,
  setNamaPasien,
  noMR,
  setNoMR,
  ruangan,
  setRuangan,
  ruanganCustom,
  setRuanganCustom,
  umur,
  setUmur,
  tanggalLahir,
  setTanggalLahir,
  jenisKelamin,
  setJenisKelamin,
  statusPasien,
  setStatusPasien,
  penanggungBiaya,
  setPenanggungBiaya,
  penanggungBiayaCustom,
  setPenanggungBiayaCustom,
  tanggalMasuk,
  setTanggalMasuk,
  kategoriPelapor,
  setKategoriPelapor,
  kategoriPelaporCustom,
  setKategoriPelaporCustom,
  // Step 1 Fasilitas
  kategoriFasilitas,
  setKategoriFasilitas,
  kategoriFasilitasCustom,
  setKategoriFasilitasCustom,
  namaFasilitas,
  setNamaFasilitas,
  namaFasilitasCustom,
  setNamaFasilitasCustom,
  kodeInventaris,
  setKodeInventaris,
  kondisiFasilitas,
  setKondisiFasilitas,
  kondisiFasilitasCustom,
  setKondisiFasilitasCustom,
  penanggungJawabFasilitas,
  setPenanggungJawabFasilitas,
  penanggungJawabFasilitasCustom,
  setPenanggungJawabFasilitasCustom,
  adaKorban,
  setAdaKorban,
  errors,
  setErrors,
}) {
  const namaOptions = kategoriFasilitas
    ? namaFasilitasOptions[kategoriFasilitas] || []
    : [];

  return (
    <div>
      {/* ── Toggle Tipe Insiden (kecil, di atas form) ── */}
      <div className="mb-5 flex items-center gap-6">
        <p className="text-xs sm:text-sm font-semibold text-slate-600">
          Apakah insiden ini melibatkan pasien?
        </p>
        <div className="flex items-center gap-4">
          {/* Ya */}
          <button
            type="button"
            onClick={() => setMelibatkanPasien(true)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all ${melibatkanPasien === true ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`}
            >
              {melibatkanPasien === true && (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
            <span
              className={`text-sm font-semibold ${melibatkanPasien === true ? "text-blue-600" : "text-slate-500"}`}
            >
              Ya
            </span>
          </button>
          {/* Tidak */}
          <button
            type="button"
            onClick={() => setMelibatkanPasien(false)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-all ${melibatkanPasien === false ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`}
            >
              {melibatkanPasien === false && (
                <div className="h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </div>
            <span
              className={`text-sm font-semibold ${melibatkanPasien === false ? "text-blue-600" : "text-slate-500"}`}
            >
              Tidak
            </span>
          </button>
        </div>
        {/* Info kecil kalau pilih Tidak */}
        {melibatkanPasien === false && (
          <span className="text-[11px] text-orange-600 font-medium bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1">
            Form akan berubah ke Data Fasilitas/Alat
          </span>
        )}
      </div>

      {/* ── Form Insiden PASIEN ── */}
      {melibatkanPasien === true && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Data Pasien & Pelapor
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Data ini membantu identifikasi insiden secara akurat agar
              penanganan lebih lanjut dapat dilakukan secara sistematis.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Kolom Kiri */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card: Data Pasien */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700">
                      Nama Pasien
                      <span className="text-xs font-medium text-slate-400">
                        (Inisial)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={namaPasien}
                      onChange={(e) => setNamaPasien(e.target.value)}
                      placeholder="Masukkan nama lengkap pasien"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      No. Rekam Medis
                    </label>
                    <input
                      type="text"
                      value={noMR}
                      onChange={(e) => setNoMR(e.target.value)}
                      placeholder="Contoh: RM-001234"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Ruangan/Unit <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {ruangan === "Lain-Lain" ? (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={ruanganCustom}
                            onChange={(e) => {
                              setRuanganCustom(e.target.value);
                              if (errors.ruangan)
                                setErrors({ ...errors, ruangan: null });
                            }}
                            placeholder="Tuliskan ruangan/unit..."
                            className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.ruangan ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setRuangan("");
                              setRuanganCustom("");
                            }}
                            title="Kembali ke pilihan dropdown"
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={ruangan}
                            onChange={(e) => {
                              setRuangan(e.target.value);
                              if (errors.ruangan)
                                setErrors({ ...errors, ruangan: null });
                            }}
                            className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.ruangan ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${ruangan ? "text-slate-800" : "text-slate-400"}`}
                          >
                            <option value="">Pilih ruangan</option>
                            {roomOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronIcon />
                          </div>
                        </>
                      )}
                    </div>
                    {errors.ruangan && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.ruangan}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Tanggal Lahir <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalLahir}
                      onChange={(e) => {
                        setTanggalLahir(e.target.value);
                        if (errors.tanggalLahir)
                          setErrors({ ...errors, tanggalLahir: null });
                      }}
                      className={`w-full rounded-lg border p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer ${errors.tanggalLahir ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                    />
                    {errors.tanggalLahir && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.tanggalLahir}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Jenis Kelamin <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {["Laki-laki", "Perempuan"].map((jk) => (
                        <button
                          key={jk}
                          type="button"
                          onClick={() => {
                            setJenisKelamin(jk);
                            if (errors.jenisKelamin)
                              setErrors({ ...errors, jenisKelamin: null });
                          }}
                          className={`flex items-center justify-center gap-2.5 rounded-xl border p-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${jenisKelamin === jk ? "border-blue-500 bg-blue-50/50 text-blue-700 ring-1 ring-blue-500" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                        >
                          <div
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${jenisKelamin === jk ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`}
                          >
                            {jenisKelamin === jk && (
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </div>
                          {jk}
                        </button>
                      ))}
                    </div>
                    {errors.jenisKelamin && (
                      <p className="mt-1.5 text-[11px] text-red-500">
                        {errors.jenisKelamin}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Penanggung Biaya & Tanggal Masuk */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Penanggung Biaya
                    </label>
                    <div className="relative">
                      {penanggungBiaya === "Lain-lain" ? (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={penanggungBiayaCustom}
                            onChange={(e) =>
                              setPenanggungBiayaCustom(e.target.value)
                            }
                            placeholder="Tuliskan penanggung biaya..."
                            className="w-full rounded-lg border border-slate-200 p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPenanggungBiaya("");
                              setPenanggungBiayaCustom("");
                            }}
                            title="Kembali ke pilihan dropdown"
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={penanggungBiaya}
                            onChange={(e) => setPenanggungBiaya(e.target.value)}
                            className="w-full appearance-none rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
                          >
                            {financeOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronIcon />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Tanggal & Jam Masuk Pukesmas{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={tanggalMasuk}
                      onChange={(e) => {
                        setTanggalMasuk(e.target.value);
                        if (errors.tanggalMasuk)
                          setErrors({ ...errors, tanggalMasuk: null });
                      }}
                      className={`w-full rounded-lg border p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer ${errors.tanggalMasuk ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                    />
                    {errors.tanggalMasuk && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.tanggalMasuk}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Kolom Kanan */}
            <div className="lg:col-span-1 space-y-6">
              {/* Card: Status Pasien */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <label className="mb-3 block text-xs sm:text-sm font-bold text-slate-700">
                  Status Pasien Saat Insiden{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {[
                    { id: "Rawat Inap", desc: "Pasien sedang menginap" },
                    { id: "Rawat Jalan", desc: "Pasien kunjungan poliklinik" },
                    { id: "IGD", desc: "Kondisi darurat/emergensi" },
                    { id: "Lain-lain", desc: "Kunjungan laboratorium dsb" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setStatusPasien(opt.id);
                        if (errors.statusPasien)
                          setErrors({ ...errors, statusPasien: null });
                      }}
                      className={`flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all w-full cursor-pointer ${statusPasien === opt.id ? "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500" : "border-slate-200 hover:bg-slate-50/50"}`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${statusPasien === opt.id ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"}`}
                      >
                        {statusPasien === opt.id && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-xs sm:text-sm font-bold ${statusPasien === opt.id ? "text-blue-800" : "text-slate-700"}`}
                        >
                          {opt.id}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.statusPasien && (
                  <p className="mt-2 text-[11px] text-red-500">
                    {errors.statusPasien}
                  </p>
                )}
              </div>

              {/* Card: Kategori Pelapor */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 text-blue-700">
                  <User className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-extrabold">
                    Data Pelapor Pertama
                  </span>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                    Kategori Pelapor
                  </label>
                  <div className="relative">
                    {kategoriPelapor === "Lain-lain" ? (
                      <>
                        <input
                          type="text"
                          autoFocus
                          value={kategoriPelaporCustom}
                          onChange={(e) =>
                            setKategoriPelaporCustom(e.target.value)
                          }
                          placeholder="Tuliskan kategori pelapor..."
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setKategoriPelapor("");
                            setKategoriPelaporCustom("");
                          }}
                          title="Kembali ke pilihan dropdown"
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <select
                          value={kategoriPelapor}
                          onChange={(e) => setKategoriPelapor(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                          {reporterCategories.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <ChevronIcon />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/70 border border-blue-50 p-3">
                  <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                    Identitas pelapor bersifat konfidensial dan hanya digunakan
                    untuk keperluan audit klinis internal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Form Insiden FASILITAS ── */}
      {melibatkanPasien === false && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">
              Data Fasilitas / Alat
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
              Lengkapi informasi fasilitas atau alat yang terlibat dalam insiden
              ini untuk membantu proses investigasi dan perbaikan.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Kolom Kiri */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card: Detail Fasilitas */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Kategori Fasilitas */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Kategori Fasilitas/Alat{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    {kategoriFasilitas === "Lain-lain" ? (
                      <div className="relative">
                        <input
                          type="text"
                          autoFocus
                          value={kategoriFasilitasCustom}
                          onChange={(e) => {
                            setKategoriFasilitasCustom(e.target.value);
                            if (errors.kategoriFasilitas)
                              setErrors({ ...errors, kategoriFasilitas: null });
                          }}
                          placeholder="Tuliskan kategori fasilitas/alat..."
                          className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.kategoriFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setKategoriFasilitas("");
                            setKategoriFasilitasCustom("");
                            setNamaFasilitas("");
                          }}
                          title="Kembali ke pilihan kategori"
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {kategoriFasilitasOptions.map((kat) => (
                          <button
                            key={kat}
                            type="button"
                            onClick={() => {
                              setKategoriFasilitas(kat);
                              setNamaFasilitas("");
                              if (errors.kategoriFasilitas)
                                setErrors({
                                  ...errors,
                                  kategoriFasilitas: null,
                                });
                            }}
                            className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all cursor-pointer text-left ${kategoriFasilitas === kat ? "border-orange-400 bg-orange-50 text-orange-700 ring-1 ring-orange-400" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                          >
                            <div
                              className={`h-2 w-2 shrink-0 rounded-full ${kategoriFasilitas === kat ? "bg-orange-500" : "bg-slate-300"}`}
                            />
                            {kat}
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.kategoriFasilitas && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.kategoriFasilitas}
                      </p>
                    )}
                  </div>

                  {/* Nama Fasilitas */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Nama Fasilitas/Alat{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {namaFasilitas === "Lain-lain" ? (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={namaFasilitasCustom}
                            onChange={(e) => {
                              setNamaFasilitasCustom(e.target.value);
                              if (errors.namaFasilitas)
                                setErrors({ ...errors, namaFasilitas: null });
                            }}
                            placeholder="Tuliskan nama fasilitas/alat..."
                            className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.namaFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setNamaFasilitas("");
                              setNamaFasilitasCustom("");
                            }}
                            title="Kembali ke pilihan dropdown"
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={namaFasilitas}
                            onChange={(e) => {
                              setNamaFasilitas(e.target.value);
                              if (errors.namaFasilitas)
                                setErrors({ ...errors, namaFasilitas: null });
                            }}
                            disabled={!kategoriFasilitas}
                            className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${!kategoriFasilitas ? "bg-slate-50 text-slate-400" : "bg-white"} ${errors.namaFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${namaFasilitas ? "text-slate-800" : "text-slate-400"}`}
                          >
                            <option value="">
                              {kategoriFasilitas
                                ? "Pilih nama fasilitas/alat"
                                : "Pilih kategori dulu"}
                            </option>
                            {namaOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronIcon />
                          </div>
                        </>
                      )}
                    </div>
                    {errors.namaFasilitas && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.namaFasilitas}
                      </p>
                    )}
                  </div>

                  {/* Kode Inventaris */}
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Nomor/Kode Inventaris{" "}
                      <span className="text-slate-400 font-normal">
                        (opsional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={kodeInventaris}
                      onChange={(e) => setKodeInventaris(e.target.value)}
                      placeholder="Contoh: INV-2024-001"
                      className="w-full rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                    />
                  </div>

                  {/* Kondisi */}
                  <div>
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Kondisi Saat Insiden{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {kondisiFasilitas === "Lain-lain" ? (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={kondisiFasilitasCustom}
                            onChange={(e) => {
                              setKondisiFasilitasCustom(e.target.value);
                              if (errors.kondisiFasilitas)
                                setErrors({
                                  ...errors,
                                  kondisiFasilitas: null,
                                });
                            }}
                            placeholder="Tuliskan kondisi saat insiden..."
                            className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.kondisiFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setKondisiFasilitas("");
                              setKondisiFasilitasCustom("");
                            }}
                            title="Kembali ke pilihan dropdown"
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={kondisiFasilitas}
                            onChange={(e) => {
                              setKondisiFasilitas(e.target.value);
                              if (errors.kondisiFasilitas)
                                setErrors({
                                  ...errors,
                                  kondisiFasilitas: null,
                                });
                            }}
                            className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.kondisiFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${kondisiFasilitas ? "text-slate-800" : "text-slate-400"}`}
                          >
                            <option value="">Pilih kondisi</option>
                            {kondisiOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronIcon />
                          </div>
                        </>
                      )}
                    </div>
                    {errors.kondisiFasilitas && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.kondisiFasilitas}
                      </p>
                    )}
                  </div>

                  {/* Penanggung Jawab */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                      Penanggung Jawab Area/Alat{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      {penanggungJawabFasilitas === "Lain-lain" ? (
                        <>
                          <input
                            type="text"
                            autoFocus
                            value={penanggungJawabFasilitasCustom}
                            onChange={(e) => {
                              setPenanggungJawabFasilitasCustom(e.target.value);
                              if (errors.penanggungJawabFasilitas)
                                setErrors({
                                  ...errors,
                                  penanggungJawabFasilitas: null,
                                });
                            }}
                            placeholder="Tuliskan penanggung jawab area/alat..."
                            className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.penanggungJawabFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPenanggungJawabFasilitas("");
                              setPenanggungJawabFasilitasCustom("");
                            }}
                            title="Kembali ke pilihan dropdown"
                            className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            value={penanggungJawabFasilitas}
                            onChange={(e) => {
                              setPenanggungJawabFasilitas(e.target.value);
                              if (errors.penanggungJawabFasilitas)
                                setErrors({
                                  ...errors,
                                  penanggungJawabFasilitas: null,
                                });
                            }}
                            className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.penanggungJawabFasilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${penanggungJawabFasilitas ? "text-slate-800" : "text-slate-400"}`}
                          >
                            <option value="">Pilih penanggung jawab</option>
                            {penanggungJawabOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <ChevronIcon />
                          </div>
                        </>
                      )}
                    </div>
                    {errors.penanggungJawabFasilitas && (
                      <p className="mt-1 text-[11px] text-red-500">
                        {errors.penanggungJawabFasilitas}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Card: Apakah ada korban */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                <label className="mb-3 block text-xs sm:text-sm font-bold text-slate-700">
                  Apakah Ada Pihak yang Terdampak/Terluka?
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    { id: "Tidak Ada", desc: "Tidak ada korban" },
                    {
                      id: "Potensi Bahaya",
                      desc: "Berisiko tapi belum ada korban",
                    },
                    {
                      id: "Ada Korban",
                      desc: "Sudah ada yang terluka/terdampak",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAdaKorban(opt.id)}
                      className={`flex flex-col rounded-xl border p-3.5 text-left transition-all cursor-pointer ${adaKorban === opt.id ? "border-orange-400 bg-orange-50 ring-1 ring-orange-400" : "border-slate-200 hover:bg-slate-50"}`}
                    >
                      <div
                        className={`mb-1.5 h-3 w-3 rounded-full ${adaKorban === opt.id ? "bg-orange-500" : "bg-slate-200"}`}
                      />
                      <p
                        className={`text-xs font-bold ${adaKorban === opt.id ? "text-orange-800" : "text-slate-700"}`}
                      >
                        {opt.id}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Kolom Kanan: Kategori Pelapor */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 text-blue-700">
                  <User className="h-4 w-4" />
                  <span className="text-xs sm:text-sm font-extrabold">
                    Data Pelapor Pertama
                  </span>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                    Kategori Pelapor
                  </label>
                  <div className="relative">
                    {kategoriPelapor === "Lain-lain" ? (
                      <>
                        <input
                          type="text"
                          autoFocus
                          value={kategoriPelaporCustom}
                          onChange={(e) =>
                            setKategoriPelaporCustom(e.target.value)
                          }
                          placeholder="Tuliskan kategori pelapor..."
                          className="w-full rounded-lg border border-slate-200 bg-white p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setKategoriPelapor("");
                            setKategoriPelaporCustom("");
                          }}
                          title="Kembali ke pilihan dropdown"
                          className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <select
                          value={kategoriPelapor}
                          onChange={(e) => setKategoriPelapor(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
                        >
                          {reporterCategories.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                          <ChevronIcon />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/70 border border-blue-50 p-3">
                  <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                    Identitas pelapor bersifat konfidensial dan hanya digunakan
                    untuk keperluan audit klinis internal.
                  </p>
                </div>

                {/* Info box fasilitas */}
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-100 p-3">
                  <Building2 className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
                  <p className="text-[10px] leading-relaxed text-orange-700 font-medium">
                    Laporan fasilitas akan diteruskan ke unit IPSRS dan Bagian
                    Umum untuk ditindaklanjuti segera.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
