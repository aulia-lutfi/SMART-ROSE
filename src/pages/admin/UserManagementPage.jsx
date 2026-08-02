import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  UserPlus,
  Copy,
  Check,
  KeyRound,
  Loader2,
  AlertCircle,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import * as userManagementService from "../../services/admin/userManagementService";

// ============================================================
// ✅ 25 Juli 2026 — tab "Semua Pengguna" DIAKTIFKAN KEMBALI.
// Sebelumnya disembunyikan (lihat riwayat di
// UserManagementPage_SemuaPengguna_backup.jsx) karena backend belum
// punya GET /admin/users. Endpoint itu sekarang sudah LIVE (dikonfirmasi
// tim BE 25 Juli 2026) — dipakai lewat
// userManagementService.getDaftarUserLengkap().
//
// ✅ 27 Juli 2026 — Edit & Hapus akun DIAKTIFKAN. PATCH & DELETE
// /admin/users/:id dikonfirmasi live oleh BE, termasuk guard yang
// mencegah ADMIN_UTAMA aktif terakhir di-nonaktifkan/downgrade/dihapus.
// Poin yang masih perlu diperhatikan (lihat juga catatan di
// userManagementService.js):
//   1. Pesan error dari guard tersebut diteruskan APA ADANYA dari
//      backend (lewat extractErrorMessage() di bawah), BUKAN diganti
//      teks generic — supaya admin tahu persis kenapa aksinya ditolak.
//   2. Soft-delete: backend sudah auto-filter user ber-`deletedAt` dari
//      semua query GET /admin/users, jadi user yang baru dihapus cukup
//      dibuang dari state lokal (tidak perlu logic filter tambahan di
//      FE) — TIDAK ADA fitur restore di sini karena endpoint restore
//      belum dikonfirmasi ada di BE.
//
// ✅ 27 Juli 2026 (update kedua, dokumen final BE) — poin #3 di atas
// SUDAH DIJAWAB TUNTAS oleh BE, jadi bagian yang tadinya "asumsi" itu
// sekarang FINAL:
//   - Field body PATCH memang sama persis dengan field response GET.
//   - Ganti email BENAR memaksa logout semua sesi aktif user itu
//     (otomatis di sisi BE), dan BE otomatis mengirim email notifikasi
//     ke alamat lama + baru. Modal Edit di bawah sudah tidak lagi
//     menampilkan catatan "belum dipastikan" — sekarang menampilkan info
//     final ke admin (lihat bagian input Email di form Edit).
// ============================================================

// ── Label & warna role, dari nilai asli backend (bukan asumsi lagi) ──────
const ROLE_LABELS = {
  ADMIN_UTAMA: "Admin Utama",
  ADMIN: "Admin",
};
const ROLE_COLORS = {
  ADMIN_UTAMA: "bg-purple-100 text-purple-700",
  ADMIN: "bg-blue-100 text-blue-700",
  USER: "bg-amber-100 text-amber-700",
};

// ── Label status verifikasi, dari nilai asli backend ──────────────────────
const STATUS_VERIFIKASI_LABELS = {
  PENDING: "Menunggu Verifikasi",
  APPROVED: "Terverifikasi",
  REJECTED: "Ditolak",
};

