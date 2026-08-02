import { useState, useEffect, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";

// ── AUTH ───────────────────────────────────────────────────────────────────
// RegisterPage sudah dihapus: nakes tidak lagi butuh akun (anonim, langsung
// isi form), dan admin tidak self-register — admin utama di-setup langsung
// dari backend, admin biasa dibuatkan akunnya oleh admin utama lewat
// UserManagementPage (username/password diberikan manual).
import LoginPage from "./pages/auth/LoginPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
// ResetPasswordPage BARU (27 Juli 2026): tujuan link reset password di
// email (mis. https://smartrose.id/reset-password?token=xxx).
// Sebelumnya halaman ini tidak ada sama sekali — authService.resetPassword()
// sudah siap dipakai sejak lama, tapi tidak pernah punya UI pemicu.
// Didaftarkan sebagai ROUTE PUBLIK sungguhan di bawah (bukan lewat authView
// seperti LoginPage/ForgotPasswordPage), karena user bisa datang langsung
// dari klik link email tanpa pernah melalui AdminRoute lebih dulu.
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";

// ── ADMIN LAYOUT IMPORTS ──────────────────────────────────────────────────
import AdminNavMenu from "./components/layout/admin/AdminNavMenu";
import AdminTopbar from "./components/layout/admin/AdminTopbar";

// ── USER PAGES IMPORTS ────────────────────────────────────────────────────
// Sisi user disederhanakan: satu-satunya tampilan adalah form laporan,
// tanpa sidebar/topbar/Beranda, dan TANPA LOGIN (akses publik lewat QR).
// Halaman user lain (Beranda, Laporan Saya, Detail Laporan, Edukasi,
// Chatbot full-page, Notifikasi, Pengaturan Profil) sudah tidak dirender
// dari sini.
import BuatLaporanPage from "./pages/user/BuatLaporanPage";
import LandingLaporanPage from "./pages/user/LandingLaporanPage";

// ── ADMIN PAGES IMPORTS ───────────────────────────────────────────────────
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import ManajemenInsidenPage from "./pages/admin/ManajemenInsidenPage";
import DetailLaporanPageAdmin from "./pages/admin/DetailLaporanPageAdmin";
import LaporanBerhasilPage from "./pages/admin/LaporanBerhasilPage";
import AnalisisInvestigasiPage from "./pages/admin/AnalisisInvestigasiPage";
import DetailInvestigasiPage from "./pages/admin/DetailInvestigasiPage";
import HasilInvestigasiPage from "./pages/admin/HasilInvestigasiPage";
import NotifikasiAdminPage from "./pages/admin/NotifikasiAdminPage";
import AuditLogPage from "./pages/admin/AuditLogPage";
import UserManagementPage from "./pages/admin/UserManagementPage";
import PengaturanProfilAdminPage from "./pages/admin/PengaturanProfilAdminPage";
import InvestigasiSederhanaPage from "./pages/admin/InvestigasiSederhanaPage";
import { io } from "socket.io-client";

// ── SERVICES ──────────────────────────────────────────────────────────────
// PENTING: restoreSession()/logout() WAJIB dari authService.js, bukan
// getCurrentUser() dari dashboardService (itu bug lama — dashboardService
// tidak pernah mengurus sesi/token sama sekali, jadi tidak pernah bisa
// memulihkan/mengakhiri sesi login admin dengan benar).
import {
  restoreSession,
  logout as logoutFromServer,
  getStoredAccessToken,
} from "./services/auth/authService";
// ⚠️ ASUMSI PATH: disesuaikan dengan pola folder services/{auth,admin,user}/
// di proyek ini. Kalau notifikasiService.js sebenarnya ada di lokasi lain,
// sesuaikan path import di bawah ini saja — isi fungsinya tidak berubah.
import { getNotifikasi } from "./services/admin/notifikasiService";

// Socket.io connect ke domain langsung (bukan ke "/api" seperti REST) —
// sesuai dokumen update BE 24 Juli 2026. ⚠️ ASUMSI: kalau ada env var
// khusus utk socket (mis. VITE_SOCKET_URL) di proyek ini, ganti fallback
// di bawah supaya tidak hardcode.
const SOCKET_BASE_URL =
  import.meta?.env?.VITE_SOCKET_URL || "https://smartrose.id";

// ── RUTE PUBLIK: FORM LAPORAN (ANONIM, TANPA LOGIN) ────────────────────────
// Ini adalah tujuan QR code. Satu URL yang sama dipakai untuk semua
// ruangan/unit — nakes mengisi sendiri field Unit Kerja & Lokasi Kejadian
// di dalam form, tidak ada auto-fill dari parameter URL.
// Route ini SENGAJA tidak dibungkus pengecekan auth apa pun, supaya kamera
// HP bisa membuka form ini langsung tanpa nyangkut ke halaman login.
function LaporPublicRoute() {
  const navigate = useNavigate();
  return (
    <LandingLaporanPage
      namaInstansi="RSUD Contoh"
      onMulai={() => navigate("/lapor/form")}
    />
  );
}

// ── RUTE ADMIN: WAJIB LOGIN + ROLE ADMIN ───────────────────────────────────
function AdminRoute({
  isCheckingAuth,
  user,
  isAdmin,
  isSuperAdmin,
  authView,
  setAuthView,
  setUser,
  adminSidebarOpen,
  setAdminSidebarOpen,
  adminActivePage,
  setAdminActivePage,
  selectedLaporanId,
  onAdminNavigate,
  handleLogout,
  getAdminPageTitle,
  unreadCount,
  setUnreadCount,
}) {
  // ✅ FIX 27 Juli 2026 (infinite loop): SEBELUMNYA fungsi ini dibuat inline
  // langsung di JSX (`onUserUpdate={(patch) => setUser(...)}`), yang
  // artinya dapat reference BARU setiap kali AdminRoute render ulang.
  // PengaturanProfilAdminPage men-depend ke `onUserUpdate` di useCallback
  // fetchProfile-nya, jadi reference baru trus-menerus bikin fetchProfile
  // ikut baru terus, useEffect fetch-nya ke-trigger ulang tanpa henti,
  // yang lalu manggil onUserUpdate lagi -> setUser -> re-render -> ulang
  // dari awal (infinite loop). Ini kelihatan di Network tab sebagai
  // request `profile` & notifikasi (`me?page=1&limit=100`) yang spam
  // berulang tanpa henti.
  // FIX: bungkus dengan useCallback dengan dependency `[setUser]` (yang
  // stabil, tidak pernah berubah reference-nya) supaya `onUserUpdate`
  // sendiri jadi stabil lintas render — memutus rantai loop di atas.
  // useCallback ini WAJIB ditaruh sebelum early return manapun di bawah
  // (rules of hooks: urutan hook harus konsisten tiap render).
  const handleProfileUserUpdate = useCallback(
    (patch) => setUser((prev) => (prev ? { ...prev, ...patch } : prev)),
    [setUser],
  );

  // ── LOADING AWAL: sedang cek apakah ada sesi login tersimpan ─────────────
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Memuat...</p>
      </div>
    );
  }

  // ── BELUM LOGIN: tampilkan halaman Login / Lupa Kata Sandi ──────────────
  // (Tidak ada lagi halaman Daftar — admin tidak self-register.)
  if (!user) {
    if (authView === "lupa-kata-sandi") {
      return (
        <ForgotPasswordPage
          onNavigate={(page) => {
            if (page === "login") setAuthView("login");
          }}
        />
      );
    }

    return (
      <LoginPage
        onNavigate={(page) => {
          if (page === "lupa-kata-sandi") setAuthView("lupa-kata-sandi");
        }}
        onLoginSuccess={(loggedInUser) => {
          console.log("🔍 User yang login:", loggedInUser);
          setUser(loggedInUser);
          setAdminActivePage("admin-dashboard");
        }}
      />
    );
  }

  // ── SUDAH LOGIN TAPI BUKAN ADMIN: tidak berhak akses area admin ──────────
  if (!isAdmin) {
    return <Navigate to="/lapor" replace />;
  }

  // ── ADMIN: layout & routing lama, tidak diubah ───────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <AdminNavMenu
        user={user}
        activeMenu={adminActivePage}
        isOpen={adminSidebarOpen}
        onMenuToggle={() => setAdminSidebarOpen((prev) => !prev)}
        onNavigate={onAdminNavigate}
      />

      <div className="flex flex-1 flex-col h-screen overflow-hidden">
        <AdminTopbar
          onMenuToggle={() => setAdminSidebarOpen((prev) => !prev)}
          title={getAdminPageTitle()}
          onNavigate={onAdminNavigate}
          onLogout={handleLogout}
          hideBell={adminActivePage === "notifications"}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto relative print:static">
          {adminActivePage === "admin-dashboard" ? (
            <AdminDashboardPage />
          ) : adminActivePage === "incident-management" ? (
            <ManajemenInsidenPage onNavigate={onAdminNavigate} />
          ) : adminActivePage === "detail-laporan" ? (
            <DetailLaporanPageAdmin
              onNavigate={onAdminNavigate}
              laporanId={selectedLaporanId}
              user={user}
            />
          ) : adminActivePage === "investigasi-sederhana" ? (
            <InvestigasiSederhanaPage
              onNavigate={onAdminNavigate}
              laporanId={selectedLaporanId}
            />
          ) : adminActivePage === "analysis" ? (
            <AnalisisInvestigasiPage onNavigate={onAdminNavigate} />
          ) : adminActivePage === "detail-investigasi" ? (
            <DetailInvestigasiPage
              onNavigate={onAdminNavigate}
              laporanId={selectedLaporanId}
              user={user}
            />
          ) : adminActivePage === "hasil-investigasi" ? (
            <HasilInvestigasiPage onNavigate={onAdminNavigate} />
          ) : adminActivePage === "laporan-berhasil" ? (
            <LaporanBerhasilPage onNavigate={onAdminNavigate} />
          ) : adminActivePage === "audit-log" ? (
            <AuditLogPage />
          ) : adminActivePage === "notifications" ? (
            <NotifikasiAdminPage
              onNavigate={onAdminNavigate}
              onUnreadCountChange={setUnreadCount}
            />
          ) : adminActivePage === "user-management" ? (
            // ── GUARD: hanya ADMIN_UTAMA yang boleh akses halaman ini ──────
            // Item menu ini memang sudah disembunyikan untuk admin biasa di
            // AdminNavMenu, tapi guard di sini tetap perlu supaya admin
            // biasa tidak bisa nyelonong lewat jalur lain (state diubah
            // manual, dsb). CATATAN: ini baru proteksi di sisi frontend —
            // endpoint backend userManagementService.js WAJIB divalidasi
            // ulang di server (cek role ADMIN_UTAMA dari token), karena
            // guard di frontend saja bisa dilewati orang yang cukup paham
            // devtools/network request.
            isSuperAdmin ? (
              <UserManagementPage />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
                <p className="text-sm font-bold text-slate-700">
                  Akses Ditolak
                </p>
                <p className="max-w-sm text-xs text-slate-500">
                  Halaman Manajemen Pengguna hanya bisa diakses oleh Admin Utama
                  (Admin Utama).
                </p>
              </div>
            )
          ) : adminActivePage === "profile-settings" ? (
            // ✅ FIX 27 Juli 2026: `onUserUpdate` diteruskan supaya perubahan
            // profil (nama/unitKerja/foto) langsung tersinkron ke state
            // `user` global di App.jsx — sebelumnya PengaturanProfilAdminPage
            // cuma update state lokalnya sendiri, jadi bagian lain yang
            // render dari `user` (AdminNavMenu, AdminTopbar) tetap nampilin
            // data lama sampai admin logout lalu login ulang (yang
            // memaksa fetch profil dari nol). `setUser` pakai functional
            // update (merge ke user lama) supaya field lain di objek user
            // (mis. role, id) tidak ikut hilang.
            <PengaturanProfilAdminPage
              user={user}
              onLogout={handleLogout}
              onUserUpdate={handleProfileUserUpdate}
            />
          ) : (
            <div className="p-8">Halaman sedang dikembangkan...</div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  // Halaman mana yang tampil sebelum login: "login" | "lupa-kata-sandi"
  const [authView, setAuthView] = useState("login");

  // ── ADMIN STATE ───────────────────────────────────────────────────────
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [adminActivePage, setAdminActivePage] = useState("admin-dashboard");
  // id laporan yang lagi dibuka — dipakai oleh halaman yang butuh konteks
  // laporan spesifik (detail-laporan, investigasi-sederhana,
  // detail-investigasi). Sebelumnya onNavigate(page, id) selalu kehilangan
  // "id" karena onNavigate cuma = setAdminActivePage (nerima 1 argumen).
  const [selectedLaporanId, setSelectedLaporanId] = useState(null);
  // Jumlah notifikasi belum dibaca — dinaikkan tiap event socket
  // "notification:new" masuk, direset ke 0 tiap kali admin membuka
  // halaman Notifikasi (lihat handleAdminNavigate di bawah).
  const [unreadCount, setUnreadCount] = useState(0);
  // Pesan dari event "auth:accountUnverified" (dipancarkan apiClient.js
  // saat backend balas 403 "Akses ditolak: Akun belum diverifikasi").
  // null = tidak ada pesan yang perlu ditampilkan.
  const [accountUnverifiedMessage, setAccountUnverifiedMessage] =
    useState(null);
  // Pesan dari event "auth:sessionExpired" (dipancarkan apiClient.js saat
  // sesi sudah tidak valid — baik lewat deteksi pesan spesifik "Sesi tidak
  // valid, silakan login kembali" maupun lewat jalur refresh-token gagal).
  // Beda dari accountUnverifiedMessage: begitu event ini masuk, sesi sudah
  // pasti tidak bisa dipakai lagi, jadi listener-nya (di bawah) juga
  // memaksa setUser(null) supaya app langsung kembali ke halaman login,
  // bukan cuma menampilkan banner sambil tetap di halaman admin.
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  // Dipakai sebagai satu-satunya "onNavigate" yang di-pass ke semua
  // halaman admin: kalau ada id yang ikut dikirim (mis. dari tombol
  // "Isi Investigasi Sederhana" -> onNavigate("investigasi-sederhana", id)),
  // id itu disimpan juga, bukan cuma dibuang.
  const handleAdminNavigate = (page, id) => {
    if (id !== undefined) setSelectedLaporanId(id);
    setAdminActivePage(page);
    // ✅ DIPERBAIKI 26 Juli 2026: sebelumnya baris ini set unreadCount(0)
    // begitu admin PINDAH ke halaman notifikasi, walau belum benar-benar
    // buka/baca satu pun notifikasinya — badge jadi menghilang padahal di
    // backend notifikasinya masih isRead:false. Sekarang unreadCount HANYA
    // diupdate lewat onUnreadCountChange yang dipanggil NotifikasiAdminPage
    // sendiri, persis mengikuti aksi baca nyata (per-item atau tandai
    // semua) — lihat prop onUnreadCountChange di bawah.
  };

  // Peran admin ditentukan dari data user yang login (bukan toggle manual lagi)
  // Role di sini mengikuti PERSIS yang dipakai backend asli (Dokumen Serah
  // Terima BE-FE, Bagian 3.7): "USER" | "ADMIN" | "ADMIN_UTAMA". String
  // lowercase "admin" & "SUPER_ADMIN" yang lama sudah dibuang — authService.js
  // (dummy) juga sudah disesuaikan supaya konsisten.
  const isAdmin = user?.role === "ADMIN" || user?.role === "ADMIN_UTAMA";

  // Admin utama vs admin biasa: cuma ADMIN_UTAMA yang boleh kelola akun
  // admin lain lewat halaman Manajemen Pengguna.
  const isSuperAdmin = user?.role === "ADMIN_UTAMA";

  // ── CEK SESI YANG SUDAH ADA SAAT APP DIBUKA ────────────────────────────
  // Ini HANYA relevan untuk sisi admin (memulihkan sesi login admin saat
  // refresh). Rute publik /lapor tidak bergantung pada state ini sama
  // sekali, jadi nakes yang scan QR tidak pernah menunggu proses ini.
  useEffect(() => {
    let isMounted = true;

    async function checkExistingSession() {
      // restoreSession() dari authService.js sudah mengurus semuanya:
      // refresh accessToken lewat cookie httpOnly, ambil profil, dan
      // mengembalikan null (bukan throw) kalau memang tidak ada sesi
      // valid. Tidak perlu baca token manual di sini sama sekali.
      const restoredUser = await restoreSession();
      if (isMounted) {
        setUser(restoredUser);
        setIsCheckingAuth(false);
      }
    }

    checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── SOCKET.IO: NOTIFIKASI REAL-TIME ─────────────────────────────────────
  // Connect HANYA setelah user login & terkonfirmasi admin (bukan saat
  // isCheckingAuth, dan bukan untuk rute publik /lapor). Room per-admin
  // sudah otomatis diurus backend — FE tidak perlu filter/join room
  // manual.
  useEffect(() => {
    if (isCheckingAuth || !user || !isAdmin) return;

    const token = getStoredAccessToken();
    if (!token) return;

    let socket;
    let isMounted = true;

    async function init() {
      // ── HITUNG UNREAD YANG SUDAH ADA SEBELUM ADMIN LOGIN ────────────
      // Sebelumnya unreadCount SELALU mulai dari 0 tiap login, padahal
      // bisa saja ada laporan/notifikasi baru yang masuk SAAT admin belum
      // online (socket belum connect) — notifikasi itu tersimpan di
      // backend tapi badge tidak pernah tahu soal itu. Di sini kita ambil
      // dulu dari GET /notifications/me lalu hitung yang isRead === false.
      //
      // ⚠️ ASUMSI: backend belum punya endpoint count unread khusus, jadi
      // kita ambil daftar (limit besar) lalu hitung manual di FE. Kalau
      // jumlah unread bisa > 100 dalam praktiknya, hitungan ini under-
      // count — sebaiknya minta BE sediakan field/endpoint count unread
      // kalau ini jadi masalah nyata di lapangan.
      try {
        const { items } = await getNotifikasi({ limit: 100 });
        const unread = (items || []).filter((n) => !n.isRead).length;
        if (isMounted) setUnreadCount(unread);
      } catch (err) {
        console.error("Gagal ambil jumlah notifikasi belum dibaca:", err);
      }

      if (!isMounted) return;

      // ── KONEKSI REAL-TIME (setelah hitungan awal selesai) ───────────
      // Struktur payload persis sama dengan 1 item GET /notifications/me
      // ({id, userId, tipe, pesan, referensiId, isRead, createdAt}) — tapi
      // di sini kita cuma perlu tahu "ada notifikasi baru masuk" untuk
      // menaikkan badge. NotifikasiAdminPage yang bertanggung jawab
      // menampilkan isinya kalau halaman itu sedang dibuka.
      // ⚠️ FIX 26 Juli 2026: sebelumnya tanpa opsi `transports`, jadi
      // Socket.io client default coba `polling` dulu sebelum upgrade ke
      // `websocket` — request polling itu yang kena CORS error terus-
      // menerus (retry otomatis bawaan Socket.io) sampai numpuk di Network
      // tab. Backend sudah dikonfirmasi CORS-nya jalan untuk websocket
      // (badge notifikasi real-time sudah terbukti bekerja), jadi aman
      // langsung skip percobaan polling sama sekali.
      socket = io(SOCKET_BASE_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.on("notification:new", () => {
        setUnreadCount((prev) => prev + 1);
      });

      socket.on("connect_error", (err) => {
        console.error("Socket.io gagal connect:", err.message);
      });
    }

    init();

    return () => {
      isMounted = false;
      socket?.disconnect();
    };
  }, [isCheckingAuth, user?.id, isAdmin]);
  // ✅ FIX 27 Juli 2026: dependency diganti dari `user` (seluruh object)
  // menjadi `user?.id` (primitif yang cuma berubah kalau memang beda
  // akun/login-logout). Sebelumnya depend ke `user` object langsung —
  // setiap kali PengaturanProfilAdminPage update nama/unitKerja/foto
  // (lewat onUserUpdate/handleProfileUserUpdate di atas), `user` dapat
  // reference BARU walau isinya cuma beda sedikit, dan itu cukup untuk
  // men-trigger effect ini lagi: disconnect+reconnect socket serta fetch
  // ulang GET /notifications/me — padahal tidak ada perubahan
  // login/logout apa pun. `user?.id` tidak berubah pada kasus itu, jadi
  // effect ini sekarang cuma jalan saat benar-benar login/logout/ganti
  // akun, sesuai niat awal komentar "Connect HANYA setelah user login".

  // ── LISTENER: EVENT "auth:accountUnverified" ────────────────────────────
  // Dipancarkan apiClient.js (interceptor 403) saat backend menolak
  // request karena akun admin belum diverifikasi. Sebelumnya event ini
  // cuma dipancarkan tanpa ada yang mendengarkan sama sekali — pesannya
  // tidak pernah sampai ke user. Listener dipasang sekali di level App,
  // bukan per-halaman, supaya tertangkap dari request mana pun.
  useEffect(() => {
    function handleAccountUnverified(event) {
      setAccountUnverifiedMessage(
        event.detail?.message || "Akun belum diverifikasi.",
      );
    }

    window.addEventListener("auth:accountUnverified", handleAccountUnverified);
    return () => {
      window.removeEventListener(
        "auth:accountUnverified",
        handleAccountUnverified,
      );
    };
  }, []);

  // ── LISTENER: EVENT "auth:sessionExpired" ────────────────────────────────
  // Dipancarkan apiClient.js saat sesi sudah dipastikan tidak valid lagi
  // (deteksi pesan "Sesi tidak valid, silakan login kembali" ATAU jalur
  // refresh-token gagal — keduanya sudah diselaraskan bentuknya jadi
  // `detail: { message }` yang sama).
  //
  // ⚠️ SEBELUMNYA: event ini dipancarkan tapi TIDAK ADA yang mendengarkan
  // sama sekali — pesan dari backend (mis. penjelasan kenapa sesi
  // di-invalidate paksa, seperti email diubah admin lain) hilang begitu
  // saja, dan state `user` di sini juga tidak ikut ke-reset, jadi UI admin
  // bisa kelihatan masih "login" walau token-nya sudah tidak valid, sampai
  // ada request lain yang gagal.
  //
  // FIX: setUser(null) di sini memaksa AdminRoute jatuh ke cabang !user
  // (redirect ke LoginPage) SEKETIKA event ini masuk, dan pesannya
  // ditampilkan sebagai banner di atas LoginPage (lihat render di bawah)
  // supaya admin tahu KENAPA dia tiba-tiba ter-logout, bukan cuma
  // menghilang ke halaman login tanpa penjelasan.
  useEffect(() => {
    function handleSessionExpired(event) {
      setSessionExpiredMessage(
        event.detail?.message ||
          "Sesi Anda telah berakhir, silakan login kembali.",
      );
      setUser(null);
      setAdminActivePage("admin-dashboard");
      setUnreadCount(0);
    }

    window.addEventListener("auth:sessionExpired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:sessionExpired", handleSessionExpired);
    };
  }, []);

  // ── LOGOUT ──────────────────────────────────────────────────────────────
  // Dipakai lewat prop onLogout ke AdminTopbar / halaman profil admin
  // supaya tombol "Keluar" bisa mengembalikan app ke halaman login admin.
  const handleLogout = async () => {
    // logoutFromServer() (authService.logout) sudah mengurus urutan yang
    // benar: panggil POST /auth/logout dulu (invalidasi refresh token
    // cookie di server), lalu bersihkan accessToken+authUser lokal lewat
    // clearSession() — tetap jalan walau request ke server gagal.
    await logoutFromServer();
    setUser(null);
    setAdminActivePage("admin-dashboard");
    setUnreadCount(0);
  };

  // ── HELPER: Get Admin Page Title ──────────────────────────────────────
  const getAdminPageTitle = () => {
    const titles = {
      "admin-dashboard": "Dashboard Analitik",

      "incident-management": "Daftar Laporan Insiden",

      "detail-laporan": "Detail Laporan",
      "investigasi-sederhana": "Investigasi Sederhana",
      "laporan-berhasil": "Laporan Berhasil",

      analysis: "Analisis & Investigasi",

      "detail-investigasi": "Detail Investigasi",

      "hasil-investigasi": "Hasil Investigasi",

      notifications: "Notifikasi",

      "audit-log": "Audit Log",

      "user-management": "Manajemen Pengguna",

      "profile-settings": "Pengaturan Profil",
    };

    return titles[adminActivePage] || "Dashboard";
  };

  return (
    <>
      {/* Banner global "akun belum diverifikasi" — muncul di atas rute
          mana pun (bisa saja request 403 itu datang dari halaman admin
          mana saja), bisa ditutup manual oleh user. */}
      {accountUnverifiedMessage && (
        <div className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-800">
          <span>{accountUnverifiedMessage}</span>
          <button
            onClick={() => setAccountUnverifiedMessage(null)}
            className="font-bold text-amber-900 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}
      {/* Banner global "sesi berakhir" — user sudah otomatis di-logout
          (setUser(null) di listener auth:sessionExpired), banner ini cuma
          menjelaskan KENAPA, muncul di atas LoginPage. Merah/rose (bukan
          amber seperti accountUnverified) supaya beda tingkat urgensi:
          ini bukan cuma peringatan, sesi memang sudah dipaksa berakhir. */}
      {sessionExpiredMessage && (
        <div className="flex items-center justify-between gap-3 bg-rose-100 px-4 py-2 text-sm text-rose-800">
          <span>{sessionExpiredMessage}</span>
          <button
            onClick={() => setSessionExpiredMessage(null)}
            className="font-bold text-rose-900 hover:underline"
          >
            Tutup
          </button>
        </div>
      )}
      <BrowserRouter>
        <Routes>
          {/* ── RUTE PUBLIK: tujuan QR code, tanpa login ─────────────────── */}
          {/* "/lapor"      → landing page (jeda sebelum form) */}
          {/* "/lapor/form" → form pelaporan insiden yang sesungguhnya */}
          <Route path="/lapor" element={<LaporPublicRoute />} />
          <Route path="/lapor/form" element={<BuatLaporanPage />} />

          {/* Tujuan link "reset password" dari email — publik sungguhan
             (tidak wajib login), token dibaca dari query string ?token=...
             oleh ResetPasswordPage sendiri. */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* ── RUTE ADMIN: wajib login + role admin ─────────────────────── */}
          <Route
            path="/admin/*"
            element={
              <AdminRoute
                isCheckingAuth={isCheckingAuth}
                user={user}
                isAdmin={isAdmin}
                isSuperAdmin={isSuperAdmin}
                authView={authView}
                setAuthView={setAuthView}
                setUser={setUser}
                adminSidebarOpen={adminSidebarOpen}
                setAdminSidebarOpen={setAdminSidebarOpen}
                adminActivePage={adminActivePage}
                setAdminActivePage={setAdminActivePage}
                selectedLaporanId={selectedLaporanId}
                onAdminNavigate={handleAdminNavigate}
                handleLogout={handleLogout}
                getAdminPageTitle={getAdminPageTitle}
                unreadCount={unreadCount}
                setUnreadCount={setUnreadCount}
              />
            }
          />

          {/* ── DEFAULT: siapa pun yang buka "/" atau path lain diarahkan
             ke form laporan publik, bukan ke login ───────────────────── */}
          <Route path="*" element={<Navigate to="/lapor" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
