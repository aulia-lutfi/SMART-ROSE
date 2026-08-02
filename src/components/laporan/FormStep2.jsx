import { useState, useEffect } from "react";
import { Search, X, Plus, AlertTriangle, Info } from "lucide-react";
import {
  dampakOptions,
  probabilitasOptions,
  hitungGrading,
  tentukanJenisInvestigasi,
  GRADING_STYLE,
} from "../../lib/grading";

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

const spesialisasiOptions = [
  "Penyakit Dalam",
  "Anak / Pediatri",
  "Bedah Umum",
  "Obstetri & Ginekologi (Kebidanan & Kandungan)",
  "Saraf / Neurologi",
  "Jantung & Pembuluh Darah",
  "Mata",
  "Telinga Hidung Tenggorokan (THT-KL)",
  "Anestesiologi & Terapi Intensif",
  "Kulit & Kelamin / Dermatologi",
  "Jiwa / Psikiatri",
  "Ortopedi & Traumatologi",
  "Urologi",
  "Lain-lain",
];

const pihakOptions = [
  "Dokter",
  "Perawat",
  "Bidan",
  "Apoteker / Farmasi",
  "Keluarga Pasien",
  "Pasien",
  "Analis Laboratorium",
  "Staf Administrasi",
  "Petugas Keamanan / Security",
  "Petugas Kebersihan / CS",
  "Teknisi / IPSRS",
];

// Opsi khusus fasilitas
const kategoriKerusakanOptions = [
  "Bocor / Rembes",
  "Tergenang Air / Licin",
  "Rusak Fisik / Patah",
  "Tidak Berfungsi / Mati",
  "Kabel / Instalasi Berbahaya",
  "Penerangan Kurang / Gelap",
  "Bau Tidak Sedap / Kontaminasi",
  "Akses Terhambat / Terblokir",
  "Lain-lain",
];

const statusPenangananOptions = [
  "Belum Ditangani",
  "Sedang Dalam Proses",
  "Sudah Ditangani Sementara",
  "Sudah Ditangani Permanen",
];

