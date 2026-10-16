// ── buatlaporanService.js ──────────────────────────────────────────────────
// Service untuk operasi laporan insiden dari sisi user (nakes), diakses
// ANONIM lewat QR code (tanpa login/akun/token).
//
// ⚠️ PENTING UNTUK BACKEND: endpoint di bawah ini HARUS bersifat PUBLIK
// (tidak boleh mewajibkan header Authorization/Bearer token). apiClient
// tetap dipakai untuk konsistensi (base URL, dsb.) — dia cuma menambahkan
// header Authorization KALAU ada token tersimpan di storage, dan untuk
// sesi anonim/QR biasanya memang tidak ada. Kalau backend pernah balikin
// 401 untuk endpoint ini, kemungkinan apiClient's refresh-token
// interceptor akan salah nyoba refresh — PERLU DIUJI di flow anonim.
//
// ⚠️ PERLU DIKONFIRMASI KE BACKEND:
//   1. Path endpoint POST untuk buat laporan publik — belum ada di daftar
//      endpoint yang sudah dikonfirmasi sebelumnya (beda dengan RCA yang
//      sudah jelas). DIASUMSIKAN "/reports" mengikuti pola REST yang sama
//      seperti "/admin/reports" di sisi admin.
//   2. Endpoint "simpan draft" — juga belum dikonfirmasi, diasumsikan
//      "/reports/draft".
//
// ✅ SUDAH DIKONFIRMASI (dokumen backend, temuan bug lampiran tidak
// tersimpan): upload lampiran BUKAN bagian dari body POST /reports.
// Lampiran adalah endpoint TERPISAH: POST /api/reports/:id/attachments,
// dikirim sebagai multipart/form-data dengan field name "file" (bukan
// "lampiran" atau digabung ke field "data" seperti implementasi lama).
// Endpoint ini baru bisa dipanggil SETELAH laporan utama berhasil dibuat
// dan id-nya didapat. Lihat kirimLaporan() di bawah — sekarang jadi 2
// langkah berurutan, bukan 1 request gabungan.

import { apiClient } from "../../lib/apiClient";
import { hitungGrading, tentukanJenisInvestigasi } from "../../lib/grading";

// ⚠️ ASUMSI (belum dikonfirmasi backend secara eksplisit, tapi cocok
// dengan urutan warna standar matriks grading risiko KARS/Kemenkes):
// hitungGrading() di lib/grading.js menghasilkan id Indonesia
// (Rendah/Moderat/Tinggi/Ekstrim), sedangkan validasi backend untuk
// body.gradingAwal minta salah satu dari HIJAU|BIRU|KUNING|MERAH.
// Urutan tingkat keparahan menaik: Rendah < Moderat < Tinggi < Ekstrim,
// dipetakan ke Biru < Hijau < Kuning < Merah. SEGERA KONFIRMASI ke
// backend kalau ternyata urutan warnanya beda dari asumsi ini.
const GRADING_ID_KE_WARNA_BACKEND = {
  Rendah: "BIRU",
  Moderat: "HIJAU",
  Tinggi: "KUNING",
  Ekstrim: "MERAH",
};

// datetime-local (mis. "2026-07-20T10:30") -> date-only ("2026-07-20").
// Backend menolak payload lama dengan pesan "expected date, received Date"
// untuk body.tanggalKejadian - dugaan kuat backend cuma mau tanggal tanpa
// jam. Kalau ternyata backend justru butuh jamnya juga, ini perlu
// dikonfirmasi ulang dan fungsi ini disesuaikan.
function keTanggalSaja(nilaiDatetimeLocal) {
  if (!nilaiDatetimeLocal) return nilaiDatetimeLocal;
  return nilaiDatetimeLocal.split("T")[0];
}

// Lampiran menerima JPG/PNG/PDF dengan batas total 25MB. Batas per file
// sama dengan batas total agar satu file bisa menggunakan seluruh kapasitas.
export const MAX_TOTAL_LAMPIRAN_SIZE = 25 * 1024 * 1024; // 25MB
export const MAX_LAMPIRAN_SIZE = MAX_TOTAL_LAMPIRAN_SIZE;
export const ALLOWED_LAMPIRAN_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

