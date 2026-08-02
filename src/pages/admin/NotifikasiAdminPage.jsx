import { useState, useEffect } from "react";
import {
  FileText,
  AlertTriangle,
  MessageSquare,
  CheckCircle2,
  CheckCheck,
  MoreVertical,
  Search,
  Send,
  AlertCircle,
  RefreshCw,
  Eye,
  Trash2,
  X,
  Archive,
} from "lucide-react";
import {
  getNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaDibaca,
} from "../../services/admin/notifikasiService";
import {
  getRiwayatPengumuman,
  kirimPengumuman,
  hapusPengumuman,
} from "../../services/admin/pengumumanService";
import {
  getPertanyaanEskalasi,
  jawabPertanyaanEskalasi,
} from "../../services/chatbot/chatbotService"; // sesuaikan path sebenarnya

// ── Label & rute per tipe notifikasi ────────────────────────────────────
// ✅ Update tim BE 24 Juli 2026: field `tipe` sekarang SELALU salah satu
// dari 5 nilai ini (UPPERCASE, sebelumnya kadang cuma "PENGUMUMAN" untuk
// semua kejadian). LABEL_TIPE_NOTIFIKASI di bawah cuma untuk tampilan
// (dropdown/heading kartu) — nilai asli dari backend tetap dipakai apa
// adanya di tempat lain (mis. dikirim balik ke endpoint).
const LABEL_TIPE_NOTIFIKASI = {
  LAPORAN: "Laporan Baru",
  SENTINEL: "Insiden Sentinel",
  CHATBOT: "Chatbot",
  INVESTIGASI: "Investigasi",
  UPDATE: "Update Status",
};

// referensiId (field baru dari BE) cuma diisi untuk tipe LAPORAN &
// INVESTIGASI, isinya id laporan terkait — dipakai untuk tombol "Lihat
// Laporan Terkait" ke halaman detail laporan admin.
// ✅ DIKOREKSI 24 Juli 2026: app ini TIDAK pakai react-router path per
// halaman admin — App.jsx pakai state adminActivePage + callback
// onNavigate(page, id) yang di-drill lewat props (lihat AdminRoute &
// handleAdminNavigate di App.jsx). Jadi navigasi ke detail laporan di
// sini WAJIB lewat prop onNavigate yang diteruskan dari App.jsx, BUKAN
// useNavigate()/react-router. "detail-laporan" adalah nilai page yang
// sama persis dipakai halaman lain (mis. ManajemenInsidenPage) untuk
// pindah ke DetailLaporanPageAdmin.
const TIPE_DENGAN_REFERENSI_LAPORAN = ["LAPORAN", "INVESTIGASI"];

