// src/services/admin/detailInvestigasiService.js
// ============================================================
// VERSI TERHUBUNG KE BACKEND ASLI — menggantikan versi dummy in-memory.
//
// KONTRAK FILE INI DIJAGA IDENTIK dengan versi dummy sebelumnya: nama
// fungsi, STATUS_RCA, JENIS_INVESTIGASI, parameter, dan bentuk return
// (nested: tim/dataInformasi/petaKronologi/analisisLimaWhy/dst) SAMA
// PERSIS — supaya DetailInvestigasiPage.jsx TIDAK PERLU diubah sama
// sekali. Semua penerjemahan ke/dari skema flat backend terjadi HANYA
// di dalam file ini (lihat mapPayloadKeBackend / mapResponseKeFormatFrontend
// di bawah).
//
// ⚠️ IMPORT apiClient DI BAWAH INI TEBAKAN PATH — samakan dengan yang
// dipakai detailLaporanService.js / userManagementService.js di proyek
// Anda kalau ternyata beda. Cukup ganti baris import ini saja, tidak ada
// bagian lain di file ini yang perlu ikut berubah.
import { apiClient } from "../../lib/apiClient";

// ============================================================
// 🔴 RINGKASAN ASUMSI & CELAH YANG BELUM DIKONFIRMASI KE BACKEND
// (diperbarui 21 Juli 2026 setelah dapat pesan validasi 400 asli dari
// backend — beberapa poin di bawah ini SUDAH terjawab, ditandai ✅):
//
// 1. STATUS / ALUR PERSETUJUAN RCA — masih TIDAK ADA di spec resmi sama
//    sekali (tidak ada field status, tidak ada endpoint approval
//    terpisah). Solusi sementara di file ini:
//      a. ✅ KONFIRMASI: field `status` & field2 di luar spec
//         (metodeAnalisis, insiden, observasi, dokumentasi,
//         ringkasanLaporan, interview) TERBUKTI diabaikan backend —
//         pesan validasi 400 yang diterima 21 Juli 2026 TIDAK PERNAH
//         menyebut field2 ini sama sekali, cuma field2 resmi di spec.
//         Aman tetap dikirim.
//      b. PATCH /reports/:id/rca/persetujuan dipanggil secara
//         SPEKULATIF di putuskanPersetujuan() — kalau backend balas
//         404/405, otomatis fallback ke cache lokal (RCA_STATUS_OVERRIDE)
//         supaya alur approval tetap bisa DITES di UI, tapi datanya
//         TIDAK sungguhan tersimpan di backend sampai endpoint ini
//         dikonfirmasi/dibuatkan. Ada console.warn yang muncul kalau ini
//         terjadi — perhatikan tab Console + Network saat tes. INI
//         BELUM DITES ULANG sejak perbaikan 21 Juli.
//
// 2. STRUKTUR DETAIL — ✅ SEBAGIAN BESAR SUDAH DIKONFIRMASI 21 Juli 2026
//    lewat pesan validasi Zod asli dari backend (bukan tebakan lagi):
//      - timelineEntries: {urutan (number, WAJIB), waktu (WAJIB),
//        kejadian, informasiTambahan, goodPractice, masalahPelayanan}.
//      - timePersonGridEntries: MASIH BELUM ADA form/section untuk ini
//        sama sekali di DetailInvestigasiPage.jsx — dikirim [] terus.
//        Backend belum sempat menolak field ini secara spesifik (body
//        test terakhir memang selalu []) jadi belum jelas apakah backend
//        menerima array kosong atau ada isian wajib di dalamnya.
//      - fiveWhyEntries: {urutan (number, WAJIB — global lintas
//        baris/poin), urutanMasalah, urutanWhy, jawaban}.
//      - masalahAwal5Why: ✅ WAJIB diisi (string, tidak boleh kosong) —
//        sebelumnya dikirim "" dan bikin 400. Belum ada field form
//        terpisah untuk ini — sementara dipetakan dari textarea "Insiden
//        (uraian singkat)" (payload.insiden). GANTI kalau nanti section
//        form khusus ditambah.
//      - fishboneEntries: {urutan (number, WAJIB), kategori (WAJIB,
//        enum uppercase persis: MAN|METHOD|MATERIAL|MACHINE|
//        MEASUREMENT|ENVIRONMENT — form saat ini cuma punya 4 opsi
//        Man/Method/Measurement/Material, belum ada Machine &
//        Environment sebagai pilihan dropdown), penyebab (string, nama
//        field BUKAN "deskripsi" seperti dugaan lama).
//      - rencanaPerbaikanEntries: ✅ BUKAN 2 daftar dibedakan `tipe`
//        seperti asumsi lama — backend minta 1 entry GABUNGAN per
//        pasangan: {urutan, akarMasalah, rekomendasiSolusi,
//        tindakanPerbaikan, pelaksana, targetWaktu}. Form saat ini masih
//        2 daftar independen (rekomendasi & jadwal) yang dipasangkan
//        BERDASAR INDEKS di mapper ini — kalau backend sebenarnya mau
//        pasangan yang berbeda dari urutan baris, form perlu diubah jadi
//        1 daftar gabungan supaya user sendiri yang memasangkan.
//
// RENCANA VALIDASI LANJUTAN: field2 yang sudah diperbaiki di atas belum
// ditest ulang end-to-end (submit sampai 200 sukses) — baru dites sampai
// dapat pesan 400 detail. Test lagi dari awal: simpan draft, buka ulang
// halaman, upload lampiran, ajukan persetujuan, setuju/revisi admin
// utama, assign tim, reload tiap aksi.
// ============================================================

