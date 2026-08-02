import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Bell,
  Shield,
  Users,
  Settings,
  X,
} from "lucide-react";

const ADMIN_MENU = [
  { id: "admin-dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "incident-management", label: "Manajemen Insiden", icon: FileText },
  { id: "analysis", label: "Analisis & Investigasi", icon: BarChart3 },
  { id: "audit-log", label: "Audit Log", icon: Shield },
  // Khusus SUPER_ADMIN: admin biasa dibuatkan akunnya oleh admin utama,
  // jadi menu ini tidak boleh terlihat/dipakai oleh admin biasa.
  {
    id: "user-management",
    label: "Manajemen Pengguna",
    icon: Users,
    superAdminOnly: true,
  },
  { id: "notifications", label: "Notifikasi", icon: Bell },
  { id: "profile-settings", label: "Pengaturan Profil", icon: Settings },
];

export default function AdminNavMenu({
  activeMenu,
  isOpen,
  onMenuToggle,
  onNavigate,
  user,
}) {
  // Admin biasa tidak boleh melihat menu "Manajemen Pengguna" — cuma
  // admin utama yang berhak membuat/mengelola akun admin lain.
  // PENTING: role dari backend asli persis "ADMIN_UTAMA" (Dokumen Serah
  // Terima BE-FE Bagian 3.7), bukan "SUPER_ADMIN" — vocab lama itu sudah
  // dibuang total (lihat App.jsx).
  const isSuperAdmin = user?.role === "ADMIN_UTAMA";
  const visibleMenu = ADMIN_MENU.filter(
    (item) => !item.superAdminOnly || isSuperAdmin,
  );

  return (
    <nav
      className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-white border-r border-slate-200 transition-transform duration-300 print:hidden lg:relative lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* 1. Header (Tetap) */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <img
            src="/LOGO_S-ROSE.svg"
            alt="SMART-ROSE"
            className="h-15 w-auto max-w-[180px] object-contain"
          />

          {/* Close Button - Hanya di Mobile */}
          <button
            onClick={onMenuToggle}
            className="lg:hidden rounded-lg p-1 hover:bg-slate-100 text-slate-600 flex-shrink-0 ml-auto"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* 2. AREA MENU (Satu-satunya yang bisa scroll) */}
      {/* PENTING: Jangan masukkan div profil ke dalam sini */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {visibleMenu.map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate?.(item.id);
                  if (window.innerWidth < 1024) onMenuToggle?.();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. AREA PROFIL (Sticky/Tetap) */}
      {/* Pastikan ini berada di luar div "flex-1 overflow-y-auto" di atas */}
      {/* Klik area ini akan navigasi ke halaman Pengaturan Profil.
          Nanti kalau backend sudah jalan, tinggal ganti isi user?.name,
          user?.role, dan user?.avatarUrl dengan data asli dari
          getCurrentUser() - tidak perlu ubah struktur di bawah ini lagi. */}
      <button
        onClick={() => {
          onNavigate?.("profile-settings");
          if (window.innerWidth < 1024) onMenuToggle?.();
        }}
        className="flex-shrink-0 w-full border-t border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition text-left"
      >
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.nama || "Admin"}
              className="h-10 w-10 rounded-full object-cover border border-blue-200"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 border border-blue-200">
              <span className="text-sm font-bold text-blue-700">
                {(user?.nama || "A").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user?.nama || "Admin User"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {user?.role || "Lead Inspector"}
            </p>
          </div>
        </div>
      </button>
    </nav>
  );
}
