import { useState } from "react";
import {
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import * as authService from "../../services/auth/authService";

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email wajib diisi");
      return;
    }
    if (!validateEmail(email.trim())) {
      setError("Format email tidak valid");
      return;
    }
    setError("");
    setSubmitError("");

    setLoading(true);
    try {
      await authService.forgotPassword({ email });
      setIsSent(true);
    } catch (err) {
      setSubmitError(
        err.message || "Gagal mengirim tautan reset. Silakan coba lagi.",
      );
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
        {/* Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-blue-900/5 sm:p-10 lg:p-12">
          {/* Logo */}
          <div className="mb-7 flex flex-col items-center text-center lg:mb-9">
            <img
              src="/LOGO_S-ROSE.svg"
              alt="SMART-ROSE"
              className="mb-2 h-auto w-48 sm:w-56 lg:w-64"
            />
          </div>

          {!isSent ? (
            <>
              <h1 className="mb-1.5 text-center text-lg font-bold text-slate-800 lg:text-2xl">
                Lupa Kata Sandi?
              </h1>
              <p className="mb-7 text-center text-xs text-slate-500 lg:mb-9 lg:text-sm">
                Masukkan email yang terdaftar, nanti kami kirimkan tautan untuk
                atur ulang kata sandi.
              </p>

              {submitError && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 lg:mb-6 lg:px-5 lg:py-3 lg:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                {/* Email (backend hanya menerima email, bukan No. Identitas Pegawai) */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type="email"
                      name="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Contoh: email@rs.co.id"
                      className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-4 lg:text-base lg:placeholder:text-sm ${
                        error
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                      }`}
                    />
                  </div>
                  {error && (
                    <p className="mt-1 text-xs text-red-500 lg:text-sm">
                      {error}
                    </p>
                  )}
                </div>

                {/* Tombol Kirim */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 lg:rounded-xl lg:py-3.5 lg:text-base"
                >
                  {loading && (
                    <Loader2 className="h-4 w-4 animate-spin lg:h-5 lg:w-5" />
                  )}
                  {loading ? "Mengirim..." : "Kirim Tautan Reset"}
                </button>
              </form>
            </>
          ) : (
            /* ── State: Berhasil Terkirim ── */
            <div className="text-center">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 lg:h-16 lg:w-16">
                <CheckCircle2 className="h-7 w-7 text-green-600 lg:h-8 lg:w-8" />
              </div>
              <h1 className="mb-2 text-lg font-bold text-slate-800 lg:text-2xl">
                Tautan Terkirim
              </h1>
              <p className="mb-7 text-xs text-slate-500 lg:mb-9 lg:text-sm">
                Jika{" "}
                <span className="font-semibold text-slate-700">{email}</span>{" "}
                terdaftar di sistem kami, tautan untuk atur ulang kata sandi
                sudah kami kirimkan. Silakan cek kotak masuk (atau folder spam)
                email Anda.
              </p>
              <button
                onClick={() => onNavigate?.("login")}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] lg:rounded-xl lg:py-3.5 lg:text-base"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          )}

          {/* Link Kembali - hanya tampil sebelum berhasil kirim */}
          {!isSent && (
            <p className="mt-6 text-center text-xs text-slate-500 lg:mt-8 lg:text-sm">
              <button
                type="button"
                onClick={() => onNavigate?.("login")}
                className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali ke Halaman Masuk
              </button>
            </p>
          )}
        </div>

        {/* Footer */}
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