export const STATUS_RCA = {
  DRAFT: "DRAFT",
  MENUNGGU_PERSETUJUAN: "MENUNGGU_PERSETUJUAN",
  DISETUJUI: "DISETUJUI",
  PERLU_REVISI: "PERLU_REVISI",
  FINAL: "FINAL",
};

export const JENIS_INVESTIGASI = {
  SEDERHANA: "SEDERHANA",
  RCA_LENGKAP: "RCA_LENGKAP",
};

// ------------------------------------------------------------
// Cache lokal SEMENTARA untuk status/catatanRevisi, key = reportId.
// HANYA fallback selama field ini belum dikonfirmasi tersimpan di
// backend (lihat poin 1 di atas) — BUKAN sumber data utama, dan TIDAK
// persisten lintas device/browser lain. Begitu backend mengembalikan
// field `status` sendiri di response GET/PUT /rca, cache ini otomatis
// tidak lagi dipakai (lihat mapResponseKeFormatFrontend).
// ------------------------------------------------------------
const RCA_STATUS_OVERRIDE = new Map();

// Generator ID lokal untuk baris/kolom hasil rekonstruksi dari backend
// (petaKronologi, fishbone, rekomendasi, jadwal) — backend tidak/belum
// tentu mengirim id per-baris, padahal form butuh id untuk key React &
// fungsi update/hapus baris.
let localIdSeq = 0;
const buatIdLokal = (prefix) => `${prefix}_${Date.now()}_${localIdSeq++}`;

// 🔧 FIX 23 Juli 2026 (investigasi bug "form kosong setelah reload" —
// AKAR MASALAH SEBENARNYA, bukan hydrate/race condition seperti dugaan
// sebelumnya): dikonfirmasi dari response JSON asli GET /reports/:id/rca
// lewat Network tab — SEMUA endpoint RCA membungkus datanya dalam amplop
// `{ success, message, data: {...} }`, BUKAN mengembalikan objek RCA
// langsung di top-level seperti yang diasumsikan kode sebelumnya
// (`const raw = res?.data ?? res` cuma buka satu lapis axios `res.data`,
// tidak buka lapis amplop `{success,message,data}` backend di dalamnya).
//
// Akibatnya SELAMA INI `raw.masalahAwal5Why`, `raw.status`,
// `raw.timelineEntries`, dst SELALU `undefined` (field aslinya ada di
// `raw.data.masalahAwal5Why` dst) — TAPI `raw` sendiri tetap truthy
// (amplopnya "ada"), jadi `rca === null` check di getInvestigasiDetail()
// tidak pernah kena, dan tidak ada error apapun yang muncul. Form
// kelihatan kosong bukan karena hydrate gagal jalan, tapi karena data
// yang di-hydrate memang kosong sejak dibaca dari response.
//
// Helper ini buka DUA lapis: lapis axios (res.data) lalu lapis amplop
// backend (body.data) — dengan deteksi supaya tetap aman kalau suatu
// endpoint ternyata TIDAK dibungkus amplop (mengembalikan objek RCA
// langsung), supaya tidak salah unwrap jadi `undefined`.
function unwrapApiEnvelope(res) {
  const body = res?.data ?? res;
  if (
    body &&
    typeof body === "object" &&
    "data" in body &&
    ("success" in body || "message" in body)
  ) {
    return body.data;
  }
  return body;
}

