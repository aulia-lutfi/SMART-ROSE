import { useState, useEffect, useRef, useCallback } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Camera,
  Upload,
  X,
  LogOut,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import * as profilService from "../../services/admin/profilService";
import { clearSession } from "../../services/auth/authService";

export default function PengaturanProfilPage({ user, onLogout, onUserUpdate }) {
  // ------------------------------------------------------------
  // State: memuat data profil dari server
  // ------------------------------------------------------------
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Data Pribadi
  // UPDATE 25 Juli 2026: field "No. Telepon" dihapus dari kontrak backend,
  // digantikan "Unit Kerja" (lihat dokumen "Update Backend untuk FE -
  // Profil dan Search Laporan"). Backend juga pakai key "nama" (bukan
  // "name") untuk field ini.
  const [namaLengkap, setNamaLengkap] = useState(user?.nama || "");
  const [unitKerja, setUnitKerja] = useState(user?.unitKerja || "");
  const [email, setEmail] = useState(user?.email || "");
  const [peran, setPeran] = useState(user?.role || "Admin");
  const [terverifikasi, setTerverifikasi] = useState(user?.isVerified ?? true);

  // Foto Profil
  const [profilePhoto, setProfilePhoto] = useState(
    user?.foto || user?.avatarUrl || "",
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  // Dropdown menu ala WhatsApp ("Lihat Foto" / "Unggah Foto" / "Hapus
  // Foto") — muncul saat ikon kamera di avatar diklik, bukan langsung
  // buka file picker seperti sebelumnya.
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  // Popup "Lihat Foto" — muncul di atas halaman ini (bukan pindah tab/
  // halaman baru), mirip preview foto profil di WA.
  const [photoViewOpen, setPhotoViewOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Ganti Kata Sandi
  const [kataLamaShow, setKataLamaShow] = useState(false);
  const [kataBaru1Show, setKataBaru1Show] = useState(false);
  const [kataBaru2Show, setKataBaru2Show] = useState(false);
  const [kataLama, setKataLama] = useState("");
  const [kataBaru, setKataBaru] = useState("");
  const [konfirmasiKata, setKonfirmasiKata] = useState("");

  // Status simpan
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Nilai awal (untuk tombol "Batal")
  const [initialData, setInitialData] = useState(null);

  // ------------------------------------------------------------
  // Ambil data profil terbaru dari backend saat halaman dibuka
  // GET /auth/profile
  // ------------------------------------------------------------
  const fetchProfile = useCallback(async () => {
    setLoadingProfile(true);
    setLoadError("");
    try {
      const data = await profilService.getProfile();
      const profile = data?.data || data; // sesuaikan bentuk response backend

      setNamaLengkap(profile?.nama || "");
      setUnitKerja(profile?.unitKerja || "");
      setEmail(profile?.email || "");
      setPeran(profile?.role || "Admin");
      setTerverifikasi(profile?.isVerified ?? true);
      setProfilePhoto(profile?.avatarUrl || "");

      // ✅ FIX 27 Juli 2026: sinkronkan juga ke state user global begitu
      // profil terbaru berhasil diambil — jaga-jaga kalau `user` global
      // sudah sempat "basi" (mis. dari sesi yang direstore sebelum
      // perubahan ini ada) walau belum ada aksi simpan apa pun di sini.
      onUserUpdate?.({
        nama: profile?.nama,
        unitKerja: profile?.unitKerja,
        avatarUrl: profile?.avatarUrl,
      });

      setInitialData({
        namaLengkap: profile?.nama || "",
        unitKerja: profile?.unitKerja || "",
      });
    } catch (err) {
      setLoadError(
        err.message || "Gagal memuat data profil. Silakan coba lagi.",
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [onUserUpdate]);

  useEffect(() => {
    // JANGAN skip fetch ini walau data `user` sudah tersedia dari
    // props/context — `avatarUrl` adalah signed URL ber-expiry
    // (dikonfirmasi BE 25 Juli 2026), jadi versi di props/context bisa
    // saja sudah kedaluwarsa kalau berasal dari state yang persist
    // lintas sesi. Selalu ambil avatarUrl terbaru dari GET /auth/profile
    // setiap kali halaman ini dibuka.
    fetchProfile();
  }, [fetchProfile]);

  // ------------------------------------------------------------
  // Upload foto profil — POST /auth/profile/photo
  // UPDATE 23 Juli 2026: diimplementasikan dengan kontrak endpoint
  // USULAN (lihat uploadPhoto() di profilService.js).
  // UPDATE 25 Juli 2026: BE mengonfirmasi endpoint ini sudah LIVE di
  // production dengan kontrak yang persis sama — tidak ada perubahan
  // logika yang diperlukan di sini.
  //
  // CATATAN PENTING soal `profilePhoto` (state di bawah): nilai awalnya
  // sempat diisi dari props `user?.foto || user?.avatarUrl`, TAPI ini
  // tidak pernah sempat dirender ke layar sebelum data asli didapat,
  // karena rendering digate oleh `loadingProfile` (lihat blok
  // "Tampilan loading awal" di bawah) — begitu `fetchProfile()` selesai,
  // `profilePhoto` selalu ditimpa dengan `avatarUrl` terbaru dari
  // GET /auth/profile. Ini penting karena avatarUrl adalah SIGNED URL
  // BER-EXPIRY (dikonfirmasi BE 25 Juli 2026) — kalau value dari props
  // itu berasal dari state yang persist lintas sesi (mis. user object
  // yang di-cache di localStorage/context saat login), value tsb bisa
  // saja sudah expired. JANGAN hapus/skip pemanggilan fetchProfile() di
  // useEffect di atas dengan alasan "kan sudah ada dari props" — itu
  // akan membuat foto profil sesekali gagal tampil karena URL expired.
  // ------------------------------------------------------------
  const MAKS_UKURAN_FOTO = 2 * 1024 * 1024; // 2MB
  const TIPE_FOTO_DIIZINKAN = ["image/png", "image/jpeg", "image/webp"];

  const handlePilihFoto = () => {
    setPhotoMenuOpen(false);
    setErrors((prev) => ({ ...prev, foto: null }));
    fileInputRef.current?.click();
  };

  // "Lihat Foto" — buka popup preview LANGSUNG DI HALAMAN INI (modal),
  // bukan pindah ke tab/halaman baru. Ditutup lewat backdrop/tombol X.
  const handleLihatFoto = () => {
    setPhotoMenuOpen(false);
    if (profilePhoto) setPhotoViewOpen(true);
  };

  // ✅ 27 Juli 2026 (sore, update kedua) — "Hapus Foto" DISAMBUNGKAN ke
  // DELETE /auth/profile/photo, endpoint yang baru dikonfirmasi BE.
  // Tombol pemicu sudah punya `disabled={!profilePhoto}` (lihat render
  // di bawah) — ini sudah sesuai saran BE supaya tombol tidak bisa
  // diklik kalau avatar memang masih kosong (menghindari 400 "User
  // tidak memiliki foto profil saat ini" secara percuma), jadi fungsi
  // ini sendiri tidak perlu cek ulang `profilePhoto` di awal.
  // BE bilang setelah dihapus GET /auth/profile otomatis avatarUrl:null
  // juga, jadi tidak perlu fetchProfile() ulang — cukup update state
  // lokal dari response DELETE ini langsung.
  const handleHapusFoto = async () => {
    setPhotoMenuOpen(false);

    const konfirmasi = window.confirm(
      "Hapus foto profil? Tindakan ini tidak dapat dibatalkan.",
    );
    if (!konfirmasi) return;

    setErrors((prev) => ({ ...prev, foto: null }));
    setRemovingPhoto(true);
    try {
      await profilService.deletePhoto();
      setProfilePhoto("");
      // Sinkronkan ke state user global juga, sama seperti upload foto
      // — supaya AdminNavMenu/AdminTopbar langsung ikut berubah.
      onUserUpdate?.({ avatarUrl: null });
      setSuccessMsg("Foto profil berhasil dihapus.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        foto: err.message || "Gagal menghapus foto profil",
      }));
    } finally {
      setRemovingPhoto(false);
    }
  };

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    // Reset value input supaya file yang sama bisa dipilih ulang kalau
    // sebelumnya gagal (tanpa reset ini, onChange tidak akan terpicu
    // lagi untuk file dengan nama sama)
    e.target.value = "";
    if (!file) return;

    if (!TIPE_FOTO_DIIZINKAN.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        foto: "Format foto harus JPG, PNG, atau WEBP",
      }));
      return;
    }
    if (file.size > MAKS_UKURAN_FOTO) {
      setErrors((prev) => ({
        ...prev,
        foto: "Ukuran foto maksimal 2MB",
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, foto: null }));
    setUploadingPhoto(true);
    try {
      const result = await profilService.uploadPhoto(file);
      const urlBaru = result?.avatarUrl || result?.data?.avatarUrl;
      if (urlBaru) {
        setProfilePhoto(urlBaru);
        // ✅ FIX 27 Juli 2026: sama seperti update data pribadi — teruskan
        // ke state global supaya foto baru langsung tampil di
        // AdminNavMenu/AdminTopbar juga, bukan cuma di halaman ini.
        // CATATAN: avatarUrl signed & ber-expiry (lihat profilService.js),
        // jadi wajar kalau nanti expired dan perlu di-refresh lagi lewat
        // fetchProfile() — bukan berarti fix ini salah.
        onUserUpdate?.({ avatarUrl: urlBaru });
        setSuccessMsg("Foto profil berhasil diubah!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        foto: err.message || "Gagal mengunggah foto profil",
      }));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ------------------------------------------------------------
  // Simpan perubahan (data pribadi + kata sandi bila diisi)
  // PUT/PATCH /admin/profile
  // PUT/PATCH /admin/profile/password
  // ------------------------------------------------------------
  const validate = () => {
    const newErrors = {};
    if (!namaLengkap.trim()) {
      newErrors.namaLengkap = "Nama lengkap wajib diisi";
    } else if (namaLengkap.trim().length < 3) {
      // Samakan dengan validasi BE: nama minimal 3 karakter
      newErrors.namaLengkap = "Nama lengkap minimal 3 karakter";
    }
    // unitKerja bersifat optional di BE, tapi TIDAK BOLEH string kosong
    // kalau dikirim. Untuk field kosong, kita cukup tidak mengirimkannya
    // sama sekali (lihat handleSimpan) alih-alih memvalidasi di sini.
    if (kataBaru && kataBaru.length < 8) {
      newErrors.kataBaru = "Kata sandi minimal 8 karakter";
    }
    if (kataBaru && kataBaru !== konfirmasiKata) {
      newErrors.konfirmasiKata = "Kata sandi tidak cocok";
    }
    if (kataBaru && !kataLama) {
      newErrors.kataLama = "Masukkan kata sandi lama";
    }
    return newErrors;
  };

  const handleSimpan = async () => {
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSaving(true);
    setSuccessMsg("");

    // PENTING: update data pribadi & ganti kata sandi sengaja dibuat
    // SALING INDEPENDEN (masing-masing dalam try/catch sendiri), bukan
    // berurutan dalam satu try/catch seperti sebelumnya. Sebelumnya kalau
    // update data pribadi gagal (mis. backend belum mount PUT /auth/profile
    // -> 404), kode langsung throw dan ganti kata sandi TIDAK PERNAH
    // sempat dicoba sama sekali, walau dua hal ini sebenarnya tidak
    // berhubungan. Sekarang keduanya dicoba terpisah, dan errornya
    // digabung di akhir supaya user tetap tahu bagian mana yang gagal.
    const dataBerubah =
      !initialData ||
      namaLengkap !== initialData.namaLengkap ||
      unitKerja !== initialData.unitKerja;

    const pesanError = [];

    // 1. Update data pribadi — hanya dikirim kalau memang ada perubahan
    if (dataBerubah) {
      try {
        // unitKerja sengaja tidak dikirim sama sekali kalau kosong/hanya
        // whitespace — BE menolak string kosong untuk field ini walau
        // field-nya optional (lihat catatan di profilService.js).
        const unitKerjaTrim = unitKerja.trim();
        await profilService.updateProfile({
          nama: namaLengkap.trim(),
          ...(unitKerjaTrim ? { unitKerja: unitKerjaTrim } : {}),
        });
        setInitialData({ namaLengkap, unitKerja });
        // ✅ FIX 27 Juli 2026: sinkronkan ke state user GLOBAL (App.jsx),
        // bukan cuma state lokal halaman ini — supaya AdminNavMenu /
        // AdminTopbar (yang render dari `user` global) langsung ikut
        // berubah tanpa perlu logout/login ulang.
        onUserUpdate?.({
          nama: namaLengkap.trim(),
          ...(unitKerjaTrim ? { unitKerja: unitKerjaTrim } : {}),
        });
      } catch (err) {
        pesanError.push(`Data pribadi: ${err.message || "Gagal menyimpan"}`);
      }
    }

    // 2. Ganti kata sandi — dicoba independen, tidak diblokir kegagalan di atas
    if (kataBaru) {
      try {
        await profilService.changePassword({
          oldPassword: kataLama,
          newPassword: kataBaru,
        });
        setKataLama("");
        setKataBaru("");
        setKonfirmasiKata("");
      } catch (err) {
        pesanError.push(`Kata sandi: ${err.message || "Gagal mengganti"}`);
      }
    }

    if (pesanError.length > 0) {
      setErrors((prev) => ({ ...prev, submit: pesanError.join(" | ") }));
    } else {
      const bagian = [];
      if (dataBerubah) bagian.push("data pribadi");
      if (kataBaru) bagian.push("kata sandi");
      setSuccessMsg(
        bagian.length > 0
          ? `Perubahan (${bagian.join(" & ")}) berhasil disimpan!`
          : "Tidak ada perubahan untuk disimpan.",
      );
      setTimeout(() => setSuccessMsg(""), 3000);
    }

    setSaving(false);
  };

  const handleBatal = () => {
    if (initialData) {
      setNamaLengkap(initialData.namaLengkap);
      setUnitKerja(initialData.unitKerja);
    }
    setKataLama("");
    setKataBaru("");
    setKonfirmasiKata("");
    setErrors({});
    setSuccessMsg("");
  };

  // ------------------------------------------------------------
  // Keluar dari akun
  // POST /auth/logout
  // ------------------------------------------------------------
  const handleKeluar = async () => {
    setLoggingOut(true);
    try {
      await profilService.logout();
    } catch (err) {
      // Tetap lanjutkan proses logout di sisi client walau request gagal
      console.error("Logout error:", err);
    } finally {
      // Sebelumnya: localStorage.removeItem("authToken") — key yang
      // tidak pernah dipakai untuk menyimpan sesi (lihat catatan di
      // authService.js), jadi sesi tidak pernah benar-benar terhapus.
      // Sekarang pakai clearSession() yang sama dengan authService.js.
      clearSession();
      setLoggingOut(false);
      if (onLogout) {
        onLogout();
      } else {
        window.location.href = "/login";
      }
    }
  };

  // ------------------------------------------------------------
  // Hapus akun
  // DELETE /auth/profile
  // Backend WAJIB menerima `password` di body sebagai konfirmasi —
  // sebelumnya deleteAccount() dipanggil tanpa argumen sama sekali,
  // pasti ditolak backend. Sementara pakai window.prompt untuk minta
  // password (fungsional, walau idealnya diganti modal konfirmasi
  // yang lebih rapi ke depannya).
  // ------------------------------------------------------------
  const handleHapusAkun = async () => {
    const konfirmasi = window.confirm(
      "Apakah Anda yakin ingin menghapus akun? Tindakan ini tidak dapat dibatalkan.",
    );
    if (!konfirmasi) return;

    const password = window.prompt(
      "Masukkan kata sandi Anda untuk mengonfirmasi penghapusan akun:",
    );
    if (!password) return;

    setDeleting(true);
    try {
      await profilService.deleteAccount({ password });
      // Sebelumnya: localStorage.removeItem("authToken") — key yang
      // tidak pernah dipakai untuk menyimpan sesi. Sekarang pakai
      // clearSession() yang sama dengan authService.js.
      clearSession();
      window.location.href = "/login";
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        submit: err.message || "Gagal menghapus akun",
      }));
    } finally {
      setDeleting(false);
    }
  };

  const PERAN_OPTIONS = ["Admin"];

  // ------------------------------------------------------------
  // Tampilan loading awal
  // ------------------------------------------------------------
  if (loadingProfile) {
    return (
      <div
        className="flex min-h-full items-center justify-center px-4 py-5"
        style={{ backgroundColor: "#EDF3FF" }}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Memuat data profil...
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8"
      style={{ backgroundColor: "#EDF3FF" }}
    >
      {/* Card Utama */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {/* Error memuat data */}
        {loadError && (
          <div className="mb-5 flex items-center justify-between gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {loadError}
            </span>
            <button
              onClick={fetchProfile}
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Foto Profil */}
        <div className="mb-8 flex flex-col items-center">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-blue-100">
              {uploadingPhoto || removingPhoto ? (
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              ) : profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Foto Profil"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                // Konsisten dengan avatar kecil di AdminNavMenu.jsx: kalau
                // tidak ada foto, tampilkan inisial nama (bukan ikon orang
                // generik) supaya tampilannya sama di kedua tempat.
                <span className="text-3xl font-bold text-blue-700">
                  {(namaLengkap || "A").charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Tombol Edit Foto — klik buka dropdown menu (bukan langsung
               file picker seperti sebelumnya) */}
            <button
              onClick={() => setPhotoMenuOpen((prev) => !prev)}
              disabled={uploadingPhoto || removingPhoto}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition disabled:opacity-60"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>

            {photoMenuOpen && (
              <>
                {/* Backdrop transparan — klik di luar menu untuk menutup */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setPhotoMenuOpen(false)}
                />
                {/* Dropdown menu ala WhatsApp: Lihat Foto / Unggah Foto /
                   Hapus Foto. "Take Photo" sengaja tidak ada — perangkat
                   admin (desktop) tidak selalu punya kamera relevan untuk
                   foto profil kerja. */}
                <div className="absolute left-1/2 top-full z-20 mt-2 w-48 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={handleLihatFoto}
                    disabled={!profilePhoto}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                  >
                    <Eye className="h-4 w-4" />
                    Lihat Foto
                  </button>
                  <button
                    type="button"
                    onClick={handlePilihFoto}
                    disabled={uploadingPhoto || removingPhoto}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                  >
                    <Upload className="h-4 w-4" />
                    Unggah Foto
                  </button>
                  <button
                    type="button"
                    onClick={handleHapusFoto}
                    disabled={!profilePhoto || uploadingPhoto || removingPhoto}
                    className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm font-medium text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-200 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Foto
                  </button>
                </div>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={handleFotoChange}
            />
          </div>
          {uploadingPhoto && (
            <p className="mt-2 text-xs font-semibold text-blue-600">
              Mengunggah...
            </p>
          )}
          {removingPhoto && (
            <p className="mt-2 text-xs font-semibold text-red-500">
              Menghapus...
            </p>
          )}
          {errors.foto && (
            <p className="mt-1 max-w-xs text-center text-xs text-red-500">
              {errors.foto}
            </p>
          )}
        </div>

        {/* Popup "Lihat Foto" — overlay di atas halaman ini, bukan tab/
           halaman baru. z-50 supaya di atas backdrop dropdown menu (z-10). */}
        {photoViewOpen && profilePhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            onClick={() => setPhotoViewOpen(false)}
          >
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPhotoViewOpen(false)}
                className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={profilePhoto}
                alt="Foto Profil"
                className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              />
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Error umum saat simpan/hapus */}
        {errors.submit && (
          <div className="mb-5 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-medium text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors.submit}
          </div>
        )}

        {/* Section Data Pribadi */}
        <div className="mb-7">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-700">Data Pribadi</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Nama Lengkap */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={namaLengkap}
                onChange={(e) => {
                  setNamaLengkap(e.target.value);
                  if (errors.namaLengkap)
                    setErrors({ ...errors, namaLengkap: null });
                }}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-1 ${
                  errors.namaLengkap
                    ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                    : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                }`}
              />
              {errors.namaLengkap && (
                <p className="mt-1 text-xs text-red-500">
                  {errors.namaLengkap}
                </p>
              )}
            </div>

            {/* email */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-24 text-sm text-slate-500 focus:outline-none"
              />
            </div>

            {/* Peran */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Peran
              </label>
              <div className="relative">
                <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                  {peran}
                </div>

                {terverifikasi && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Verifikasi
                  </span>
                )}
              </div>
            </div>

            {/* Unit Kerja */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Unit Kerja
              </label>
              <input
                type="text"
                value={unitKerja}
                onChange={(e) => setUnitKerja(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-7 border-t border-slate-100" />

        {/* Section Ganti Kata Sandi */}
        <div className="mb-7">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-700">
              Ganti Kata Sandi
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Kata Sandi Lama */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                Kata Sandi Lama
              </label>
              <div className="relative">
                <input
                  type={kataLamaShow ? "text" : "password"}
                  value={kataLama}
                  onChange={(e) => {
                    setKataLama(e.target.value);
                    if (errors.kataLama)
                      setErrors({ ...errors, kataLama: null });
                  }}
                  placeholder="••••••••"
                  className={`w-full rounded-full border px-3 py-2.5 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-1 ${
                    errors.kataLama
                      ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                      : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setKataLamaShow((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {kataLamaShow ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.kataLama && (
                <p className="mt-1 text-xs text-red-500">{errors.kataLama}</p>
              )}
            </div>

            {/* Kata Sandi Baru + Konfirmasi */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Kata Sandi Baru
                </label>
                <div className="relative">
                  <input
                    type={kataBaru1Show ? "text" : "password"}
                    value={kataBaru}
                    onChange={(e) => {
                      setKataBaru(e.target.value);
                      if (errors.kataBaru)
                        setErrors({ ...errors, kataBaru: null });
                    }}
                    placeholder="Minimal 8 karakter"
                    className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-1 ${
                      errors.kataBaru
                        ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                        : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setKataBaru1Show((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {kataBaru1Show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.kataBaru && (
                  <p className="mt-1 text-xs text-red-500">{errors.kataBaru}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                  Konfirmasi Kata Sandi Baru
                </label>
                <div className="relative">
                  <input
                    type={kataBaru2Show ? "text" : "password"}
                    value={konfirmasiKata}
                    onChange={(e) => {
                      setKonfirmasiKata(e.target.value);
                      if (errors.konfirmasiKata)
                        setErrors({ ...errors, konfirmasiKata: null });
                    }}
                    placeholder="Ulangi kata sandi baru"
                    className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-1 ${
                      errors.konfirmasiKata
                        ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                        : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setKataBaru2Show((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {kataBaru2Show ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.konfirmasiKata && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.konfirmasiKata}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            onClick={handleBatal}
            disabled={saving}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
          >
            Batal
          </button>
          <button
            onClick={handleSimpan}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      {/* Keluar dari Akun & Hapus Akun */}
      <div className="mt-8 flex justify-center gap-6">
        {/* Tombol Keluar */}
        <button
          onClick={handleKeluar}
          disabled={loggingOut}
          className="flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-600 hover:underline transition disabled:opacity-60"
        >
          {loggingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          Keluar
        </button>

        {/* Tombol Hapus Akun */}
        <button
          onClick={handleHapusAkun}
          disabled={deleting}
          className="flex items-center gap-1.5 text-sm font-semibold text-red-500 hover:text-red-600 hover:underline transition disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Hapus Akun
        </button>
      </div>
    </div>
  );
}
