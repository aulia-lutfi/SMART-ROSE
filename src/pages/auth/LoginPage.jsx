import { useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  KeyRound,
} from "lucide-react";
import * as authService from "../../services/auth/authService";

export default function LoginPage({ onLoginSuccess, onNavigate }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- State untuk alur OTP (khusus admin) ----
  // Kalau authService.login() mengembalikan requiresOtp: true, kita
  // pindah ke "tampilan OTP" (bukan halaman terpisah, cukup ganti form
  // yang ditampilkan di kartu yang sama) dan simpan email-nya di sini
  // supaya bisa dipakai saat submit OTP.
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!identifier.trim()) {
      newErrors.identifier = "Email atau No. Identitas Pegawai wajib diisi";
    }
    if (!password) {
      newErrors.password = "Kata sandi wajib diisi";
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    setErrors(newErrors);
    setSubmitError("");
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    try {
      const result = await authService.login({
        identifier,
        password,
        rememberMe,
      });

      // Backend minta verifikasi OTP dulu (khusus admin) — jangan
      // panggil onLoginSuccess dulu, pindah ke form input OTP.
      if (result.requiresOtp) {
        setOtpEmail(result.email || identifier);
        setOtpStep(true);
        return;
      }

      // authService sudah menyimpan accessToken & user sendiri di
      // dalam login() — di sini tinggal lanjutkan ke halaman berikutnya.
      if (onLoginSuccess) {
        onLoginSuccess(result.user);
      }
    } catch (err) {
      setSubmitError(
        err.message || "Email/No. Identitas atau kata sandi salah.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    if (!otp.trim()) {
      setOtpError("Kode OTP wajib diisi");
      return;
    }

    setOtpLoading(true);
    try {
      const user = await authService.verifyOtp({
        email: otpEmail,
        otp,
        rememberMe,
      });

      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setOtpError(err.message || "Kode OTP salah atau sudah kedaluwarsa.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setOtp("");
    setOtpError("");
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
        {/* Card Login */}
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-lg shadow-blue-900/5 sm:p-10 lg:p-12">
          {/* Logo & Judul */}
          <div className="mb-7 flex flex-col items-center text-center lg:mb-9">
            <img
              src="/LOGO_S-ROSE.svg"
              alt="SMART-ROSE"
              className="mb-2 h-auto w-48 sm:w-56 lg:w-64"
            />
          </div>

          {!otpStep ? (
            <>
              {submitError && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 lg:mb-6 lg:px-5 lg:py-3 lg:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-5">
                {/* Email / No. Identitas Pegawai */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Email atau No. Identitas Pegawai
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type="text"
                      name="identifier"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (errors.identifier)
                          setErrors({ ...errors, identifier: null });
                      }}
                      placeholder="Contoh: 198801334 atau email@rs.co.id"
                      className={`w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-4 lg:text-base lg:placeholder:text-sm ${
                        errors.identifier
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                      }`}
                    />
                  </div>
                  {errors.identifier && (
                    <p className="mt-1 text-xs text-red-500 lg:text-sm">
                      {errors.identifier}
                    </p>
                  )}
                </div>

                {/* Kata Sandi */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password)
                          setErrors({ ...errors, password: null });
                      }}
                      placeholder="••••••••"
                      className={`w-full rounded-lg border py-2.5 pl-9 pr-9 text-sm text-slate-700 focus:outline-none focus:ring-1 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-11 lg:text-base ${
                        errors.password
                          ? "border-red-300 focus:border-red-400 focus:ring-red-200"
                          : "border-slate-200 focus:border-blue-400 focus:ring-blue-200"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 lg:right-4"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 lg:h-5 lg:w-5" />
                      ) : (
                        <Eye className="h-4 w-4 lg:h-5 lg:w-5" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-xs text-red-500 lg:text-sm">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Ingat saya & Lupa kata sandi */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => onNavigate?.("lupa-kata-sandi")}
                    className="text-xs font-semibold text-blue-600 hover:underline lg:text-sm"
                  >
                    Lupa Kata Sandi?
                  </button>
                </div>

                {/* Tombol Masuk */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 lg:rounded-xl lg:py-3.5 lg:text-base"
                >
                  {loading && (
                    <Loader2 className="h-4 w-4 animate-spin lg:h-5 lg:w-5" />
                  )}
                  {loading ? "Memproses..." : "Masuk"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* ---- Tampilan verifikasi OTP ---- */}
              <p className="mb-5 text-center text-sm text-slate-600 lg:mb-6 lg:text-base">
                Kode verifikasi telah dikirim ke{" "}
                <span className="font-semibold text-slate-800">{otpEmail}</span>
                . Masukkan kode di bawah untuk melanjutkan.
              </p>

              {otpError && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-600 lg:mb-6 lg:px-5 lg:py-3 lg:text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {otpError}
                </div>
              )}

              <form
                onSubmit={handleVerifyOtp}
                className="space-y-4 lg:space-y-5"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 lg:mb-2 lg:text-sm">
                    Kode OTP
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                    <input
                      type="text"
                      name="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Masukkan kode OTP"
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-xs placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 lg:rounded-xl lg:py-3.5 lg:pl-12 lg:pr-4 lg:text-base lg:placeholder:text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60 lg:rounded-xl lg:py-3.5 lg:text-base"
                >
                  {otpLoading && (
                    <Loader2 className="h-4 w-4 animate-spin lg:h-5 lg:w-5" />
                  )}
                  {otpLoading ? "Memverifikasi..." : "Verifikasi"}
                </button>

                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 hover:underline lg:text-sm"
                >
                  Kembali ke halaman login
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-[11px] text-slate-400 lg:text-xs">
            System Version 2.4.1
            <span className="mx-1.5">·</span>
            <button
              type="button"
              onClick={() => onNavigate?.("privacy-policy")}
              className="hover:text-slate-600 hover:underline"
            >
              Privacy Policy
            </button>
            <span className="mx-1.5">·</span>
            <button
              type="button"
              onClick={() => onNavigate?.("security-compliance")}
              className="hover:text-slate-600 hover:underline"
            >
              Security Compliance
            </button>
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