// ============================================================
// Mapper: payload form (nested, dari buildPayload() di
// DetailInvestigasiPage.jsx) -> body request sesuai skema flat backend.
// ============================================================
function mapPayloadKeBackend(payload) {
  return {
    // 🔧 FIX 25 Juli 2026: DIKONFIRMASI dari response asli PUT /rca (lewat
    // Network tab) — nama field backend BUKAN timKetua/timSekretaris/
    // timAnggota seperti tebakan sebelumnya, tapi timKetuaLegacyText/
    // timSekretarisLegacyText/timAnggotaLegacyText. Backend TIDAK error
    // 400 saat nama field salah (field yang tidak dikenali diam-diam
    // dibuang, sama seperti kasus metodeAnalisis) — jadi bug ini kelihatan
    // "sukses" padahal data Tim tidak pernah tersimpan sungguhan.
    // Field "...LegacyText" ini juga konsisten dengan keputusan desain
    // FE: Tim Investigasi di form ini murni teks manual (dicatat setelah
    // investigasi selesai lewat diskusi offline), bukan assign akun real
    // — lihat catatan di dekat import statement DetailInvestigasiPage.jsx.
    // Backend juga punya field terpisah `teamMembers` (array, masih
    // kosong di semua response yang dilihat sejauh ini) yang sepertinya
    // struktur relasional ke akun user asli — TIDAK dipakai di sini
    // karena tidak sesuai keputusan desain (manual text, bukan assign
    // akun), tapi worth dikonfirmasi ke BE apa fungsi field itu.
    timKetuaLegacyText: payload.tim?.ketuaTim || "",
    timSekretarisLegacyText: payload.tim?.sekretaris || "",
    timAnggotaLegacyText: payload.tim?.anggota || [],

    kronologiSingkat: payload.dataInformasi?.kronologiSingkat || "",

    // ✅ DIKONFIRMASI 21 Juli 2026 lewat pesan validasi backend: field ini
    // WAJIB diisi (sebelumnya dikirim "" dan bikin 400). Belum ada field
    // form terpisah untuk "pernyataan awal masalah 5 Why" (lihat GAP di
    // atas) — sebagai jembatan sementara, dipakai isi textarea "Insiden
    // (uraian singkat)" (payload.insiden) yang secara konsep memang
    // pernyataan awal masalah yang jadi pemicu analisis 5 Why. GANTI ke
    // field form khusus kalau nanti section-nya ditambah di
    // DetailInvestigasiPage.jsx.
    masalahAwal5Why:
      payload.insiden || payload.dataInformasi?.ringkasanLaporan || "",

    // ✅ DIKONFIRMASI: tiap entry butuh field "urutan" (number, terpisah
    // dari waktu/kejadian) — sebelumnya belum dikirim sama sekali.
    timelineEntries: (payload.petaKronologi || []).map((row, idx) => ({
      urutan: idx + 1,
      waktu: row.waktu || "",
      kejadian: row.kejadian || "",
      informasiTambahan: row.informasiTambahan || "",
      goodPractice: row.goodPractice || "",
      masalahPelayanan: row.masalahPelayanan || "",
    })),

    // 🔴 GAP: belum ada section/form "time-person grid" sama sekali.
    timePersonGridEntries: [],

    // ✅ DIKONFIRMASI 21 Juli 2026 lewat pesan validasi backend: array ini
    // harus KOSONG SAMA SEKALI atau TEPAT 5 item (sesuai metodologi 5 Why
    // yang selalu 5 tingkat "kenapa") — sebelumnya jumlah entry bebas
    // mengikuti isian user, ditolak kalau bukan 0 atau 5. Kalau user isi
    // kurang dari 5, dilengkapi otomatis dgn entry kosong sampai genap 5;
    // kalau lebih dari 5, dipotong ke 5 pertama; kalau tidak diisi sama
    // sekali, tetap dikirim array kosong (kondisi "kosong" yg diizinkan).
    fiveWhyEntries: (() => {
      const semua = (payload.analisisLimaWhy || []).flatMap((row, rowIdx) =>
        (row.poin || [])
          .map((jawaban, poinIdx) => ({
            jawaban,
            urutanMasalah: rowIdx + 1,
            urutanWhy: poinIdx + 1,
          }))
          .filter((entry) => entry.jawaban),
      );
      if (semua.length === 0) return [];
      const genap5 = semua.slice(0, 5);
      while (genap5.length < 5) {
        genap5.push({
          jawaban: "",
          urutanMasalah: 1,
          urutanWhy: genap5.length + 1,
        });
      }
      return genap5.map((entry, idx) => ({ ...entry, urutan: idx + 1 }));
    })(),

    // ✅ DIKONFIRMASI: kategori harus salah satu enum uppercase
    // MAN|METHOD|MATERIAL|MACHINE|MEASUREMENT|ENVIRONMENT (sebelumnya
    // dikirim label form apa adanya, mis. "Man" — ditolak); nama field
    // "deskripsi" salah, backend minta "penyebab"; dan tiap entry butuh
    // "urutan" (number) yang sebelumnya belum dikirim.
    fishboneEntries: (payload.analisisPenyebabMasalah || []).map((f, idx) => ({
      urutan: idx + 1,
      kategori: (f.kategori || "").trim().toUpperCase(),
      penyebab: f.deskripsi || "",
    })),

    // ✅ DIKONFIRMASI (menjawab pertanyaan poin 2c yang belum terjawab
    // sebelumnya): rencanaPerbaikanEntries BUKAN 2 daftar independen
    // dibedakan `tipe` seperti asumsi lama — backend minta 1 entry
    // GABUNGAN per pasangan berisi akarMasalah, rekomendasiSolusi,
    // tindakanPerbaikan, pelaksana, targetWaktu, urutan sekaligus.
    // Form saat ini masih memodelkan rekomendasi & jadwal sebagai 2
    // daftar independen yang jumlah barisnya bisa beda — dipasangkan
    // berdasar INDEKS (baris ke-1 rekomendasi dipasangkan dengan baris
    // ke-1 jadwal, dst). Kalau jumlah baris beda, sisi yang lebih pendek
    // diisi string kosong. Ini masih ASUMSI cara memasangkan — kalau
    // backend sebenarnya mau pasangan berbeda, form perlu diubah supaya
    // rekomendasi & jadwal jadi SATU daftar (bukan 2 daftar terpisah)
    // supaya penggunanya sendiri yang memasangkan.
    rencanaPerbaikanEntries: (() => {
      const rekomendasi = payload.rekomendasiRencanaKerja || [];
      const jadwal = payload.jadwalPerbaikan || [];
      const jumlah = Math.max(rekomendasi.length, jadwal.length);
      return Array.from({ length: jumlah }, (_, idx) => {
        const r = rekomendasi[idx];
        const j = jadwal[idx];
        return {
          urutan: idx + 1,
          akarMasalah: r?.akarMasalah || "",
          rekomendasiSolusi: r?.rekomendasi || "",
          tindakanPerbaikan: j?.kegiatan || "",
          pelaksana: j?.pelaksana || "",
          targetWaktu: j?.target || "",
        };
      });
    })(),

    // 🔴 Field di luar spec resmi (lihat catatan poin 1 di atas) — tetap
    // disertakan siapa tahu backend menyimpannya walau tidak
    // didokumentasikan.
    status: payload.status,

    // 🔴 Field yang TIDAK ADA padanannya sama sekali di spec
    // (metodeAnalisis, insiden, observasi, dokumentasi, ringkasanLaporan,
    // interview) — tetap disertakan sebagai field tambahan dengan asumsi
    // backend mengabaikan field yang tidak dikenalnya. KONFIRMASI 21 Juli
    // 2026: pesan validasi 400 dari backend TIDAK PERNAH menyebut field2
    // ini sama sekali (cuma menyebut field2 spec resmi) — asumsi ini
    // TERBUKTI BENAR, backend memang mengabaikan field tak dikenal.
    metodeAnalisis: payload.metodeAnalisis,
    insiden: payload.insiden,
    observasi: payload.dataInformasi?.observasi,
    dokumentasi: payload.dataInformasi?.dokumentasi,
    ringkasanLaporan: payload.dataInformasi?.ringkasanLaporan,
    // 🔧 FIX 23 Juli 2026: field asli backend bernama "daftarInterviewee"
    // (dikonfirmasi dari response GET /rca), BUKAN "interview" — nama lama
    // ini kemungkinan besar juga cuma diam-diam dibuang backend, sama
    // seperti kasus metodeAnalisis. Sudah dikonfirmasi lewat response GET
    // (raw.daftarInterviewee ada, raw.interview tidak pernah ada).
    daftarInterviewee: payload.dataInformasi?.interview || [],
  };
}