/**
 * Validasi satu file lampiran sebelum ditambahkan ke daftar upload.
 * @param {File} file
 * @returns {string|null} pesan error, atau null kalau valid
 */
export function validasiLampiran(file) {
  if (!ALLOWED_LAMPIRAN_TYPES.includes(file.type)) {
    return `"${file.name}" ditolak — hanya boleh JPG, PNG, atau PDF.`;
  }
  if (file.size > MAX_LAMPIRAN_SIZE) {
    return `"${file.name}" ditolak — ukuran maksimal 25 MB.`;
  }
  return null;
}

// ⚠️ SEMENTARA (menunggu daftar lengkap pilihan dropdown "Kategori
// Pelapor" di FormStep1.jsx): backend cuma terima salah satu dari
// PASIEN_SENDIRI|KELUARGA|STAF|LAIN_LAIN (dikonfirmasi lewat pesan
// error validasi 400 asli: body.kategoriPelaporPertama). Fallback di
// bawah ini menebak dari POLA KATA di label dropdown - PERLU DIGANTI
// dengan pemetaan eksplisit 1-ke-1 begitu daftar lengkap pilihannya
// diketahui, supaya tidak salah kategori secara diam-diam.
function keKategoriPelaporBackend(labelDropdown) {
  if (!labelDropdown) return "LAIN_LAIN";
  const lower = labelDropdown.toLowerCase();
  if (lower.includes("karyawan") || lower.includes("staf")) return "STAF";
  if (lower.includes("keluarga")) return "KELUARGA";
  if (lower.includes("pasien")) return "PASIEN_SENDIRI";
  return "LAIN_LAIN";
}

function unwrap(res) {
  return res.data?.data ?? res.data;
}

// ── Resolve nilai dropdown "Lain-lain"/"Lain-Lain" ke teks custom ──────────
// Ditambahkan 24 Juli 2026 bareng fitur input custom di FormStep1.jsx.
// Kalau user pilih opsi "Lain-lain" lalu tulis teks sendiri, teks itu yang
// dikirim ke backend menggantikan literal "Lain-lain" — BUKAN dikirim
// sebagai field terpisah, supaya tidak perlu kolom baru di backend untuk
// tiap dropdown (field tujuan tetap sama seperti sebelumnya, cuma isinya
// yang lebih spesifik).
//
// ⚠️ BUG LAMA yang ikut diperbaiki di sini: namaFasilitasCustom SUDAH
// ditangkap di form sejak sebelumnya, tapi TIDAK PERNAH benar-benar
// dipakai di sini — field namaFasilitas yang dikirim ke backend tetap
// literal "Lain-lain" apa adanya, teks custom-nya hilang. Sekarang
// dibenarkan lewat resolveLainLain() di bawah, sama seperti field lain.
function resolveLainLain(value, customValue) {
  if ((value === "Lain-lain" || value === "Lain-Lain") && customValue?.trim()) {
    return customValue.trim();
  }
  return value;
}

// ── Mapping "Ada Korban" (UI) → boolean strict (backend) ──────────────────
// 🐛 BUG DITEMUKAN 27 Juli 2026: backend menolak POST /reports dengan pesan
// "body.adaKorban: Invalid input: expected boolean, received string" —
// field `dataFasilitas.adaKorban` di UI (FormStep1.jsx, card "Apakah Ada
// Pihak yang Terdampak/Terluka?") SEBENARNYA 3 pilihan teks: "Tidak Ada",
// "Potensi Bahaya", "Ada Korban" — bukan toggle Ya/Tidak. Backend cuma mau
// boolean murni, jadi 3 nilai ini harus dipetakan, TIDAK BISA dikirim apa
// adanya lagi.
//
// KEPUTUSAN USER (27 Juli 2026): "Potensi Bahaya" dipetakan ke `true`
// (dianggap ada korban/risiko) — bukan `false`. Jadi cuma "Tidak Ada" yang
// jadi `false`; "Potensi Bahaya" dan "Ada Korban" sama-sama `true`.
//
// ⚠️ CATATAN PENTING: mapping ini KEHILANGAN NUANSA "Potensi Bahaya" vs
// "Ada Korban" aktual begitu sampai ke backend (keduanya sama-sama true).
// Kalau nanti dibutuhkan detail levelnya lagi di sisi backend/pelaporan,
// perlu diusulkan ke tim BE supaya field ini didukung sebagai 3-level
// (bukan boolean), atau ditambah field terpisah untuk simpan level aslinya
// tanpa mengubah kontrak `adaKorban` yang sudah boolean.
function adaKorbanKeBoolean(nilaiUi) {
  if (nilaiUi === "Tidak Ada") return false;
  if (nilaiUi === "Potensi Bahaya" || nilaiUi === "Ada Korban") return true;
  // Nilai kosong/belum dipilih (laporan bukan tipe fasilitas, atau field
  // belum diisi) — jangan paksa jadi false, biarkan undefined supaya tidak
  // mengirim `adaKorban: false` untuk laporan yang bukan tipe fasilitas.
  return undefined;
}

