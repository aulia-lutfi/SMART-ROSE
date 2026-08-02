import { useState, useEffect } from "react";
import { getDashboardData } from "../../services/admin/adminDashboardService";
import { TrendingUp, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

// ── Stat Card Component ───────────────────────────────────────────────────
function StatCard({ icon: Icon, value, label, trend, color = "blue" }) {
  const colorMap = {
    blue: { bg: "bg-blue-50", icon: "text-blue-600", trend: "text-green-600" },
    green: {
      bg: "bg-green-50",
      icon: "text-green-600",
      trend: "text-green-600",
    },
    orange: {
      bg: "bg-orange-50",
      icon: "text-orange-600",
      trend: "text-green-600",
    },
  };

  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`${c.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
      <div className="mb-3 flex items-start justify-between">
        <div className={`rounded-lg bg-white p-2 ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-0.5 text-xs font-semibold ${c.trend}`}
          >
            <TrendingUp className="h-3 w-3" />
            {trend}
          </div>
        )}
      </div>
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-2">{value}</p>
    </div>
  );
}

// ── Bar Chart Component (Distribusi Jenis Insiden) ────────────────────────
function DistribusiJenisChart({ data }) {
  // ── Sumbu X/Y & grid tetap full-width seperti semula. Bar dirapatkan
  // ke kiri (dekat sumbu Y) lewat padding kanan pada XAxis, bukan dengan
  // mengecilkan lebar chart, supaya garis sumbu tidak ikut terpotong. ──
  const rightPadding = Math.max(0, (6 - data.length) * 85);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <h3 className="text-base font-bold text-slate-800 mb-4">
        Distribusi Jenis Insiden
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={data}
          barCategoryGap="10%"
          margin={{ top: 10, right: 20, left: -15, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="#94a3b8"
            style={{ fontSize: "12px" }}
            padding={{ left: 4, right: rightPadding }}
          />
          <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} width={35} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
            }}
            cursor={{ fill: "transparent" }}
          />
          <Bar dataKey="jumlah" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {data.map((entry, idx) => (
              <Cell key={`cell-${idx}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-flow-col grid-rows-2 justify-start gap-x-5 gap-y-1.5 text-xs">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="whitespace-nowrap text-slate-600">
              {item.name}: {item.jumlah}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Horizontal Progress Bar Component (Tingkat Keparahan) ─────────────────
function TingkatKeparahanChart({ data }) {
  // ── Panjang tiap bar proporsional terhadap nilai "laporan" terbesar
  // di dalam data, bukan angka tetap, jadi otomatis menyesuaikan kalau
  // data dari BE berubah. Data (name, laporan, color) tidak diubah. ──
  const maxLaporan = Math.max(...data.map((item) => item.laporan), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-full">
      <div className="mb-5 flex items-start justify-between gap-3">
        <h3 className="text-base font-bold text-slate-800">
          Tingkat Keparahan (Grading)
        </h3>
        <span className="whitespace-nowrap text-xs text-slate-400">
          Berdasarkan Matriks Risiko
        </span>
      </div>
      <div className="space-y-5">
        {data.map((item) => {
          const widthPct = Math.max(4, (item.laporan / maxLaporan) * 100);
          return (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold" style={{ color: item.color }}>
                    {item.name}
                  </span>
                </div>
                <span className="font-semibold text-slate-800">
                  {item.laporan} Laporan
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Area Chart Component ───────────────────────────────────────────────────
function TrenInsidenChart({ data }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-800 mb-4">
        Tren Insiden Bulanan
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 20, left: -15, bottom: 0 }}
        >
          {/* ── Gradient rongga di bawah garis: solid di atas, transparan
          di bawah, biar ada efek "hollow" yang menarik tanpa menutupi
          grid/chart di baliknya ── */}
          <defs>
            <linearGradient
              id="trenInsidenGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="bulan"
            stroke="#94a3b8"
            style={{ fontSize: "12px" }}
          />
          <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} width={35} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
            }}
          />
          <Area
            type="linear"
            dataKey="insiden"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#trenInsidenGradient)"
            dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [selectedPeriode, setSelectedPeriode] = useState("Bulan ini");
  const periodes = ["Hari ini", "Minggu ini", "Bulan ini", "Tahun ini"];

  // ── State data dashboard - diisi lewat adminDashboardService ──
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [distribusiJenis, setDistribusiJenis] = useState([]);
  const [tingkatKeparahan, setTingkatKeparahan] = useState([]);
  const [trenBulanan, setTrenBulanan] = useState([]);
  const [statusTindakLanjut, setStatusTindakLanjut] = useState(null);

  // ── Ambil data dashboard setiap kali periode berubah ──
  // Mengikuti pola getCurrentUser di dashboardService.js: async function
  // di dalam useEffect, dengan isMounted guard supaya aman dari race
  // condition kalau periode diganti cepat berkali-kali.
  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      try {
        const data = await getDashboardData(selectedPeriode);
        if (isMounted) {
          setStats(data.stats);
          setDistribusiJenis(data.distribusiJenis);
          setTingkatKeparahan(data.tingkatKeparahan);
          setTrenBulanan(data.trenBulanan);
          setStatusTindakLanjut(data.statusTindakLanjut);
        }
      } catch (error) {
        console.error("Gagal memuat dashboard:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, [selectedPeriode]);

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 lg:px-8">
      {/* Periode Section */}
      <div className="mb-6 flex items-center justify-between gap-3 sm:gap-4">
        {/* Periode Tabs - Bisa scroll di mobile */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2">
          {periodes.map((periode) => (
            <button
              key={periode}
              onClick={() => setSelectedPeriode(periode)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition active:scale-95 sm:px-4 sm:py-2 ${
                selectedPeriode === periode
                  ? "bg-blue-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {periode}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <p className="text-sm text-slate-400">Memuat data dashboard...</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {stats.map((item, idx) => (
              <StatCard
                key={idx}
                icon={item.icon}
                value={item.value}
                label={item.label}
                trend={item.trend}
                color={item.color}
              />
            ))}
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pie Chart */}
            <DistribusiJenisChart data={distribusiJenis} />

            {/* Bar Chart */}
            <TingkatKeparahanChart data={tingkatKeparahan} />

            {/* Area Chart - Full Width */}
            <div className="lg:col-span-2">
              <TrenInsidenChart data={trenBulanan} />
            </div>

            {/* Status Card - Full Width */}
            <div className="lg:col-span-2">
              {statusTindakLanjut && (
                <StatusTindakLanjutCard data={statusTindakLanjut} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