// ============================================================
// Mapper kebalikannya: response flat dari backend -> bentuk nested yang
// dipakai DetailInvestigasiPage.jsx (lewat hydrateFormFromRca()).
// ============================================================
function mapTimelineEntriesDariBackend(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => ({
    id: buatIdLokal("timeline"),
    waktu: e?.waktu ?? "",
    kejadian: e?.kejadian ?? "",
    informasiTambahan: e?.informasiTambahan ?? "",
    goodPractice: e?.goodPractice ?? "",
    masalahPelayanan: e?.masalahPelayanan ?? "",
  }));
}

function mapFiveWhyEntriesDariBackend(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const grouped = new Map();
  entries.forEach((e) => {
    const baris = e?.urutanMasalah ?? 1;
    if (!grouped.has(baris)) grouped.set(baris, []);
    grouped.get(baris).push(e);
  });
  return [...grouped.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, rowEntries]) => ({
      poin: rowEntries
        .slice()
        .sort((a, b) => (a?.urutanWhy ?? 0) - (b?.urutanWhy ?? 0))
        .map((e) => e?.jawaban ?? ""),
    }));
}

function mapFishboneEntriesDariBackend(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((e) => ({
    id: buatIdLokal("fishbone"),
    kategori: e?.kategori ?? "",
    // 🔧 FIX 23 Juli 2026: backend menyimpan & mengembalikan field ini
    // sebagai "penyebab" (dikonfirmasi 21 Juli lewat pesan validasi Zod,
    // lihat catatan di mapPayloadKeBackend), BUKAN "deskripsi". Sebelumnya
    // baca "e?.deskripsi" yang selalu undefined dari response asli
    // backend, jadi deskripsi fishbone selalu tampil kosong tiap reload
    // walau tersimpan benar di backend. Frontend (DetailInvestigasiPage.jsx)
    // tetap pakai nama "deskripsi" secara internal, jadi konversi terjadi
    // di sini saja.
    deskripsi: e?.penyebab ?? e?.deskripsi ?? "",
  }));
}