export default function NotifikasiAdminPage({
  onNavigate,
  onUnreadCountChange,
}) {
  // ── State Form Pengumuman ────────────────────────────────────────────────
  const [judul, setJudul] = useState("");
  const [isiPengumuman, setIsiPengumuman] = useState("");
  const [targetPenerima, setTargetPenerima] = useState("SEMUA");
  const [isSending, setIsSending] = useState(false);

  // ── State Data dari "Backend" (lewat service) ────────────────────────────
  const [notifikasi, setNotifikasi] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ── State Search (khusus di UI, belum difilter ke backend) ───────────────
  const [searchQuery, setSearchQuery] = useState("");

  // ── Toggle "Notifikasi Lama" (✅ 27 Juli 2026 — kebijakan retensi &
  // archive notifikasi) ────────────────────────────────────────────────
  // false (default) → getNotifikasi() dipanggil TANPA param includeArchived
  // sama sekali, persis perilaku lama (backward compatible, sesuai
  // dokumen BE). true → kirim includeArchived:true, backend ikut
  // tampilkan notifikasi yang sudah isArchived:true.
  const [showArchived, setShowArchived] = useState(false);

  // ── State untuk batasi jumlah notifikasi yang tampil ─────────────────────
  // Defaultnya hanya tampilkan beberapa item dulu (JUMLAH_NOTIF_AWAL),
  // biar list-nya tidak langsung panjang ke bawah. User bisa klik
  // "Lihat Semua Notifikasi" untuk expand semuanya, atau "Sembunyikan"
  // untuk collapse lagi.
  const JUMLAH_NOTIF_AWAL = 5;
  const [showAllNotif, setShowAllNotif] = useState(false);

  // ── State dropdown titik tiga di kartu Riwayat Pengumuman ────────────────
  const [openMenuId, setOpenMenuId] = useState(null);
  const [detailRiwayat, setDetailRiwayat] = useState(null);
  const [detailNotif, setDetailNotif] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [chatbotModalNotif, setChatbotModalNotif] = useState(null);
  const [pertanyaanEskalasi, setPertanyaanEskalasi] = useState(null);
  const [loadingPertanyaan, setLoadingPertanyaan] = useState(false);
  const [errorPertanyaan, setErrorPertanyaan] = useState(null);
  const [jawabanInput, setJawabanInput] = useState("");
  const [isSubmittingJawaban, setIsSubmittingJawaban] = useState(false);
  // Ambil data notifikasi + riwayat pengumuman dari service.
  // Nanti kalau backend sudah siap, function ini otomatis akan memanggil
  // API asli karena isi getNotifikasi()/getRiwayatPengumuman() di
  // notifikasiService.js yang diganti, bukan bagian ini.
  const fetchData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Ambil notifikasi & riwayat secara paralel biar lebih cepat.
      // ✅ 27 Juli 2026: includeArchived ikut dikirim sesuai state toggle
      // "Notifikasi Lama" (showArchived) — lihat notifikasiService.js
      // untuk detail param ini.
      const [dataNotifikasi, dataRiwayat] = await Promise.all([
        getNotifikasi({ includeArchived: showArchived }),
        getRiwayatPengumuman(),
      ]);

      // getNotifikasi() balikin objek { items, total, page, limit } sesuai
      // notifikasiService.js, BUKAN array langsung - ambil .items-nya.
      // Fallback berlapis jaga-jaga kalau ternyata backend balikin bentuk
      // lain dari dugaan (mis. array langsung, atau field beda nama).
      console.info(
        "[NotifikasiAdminPage] Raw response getNotifikasi (buat cek nama field):",
        dataNotifikasi,
      );
      const listNotifikasi = Array.isArray(dataNotifikasi)
        ? dataNotifikasi
        : Array.isArray(dataNotifikasi?.items)
          ? dataNotifikasi.items
          : [];
      setNotifikasi(listNotifikasi);
      // ✅ BARU 26 Juli 2026: sinkronkan badge Bell di topbar (App.jsx)
      // dengan data isRead ASLI dari backend begitu list ini selesai
      // dimuat — supaya badge tidak pernah "berbohong" (misal masih
      // nunjukin 0 padahal ada notif belum dibaca yang masuk lewat
      // Socket.io sebelum halaman ini pernah dibuka).
      onUnreadCountChange?.(listNotifikasi.filter((n) => !n.isRead).length);

      // getRiwayatPengumuman() didokumentasikan balikin array pengumuman
      // langsung, tapi tambahkan fallback yang sama untuk jaga-jaga.
      const listRiwayat = Array.isArray(dataRiwayat)
        ? dataRiwayat
        : Array.isArray(dataRiwayat?.items)
          ? dataRiwayat.items
          : [];
      setRiwayat(listRiwayat);
    } catch (err) {
      console.error("Gagal memuat data notifikasi:", err);
      setLoadError("Gagal memuat data notifikasi. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refetch juga saat toggle "Notifikasi Lama" berubah, supaya list
    // langsung update mengikuti param includeArchived yang baru — fetchData
    // sendiri tidak di-useCallback/memo, jadi cukup taruh showArchived di
    // dependency array (closure di dalam fetchData otomatis baca state
    // terbaru tiap kali effect ini jalan ulang).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  const getIconByType = (type) => {
    // ✅ BUG DIPERBAIKI 24 Juli 2026: key di objek ini lowercase, tapi
    // backend selalu kirim `tipe` UPPERCASE (LAPORAN/SENTINEL/dst) —
    // sebelumnya icons[type] SELALU undefined utk semua tipe, jadi ikon
    // yang tampil selalu fallback ke ikon laporan. Sekarang di-lowercase
    // dulu sebelum lookup.
    const icons = {
      laporan: <FileText className="h-5 w-5 text-blue-600" />,
      sentinel: <AlertTriangle className="h-5 w-5 text-red-600" />,
      chatbot: <MessageSquare className="h-5 w-5 text-purple-600" />,
      investigasi: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      update: <FileText className="h-5 w-5 text-slate-600" />,
    };
    return icons[(type || "").toLowerCase()] || icons.laporan;
  };

  // Kirim pengumuman baru lewat service, lalu masukkan hasilnya ke riwayat
  // secara langsung (optimistic update) supaya tidak perlu fetch ulang.
  const handleKirimPengumuman = async () => {
    if (!judul.trim() || !isiPengumuman.trim()) {
      alert("Judul dan isi pengumuman harus diisi!");
      return;
    }

    setIsSending(true);
    try {
      // kirimPengumuman() sudah unwrap respons di service (res.data?.data
      // ?? res.data), jadi hasilnya langsung objek pengumuman yang baru
      // dibuat - bukan { success, data }.
      const pengumumanBaru = await kirimPengumuman({
        judul,
        isi: isiPengumuman,
        targetRole: targetPenerima,
      });

      // Tambahkan pengumuman baru ke paling atas daftar riwayat
      setRiwayat((prev) => [pengumumanBaru, ...prev]);
      alert("Pengumuman berhasil dikirim!");
      setJudul("");
      setIsiPengumuman("");
      setTargetPenerima("SEMUA");
    } catch (err) {
      console.error("Gagal mengirim pengumuman:", err);
      alert("Gagal mengirim pengumuman. Silakan coba lagi.");
    } finally {
      setIsSending(false);
    }
  };

  // Filter notifikasi di sisi client berdasarkan search bar.
  // ✅ BUG DIPERBAIKI 24 Juli 2026: sebelumnya filter baca notif.judul &
  // notif.deskripsi — DUA FIELD ITU TIDAK PERNAH ADA di objek notifikasi
  // asli backend (struktur asli cuma {id,userId,tipe,pesan,referensiId,
  // isRead,createdAt}, dikonfirmasi dari dokumen BE), jadi search selama
  // ini tidak pernah match apa pun. Sekarang filter dari `pesan` (isi
  // notifikasi) dan label tipe yang readable.
  // Kalau nanti datanya sudah banyak/dari backend, ini sebaiknya diganti
  // jadi query parameter ke API (misal getNotifikasi({ search: searchQuery }))
  // supaya pencariannya dilakukan di server, bukan di browser.
  const filteredNotifikasi = notifikasi.filter((notif) => {
    const q = searchQuery.toLowerCase();
    const label = LABEL_TIPE_NOTIFIKASI[notif.tipe] || notif.tipe || "";
    return (
      (notif.pesan ?? "").toLowerCase().includes(q) ||
      label.toLowerCase().includes(q)
    );
  });

  // Notifikasi yang benar-benar dirender: dipotong ke JUMLAH_NOTIF_AWAL
  // kecuali user sudah klik "Lihat Semua Notifikasi".
  const displayedNotifikasi = showAllNotif
    ? filteredNotifikasi
    : filteredNotifikasi.slice(0, JUMLAH_NOTIF_AWAL);
  const masihAdaSisa = filteredNotifikasi.length > JUMLAH_NOTIF_AWAL;

  // Ada berapa notifikasi yang belum dibaca (buat tombol "Tandai semua
  // dibaca" - cuma tampil kalau memang masih ada yang belum dibaca)
  const jumlahBelumDibaca = notifikasi.filter((n) => !n.isRead).length;

  // Klik 1 notifikasi → tandai dibaca ke backend, lalu update tampilan
  // (bukan dihapus dari list, cuma hilang highlight birunya - sesuai
  // konsep notifikasi pada umumnya).
  const handleBacaNotifikasi = async (notif) => {
    if (!notif.isRead) {
      try {
        await tandaiNotifikasiDibaca(notif.id);
        setNotifikasi((prev) => {
          const updated = prev.map((n) =>
            n.id === notif.id ? { ...n, isRead: true } : n,
          );
          // ✅ BARU 26 Juli 2026: turunkan badge Bell tepat 1 begitu
          // notifikasi ini benar-benar ditandai dibaca — bukan di-nol-kan
          // borongan cuma karena admin membuka halaman ini (lihat catatan
          // di handleAdminNavigate, App.jsx).
          onUnreadCountChange?.(updated.filter((n) => !n.isRead).length);
          return updated;
        });
      } catch (err) {
        console.error("Gagal menandai notifikasi dibaca:", err);
      }
    }

    // Tipe CHATBOT buka modal jawab eskalasi, bukan modal detail biasa
    // (keputusan 26 Juli 2026 — lebih ringkas daripada pindah halaman)
    if (notif.tipe === "CHATBOT" && notif.referensiId) {
      handleBukaEskalasiChatbot(notif);
      return;
    }

    setDetailNotif(notif);
  };

  // Buka modal + fetch detail pertanyaan eskalasi
  const handleBukaEskalasiChatbot = async (notif) => {
    setChatbotModalNotif(notif);
    setPertanyaanEskalasi(null);
    setErrorPertanyaan(null);
    setJawabanInput("");
    setLoadingPertanyaan(true);
    try {
      const data = await getPertanyaanEskalasi(notif.referensiId);
      setPertanyaanEskalasi(data);
    } catch (err) {
      console.error("Gagal memuat pertanyaan eskalasi:", err);
      setErrorPertanyaan("Gagal memuat pertanyaan. Silakan coba lagi.");
    } finally {
      setLoadingPertanyaan(false);
    }
  };

  // Kirim jawaban admin
  const handleKirimJawaban = async () => {
    const trimmed = jawabanInput.trim();
    if (trimmed.length < 3 || trimmed.length > 2000) {
      alert("Jawaban harus 3–2000 karakter.");
      return;
    }
    setIsSubmittingJawaban(true);
    try {
      await jawabPertanyaanEskalasi(chatbotModalNotif.referensiId, trimmed);
      setPertanyaanEskalasi((prev) => ({
        ...prev,
        status: "TERJAWAB",
        jawaban: trimmed,
      }));
      alert("Jawaban tersimpan dan otomatis masuk ke knowledge base chatbot.");
    } catch (err) {
      console.error("Gagal mengirim jawaban:", err);
      alert("Gagal mengirim jawaban. Silakan coba lagi.");
    } finally {
      setIsSubmittingJawaban(false);
    }
  };

  // Navigasi ke halaman detail laporan terkait, dipakai tombol "Lihat
  // Laporan Terkait" (fitur referensiId, update BE 24 Juli 2026).
  // stopPropagation supaya tidak ikut memicu onClick kartu notifikasi
  // (yang membuka modal detail) saat tombol ini yang diklik.
  // Kalau onNavigate belum diteruskan dari App.jsx (mis. lupa di-wiring),
  // tombol tetap aman — cuma tidak melakukan apa-apa, tidak crash.
  const handleLihatLaporanTerkait = (e, referensiId) => {
    e.stopPropagation();
    if (!referensiId || !onNavigate) return;
    onNavigate("detail-laporan", referensiId);
  };

  // Tandai SEMUA notifikasi sebagai dibaca sekaligus
  const handleTandaiSemuaDibaca = async () => {
    try {
      await tandaiSemuaDibaca();
      setNotifikasi((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onUnreadCountChange?.(0);
    } catch (err) {
      console.error("Gagal menandai semua notifikasi dibaca:", err);
      alert("Gagal menandai semua notifikasi sebagai dibaca.");
    }
  };

  // Tutup dropdown, lalu tampilkan detail riwayat di dalam kartu
  const handleLihatDetail = (item) => {
    setDetailRiwayat(item);
    setOpenMenuId(null);
  };

  // Hapus 1 item riwayat: panggil DELETE ke backend dulu lewat
  // hapusPengumuman(id) dari pengumumanService, baru hapus dari state
  // kalau requestnya berhasil. Kalau gagal, item TIDAK dihapus dari
  // tampilan supaya data di layar tetap sinkron dengan backend.
  const handleHapusRiwayat = async (id) => {
    setOpenMenuId(null);
    setDeletingId(id);
    try {
      await hapusPengumuman(id);
      setRiwayat((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Gagal menghapus riwayat pengumuman:", err);
      alert("Gagal menghapus pengumuman. Silakan coba lagi.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Search Header */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Cari laporan atau unit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 pl-12 pr-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Main Content - 2 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Kolom Kiri: Pusat Notifikasi */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">
                Pusat Notifikasi
              </h2>
              <div className="flex items-center gap-3">
                {jumlahBelumDibaca > 0 && (
                  <button
                    onClick={handleTandaiSemuaDibaca}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tandai semua dibaca ({jumlahBelumDibaca})
                  </button>
                )}
                {/* ✅ 27 Juli 2026 — toggle "Notifikasi Lama": panggil ulang
                    getNotifikasi() dengan includeArchived:true supaya
                    notifikasi yang sudah di-archive otomatis (isRead lebih
                    dari 30 hari) ikut ditampilkan, dibedakan tampilannya
                    lewat styling pudar (lihat kondisi notif.isArchived di
                    render list di bawah). */}
                <button
                  type="button"
                  onClick={() => setShowArchived((prev) => !prev)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    showArchived
                      ? "border-blue-200 bg-blue-50 text-blue-600"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {showArchived ? "Sembunyikan Lama" : "Notifikasi Lama"}
                </button>
              </div>
            </div>

            {/* State: Loading */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-20 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : loadError ? (
              /* State: Error */
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                  <AlertCircle className="h-6 w-6 text-red-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  {loadError}
                </p>
                <button
                  onClick={fetchData}
                  className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Coba Lagi
                </button>
              </div>
            ) : filteredNotifikasi.length > 0 ? (
              /* State: Notifikasi List */
              <div className="space-y-3">
                {displayedNotifikasi.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleBacaNotifikasi(notif)}
                    className={`rounded-lg p-4 border-l-4 transition cursor-pointer ${
                      notif.isArchived
                        ? // ✅ 27 Juli 2026: notifikasi yang sudah diarsipkan
                          // otomatis (isRead > 30 hari) ditampilkan lebih
                          // pudar, hanya muncul saat toggle "Notifikasi
                          // Lama" aktif — supaya admin tetap bisa bedakan
                          // dari notifikasi aktif tanpa perlu buka detail.
                          "border-l-slate-200 bg-slate-50/70 opacity-60 hover:opacity-100"
                        : notif.isRead
                          ? "border-l-slate-300 bg-slate-50 hover:bg-slate-100"
                          : "border-l-blue-500 bg-blue-50 hover:bg-blue-100"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getIconByType(notif.tipe)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                          {LABEL_TIPE_NOTIFIKASI[notif.tipe] || notif.tipe}
                          {notif.isArchived && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                              <Archive className="h-2.5 w-2.5" />
                              Diarsipkan
                            </span>
                          )}
                        </h3>

                        <p className="text-xs text-slate-600 mt-1">
                          {notif.pesan}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-[10px] text-slate-500">
                            {new Date(notif.createdAt).toLocaleString("id-ID")}
                          </p>
                          {/* ✅ Field baru `readAt` dari dokumen retensi BE
                              27 Juli 2026 — tampilkan kapan pertama kali
                              dibaca kalau ada. */}
                          {notif.readAt && (
                            <p className="text-[10px] text-slate-400">
                              Dibaca{" "}
                              {new Date(notif.readAt).toLocaleString("id-ID")}
                            </p>
                          )}
                          {TIPE_DENGAN_REFERENSI_LAPORAN.includes(notif.tipe) &&
                            notif.referensiId && (
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleLihatLaporanTerkait(
                                    e,
                                    notif.referensiId,
                                  )
                                }
                                className="text-[10px] font-semibold text-blue-600 hover:underline"
                              >
                                Lihat Laporan Terkait →
                              </button>
                            )}
                        </div>
                      </div>
                      {!notif.isRead && (
                        <div className="flex-shrink-0 h-2.5 w-2.5 rounded-full bg-blue-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* State: Kosong */
              <div className="py-10 text-center">
                <p className="text-sm font-semibold text-slate-500">
                  Tidak ada notifikasi.
                </p>
              </div>
            )}

            {/* Link Lihat Semua / Sembunyikan - hanya tampil kalau datanya
                memang lebih banyak dari batas awal */}
            {!isLoading && !loadError && masihAdaSisa && (
              <button
                onClick={() => setShowAllNotif((prev) => !prev)}
                className="w-full text-center text-sm font-semibold text-blue-600 hover:underline mt-4"
              >
                {showAllNotif
                  ? "Sembunyikan"
                  : `Lihat Semua Notifikasi (${filteredNotifikasi.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Buat Pengumuman + Riwayat */}
        <div className="lg:col-span-1 space-y-6">
          {/* Buat Pengumuman Form */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800 mb-4">
              Buat Pengumuman
            </h2>

            {/* Judul Pengumuman */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Judul Pengumuman
              </label>
              <input
                type="text"
                placeholder="Contoh: Pemeliharaan Sistem SMART-ROSE"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                disabled={isSending}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
              />
            </div>

            {/* Isi Pengumuman */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Isi Pengumuman
              </label>
              <textarea
                placeholder="Tuliskan detail informasi di sini..."
                value={isiPengumuman}
                onChange={(e) => setIsiPengumuman(e.target.value)}
                disabled={isSending}
                rows="4"
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none disabled:bg-slate-50"
              />
            </div>

            {/* Target Penerima */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Target Penerima
              </label>
              <select
                value={targetPenerima}
                onChange={(e) => setTargetPenerima(e.target.value)}
                disabled={isSending}
                className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
              >
                <option value="SEMUA">Semua Pengguna</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {/* Kirim Button */}
            <button
              onClick={handleKirimPengumuman}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {isSending ? "Mengirim..." : "Kirim Pengumuman"}
            </button>
          </div>

          {/* Riwayat Pengumuman */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-800">
                Riwayat Pengumuman
              </h2>
              <button className="text-sm font-semibold text-blue-600 hover:underline">
                Lihat Semua Riwayat
              </button>
            </div>

            {/* State: Loading */}
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-14 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
            ) : riwayat.length > 0 ? (
              /* State: Riwayat List */
              <div className="space-y-3">
                {riwayat.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-50 transition"
                  >
                    <div>{getIconByType(item.tipe)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {item.judul}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.tanggal}
                      </p>
                    </div>
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() =>
                          setOpenMenuId(openMenuId === item.id ? null : item.id)
                        }
                        className="p-1 hover:bg-slate-200 rounded-lg transition"
                      >
                        <MoreVertical className="h-4 w-4 text-slate-400" />
                      </button>

                      {openMenuId === item.id && (
                        <>
                          {/* Overlay untuk menutup dropdown saat klik di luar */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                            <button
                              onClick={() => handleLihatDetail(item)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Lihat Detail
                            </button>
                            <button
                              onClick={() => handleHapusRiwayat(item.id)}
                              disabled={deletingId === item.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingId === item.id
                                ? "Menghapus..."
                                : "Hapus"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* State: Kosong */
              <p className="py-6 text-center text-sm font-semibold text-slate-500">
                Belum ada riwayat pengumuman.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal Detail Notifikasi */}
      {detailNotif && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDetailNotif(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800">
                Detail Notifikasi
              </h2>
              <button
                onClick={() => setDetailNotif(null)}
                className="rounded-lg p-1 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-2">
                {getIconByType(detailNotif.tipe)}
                <p className="text-sm font-bold text-slate-800">
                  {LABEL_TIPE_NOTIFIKASI[detailNotif.tipe] || detailNotif.tipe}
                </p>
                {!detailNotif.isRead && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                    Baru
                  </span>
                )}
                {detailNotif.isArchived && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    <Archive className="h-2.5 w-2.5" />
                    Diarsipkan
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 leading-relaxed border-t border-slate-100 pt-3">
                {detailNotif.pesan}
              </p>
              <p className="text-xs text-slate-500">
                {new Date(detailNotif.createdAt).toLocaleString("id-ID")}
              </p>
              {/* ✅ Field baru dari dokumen retensi BE 27 Juli 2026 */}
              {detailNotif.readAt && (
                <p className="text-xs text-slate-400">
                  Dibaca pertama kali:{" "}
                  {new Date(detailNotif.readAt).toLocaleString("id-ID")}
                </p>
              )}
              {detailNotif.archivedAt && (
                <p className="text-xs text-slate-400">
                  Diarsipkan pada:{" "}
                  {new Date(detailNotif.archivedAt).toLocaleString("id-ID")}
                </p>
              )}
              {TIPE_DENGAN_REFERENSI_LAPORAN.includes(detailNotif.tipe) &&
                detailNotif.referensiId && (
                  <button
                    type="button"
                    onClick={(e) =>
                      handleLihatLaporanTerkait(e, detailNotif.referensiId)
                    }
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Lihat Laporan Terkait →
                  </button>
                )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setDetailNotif(null)}
                className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal Detail Riwayat */}
      {detailRiwayat && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setDetailRiwayat(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800">
                Detail Pengumuman
              </h2>
              <button
                onClick={() => setDetailRiwayat(null)}
                className="rounded-lg p-1 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="flex items-center gap-2">
                {getIconByType(detailRiwayat.tipe)}
                <p className="text-sm font-bold text-slate-800">
                  {detailRiwayat.judul}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Dikirim pada: {detailRiwayat.tanggal}
              </p>
              {/* PERLU DIKONFIRMASI: field respons GET /admin/announcements
                  belum didokumentasikan backend. Fallback ke nama field
                  lama (isiPengumuman/targetPenerima) jaga-jaga kalau
                  ternyata itu yang dipakai backend, tapi field resmi
                  seharusnya isi/targetRole (lihat pengumumanService.js). */}
              {(detailRiwayat.isi || detailRiwayat.isiPengumuman) && (
                <p className="text-sm text-slate-700 leading-relaxed border-t border-slate-100 pt-3">
                  {detailRiwayat.isi || detailRiwayat.isiPengumuman}
                </p>
              )}
              {(detailRiwayat.targetRole || detailRiwayat.targetPenerima) && (
                <p className="text-xs text-slate-500">
                  Target Penerima:{" "}
                  <span className="font-semibold text-slate-700">
                    {detailRiwayat.targetRole || detailRiwayat.targetPenerima}
                  </span>
                </p>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setDetailRiwayat(null)}
                className="w-full rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </>
      )}
      {/* Modal Eskalasi Chatbot */}
      {chatbotModalNotif && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setChatbotModalNotif(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Pertanyaan Chatbot
              </h2>
              <button
                onClick={() => setChatbotModalNotif(null)}
                className="rounded-lg p-1 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {loadingPertanyaan ? (
                <div className="space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
              ) : errorPertanyaan ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-500 mb-2">{errorPertanyaan}</p>
                  <button
                    onClick={() => handleBukaEskalasiChatbot(chatbotModalNotif)}
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Coba lagi
                  </button>
                </div>
              ) : pertanyaanEskalasi ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1">
                      Pertanyaan dari user:
                    </p>
                    <p className="text-sm text-slate-800 rounded-lg bg-slate-50 p-3">
                      {pertanyaanEskalasi.pertanyaan}
                    </p>
                  </div>

                  {pertanyaanEskalasi.status === "TERJAWAB" ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">
                        Jawaban admin:
                      </p>
                      {pertanyaanEskalasi.jawaban ? (
                        <p className="text-sm text-slate-700 rounded-lg border border-green-100 bg-green-50 p-3">
                          {pertanyaanEskalasi.jawaban}
                        </p>
                      ) : (
                        // ⚠️ FALLBACK sementara — backend saat ini belum
                        // mengirim teks jawaban lewat GET /chatbot/pertanyaan/:id
                        // (response cuma {id,pertanyaan,namaUser,createdAt,status},
                        // tidak ada field jawaban sama sekali walau status sudah
                        // TERJAWAB). Setelah tim BE tambahkan field itu, blok ini
                        // otomatis tidak lagi kepakai karena kondisi di atas akan
                        // true — boleh dihapus kapan saja kalau mau lebih ringkas.
                        <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 p-3">
                          <CheckCheck className="h-4 w-4 shrink-0 text-green-600 mt-0.5" />
                          <p className="text-sm text-slate-700">
                            Pertanyaan ini sudah dijawab admin.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">
                        Jawaban Anda:
                      </label>
                      <textarea
                        value={jawabanInput}
                        onChange={(e) => setJawabanInput(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        placeholder="Tulis jawaban untuk pertanyaan ini..."
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none resize-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1 text-right">
                        {jawabanInput.trim().length}/2000
                      </p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex gap-2">
              <button
                onClick={() => setChatbotModalNotif(null)}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              {pertanyaanEskalasi &&
                pertanyaanEskalasi.status !== "TERJAWAB" && (
                  <button
                    onClick={handleKirimJawaban}
                    disabled={
                      isSubmittingJawaban ||
                      jawabanInput.trim().length < 3 ||
                      jawabanInput.trim().length > 2000
                    }
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {isSubmittingJawaban ? "Mengirim..." : "Kirim Jawaban"}
                  </button>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