function formatTanggal(isoString) {
  if (!isoString) return "-";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ⚠️ CATATAN: belum sempat lihat isi apiClient.js, jadi belum pasti
// bentuk error-nya persis seperti apa (bisa gaya axios —
// err.response.data.message — atau sudah di-unwrap jadi err.message
// biasa, seperti pola di authService.js/profilService.js). Helper ini
// coba beberapa kemungkinan supaya pesan ASLI dari backend (termasuk
// pesan guard ADMIN_UTAMA terakhir) tetap muncul apa adanya ke admin,
// bukan fallback generic — SELAMA salah satu bentuk ini cocok. Kalau
// ternyata pesan guard masih tidak muncul dengan benar saat dites,
// cek dulu bentuk error asli dari apiClient.js dan sesuaikan di sini.
function extractErrorMessage(err, fallback) {
  return (
    err?.response?.data?.message ||
    err?.data?.message ||
    err?.message ||
    fallback
  );
}

// Status gabungan yang ditampilkan di tabel: prioritas ke `aktif` (kalau
// nonaktif, tampilkan itu dulu), baru ke statusVerifikasi kalau belum
// APPROVED (mis. staf yang baru daftar sendiri dan belum di-approve —
// lihat catatan konsep di riwayat file lama soal alur approve terpisah
// untuk akun USER/staf).
function getStatusBadge(user) {
  if (!user.aktif) {
    return {
      label: "Nonaktif",
      color: "bg-slate-100 text-slate-500",
      dot: "bg-slate-400",
    };
  }
  if (user.statusVerifikasi && user.statusVerifikasi !== "APPROVED") {
    return {
      label:
        STATUS_VERIFIKASI_LABELS[user.statusVerifikasi] ||
        user.statusVerifikasi,
      color: "bg-amber-100 text-amber-700",
      dot: "bg-amber-500",
    };
  }
  return {
    label: "Aktif",
    color: "bg-green-100 text-green-700",
    dot: "bg-green-600",
  };
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState("semua-pengguna");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Tab "Semua Pengguna": data dari GET /admin/users ────────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Edit & Hapus akun (✅ 27 Juli 2026) ──────────────────────────────
  const [openMenuUserId, setOpenMenuUserId] = useState(null);
  // Posisi dropdown "Aksi" saat dirender lewat portal (lihat catatan di
  // handleToggleMenu di bawah) — { top, left } dalam koordinat viewport
  // (cocok dipakai dengan position: fixed karena getBoundingClientRect()
  // juga viewport-relative).
  const [menuPosition, setMenuPosition] = useState(null);

  // Lebar & perkiraan tinggi dropdown, dipakai untuk hitung posisi &
  // auto-flip ke atas kalau baris terlalu dekat ke bawah viewport.
  const MENU_WIDTH = 160; // w-40
  const MENU_HEIGHT_ESTIMATE = 96; // 2 item menu (~2 x 44px + border)

  const closeMenu = useCallback(() => {
    setOpenMenuUserId(null);
    setMenuPosition(null);
  }, []);

  // ⚠️ Dropdown ini sebelumnya dirender `position: absolute` DI DALAM
  // container tabel yang overflow-x-auto — akibatnya baris-baris di
  // dekat bawah tabel dropdown-nya kepotong/harus discroll, karena
  // overflow-x-auto memaksa overflow-y ikut "auto" juga (perilaku
  // default CSS: kalau salah satu axis overflow bukan visible, axis
  // lainnya ikut jadi auto). Sekarang dropdown dirender lewat React
  // Portal ke document.body dengan position: fixed, jadi lepas total
  // dari batas/scroll container tabel.
  const handleToggleMenu = (event, userId) => {
    if (openMenuUserId === userId) {
      closeMenu();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE + 8;

    setMenuPosition({
      top: openUpward ? rect.top - MENU_HEIGHT_ESTIMATE - 4 : rect.bottom + 4,
      // Rata kanan ke tombol "Aksi" (sama seperti posisi lama `right-6`)
      left: rect.right - MENU_WIDTH,
    });
    setOpenMenuUserId(userId);
  };

  // Tutup menu kalau halaman/tabel discroll atau ukuran window berubah,
  // supaya dropdown tidak "nempel di udara" pada posisi lama yang sudah
  // tidak sesuai dengan tombolnya lagi. `true` di listener scroll supaya
  // ikut menangkap scroll dari container tabel (overflow-x-auto), bukan
  // cuma scroll window.
  useEffect(() => {
    if (openMenuUserId == null) return;
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [openMenuUserId, closeMenu]);

  const [editingUser, setEditingUser] = useState(null); // objek user | null
  const [editForm, setEditForm] = useState({
    nama: "",
    email: "",
    role: "ADMIN",
    unitKerja: "",
    aktif: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  const [deletingUserId, setDeletingUserId] = useState(null); // id yang sedang diproses hapus
  const [actionError, setActionError] = useState(""); // error dari aksi hapus (di luar modal edit)

  const fetchUsers = useCallback(async (search = "") => {
    setLoadingUsers(true);
    setLoadError("");
    try {
      const data = await userManagementService.getDaftarUserLengkap({
        search,
      });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(
        err.message || "Gagal memuat daftar pengguna. Silakan coba lagi.",
      );
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounce pencarian: kirim ?search= ke backend 400ms setelah user
  // berhenti mengetik, sama seperti pola di versi backup lama.
  useEffect(() => {
    if (activeTab !== "semua-pengguna") return;
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeTab]);

  // Pencarian sudah dilakukan di backend (query `search`), jadi `users`
  // di sini bisa langsung dipakai tanpa filter tambahan di client.
  const filteredUsers = users;

  // ── Tab "Buat Akun Admin" (sudah live sebelumnya, TIDAK diubah) ─────────
  // Password TIDAK digenerate di sisi klien — backend yang generate dan
  // mengembalikannya sekali di response POST /admin/users.
  const [newAdminForm, setNewAdminForm] = useState({
    nama: "",
    email: "",
    noPegawai: "",
    unitKerja: "",
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null); // { nama, email, password } | null
  const [copiedField, setCopiedField] = useState(null); // "email" | "password" | null

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      // Gagal salin (mis. browser tidak mendukung clipboard API) — abaikan
      // secara diam-diam, admin masih bisa salin manual dari layar.
    }
  };

  // POST /admin/users — body: { nama, email, noPegawai, unitKerja }
  // Response 201 mengembalikan password plain text SEKALI SAJA.
  const handleCreateAdmin = async () => {
    const { nama, email, noPegawai, unitKerja } = newAdminForm;
    if (
      !nama.trim() ||
      !email.trim() ||
      !noPegawai.trim() ||
      !unitKerja.trim()
    ) {
      setCreateAdminError("Semua field wajib diisi!");
      return;
    }
    setCreatingAdmin(true);
    setCreateAdminError("");
    try {
      const created = await userManagementService.createAdmin({
        nama,
        email,
        noPegawai,
        unitKerja,
      });

      setCreatedAccount({
        nama,
        email,
        password:
          created?.password ??
          "(password tidak ditemukan di response — cek konsol)",
      });
      if (!created?.password) {
        console.warn(
          "[UserManagementPage] Field password tidak ditemukan di response createAdmin(). Response asli:",
          created,
        );
      }
      setNewAdminForm({ nama: "", email: "", noPegawai: "", unitKerja: "" });

      // Akun baru langsung muncul di tab "Semua Pengguna" tanpa perlu
      // pindah tab & refetch manual — reset ke halaman pertama pencarian
      // kosong supaya akun barunya (biasanya paling atas/terbaru) kelihatan.
      if (searchQuery === "") {
        fetchUsers("");
      }
    } catch (err) {
      setCreateAdminError(err.message || "Gagal membuat akun admin");
    } finally {
      setCreatingAdmin(false);
    }
  };

  // ── Edit akun ────────────────────────────────────────────────────────
  const handleOpenEdit = (user) => {
    closeMenu();
    setEditError("");
    setEditingUser(user);
    setEditForm({
      nama: user.nama || "",
      email: user.email || "",
      role: user.role || "ADMIN",
      unitKerja: user.unitKerja || "",
      aktif: user.aktif ?? true,
    });
  };

  const handleCloseEdit = () => {
    if (savingEdit) return; // jangan bisa ditutup saat request masih jalan
    setEditingUser(null);
    setEditError("");
  };

  // PATCH /admin/users/:id — lihat catatan lengkap soal payload &
  // guard ADMIN_UTAMA di userManagementService.js.
  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    // Validasi ringan sisi klien, mengikuti aturan BE persis (lihat
    // dokumen PATCH /admin/users/:id) — supaya admin dapat feedback
    // instan tanpa perlu round-trip request yang pasti ditolak backend.
    if (!editForm.nama.trim() || !editForm.email.trim()) {
      setEditError("Nama dan email wajib diisi");
      return;
    }
    if (editForm.nama.trim().length < 3) {
      setEditError("Nama minimal 3 karakter");
      return;
    }
    if (!editForm.unitKerja.trim()) {
      setEditError("Unit Kerja tidak boleh kosong");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await userManagementService.updateUser(editingUser.id, {
        nama: editForm.nama.trim(),
        email: editForm.email.trim(),
        role: editForm.role,
        unitKerja: editForm.unitKerja.trim(),
        aktif: editForm.aktif,
      });

      // Update state lokal langsung (optimistic) supaya tabel ikut
      // berubah tanpa perlu fetch ulang seluruh daftar.
      setUsers((prev) =>
        prev.map((u) => (u.id === editingUser.id ? { ...u, ...editForm } : u)),
      );
      setEditingUser(null);
    } catch (err) {
      // ⚠️ Ini yang menampilkan pesan guard ADMIN_UTAMA terakhir dari
      // backend (mis. "Tidak bisa menonaktifkan admin ini karena
      // merupakan satu-satunya Admin Utama aktif.") apa adanya — JANGAN
      // ganti jadi teks generic di sini.
      setEditError(extractErrorMessage(err, "Gagal memperbarui data pengguna"));
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Hapus akun (soft-delete) ─────────────────────────────────────────
  // ✅ Diganti dari window.confirm() (popup native browser) ke modal
  // konfirmasi custom (lihat state confirmDeleteUser & render modal di
  // bawah), supaya tampilannya konsisten dengan desain aplikasi.
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null); // objek user | null

  const handleDeleteUser = (user) => {
    closeMenu();
    setActionError("");
    setConfirmDeleteUser(user);
  };

  const handleCancelDelete = () => {
    if (deletingUserId) return; // jangan bisa dibatalkan saat request masih jalan
    setConfirmDeleteUser(null);
  };

  // DELETE /admin/users/:id — dipanggil setelah admin menekan tombol
  // konfirmasi "Hapus" di modal (bukan lagi window.confirm). Lihat
  // catatan lengkap soal soft-delete & guard ADMIN_UTAMA di
  // userManagementService.js.
  const handleConfirmDelete = async () => {
    if (!confirmDeleteUser) return;
    const user = confirmDeleteUser;

    setActionError("");
    setDeletingUserId(user.id);
    try {
      await userManagementService.deleteUser(user.id);
      // Backend sudah auto-filter user ber-deletedAt dari GET
      // /admin/users, jadi cukup buang dari state lokal — tidak perlu
      // fetch ulang.
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setConfirmDeleteUser(null);
    } catch (err) {
      // Sama seperti edit: pesan guard ADMIN_UTAMA terakhir (kalau kena)
      // diteruskan apa adanya, ditampilkan sebagai banner di atas tabel.
      // Modal ditutup dulu di sini supaya banner-nya kelihatan (modal
      // menutupi seluruh layar selama masih terbuka).
      setConfirmDeleteUser(null);
      setActionError(
        extractErrorMessage(err, `Gagal menghapus akun "${user.nama}"`),
      );
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-slate-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab("semua-pengguna")}
            className={`pb-3 text-sm font-semibold transition ${
              activeTab === "semua-pengguna"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Semua Pengguna
          </button>
          <button
            onClick={() => setActiveTab("buat-admin")}
            className={`pb-3 text-sm font-semibold transition ${
              activeTab === "buat-admin"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Buat Akun Admin
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Tab Content: Semua Pengguna                                   */}
      {/* ============================================================ */}
      {activeTab === "semua-pengguna" && (
        <div>
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              name="search-users"
              id="search-users"
              autoComplete="off"
              placeholder="Cari nama atau email pengguna..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
          </div>

          {loadError && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {loadError}
              </span>
              <button
                onClick={() => fetchUsers(searchQuery)}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Error dari aksi Hapus (termasuk pesan guard ADMIN_UTAMA
              terakhir dari backend) — terpisah dari loadError karena
              tidak terkait gagal MEMUAT data, tapi gagal aksi HAPUS. */}
          {actionError && (
            <div className="mb-5 flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {actionError}
              </span>
              <button
                onClick={() => setActionError("")}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold hover:bg-red-100"
              >
                Tutup
              </button>
            </div>
          )}

          {loadingUsers ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm font-medium text-slate-500">
                Memuat data pengguna...
              </p>
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">
                      Nama & Email
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">
                      Peran
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">
                      Unit Kerja
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase text-slate-600">
                      Terdaftar
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold uppercase text-slate-600">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const statusBadge = getStatusBadge(user);
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {user.nama}
                            </p>
                            <p className="text-xs text-slate-500">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                              ROLE_COLORS[user.role] ||
                              "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {ROLE_LABELS[user.role] || user.role || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {user.unitKerja || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${statusBadge.color}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusBadge.dot}`}
                            />
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {formatTanggal(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => handleToggleMenu(e, user.id)}
                            disabled={deletingUserId === user.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <MoreVertical className="h-3.5 w-3.5" />
                            )}
                            Aksi
                          </button>

                          {/* ✅ Dropdown ini dirender lewat Portal ke
                              document.body (posisi: fixed, dihitung dari
                              getBoundingClientRect tombol di atas) supaya
                              TIDAK kepotong oleh overflow-x-auto milik
                              container tabel — sebelumnya versi
                              `absolute` di dalam <td> kepotong untuk
                              baris-baris dekat bawah tabel. Auto-flip ke
                              atas juga sudah ditangani di
                              handleToggleMenu kalau ruang di bawah
                              tombol tidak cukup. */}
                          {openMenuUserId === user.id &&
                            menuPosition &&
                            createPortal(
                              <>
                                {/* Backdrop transparan — klik di luar
                                    menu untuk menutupnya. */}
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={closeMenu}
                                />
                                <div
                                  style={{
                                    position: "fixed",
                                    top: menuPosition.top,
                                    left: menuPosition.left,
                                    width: MENU_WIDTH,
                                  }}
                                  className="z-50 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-lg"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(user)}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(user)}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Hapus
                                  </button>
                                </div>
                              </>,
                              document.body,
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-base font-semibold text-slate-600">
                Pengguna tidak ditemukan
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-400">
                Coba kata kunci lain atau tambahkan pengguna baru
              </p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab Content: Buat Akun Admin (sudah live sebelumnya, tidak    */}
      {/* diubah logic-nya — cuma dipindah ke dalam struktur tab)       */}
      {/* ============================================================ */}
      {activeTab === "buat-admin" &&
        (createdAccount ? (
          <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                <KeyRound className="h-4.5 w-4.5 text-green-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Akun Admin Berhasil Dibuat
                </h2>
                <p className="text-xs text-slate-500">{createdAccount.nama}</p>
              </div>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p className="text-xs font-medium text-amber-700">
                Catat atau salin kredensial ini sekarang. Password ini
                <strong> tidak akan ditampilkan lagi</strong> setelah Anda
                meninggalkan halaman ini. Sampaikan secara manual dan aman
                kepada admin yang bersangkutan.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Username (Email)
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                  <span className="flex-1 truncate text-sm font-semibold text-slate-800">
                    {createdAccount.email}
                  </span>
                  <button
                    onClick={() => handleCopy(createdAccount.email, "email")}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === "email" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedField === "email" ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Password
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5">
                  <span className="flex-1 truncate font-mono text-sm font-semibold text-slate-800">
                    {createdAccount.password}
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(createdAccount.password, "password")
                    }
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === "password" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copiedField === "password" ? "Tersalin" : "Salin"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-green-100 pt-5">
              <button
                onClick={() => setCreatedAccount(null)}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition active:scale-95"
              >
                <UserPlus className="h-4 w-4" />
                Buat Akun Admin Lain
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-bold text-slate-800">
              Buat Akun Admin Baru
            </h2>
            <p className="mb-6 text-sm text-slate-600">
              Akun langsung dibuat dan aktif. Password akan digenerate otomatis
              oleh sistem dan ditampilkan sekali setelah akun berhasil dibuat —
              sampaikan kredensialnya secara manual kepada admin yang
              bersangkutan.
            </p>

            {createAdminError && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createAdminError}
              </div>
            )}

            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="new-admin-nama"
                    autoComplete="off"
                    value={newAdminForm.nama}
                    onChange={(e) =>
                      setNewAdminForm({
                        ...newAdminForm,
                        nama: e.target.value,
                      })
                    }
                    placeholder="Contoh: dr. Budi Santoso"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email (jadi Username Login){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="new-admin-email"
                    autoComplete="off"
                    value={newAdminForm.email}
                    onChange={(e) =>
                      setNewAdminForm({
                        ...newAdminForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="admin@hospital.id"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Nomor Pegawai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="new-admin-noPegawai"
                    autoComplete="off"
                    value={newAdminForm.noPegawai}
                    onChange={(e) =>
                      setNewAdminForm({
                        ...newAdminForm,
                        noPegawai: e.target.value,
                      })
                    }
                    placeholder="Contoh: 198501012010011002"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Unit Kerja <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="new-admin-unitKerja"
                    autoComplete="off"
                    value={newAdminForm.unitKerja}
                    onChange={(e) =>
                      setNewAdminForm({
                        ...newAdminForm,
                        unitKerja: e.target.value,
                      })
                    }
                    placeholder="Contoh: Komite Keselamatan Pasien"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setNewAdminForm({
                      nama: "",
                      email: "",
                      noPegawai: "",
                      unitKerja: "",
                    });
                    setCreateAdminError("");
                  }}
                  disabled={creatingAdmin}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
                >
                  Reset
                </button>
                <button
                  onClick={handleCreateAdmin}
                  disabled={creatingAdmin}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-60"
                >
                  {creatingAdmin ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  {creatingAdmin ? "Membuat Akun..." : "Buat Akun"}
                </button>
              </div>
            </div>
          </div>
        ))}

      {/* ============================================================ */}
      {/* Modal Edit Akun (✅ 27 Juli 2026)                              */}
      {/* ============================================================ */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Edit Pengguna
              </h2>
              <button
                type="button"
                onClick={handleCloseEdit}
                disabled={savingEdit}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-60"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {editError}
              </div>
            )}

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={editForm.nama}
                  onChange={(e) =>
                    setEditForm({ ...editForm, nama: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
                {/* ✅ 27 Juli 2026 — dikonfirmasi final oleh BE (bukan lagi
                    "belum dipastikan"): ganti email otomatis meng-invalidate
                    semua sesi aktif pengguna ini di semua device, DAN BE
                    otomatis mengirim email notifikasi ke alamat lama & baru
                    sekaligus. Admin tidak perlu menyampaikan ini manual ke
                    pengguna — cukup diberi tahu di sini bahwa hal itu akan
                    terjadi otomatis. */}
                {editForm.email !== editingUser.email && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Pengguna akan otomatis logout dari semua perangkat begitu
                    email ini disimpan, dan sistem akan mengirim email
                    notifikasi otomatis ke alamat lama maupun baru. Pengguna
                    perlu login ulang memakai email baru.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Peran
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Unit Kerja
                </label>
                <input
                  type="text"
                  value={editForm.unitKerja}
                  onChange={(e) =>
                    setEditForm({ ...editForm, unitKerja: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Akun Aktif
                </span>
                {/* Toggle switch (bukan checkbox) — klik area mana pun di
                    kapsul ini untuk membalik status aktif/nonaktif. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={editForm.aktif}
                  onClick={() =>
                    setEditForm({ ...editForm, aktif: !editForm.aktif })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                    editForm.aktif ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      editForm.aktif ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              {/* Kalau ini ADMIN_UTAMA aktif terakhir dan admin coba
                  matikan toggle di atas atau ganti Peran-nya, backend akan
                  menolak — pesannya akan muncul di banner error di atas
                  form ini (lihat handleSubmitEdit / extractErrorMessage). */}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={savingEdit}
                  className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition active:scale-95 disabled:opacity-60"
                >
                  {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingEdit ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Modal Konfirmasi Hapus Akun (✅ ganti dari window.confirm)      */}
      {/* ============================================================ */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </span>
              <h2 className="text-lg font-bold text-slate-800">Hapus Akun?</h2>
            </div>

            <p className="mb-6 text-sm leading-relaxed text-slate-600">
              Akun{" "}
              <span className="font-semibold text-slate-800">
                "{confirmDeleteUser.nama}"
              </span>{" "}
              akan dihapus dan tidak akan muncul lagi di daftar ini.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={deletingUserId === confirmDeleteUser.id}
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition active:scale-95 disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingUserId === confirmDeleteUser.id}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition active:scale-95 disabled:opacity-60"
              >
                {deletingUserId === confirmDeleteUser.id && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {deletingUserId === confirmDeleteUser.id
                  ? "Menghapus..."
                  : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