function splitRencanaPerbaikanEntriesDariBackend(entries) {
  const list = Array.isArray(entries) ? entries : [];

  // 🔧 FIX 23 Juli 2026: versi lama filter pakai `e?.tipe === "rekomendasi"`
  // / `"jadwal"` — tapi field `tipe` itu TIDAK PERNAH ada di payload yang
  // dikirim ke backend (lihat mapPayloadKeBackend: rencanaPerbaikanEntries
  // cuma berisi {urutan, akarMasalah, rekomendasiSolusi, tindakanPerbaikan,
  // pelaksana, targetWaktu} — 1 entry gabungan per pasangan, BUKAN 2 entry
  // dibedakan tipe). Backend pasti juga tidak mengembalikan field `tipe`
  // karena tidak pernah menyimpannya, jadi filter ini SELALU cocok 0 entry
  // dan Bagian 7 (Rekomendasi) + Bagian 8 (Jadwal Perbaikan) selalu tampil
  // kosong total tiap kali halaman dibuka ulang, walau data tersimpan
  // benar di backend.
  //
  // Perbaikan: setiap entry gabungan dipecah balik jadi 2 baris (satu di
  // rekomendasiRencanaKerja, satu di jadwalPerbaikan) berdasar INDEKS —
  // sama seperti cara mapPayloadKeBackend menggabungkannya waktu kirim.
  // Ini menjaga jumlah baris tetap sinkron di kedua bagian, sesuai fix
  // index-mismatch yang sudah diterapkan di form (Bagian 2.7).
  const rekomendasiRencanaKerja = list.map((e) => ({
    id: buatIdLokal("rekomendasi"),
    akarMasalah: e?.akarMasalah ?? "",
    rekomendasi: e?.rekomendasiSolusi ?? e?.rekomendasi ?? "",
  }));
  const jadwalPerbaikan = list.map((e) => ({
    id: buatIdLokal("jadwal"),
    kegiatan: e?.tindakanPerbaikan ?? e?.kegiatan ?? "",
    pelaksana: e?.pelaksana ?? "",
    target: e?.targetWaktu ?? e?.target ?? "",
  }));
  return { rekomendasiRencanaKerja, jadwalPerbaikan };
}

// 🔧 FIX 23 Juli 2026: dikonfirmasi dari response GET /rca asli — tiap
// item di `attachments` backend berbentuk {id, rcaId, fileUrl, objectPath,
// tipeFile, createdAt}, TIDAK PERNAH ada field `nama`/`url`/`ukuran`/`size`
// seperti diasumsikan sebelumnya (itu sebabnya lampiran lama tidak pernah
// muncul lagi setelah reload — bukan cuma soal amplop response, field-nya
// sendiri juga salah nama).
//
// 🔧 FIX LANJUTAN 23 Juli 2026: nama file ASLI yang diupload user TIDAK
// PERNAH disimpan backend sama sekali — backend cuma simpan nama file
// hasil generate UUID (lihat `objectPath`, mis. "a78c060c-...pdf"),
// bukan nama asli (mis. "foto-kejadian.pdf"). Ini BUKAN sesuatu yang bisa
// diperbaiki murni di frontend — nama aslinya sudah hilang sejak upload,
// tidak ada cara mengembalikannya tanpa backend menambah kolom baru utk
// menyimpannya. Sebagai perbaikan SEMENTARA supaya tampilan (terutama di
// versi Cetak/PDF) tidak menampilkan UUID mentah yang membingungkan,
// nama fallback diganti jadi label rapi "Lampiran <urutan>.<ekstensi>"
// (ekstensi tetap diambil dari objectPath/tipeFile supaya user masih tahu
// jenis filenya). Perbaikan PERMANEN perlu backend: tambah kolom
// `namaAsli` di tabel attachment, isi dari nama file asli saat upload
// (multipart Content-Disposition sudah membawa info ini, tinggal backend
// baca & simpan), lalu ikut dikembalikan di response GET.
function mapLampiranDariBackend(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, idx) => {
    if (item?.nama || item?.name || item?.filename) {
      return {
        nama: item.nama ?? item.name ?? item.filename,
        url: item?.fileUrl ?? item?.url ?? null,
        ukuran: item?.ukuran ?? item?.size ?? 0,
      };
    }
    const ekstensi = item?.objectPath?.includes(".")
      ? item.objectPath.split(".").pop()
      : (item?.tipeFile || "pdf").toLowerCase();
    return {
      nama: `Lampiran ${idx + 1}.${ekstensi}`,
      url: item?.fileUrl ?? item?.url ?? null,
      ukuran: item?.ukuran ?? item?.size ?? 0,
    };
  });
}

