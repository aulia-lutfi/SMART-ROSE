import { Bell, Menu, LogOut } from "lucide-react";

// Catatan: dropdown filter periode di topbar SENGAJA dihapus (24 Juli 2026)
// — AdminDashboardPage sudah punya filter periode sendiri (tombol pill
// Hari ini/Minggu ini/Bulan ini/Tahun ini) yang benar-benar mengontrol data
// dashboard. Dropdown di topbar dulu cuma nyimpen state lokal di App.jsx
// tanpa pernah dikirim ke AdminDashboardPage, jadi tidak berfungsi dan
// bikin bingung (2 filter periode yang tidak sinkron di satu halaman).

export default function AdminTopbar({
  onMenuToggle,
  title = "Dashboard",
  onNavigate,
  hideBell = false,
  onLogout,
  unreadCount = 0,
}) {
  return (
    <div className="border-b border-slate-200 bg-white shadow-sm print:hidden">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        {/* Sisi Kiri: Toggle Menu + Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
          >
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        </div>

        {/* Sisi Kanan: Notifikasi + Logout */}
        <div className="flex items-center gap-2">
          {!hideBell && (
            <button
              onClick={() => onNavigate?.("notifications")}
              className="relative rounded-lg p-2 hover:bg-slate-100"
            >
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              title="Keluar"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <LogOut className="h-5 w-5 text-slate-600" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
