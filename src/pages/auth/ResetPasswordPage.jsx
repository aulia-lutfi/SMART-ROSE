import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import * as authService from "../../services/auth/authService";

// ── ResetPasswordPage ────────────────────────────────────────────────────
// Tujuan link "Gunakan token berikut untuk mereset password Anda" di email
// (mis. https://smartrose.id/reset-password?token=xxx). SEBELUMNYA halaman
// ini TIDAK ADA sama sekali di aplikasi — authService.resetPassword() sudah
// siap dipakai sejak lama, tapi tidak pernah dipanggil dari mana pun karena
// tidak ada form untuk memicunya.
//
// ⚠️ Ini route PUBLIK sungguhan (didaftarkan langsung di App.jsx, BUKAN
// lewat authView seperti ForgotPasswordPage/LoginPage yang dirender di
// dalam AdminRoute) — karena user bisa datang "dingin" dari klik link di
// email, tanpa pernah melalui alur login/AdminRoute sebelumnya. Token
// dibaca dari query string URL lewat useSearchParams, bukan dari prop.
//
// ⚠️ BELUM DIKONFIRMASI langsung oleh tim BE (lihat catatan di
// authService.js): path & body POST /auth/password/reset masih dugaan.
// Kalau ternyata backend juga belum membungkus token jadi URL di email
// (baru kirim token mentah, lihat screenshot email 27 Juli 2026), maka
// perbaikan di sisi backend (template email) TETAP DIPERLUKAN sebagai
// pasangan dari halaman ini — halaman ini saja tidak cukup kalau user
// tidak pernah dapat link yang bisa diklik.
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!newPassword) {
      newErrors.newPassword = "Kata sandi baru wajib diisi";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Kata sandi minimal 8 karakter";
    }
    if (confirmPassword !== newPassword) {
      newErrors.confirmPassword = "Konfirmasi kata sandi tidak cocok";
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitError("");
    setIsRateLimited(false);
    setLoading(true);
    try {
      await authService.resetPassword({ token, newPassword });
      setIsDone(true);
    } catch (err) {
      if (err.status === 429) {
        // Rate limit (maks 10 request/15 menit/IP) — BUKAN token
        // invalid/kedaluwarsa, jadi jangan pakai pesan "minta tautan
        // baru" di sini, itu menyesatkan (link user sebenarnya masih
        // berlaku, cuma kebanyakan percobaan dari IP yang sama).
        setIsRateLimited(true);
        setSubmitError(
          err.message ||
            "Terlalu banyak permintaan reset password dari IP ini, silakan coba lagi setelah 15 menit.",
        );
      } else {
        setSubmitError(
          err.message ||
            "Gagal mengatur ulang kata sandi. Tautan mungkin sudah kedaluwarsa, silakan minta tautan baru.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8"
      style={{
        background:
          "linear-gradient(135deg, #EAF1FF 0%, #F5F8FF 50%, #EDF3FF 100%)",
      }}
    >
      <div className="w-full max-w-sm sm:max-w-md lg:max-w-xl">
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-blue-900/5 sm:p-10 lg:p-12">
          <div className="mb-7 flex flex-col items-center text-center lg:mb-9">
            <img
              src="/LOGO_S-ROSE.svg"
              alt="SMART-ROSE"
              className="mb-2 h-auto w-48 sm:w-56 lg:w-64"
            />
          </div>

          {/* ── TIDAK ADA TOKEN DI URL ────────────────────────────────────
              Bisa terjadi kalau user buka halaman ini langsung (bukan lewat
              link email), atau backend belum membungkus token jadi URL
              (masih kirim token mentah seperti temuan 27 Juli 2026) — di
              kedua kasus, jangan tampilkan form, karena submit pasti gagal
              tanpa token yang valid. */}
          {!token ? (
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 lg:h-16 lg:w-16">
                <AlertCircle className="h-7 w-7 text-red-500 lg:h-8 lg:w-8" />
              </div>
              <h1 className="mb-2 text-lg font-bold text-slate-800 lg:text-2xl">
                Tautan Tidak Valid
              </h1>
              <p className="mb-7 text-xs text-slate-500 lg:mb-9 lg:text-sm">
                Tautan reset kata sandi ini tidak lengkap atau sudah tidak
                berlaku. Silakan minta tautan baru dari halaman "Lupa Kata
                Sandi".
              </p>
              <button
                onClick={() => navigate("/admin")}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] lg:rounded-xl lg:py-3.5 lg:text-base"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          ) : !isDone ? (
            <>
              <h1 className="mb-1.5 text-center text-lg font-bold text-slate-800 lg:text-2xl">
                Atur Ulang Kata Sandi
              </h1>
              <p className="mb-1 text-center text-xs text-slate-500 lg:text-sm">
                Masukkan kata sandi baru untuk akun Anda.
              </p>
              <p className="mb-7 text-center text-[11px] text-slate-400 lg:mb-9 lg:text-xs">
                Tautan ini berlaku selama 30 menit sejak email dikirim.
              </p>

              {submitError && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 lg:mb-6 lg:px-5 lg:py-3 lg:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    {submitError}
                    {isRateLimited && (
                      <>
                        {" "}
                        Kata sandi Anda belum berubah — tautan ini masih
                        berlaku, coba lagi setelah beberapa saat.
                      </>
                    )}
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type="password"
                      name="newPassword"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (errors.newPassword)
                          setErrors({ ...errors, newPassword: null });
                      }}
                      placeholder="Minimal 8 karakter"
                      className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-4 lg:text-base lg:placeholder:text-sm ${
                        errors.newPassword
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                      }`}
                    />
                  </div>
                  {errors.newPassword && (
                    <p className="mt-1 text-xs text-red-500 lg:text-sm">
                      {errors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Konfirmasi Kata Sandi Baru
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errors.confirmPassword)
                          setErrors({ ...errors, confirmPassword: null });
                      }}
                      placeholder="Ulangi kata sandi baru"
                      className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-4 lg:text-base lg:placeholder:text-sm ${
                        errors.confirmPassword
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-red-500 lg:text-sm">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 lg:rounded-xl lg:py-3.5 lg:text-base"
                >
                  {loading && (
                    <Loader2 className="h-4 w-4 animate-spin lg:h-5 lg:w-5" />
                  )}
                  {loading ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-500 lg:mt-8 lg:text-sm">
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Kembali ke Halaman Masuk
                </button>
              </p>
            </>
          ) : (
            /* ── State: Berhasil ── */
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 lg:h-16 lg:w-16">
                <CheckCircle2 className="h-7 w-7 text-green-600 lg:h-8 lg:w-8" />
              </div>
              <h1 className="mb-2 text-lg font-bold text-slate-800 lg:text-2xl">
                Kata Sandi Diperbarui
              </h1>
              <p className="mb-7 text-xs text-slate-500 lg:mb-9 lg:text-sm">
                Kata sandi Anda berhasil diatur ulang. Silakan masuk kembali
                menggunakan kata sandi baru.
              </p>
              <button
                onClick={() => navigate("/admin")}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] lg:rounded-xl lg:py-3.5 lg:text-base"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-400 lg:text-xs">
            System Version 2.4.1
          </p>
          <p className="mt-1 text-[11px] text-slate-400 lg:text-xs">
            © {new Date().getFullYear()} SMART-ROSE Healthcare Systems. All
            rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