function mapResponseKeFormatFrontend(raw, reportId) {
  if (!raw) return null;

  const cacheLokal = RCA_STATUS_OVERRIDE.get(reportId) || {};
  const status = raw.status ?? cacheLokal.status ?? STATUS_RCA.DRAFT;
  const catatanRevisi = raw.catatanRevisi ?? cacheLokal.catatanRevisi ?? null;

  if (raw.status === undefined) {
    // eslint-disable-next-line no-console
    console.warn(
      "[detailInvestigasiService] Response GET/PUT /rca tidak menyertakan " +
        "field `status` — kemungkinan backend belum/tidak menyimpannya " +
        "(field ini memang tidak ada di spec resmi). UI sementara pakai " +
        "cache lokal sesi ini sebagai fallback, TAPI ini TIDAK persisten " +
        "lintas device/browser lain. Wajib dikonfirmasi ke tim backend.",
    );
  }

  const { rekomendasiRencanaKerja, jadwalPerbaikan } =
    splitRencanaPerbaikanEntriesDariBackend(raw.rencanaPerbaikanEntries);

  return {
    // Tim — nested (dipakai saveInvestigasi) sekaligus flat (kompatibilitas
    // lama). 🔧 FIX 25 Juli 2026: baca dari field asli backend
    // timKetuaLegacyText/timSekretarisLegacyText/timAnggotaLegacyText
    // (dikonfirmasi dari response PUT /rca asli), bukan timKetua/
    // timSekretaris/timAnggota seperti sebelumnya — lihat catatan detail
    // di mapPayloadKeBackend.
    tim: {
      ketuaTim: raw.timKetuaLegacyText ?? "",
      sekretaris: raw.timSekretarisLegacyText ?? "",
      anggota: raw.timAnggotaLegacyText ?? [],
    },
    investigatorUtama: raw.timKetuaLegacyText ?? "",
    sekretarisTim: raw.timSekretarisLegacyText ?? "",
    timAnggota: raw.timAnggotaLegacyText ?? [],

    dataInformasi: {
      kronologiSingkat: raw.kronologiSingkat ?? "",
      observasi: raw.observasi ?? "",
      dokumentasi: raw.dokumentasi ?? "",
      ringkasanLaporan: raw.ringkasanLaporan ?? {},
      interview: raw.daftarInterviewee ?? raw.interview ?? [],
    },

    petaKronologi: mapTimelineEntriesDariBackend(raw.timelineEntries),

    // BELUM ditampilkan di form manapun (lihat catatan poin 2) — disimpan
    // mentah supaya tidak hilang diam-diam kalau backend mengirimnya,
    // meski belum dipakai UI.
    _timePersonGridEntriesMentah: raw.timePersonGridEntries ?? [],
    _masalahAwal5WhyMentah: raw.masalahAwal5Why ?? "",

    analisisLimaWhy: mapFiveWhyEntriesDariBackend(raw.fiveWhyEntries),
    analisisPenyebabMasalah: mapFishboneEntriesDariBackend(raw.fishboneEntries),
    rekomendasiRencanaKerja,
    jadwalPerbaikan,

    lampiran: mapLampiranDariBackend(raw.attachments ?? raw.lampiran),

    // 🔧 FIX 23 Juli 2026 (revisi kedua, setelah lihat response JSON asli
    // lewat Network tab) — koreksi atas fix sebelumnya yang TERNYATA masih
    // salah:
    //
    // - `insiden`: raw.insiden TIDAK PERNAH ADA di response backend (sudah
    //   dikonfirmasi dari response asli). Field ini disimpan backend di
    //   bawah nama `masalahAwal5Why` — sesuai jembatan yang SUDAH dibuat di
    //   mapPayloadKeBackend 21 Juli (payload.insiden dikirim sebagai
    //   masalahAwal5Why). Jadi baca-baliknya juga harus dari
    //   raw.masalahAwal5Why, bukan raw.insiden. Datanya SEBENARNYA
    //   tersimpan aman di backend — cuma dibaca dari nama field yang salah.
    //
    // - `metodeAnalisis`: BEDA KASUS — field ini betul-betul TIDAK ADA di
    //   response backend sama sekali, tidak disimpan di field manapun
    //   (bukan cuma salah nama seperti insiden). Backend menerima field
    //   ini di body request (tidak bikin validasi 400) tapi diam-diam
    //   membuangnya, tidak pernah menyimpannya ke database. TIDAK ADA
    //   perbaikan yang bisa dilakukan murni di frontend untuk membuat data
    //   ini bertahan lintas reload/device — perlu field kolom baru di
    //   backend (mis. kolom `metodeAnalisis` di tabel RCA), SAMA seperti
    //   6 field yang sudah dilaporkan di bug report sebelumnya (lihat
    //   Bagian 3 ringkasan progres). Sebagai jembatan SEMENTARA (BUKAN
    //   solusi permanen), disimpan di cache lokal per-reportId supaya
    //   minimal tidak hilang kalau user pindah halaman lalu balik lagi
    //   DALAM SESI BROWSER YANG SAMA — begitu backend menambah field
    //   sungguhan, cache ini otomatis tidak lagi dipakai (lihat bawah).
    metodeAnalisis: raw.metodeAnalisis ?? cacheLokal.metodeAnalisis ?? "",
    insiden: raw.masalahAwal5Why ?? "",

    status,
    catatanRevisi,
  };
}