// ── Jenis Insiden (dipindah dari FormStep4.jsx, step tersendiri dihapus
// dan digabung ke sini sesuai rencana penyederhanaan 5 → 4 step) ────────
const jenisInsidenOptions = [
  {
    id: "KPC",
    label: "KPC - Kondisi Potensial Cedera",
    description:
      "Situasi yang berpotensi menimbulkan cedera namun belum terjadi.",
  },
  {
    id: "KNC",
    label: "KNC - Kejadian Nyaris Cedera",
    description: "Insiden yang sudah terjadi tetapi belum terpapar ke pasien.",
  },
  {
    id: "KTC",
    label: "KTC - Kejadian Tidak Cedera",
    description:
      "Insiden sudah terpapar ke pasien tetapi tidak menimbulkan cedera.",
  },
  {
    id: "KTD",
    label: "KTD - Kejadian Tidak Diharapkan",
    description: "Insiden yang mengakibatkan cedera pada pasien.",
  },
  {
    id: "SENTINEL",
    label: "Sentinel - Kejadian Sentinel",
    description:
      "Kejadian tidak diharapkan yang mengakibatkan kematian atau cedera permanen.",
  },
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

export default function FormStep2({
  // Toggle dari Step 1
  melibatkanPasien,
  // Field umum
  tanggalKejadian,
  setTanggalKejadian,
  lokasiKejadian,
  setLokasiKejadian,
  lokasiKejadianCustom,
  setLokasiKejadianCustom,
  unitPenyebab,
  setUnitPenyebab,
  unitPenyebabCustom,
  setUnitPenyebabCustom,
  pihakTerlibat,
  setPihakTerlibat,
  kronologiSingkat,
  setKronologiSingkat,
  dampakTerjadi,
  setDampakTerjadi,
  probabilitas,
  setProbabilitas,
  gradingKeparahan,
  setGradingKeparahan,
  jenisInsiden,
  setJenisInsiden,
  // Field khusus pasien
  spesialisasiTerkait,
  setSpesialisasiTerkait,
  spesialisasiTerkaitCustom,
  setSpesialisasiTerkaitCustom,
  akibatInsiden,
  setAkibatInsiden,
  // Field khusus fasilitas
  kategoriKerusakan,
  setKategoriKerusakan,
  kategoriKerusakanCustom,
  setKategoriKerusakanCustom,
  statusPenangananAwal,
  setStatusPenangananAwal,
  tindakanDarurat,
  setTindakanDarurat,
  errors,
  setErrors,
}) {
  const [searchUnitQuery, setSearchUnitQuery] = useState("");
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showPihakDropdown, setShowPihakDropdown] = useState(false);
  const [customPihakText, setCustomPihakText] = useState("");

  const filteredUnits = roomOptions.filter((unit) =>
    unit.toLowerCase().includes(searchUnitQuery.toLowerCase()),
  );

  const handleSelectUnit = (unit) => {
    setLokasiKejadian(unit);
    setSearchUnitQuery("");
    setShowUnitDropdown(false);
    if (errors.lokasiKejadian) setErrors({ ...errors, lokasiKejadian: null });
  };

  const handleRemovePihak = (pihak) => {
    setPihakTerlibat(pihakTerlibat.filter((p) => p !== pihak));
  };

  const handleAddPihak = (pihak) => {
    if (pihak && !pihakTerlibat.includes(pihak)) {
      setPihakTerlibat([...pihakTerlibat, pihak]);
    }
    setShowPihakDropdown(false);
  };

  const handleAddCustomPihak = () => {
    const trimmed = customPihakText.trim();
    if (trimmed && !pihakTerlibat.includes(trimmed)) {
      setPihakTerlibat([...pihakTerlibat, trimmed]);
    }
    setCustomPihakText("");
    setShowPihakDropdown(false);
  };

  // ── Grading otomatis: begitu Dampak & Probabilitas sama-sama terisi,
  // hasilnya langsung dihitung dari RISK_MATRIX dan disimpan ke
  // gradingKeparahan. Admin/nakes tidak lagi pilih grading manual.
  useEffect(() => {
    const hasil = hitungGrading(dampakTerjadi, probabilitas);
    if (hasil) setGradingKeparahan(hasil);
  }, [dampakTerjadi, probabilitas, setGradingKeparahan]);

  // Grading: label berbeda untuk pasien vs fasilitas.
  // id & warna mengikuti GRADING_STYLE dari lib/grading.js supaya konsisten
  // dengan yang dipakai admin di DetailLaporanPageAdmin.jsx.
  const gradingOptions = melibatkanPasien
    ? [
        {
          id: "Rendah",
          color: GRADING_STYLE.Rendah.dot,
          activeStyles: "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500",
          desc: "Tidak ada cedera atau cedera ringan",
        },
        {
          id: "Moderat",
          color: GRADING_STYLE.Moderat.dot,
          activeStyles: "border-green-500 bg-green-50/20 ring-1 ring-green-500",
          desc: "Cedera ringan-sedang, butuh intervensi",
        },
        {
          id: "Tinggi",
          color: GRADING_STYLE.Tinggi.dot,
          activeStyles:
            "border-yellow-500 bg-yellow-50/20 ring-1 ring-yellow-500",
          desc: "Cedera bermakna, butuh tindakan intensif",
        },
        {
          id: "Ekstrim",
          color: GRADING_STYLE.Ekstrim.dot,
          activeStyles: "border-red-500 bg-red-50/20 ring-1 ring-red-500",
          desc: "Kematian atau cedera permanen bermakna",
        },
      ]
    : [
        {
          id: "Rendah",
          color: GRADING_STYLE.Rendah.dot,
          activeStyles: "border-blue-500 bg-blue-50/20 ring-1 ring-blue-500",
          desc: "Tidak mengganggu operasional RS",
        },
        {
          id: "Moderat",
          color: GRADING_STYLE.Moderat.dot,
          activeStyles: "border-green-500 bg-green-50/20 ring-1 ring-green-500",
          desc: "Berpotensi cedera ringan atau gangguan operasional",
        },
        {
          id: "Tinggi",
          color: GRADING_STYLE.Tinggi.dot,
          activeStyles:
            "border-yellow-500 bg-yellow-50/20 ring-1 ring-yellow-500",
          desc: "Berpotensi cedera serius atau gangguan layanan",
        },
        {
          id: "Ekstrim",
          color: GRADING_STYLE.Ekstrim.dot,
          activeStyles: "border-red-500 bg-red-50/20 ring-1 ring-red-500",
          desc: "Mengancam jiwa atau operasional RS terhenti",
        },
      ];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800">
          Kronologi Kejadian
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-relaxed">
          Mohon ceritakan kronologi secara objektif. Data yang akurat sangat
          membantu proses investigasi dan perbaikan sistem pelayanan di masa
          depan.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm space-y-6">
        {/* Row 1: Tanggal & Lokasi */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Tanggal dan Waktu Kejadian <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={tanggalKejadian}
              onChange={(e) => {
                setTanggalKejadian(e.target.value);
                if (errors.tanggalKejadian)
                  setErrors({ ...errors, tanggalKejadian: null });
              }}
              className={`w-full rounded-lg border p-2.5 text-xs sm:text-sm text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer ${errors.tanggalKejadian ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
            />
            {errors.tanggalKejadian && (
              <p className="mt-1 text-[11px] text-red-500">
                {errors.tanggalKejadian}
              </p>
            )}
          </div>

          <div className="relative">
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Lokasi/Unit Kerja Kejadian <span className="text-red-500">*</span>
            </label>
            {lokasiKejadian === "Lain-Lain" ? (
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={lokasiKejadianCustom}
                  onChange={(e) => {
                    setLokasiKejadianCustom(e.target.value);
                    if (errors.lokasiKejadian)
                      setErrors({ ...errors, lokasiKejadian: null });
                  }}
                  placeholder="Tuliskan lokasi/unit kejadian..."
                  className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.lokasiKejadian ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setLokasiKejadian("");
                    setLokasiKejadianCustom("");
                    setSearchUnitQuery("");
                  }}
                  title="Kembali ke pencarian"
                  className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  value={showUnitDropdown ? searchUnitQuery : lokasiKejadian}
                  onChange={(e) => {
                    setSearchUnitQuery(e.target.value);
                    setShowUnitDropdown(true);
                    if (!e.target.value) setLokasiKejadian("");
                  }}
                  onFocus={() => {
                    setSearchUnitQuery(lokasiKejadian);
                    setShowUnitDropdown(true);
                  }}
                  onBlur={() =>
                    setTimeout(() => setShowUnitDropdown(false), 250)
                  }
                  placeholder="Cari unit (misal: ICU, Melati...)"
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-4 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.lokasiKejadian ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                />
              </div>
            )}
            {errors.lokasiKejadian && (
              <p className="mt-1 text-[11px] text-red-500">
                {errors.lokasiKejadian}
              </p>
            )}
            {showUnitDropdown && lokasiKejadian !== "Lain-Lain" && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-100 bg-white py-1 shadow-lg">
                {filteredUnits.length > 0 ? (
                  filteredUnits.map((room) => (
                    <button
                      key={room}
                      type="button"
                      onMouseDown={() => handleSelectUnit(room)}
                      className="flex w-full items-center px-4 py-2 text-left text-xs sm:text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {room}
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-2.5 text-xs text-slate-400 italic">
                    Unit tidak ditemukan
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Unit Penyebab & Pihak Terlibat */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Ruangan/Unit yang Menyebabkan Insiden
            </label>
            <div className="relative">
              {unitPenyebab === "Lain-Lain" ? (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={unitPenyebabCustom}
                    onChange={(e) => setUnitPenyebabCustom(e.target.value)}
                    placeholder="Tuliskan unit penyebab..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUnitPenyebab("");
                      setUnitPenyebabCustom("");
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
                    value={unitPenyebab}
                    onChange={(e) => setUnitPenyebab(e.target.value)}
                    className={`w-full appearance-none rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${unitPenyebab ? "text-slate-800" : "text-slate-400"}`}
                  >
                    <option value="">Pilih Unit Penyebab</option>
                    {roomOptions.map((opt) => (
                      <option key={opt} value={opt} className="text-slate-800">
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

          <div className="relative">
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Pihak yang Terlibat
            </label>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/20 p-2 min-h-[42px]">
              {pihakTerlibat.map((pihak) => (
                <span
                  key={pihak}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white"
                >
                  {pihak}
                  <button
                    type="button"
                    onClick={() => handleRemovePihak(pihak)}
                    className="rounded-full p-0.5 hover:bg-blue-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setShowPihakDropdown(!showPihakDropdown)}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer py-1 px-1.5 rounded hover:bg-blue-50/50"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah pihak...
              </button>
            </div>
            <p className="mt-1.5 text-[10px] sm:text-xs text-slate-400 italic">
              Contoh: Farmasi, Keluarga Pasien, IPSRS
            </p>
            {showPihakDropdown && (
              <div className="absolute right-0 left-0 z-50 mt-1 rounded-xl border border-slate-100 bg-white p-3 shadow-lg max-w-sm">
                <div className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Pilih Cepat:
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3 max-h-36 overflow-y-auto">
                  {pihakOptions
                    .filter((opt) => !pihakTerlibat.includes(opt))
                    .map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleAddPihak(opt)}
                        className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 py-1 px-2 rounded-full cursor-pointer"
                      >
                        {opt}
                      </button>
                    ))}
                </div>
                <div className="border-t pt-2.5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pihak Lain / Kustom:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPihakText}
                      onChange={(e) => setCustomPihakText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddCustomPihak();
                        }
                      }}
                      placeholder="Ketik peran, lalu enter"
                      className="w-full rounded-lg border border-slate-200 p-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPihak}
                      className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-blue-700 cursor-pointer"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
                <div className="flex justify-end border-t pt-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowPihakDropdown(false)}
                    className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Kondisional — Pasien: Spesialisasi | Fasilitas: Kategori Kerusakan */}
        {melibatkanPasien ? (
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Kasus Penyakit/Spesialisasi Terkait
            </label>
            <div className="relative">
              {spesialisasiTerkait === "Lain-lain" ? (
                <>
                  <input
                    type="text"
                    autoFocus
                    value={spesialisasiTerkaitCustom}
                    onChange={(e) =>
                      setSpesialisasiTerkaitCustom(e.target.value)
                    }
                    placeholder="Tuliskan spesialisasi terkait..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSpesialisasiTerkait("");
                      setSpesialisasiTerkaitCustom("");
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
                    value={spesialisasiTerkait}
                    onChange={(e) => setSpesialisasiTerkait(e.target.value)}
                    className={`w-full appearance-none rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${spesialisasiTerkait ? "text-slate-800" : "text-slate-400"}`}
                  >
                    <option value="">Pilih Spesialisasi</option>
                    {spesialisasiOptions.map((opt) => (
                      <option key={opt} value={opt} className="text-slate-800">
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
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Kategori Kerusakan */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                Kategori Kerusakan/Masalah{" "}
                <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {kategoriKerusakan === "Lain-lain" ? (
                  <>
                    <input
                      type="text"
                      autoFocus
                      value={kategoriKerusakanCustom}
                      onChange={(e) => {
                        setKategoriKerusakanCustom(e.target.value);
                        if (errors.kategoriKerusakan)
                          setErrors({ ...errors, kategoriKerusakan: null });
                      }}
                      placeholder="Tuliskan kategori kerusakan/masalah..."
                      className={`w-full rounded-lg border p-2.5 pr-8 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.kategoriKerusakan ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setKategoriKerusakan("");
                        setKategoriKerusakanCustom("");
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
                      value={kategoriKerusakan}
                      onChange={(e) => {
                        setKategoriKerusakan(e.target.value);
                        if (errors.kategoriKerusakan)
                          setErrors({ ...errors, kategoriKerusakan: null });
                      }}
                      className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.kategoriKerusakan ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${kategoriKerusakan ? "text-slate-800" : "text-slate-400"}`}
                    >
                      <option value="">Pilih kategori kerusakan</option>
                      {kategoriKerusakanOptions.map((opt) => (
                        <option
                          key={opt}
                          value={opt}
                          className="text-slate-800"
                        >
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
              {errors.kategoriKerusakan && (
                <p className="mt-1 text-[11px] text-red-500">
                  {errors.kategoriKerusakan}
                </p>
              )}
            </div>

            {/* Status Penanganan Awal */}
            <div>
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                Status Penanganan Awal
              </label>
              <div className="relative">
                <select
                  value={statusPenangananAwal}
                  onChange={(e) => setStatusPenangananAwal(e.target.value)}
                  className={`w-full appearance-none rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${statusPenangananAwal ? "text-slate-800" : "text-slate-400"}`}
                >
                  <option value="">Pilih status</option>
                  {statusPenangananOptions.map((opt) => (
                    <option key={opt} value={opt} className="text-slate-800">
                      {opt}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronIcon />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Row 4: Kronologi */}
        <div>
          <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
            Kronologi Singkat Kejadian <span className="text-red-500">*</span>
          </label>
          <textarea
            rows="4"
            value={kronologiSingkat}
            onChange={(e) => {
              setKronologiSingkat(e.target.value);
              if (errors.kronologiSingkat)
                setErrors({ ...errors, kronologiSingkat: null });
            }}
            placeholder={
              melibatkanPasien
                ? "Ceritakan urutan kejadian secara objektif, meliputi apa yang terjadi, mengapa bisa terjadi, dan tindakan langsung yang dilakukan..."
                : "Ceritakan kondisi fasilitas/alat, bagaimana kejadian bermula, dampak yang ditimbulkan, dan tindakan darurat yang sudah diambil..."
            }
            className={`w-full rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400 ${errors.kronologiSingkat ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"}`}
          />
          {errors.kronologiSingkat && (
            <p className="mt-1 text-[11px] text-red-500">
              {errors.kronologiSingkat}
            </p>
          )}
        </div>
        {/* Row 8: Jenis Insiden — dipindah dari step "Rencana Tindak" lama */}
        <div>
          <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
            Jenis Insiden <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              value={jenisInsiden}
              onChange={(e) => {
                setJenisInsiden(e.target.value);
                if (errors.jenisInsiden)
                  setErrors({ ...errors, jenisInsiden: null });
              }}
              className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.jenisInsiden ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${jenisInsiden ? "text-slate-800" : "text-slate-400"}`}
            >
              <option value="">Pilih jenis insiden</option>
              {jenisInsidenOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="text-slate-800">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <ChevronIcon />
            </div>
          </div>
          {errors.jenisInsiden && (
            <p className="mt-1 text-[11px] text-red-500">
              {errors.jenisInsiden}
            </p>
          )}

          {/* Deskripsi singkat opsi yang dipilih */}
          {jenisInsiden && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
              {
                jenisInsidenOptions.find((o) => o.id === jenisInsiden)
                  ?.description
              }
            </p>
          )}

          {/* Wajib lapor — berlaku untuk semua jenis insiden, bukan cuma Sentinel */}
          {jenisInsiden && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500 mt-0.5" />
              <p className="text-xs font-semibold text-orange-700">
                Wajib dilaporkan segera (2 x 24 jam)
              </p>
            </div>
          )}
        </div>

        {/* Row 5: Dampak & Probabilitas — dasar perhitungan grading otomatis */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Dampak yang Terjadi/Berpotensi Terjadi{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={dampakTerjadi}
                onChange={(e) => {
                  setDampakTerjadi(e.target.value);
                  if (errors.dampakTerjadi)
                    setErrors({ ...errors, dampakTerjadi: null });
                }}
                className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.dampakTerjadi ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${dampakTerjadi ? "text-slate-800" : "text-slate-400"}`}
              >
                <option value="">Pilih tingkat dampak</option>
                {dampakOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="text-slate-800"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronIcon />
              </div>
            </div>
            {errors.dampakTerjadi && (
              <p className="mt-1 text-[11px] text-red-500">
                {errors.dampakTerjadi}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
              Probabilitas/Frekuensi Kejadian{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={probabilitas}
                onChange={(e) => {
                  setProbabilitas(e.target.value);
                  if (errors.probabilitas)
                    setErrors({ ...errors, probabilitas: null });
                }}
                className={`w-full appearance-none rounded-lg border p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none cursor-pointer ${errors.probabilitas ? "border-red-400 ring-1 ring-red-100" : "border-slate-200"} ${probabilitas ? "text-slate-800" : "text-slate-400"}`}
              >
                <option value="">Pilih probabilitas</option>
                {probabilitasOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="text-slate-800"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <ChevronIcon />
              </div>
            </div>
            {errors.probabilitas && (
              <p className="mt-1 text-[11px] text-red-500">
                {errors.probabilitas}
              </p>
            )}
          </div>
        </div>

        {/* Row 6: Kondisional — Pasien: Akibat Insiden | Fasilitas: Tindakan Darurat */}
        {melibatkanPasien ? (
          <div>
            <label className="mb-2.5 block text-xs sm:text-sm font-bold text-slate-700">
              Akibat Insiden terhadap Pasien secara Formal
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              {[
                "Tidak Ada Cedera",
                "Cedera Ringan",
                "Cedera Reversibel",
                "Cedera Irreversibel",
                "Kematian",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAkibatInsiden(item)}
                  className={`flex items-center justify-center rounded-lg border p-2.5 text-center text-xs font-semibold transition-all cursor-pointer select-none sm:px-4 ${akibatInsiden === item ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-2.5 block text-xs sm:text-sm font-bold text-slate-700">
              Dampak terhadap Operasional & Keselamatan
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
              {[
                "Tidak Ada Korban (Potensi Bahaya)",
                "Ada Korban Cedera",
                "Gangguan Operasional RS",
                "Kerugian Materil",
                "Layanan Terhenti",
              ].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setAkibatInsiden(item)}
                  className={`flex items-center justify-center rounded-lg border p-2.5 text-center text-xs font-semibold transition-all cursor-pointer select-none sm:px-4 ${akibatInsiden === item ? "border-orange-500 bg-orange-500 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Tindakan Darurat — khusus fasilitas */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-700">
                Tindakan Darurat yang Sudah Dilakukan
              </label>
              <textarea
                rows="2"
                value={tindakanDarurat}
                onChange={(e) => setTindakanDarurat(e.target.value)}
                placeholder="Contoh: Memasang cone/tanda peringatan, menghubungi IPSRS, menutup area sementara..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Row 7: Grading — dihitung OTOMATIS dari Dampak x Probabilitas,
            tidak lagi dipilih manual. Kartunya tetap dirender (biar
            konsisten sama desain lain) tapi tidak bisa diklik — cuma
            satu yang menyala sesuai hasil matriks. */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-xs sm:text-sm font-bold text-slate-700">
              Tingkat Keparahan / Grading (Otomatis)
            </label>
            {dampakTerjadi && probabilitas ? (
              <span className="text-[11px] font-semibold text-slate-400">
                Dihitung dari Dampak {dampakTerjadi} × Probabilitas{" "}
                {probabilitas}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-orange-500">
                Isi Dampak & Probabilitas dulu untuk melihat grading
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gradingOptions.map((item) => (
              <div
                key={item.id}
                aria-disabled="true"
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-all select-none ${gradingKeparahan === item.id ? item.activeStyles : "border-slate-200 bg-white opacity-60"}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`h-3 w-3 rounded-full ${item.color} shrink-0`}
                  />
                  <span
                    className={`text-xs sm:text-sm font-bold ${gradingKeparahan === item.id ? "text-slate-800" : "text-slate-700"}`}
                  >
                    {item.id}
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400 font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Info jenis investigasi mengikuti hasil grading */}
          {gradingKeparahan &&
            (() => {
              const info = tentukanJenisInvestigasi(
                gradingKeparahan,
                jenisInsiden,
              );
              if (!info) return null;
              return (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 ${info.style}`}
                >
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">{info.label}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                      {info.desc}
                    </p>
                  </div>
                </div>
              );
            })()}
        </div>
      </div>
    </div>
  );
}