// ── Kirim Laporan Baru ────────────────────────────────────────────────────
// Dipanggil di BuatLaporanPage.jsx saat nakes klik "Kirim Laporan" di Step 4.
//
// payloadMentah berisi data form APA ADANYA — belum ada
// gradingAwal/gradingSaatIni/jenisInvestigasi/status. Semua itu di-enrich di
// sini, supaya BuatLaporanPage.jsx tidak perlu tahu aturan bisnisnya.
//
// @param {object} payloadMentah
// @param {File[]} [files] - file lampiran yang sudah lolos validasiLampiran()
// @returns {Promise<{id: string}>}
export async function kirimLaporan(payloadMentah, files = []) {
  const { dampak, probabilitas, gradingKeparahan } =
    payloadMentah.grading || {};

  // Hitung ulang grading di sini (jangan cuma percaya nilai yang sudah
  // dihitung di frontend) — backend sungguhan kemungkinan besar juga
  // menghitung ulang, tapi ini tetap dikirim sebagai referensi/fallback.
  const gradingFinal = hitungGrading(dampak, probabilitas) || gradingKeparahan;
  const infoJenisInvestigasi = tentukanJenisInvestigasi(gradingFinal);

  const payload = {
    ...payloadMentah,

    // ── Field WAJIB backend, dikirim FLAT di top-level body ──────────
    // (lihat pesan validasi 400 asli: body.jenisInsiden, body.lokasi,
    // body.unitKerja, body.kronologi, body.dampak, body.tanggalKejadian,
    // body.gradingAwal - semua diharapkan ada langsung di root, BUKAN
    // bersarang di dalam objek kronologi{}/grading{} seperti sebelumnya).
    // ✅ DIKONFIRMASI lewat GET /admin/reports/:id sungguhan: keenam field
    // ini sudah tersimpan dengan benar (nilai muncul, bukan null) — jadi
    // flatten di bawah ini SUDAH BENAR, tidak perlu diubah lagi.
    jenisInsiden: payloadMentah.kronologi?.jenisInsiden,
    tanggalKejadian: keTanggalSaja(payloadMentah.kronologi?.tanggalKejadian),
    lokasi: resolveLainLain(
      payloadMentah.kronologi?.lokasiKejadian,
      payloadMentah.kronologi?.lokasiKejadianCustom,
    ),
    unitKerja: resolveLainLain(
      payloadMentah.kronologi?.unitPenyebab,
      payloadMentah.kronologi?.unitPenyebabCustom,
    ),
    // PENTING: field "kronologi" di top-level ini SENGAJA menimpa objek
    // "kronologi" yang ikut ter-spread dari payloadMentah di atas - backend
    // mau field ini berupa STRING narasi (isi kronologiSingkat), bukan
    // objek section. Objek section aslinya tetap tersimpan di bawah lewat
    // spread ...payloadMentah, cuma namanya beda (lihat catatan bagian
    // "data mentah lengkap" kalau backend ternyata masih butuh itu juga).
    kronologi: payloadMentah.kronologi?.kronologiSingkat,
    dampak: payloadMentah.grading?.dampak,
    gradingAwal: GRADING_ID_KE_WARNA_BACKEND[gradingFinal] ?? null,

    // ── Field data pasien & pelapor, di-flatten ke top-level ──────────
    // ✅ Nama-nama field di bawah ini DIKONFIRMASI ADA sebagai kolom asli
    // di response GET /admin/reports/:id (walau isinya masih null di
    // laporan yang sudah dites, karena versi lama kirimLaporan belum
    // pernah mengirimnya). Sebelumnya field ini nyasar di dalam objek
    // nested dataPasien{}/dataFasilitas{} yang tidak pernah dibaca
    // backend, makanya semua tampil null/kosong di halaman admin.
    //
    // ⚠️ Ejaan beberapa nama field ini (terutama
    // statusPasienSaatMasukRs & kasusSpesialisasi) diambil dari
    // screenshot response, JADI ADA RISIKO SALAH KETIK/BEDA HURUF.
    // Kalau setelah dites field ini masih tetap null, cek dulu response
    // JSON asli (bukan screenshot) untuk mastikan ejaan persis sebelum
    // curiga ke tempat lain.
    namaPasien: payloadMentah.dataPasien?.namaPasien,
    noRekamMedis: payloadMentah.dataPasien?.noMR,
    jenisKelaminPasien: payloadMentah.dataPasien?.jenisKelamin,
    ruanganPasien: resolveLainLain(
      payloadMentah.dataPasien?.ruangan,
      payloadMentah.dataPasien?.ruanganCustom,
    ),
    // ✅ Dikoreksi 24 Juli 2026 sesuai konfirmasi resmi tim backend: nama
    // field yang benar adalah "statusPasienSaatInsiden" (bukan
    // "statusPasienSaatMasukInsiden" seperti tebakan sebelumnya). Enum
    // value yang diterima backend: RAWAT_INAP, RAWAT_JALAN, IGD, LAIN_LAIN.
    statusPasienSaatInsiden: payloadMentah.dataPasien?.statusPasien,
    tanggalJamMasukRs: payloadMentah.dataPasien?.tanggalMasuk,
    penanggungBiaya: resolveLainLain(
      payloadMentah.dataPasien?.penanggungBiaya,
      payloadMentah.dataPasien?.penanggungBiayaCustom,
    ),
    // ⚠️ payloadMentah.dataPasien?.kategoriPelaporCustom (teks custom kalau
    // user pilih "Lain-lain") SENGAJA BELUM dipakai di sini — nilai
    // kategoriPelapor selalu dipetakan paksa ke salah satu dari
    // STAF|KELUARGA|PASIEN_SENDIRI|LAIN_LAIN, jadi teks bebas apa pun akan
    // tetap jadi LAIN_LAIN di backend tanpa ada tempat menyimpan teksnya.
    // PERLU DIKONFIRMASI BE: apakah ada field terpisah untuk teks bebas ini
    // (mis. kategoriPelaporLainnya) sebelum teks custom-nya ikut dikirim.
    kategoriPelaporPertama: keKategoriPelaporBackend(
      payloadMentah.dataPasien?.kategoriPelapor,
    ),
    // Field "pelapor" SENGAJA tidak dikirim — laporan bersifat anonim
    // (isAnonim: true), identitas pelapor tidak dipakai di alur ini.
    // Kategori pelapor (kategoriPelaporPertama di bawah) tetap dikirim
    // karena berguna buat admin tanpa membuka identitas personal.
    pihakTerlibat: payloadMentah.kronologi?.pihakTerlibat,
    kasusSpesialisasi: resolveLainLain(
      payloadMentah.kronologi?.spesialisasiTerkait,
      payloadMentah.kronologi?.spesialisasiTerkaitCustom,
    ),
    akibatTerhadapPasien: payloadMentah.kronologi?.akibatInsiden,
    apakahKejadianSerupaPernahTerjadi:
      payloadMentah.analisis?.kejadianSerupaTerjadi === "Ya",

    // ✅ DIKONFIRMASI BACKEND (24 Juli 2026): field-field ini sudah
    // terverifikasi tersimpan & muncul dengan benar di
    // GET /admin/reports/:id (end-to-end di production). Nama field di
    // bawah ini SUDAH SESUAI, tidak perlu diubah. Laporan yang dibuat
    // SEBELUM tanggal 24 Juli 2026 kemungkinan besar tetap kosong di
    // database (dikirim saat backend belum menyimpan kolom ini) — itu
    // bukan bug, cuma data lama. Laporan baru sejak tanggal ini
    // seharusnya sudah tersimpan dengan benar.
    tindakanDilakukan: payloadMentah.analisis?.tindakanDilakukan,
    tindakanDilakukanOleh: payloadMentah.analisis?.tindakanDilakukanOleh,
    akarPenyebab: payloadMentah.analisis?.akarPenyebab,
    rekomendasi: payloadMentah.analisis?.rekomendasi,
    kejadianSerupaDetail: payloadMentah.analisis?.kejadianSerupaDetail,

    // 🧪 PERCOBAAN 24 Juli 2026 — SEBELUMNYA field fasilitas ini SENGAJA
    // TIDAK di-flatten (cuma nyangkut sebagai objek nested
    // payloadMentah.dataFasilitas/kronologi lewat spread ...payloadMentah,
    // yang kemungkinan besar diabaikan backend karena bukan field
    // top-level yang dikenali — sama seperti pola data pasien SEBELUM
    // di-flatten). Sekarang di-flatten ke top-level, nama field TUJUAN
    // mengikuti yang sudah dipakai di DetailLaporanPageAdmin.jsx.
    //
    // ✅ Nama key SUMBER di bawah ini SUDAH DICOCOKKAN ke
    // BuatLaporanPage.jsx (24 Juli 2026) — bukan tebakan lagi:
    //   - kategoriFasilitas, namaFasilitas, kodeInventaris,
    //     kondisiFasilitas, penanggungJawabFasilitas, adaKorban ada di
    //     dalam payloadMentah.dataFasilitas.
    //   - kategoriKerusakan, statusPenangananAwal, tindakanDarurat
    //     TERNYATA BUKAN di dataFasilitas, tapi di-spread ke dalam
    //     payloadMentah.kronologi (lihat kronologi: {...(!melibatkanPasien
    //     && { kategoriKerusakan, statusPenangananAwal, tindakanDarurat })}
    //     di BuatLaporanPage.jsx) — jadi sumbernya beda dari 6 field
    //     lainnya, JANGAN disamakan ke dataFasilitas lagi.
    //
    // ⚠️ MASIH ASUMSI DI SISI TUJUAN SAJA: nama field yang backend
    // simpan (kategoriFasilitas, dst di top-level) belum dikonfirmasi
    // langsung oleh tim BE — cuma diasumsikan konsisten dengan pola
    // penamaan data pasien. WAJIB DITES: submit 1 laporan tipe fasilitas,
    // lalu cek GET /admin/reports/:id. Kalau field masih kosong padahal
    // payload yang terkirim (cek Network tab) sudah berisi nilai yang
    // benar, berarti backend pakai nama field lain — perlu konfirmasi BE.
    kategoriFasilitas: resolveLainLain(
      payloadMentah.dataFasilitas?.kategoriFasilitas,
      payloadMentah.dataFasilitas?.kategoriFasilitasCustom,
    ),
    namaFasilitas: resolveLainLain(
      payloadMentah.dataFasilitas?.namaFasilitas,
      payloadMentah.dataFasilitas?.namaFasilitasCustom,
    ),
    kodeInventaris: payloadMentah.dataFasilitas?.kodeInventaris,
    kondisiFasilitas: resolveLainLain(
      payloadMentah.dataFasilitas?.kondisiFasilitas,
      payloadMentah.dataFasilitas?.kondisiFasilitasCustom,
    ),
    penanggungJawabFasilitas: resolveLainLain(
      payloadMentah.dataFasilitas?.penanggungJawabFasilitas,
      payloadMentah.dataFasilitas?.penanggungJawabFasilitasCustom,
    ),
    adaKorban: adaKorbanKeBoolean(payloadMentah.dataFasilitas?.adaKorban),
    kategoriKerusakan: resolveLainLain(
      payloadMentah.kronologi?.kategoriKerusakan,
      payloadMentah.kronologi?.kategoriKerusakanCustom,
    ),
    statusPenangananAwal: payloadMentah.kronologi?.statusPenangananAwal,
    tindakanDarurat: payloadMentah.kronologi?.tindakanDarurat,
    grading: {
      ...payloadMentah.grading,
      gradingAwal: gradingFinal,
      gradingSaatIni: gradingFinal,
    },
    jenisInvestigasi: infoJenisInvestigasi?.id ?? null,
    status: "Menunggu Investigasi",
  };

  // ── LANGKAH 1: kirim data laporan utama (JSON biasa, TANPA lampiran) ──
  // Lampiran BUKAN bagian dari body ini — endpoint /reports cuma mau data
  // laporan. Kalau langkah ini gagal (validasi/network), lempar error
  // sebelum sempat coba upload lampiran sama sekali.
  let laporanId;
  try {
    const res = await apiClient.post("/reports", payload);
    const result = unwrap(res);
    laporanId = result?.id;
  } catch (err) {
    // Backend (kalau menolak validasi) balikin pesan detail di
    // err.response.data.message - tampilkan itu apa adanya ke pemanggil
    // supaya errornya jelas tanpa perlu buka DevTools tiap kali.
    const pesanBackend = err.response?.data?.message;
    if (pesanBackend) {
      throw new Error(pesanBackend);
    }
    throw err;
  }

  // ── LANGKAH 2: kalau ada lampiran, upload TERPISAH setelah dapat id ────
  // Endpoint ini beda dari POST /reports di atas, dan field name harus
  // "file" (dikonfirmasi lewat dokumen backend), bukan "lampiran".
  //
  // ✅ BUG DITEMUKAN & DIPERBAIKI 22 Jul 2026: sebelumnya semua file
  // digabung ke SATU FormData dengan key "file" yang sama lalu dikirim
  // dalam SATU request. Ini gagal dengan response
  // {"success":false,"message":"Error upload file: Unexpected field..."}
  // begitu user upload LEBIH DARI 1 lampiran — dikonfirmasi lewat
  // DevTools Network tab. Sebabnya: backend pakai middleware multer
  // .single('file') (lihat uploadMiddleware.single('file') di
  // reports.routes.ts), yang cuma menerima SATU file per request untuk
  // field itu; file kedua dengan nama field sama langsung ditolak
  // multer dengan pesan persis ini.
  //
  // Perbaikan: kirim tiap file lewat REQUEST TERPISAH (loop), bukan
  // digabung dalam satu FormData. Upload dijalankan berurutan
  // (sequential, bukan Promise.all paralel) supaya tidak membebani
  // endpoint publik ini sekaligus (ada rate limit 429 di endpoint ini
  // sesuai spec) dan supaya progres/kegagalan per file mudah dilacak.
  let lampiranGagal = [];
  if (files.length > 0 && laporanId) {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        // PENTING: JANGAN set header Content-Type manual di sini — browser
        // yang harus menentukan boundary multipart-nya sendiri.
        // apiClient.js sudah menangani ini otomatis lewat interceptor
        // (menghapus Content-Type kalau data instanceof FormData).
        await apiClient.post(`/reports/${laporanId}/attachments`, formData);
      } catch (err) {
        // Laporan utama SUDAH berhasil dibuat di langkah 1 — jangan lempar
        // error di sini seolah-olah seluruh laporan gagal terkirim (nakes
        // sudah dapat konfirmasi laporan masuk). Lanjut ke file berikutnya
        // (satu file gagal tidak boleh menggagalkan file lain yang valid),
        // catat nama filenya supaya pemanggil bisa kasih tahu user file
        // mana saja yang gagal.
        console.error(`Gagal mengunggah lampiran "${file.name}":`, err);
        lampiranGagal.push(file.name);
      }
    }
  }

  if (lampiranGagal.length > 0) {
    return { id: laporanId, lampiranGagal };
  }

  return { id: laporanId };
}

// ── Simpan Draft Laporan ──────────────────────────────────────────────────
// Dipanggil saat nakes klik "Simpan sebagai Draft" di Step 1.
// Catatan: karena akses anonim (tanpa akun), draft ini bersifat sementara
// di sisi perangkat/browser saja — bukan draft yang tersimpan ke akun user.
export async function simpanDraft(payload) {
  const res = await apiClient.post("/reports/draft", payload);
  return unwrap(res);
}