/**
 * Ambil data RCA untuk satu laporan.
 * Endpoint: GET /reports/:reportId/rca
 * @param {string} reportId
 * @returns {Promise<object|null>} null kalau laporan ini belum pernah
 *   punya RCA tersimpan sama sekali (backend balas 404) —
 *   DetailInvestigasiPage.jsx akan menganggap ini RCA baru.
 */
export async function getInvestigasiDetail(reportId) {
  try {
    const res = await apiClient.get(`/reports/${reportId}/rca`);
    const raw = unwrapApiEnvelope(res);
    if (!raw) return null;
    return mapResponseKeFormatFrontend(raw, reportId);
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/**
 * Simpan data RCA. isNew menentukan POST (create) vs PUT (update).
 * Endpoint: POST /reports/:reportId/rca (isNew) atau
 *           PUT  /reports/:reportId/rca (update)
 * @param {string} reportId
 * @param {object} payload isi form RCA lengkap + status yang mau disimpan
 * @param {{ isNew?: boolean }} [options]
 */
export async function saveInvestigasi(
  reportId,
  payload,
  { isNew = false } = {},
) {
  const body = mapPayloadKeBackend(payload);
  const res = isNew
    ? await apiClient.post(`/reports/${reportId}/rca`, body)
    : await apiClient.put(`/reports/${reportId}/rca`, body);
  const raw = unwrapApiEnvelope(res);

  // Simpan juga di cache lokal (lihat catatan poin 1 di atas) sampai
  // dikonfirmasi backend benar-benar menyimpan field ini sendiri.
  RCA_STATUS_OVERRIDE.set(reportId, {
    status: payload.status,
    catatanRevisi:
      payload.status === STATUS_RCA.PERLU_REVISI
        ? (payload.catatanRevisi ??
          RCA_STATUS_OVERRIDE.get(reportId)?.catatanRevisi ??
          null)
        : null,
    // FIX 23 Juli 2026: metodeAnalisis dikonfirmasi TIDAK disimpan
    // backend sama sekali (lihat catatan panjang di
    // mapResponseKeFormatFrontend) - cache lokal ini jembatan sementara
    // supaya nilainya minimal tidak hilang selama masih di sesi browser
    // yang sama (tab/reload), walau TIDAK persisten lintas device/browser
    // lain dan TIDAK tersimpan sungguhan di backend.
    metodeAnalisis: payload.metodeAnalisis ?? "",
  });

  return mapResponseKeFormatFrontend(raw ?? body, reportId);
}

/**
 * Hapus RCA suatu laporan.
 * Endpoint: DELETE /reports/:reportId/rca
 * @param {string} reportId
 */
export async function deleteInvestigasi(reportId) {
  await apiClient.delete(`/reports/${reportId}/rca`);
  RCA_STATUS_OVERRIDE.delete(reportId);
  return { success: true };
}

/**
 * Upload lampiran RCA (Bagian 9) — biner asli file, bukan cuma metadata.
 * Endpoint: POST /reports/:reportId/rca/attachments (field `file`, pola
 * sama dengan lampiran laporan awal).
 *
 * ⚠️ JANGAN set header Content-Type manual di sini. Axios (dipakai
 * apiClient) OTOMATIS mengisi "multipart/form-data; boundary=..." yang
 * benar begitu body-nya instance FormData. Kalau di-override manual jadi
 * cuma "multipart/form-data" TANPA boundary (seperti versi sebelumnya),
 * backend tidak bisa memecah bagian file di body request — muncul
 * sebagai error "Tipe file tidak dikenali atau file rusak" walau file
 * asli yang diupload valid (DIKONFIRMASI 21 Juli 2026 dari pesan error
 * ini persis).
 * @param {string} reportId
 * @param {File} file
 */
export async function uploadLampiranInvestigasi(reportId, file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiClient.post(
    `/reports/${reportId}/rca/attachments`,
    formData,
  );
  const raw = unwrapApiEnvelope(res);

  // 🔧 FIX 23 Juli 2026: dikonfirmasi dari response GET /rca asli (lewat
  // Network tab) — objek attachment backend TIDAK PERNAH punya field
  // `nama`/`url`/`ukuran`/`size` seperti diasumsikan sebelumnya. Field
  // aslinya `fileUrl` (signed URL lengkap), `objectPath` (path di storage,
  // nama file asli ada di segmen terakhirnya), `tipeFile`. Backend juga
  // tidak pernah mengembalikan ukuran file — pakai `file.size` dari objek
  // File lokal sebagai fallback (akurat, itu file yang sama yang baru
  // diupload).
  const namaDariObjectPath = raw?.objectPath
    ? raw.objectPath.split("/").pop()
    : null;

  return {
    nama: file?.name || namaDariObjectPath || "lampiran",
    url: raw?.fileUrl ?? raw?.url ?? "#",
    ukuran: file?.size ?? 0,
  };
}

/**
 * Export RCA ke PDF/Excel dari sisi server.
 * Endpoint: GET /reports/:reportId/rca/export?format=excel|pdf
 *
 * ✅ Endpoint ini SUDAH dikonfirmasi ADA di spec backend. TAPI
 * DetailInvestigasiPage.jsx SAAT INI tidak memanggil fungsi ini — tombol
 * "Unduh PDF" di halaman itu pakai solusi client-side (html2pdf.js) yang
 * sudah jalan lebih dulu. Fungsi ini disiapkan untuk dipakai KALAU/KAPAN
 * nanti diputuskan pindah ke export sisi server — sesuai catatan
 * sebelumnya, pemakaiannya OPSIONAL, bukan keharusan.
 * @param {string} reportId
 * @param {"pdf"|"excel"} [format]
 * @returns {Promise<Blob>}
 */
export async function exportInvestigasi(reportId, format = "pdf") {
  const res = await apiClient.get(`/reports/${reportId}/rca/export`, {
    params: { format },
    responseType: "blob",
  });
  return res?.data ?? res;
}

/**
 * Keputusan Admin Utama atas RCA yang statusnya MENUNGGU_PERSETUJUAN.
 * Endpoint (BELUM DIKONFIRMASI ADA — lihat catatan poin 1 di atas):
 * PATCH /reports/:reportId/rca/persetujuan
 * @param {string} reportId
 * @param {{ keputusan: "setuju"|"revisi", catatan?: string }} params
 * @returns {Promise<object>} data RCA yang sudah diupdate statusnya
 */
export async function putuskanPersetujuan(reportId, { keputusan, catatan }) {
  const statusBaru =
    keputusan === "setuju" ? STATUS_RCA.DISETUJUI : STATUS_RCA.PERLU_REVISI;
  const catatanRevisi = keputusan === "revisi" ? catatan || "" : null;

  // 🔧 FIX 23 Juli 2026: backend menolak (400 "Validasi gagal:
  // body.catatan: Invalid input...") kalau `catatan` dikirim sebagai
  // `null` eksplisit — polanya sama seperti field2 lain di backend ini
  // (lihat catatan masalahAwal5Why di atas): field yang ADA tapi bernilai
  // `null` beda dengan field yang TIDAK ADA sama sekali di body. Zod
  // (atau validator sejenis) di sisi backend kemungkinan pakai
  // `.optional()` yang cuma menerima `undefined`, bukan `.nullable()`
  // yang juga menerima `null` — jadi kirim `null` tetap dianggap "ada
  // nilai tapi tipenya salah", bukan "field kosong/tidak diisi".
  // Solusinya: bangun body secara kondisional, field `catatan` HANYA
  // disertakan kalau memang ada isinya (skenario "revisi"). Untuk
  // "setuju", body dikirim tanpa field `catatan` sama sekali.
  const body =
    catatanRevisi != null
      ? { keputusan, catatan: catatanRevisi }
      : { keputusan };

  try {
    const res = await apiClient.patch(
      `/reports/${reportId}/rca/persetujuan`,
      body,
    );
    const raw = unwrapApiEnvelope(res);
    RCA_STATUS_OVERRIDE.set(reportId, { status: statusBaru, catatanRevisi });
    return mapResponseKeFormatFrontend(raw ?? {}, reportId);
  } catch (err) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      // eslint-disable-next-line no-console
      console.warn(
        "[detailInvestigasiService] PATCH /rca/persetujuan tidak " +
          "ditemukan di backend (404/405) — endpoint approval memang " +
          "belum dikonfirmasi ada di spec. Status disimpan HANYA di cache " +
          "lokal sesi ini sebagai fallback sementara, BUKAN tersimpan " +
          "sungguhan di backend.",
      );
      RCA_STATUS_OVERRIDE.set(reportId, { status: statusBaru, catatanRevisi });
      const existing = await getInvestigasiDetail(reportId);
      return { ...(existing || {}), status: statusBaru, catatanRevisi };
    }
    throw err;
  }
}

// ✅ 25 Juli 2026: fungsi assignInvestigators() (POST /admin/reports/:id/
// assign) DIHAPUS dari file ini — tombol "Tugaskan" yang memanggilnya
// sudah dihapus dari DetailInvestigasiPage.jsx. Keputusan desain: Tim
// Investigasi di form RCA ini murni pencatatan manual (teks bebas,
// lihat timKetuaLegacyText dkk di atas), bukan lagi fitur assign akun +
// notifikasi real-time. Endpoint /admin/reports/:id/assign sendiri
// kemungkinan masih ada di backend (kaitannya dengan field `teamMembers`
// yang terlihat di response RCA — lihat catatan di mapPayloadKeBackend),
// tapi tidak lagi relevan dipakai dari halaman ini.

export default {
  STATUS_RCA,
  JENIS_INVESTIGASI,
  getInvestigasiDetail,
  saveInvestigasi,
  deleteInvestigasi,
  uploadLampiranInvestigasi,
  exportInvestigasi,
  putuskanPersetujuan,
};
