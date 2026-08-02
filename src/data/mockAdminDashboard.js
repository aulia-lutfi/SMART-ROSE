import { FileText, AlertCircle, CheckCircle2 } from "lucide-react";

// ── Mock Data: Dashboard Admin ─────────────────────────────────────────────
// Dipisah per periode supaya saat filter "Hari ini/Minggu ini/Bulan ini/
// Tahun ini" diganti, tampilan ikut berubah walau masih pakai mock data.
// Struktur objek untuk tiap periode harus SAMA PERSIS dengan response asli
// dari backend nantinya (stats, distribusiJenis, tingkatKeparahan,
// trenBulanan, statusTindakLanjut).

export const mockDashboardByPeriode = {
  "Hari ini": {
    stats: [
      {
        icon: FileText,
        value: "42",
        label: "Total Laporan",
        trend: "+3%",
        color: "blue",
      },
      {
        icon: AlertCircle,
        value: "5",
        label: "Laporan Baru",
        trend: "+2%",
        color: "green",
      },
      {
        icon: FileText,
        value: "3",
        label: "Dalam Investigasi",
        trend: null,
        color: "orange",
      },
      {
        icon: CheckCircle2,
        value: "34",
        label: "Selesai",
        trend: "+1%",
        color: "green",
      },
    ],
    distribusiJenis: [
      { name: "KPC (30%)", value: 30, color: "#3b82f6" },
      { name: "KNC (30%)", value: 30, color: "#10b981" },
      { name: "KTC (20%)", value: 20, color: "#f59e0b" },
      { name: "Sentinel (20%)", value: 20, color: "#ef4444" },
    ],
    tingkatKeparahan: [
      { name: "Ekstrem", laporan: 2, color: "bg-red-500" },
      { name: "Tinggi", laporan: 6, color: "bg-orange-500" },
      { name: "Moderat", laporan: 15, color: "bg-yellow-500" },
      { name: "Rendah", laporan: 19, color: "bg-blue-500" },
    ],
    trenBulanan: [
      { bulan: "SEN", insiden: 5 },
      { bulan: "SEL", insiden: 8 },
      { bulan: "RAB", insiden: 6 },
      { bulan: "KAM", insiden: 9 },
      { bulan: "JUM", insiden: 7 },
      { bulan: "SAB", insiden: 4 },
    ],
    statusTindakLanjut: {
      persenSelesai: 65,
      waktuRataRataSelesai: "1.1 Hari",
      responsPertama: "< 2 Jam",
      complianceRate: 90.0,
    },
  },

  "Minggu ini": {
    stats: [
      {
        icon: FileText,
        value: "210",
        label: "Total Laporan",
        trend: "+6%",
        color: "blue",
      },
      {
        icon: AlertCircle,
        value: "18",
        label: "Laporan Baru",
        trend: "+4%",
        color: "green",
      },
      {
        icon: FileText,
        value: "9",
        label: "Dalam Investigasi",
        trend: null,
        color: "orange",
      },
      {
        icon: CheckCircle2,
        value: "183",
        label: "Selesai",
        trend: "+3%",
        color: "green",
      },
    ],
    distribusiJenis: [
      { name: "KPC (32%)", value: 32, color: "#3b82f6" },
      { name: "KNC (28%)", value: 28, color: "#10b981" },
      { name: "KTC (22%)", value: 22, color: "#f59e0b" },
      { name: "Sentinel (18%)", value: 18, color: "#ef4444" },
    ],
    tingkatKeparahan: [
      { name: "Ekstrem", laporan: 8, color: "bg-red-500" },
      { name: "Tinggi", laporan: 25, color: "bg-orange-500" },
      { name: "Moderat", laporan: 90, color: "bg-yellow-500" },
      { name: "Rendah", laporan: 87, color: "bg-blue-500" },
    ],
    trenBulanan: [
      { bulan: "M1", insiden: 40 },
      { bulan: "M2", insiden: 55 },
      { bulan: "M3", insiden: 48 },
      { bulan: "M4", insiden: 60 },
      { bulan: "M5", insiden: 52 },
      { bulan: "M6", insiden: 58 },
    ],
    statusTindakLanjut: {
      persenSelesai: 70,
      waktuRataRataSelesai: "2.4 Hari",
      responsPertama: "< 3 Jam",
      complianceRate: 91.0,
    },
  },

  "Bulan ini": {
    stats: [
      {
        icon: FileText,
        value: "1,284",
        label: "Total Laporan",
        trend: "+12%",
        color: "blue",
      },
      {
        icon: AlertCircle,
        value: "42",
        label: "Laporan Baru",
        trend: "+8%",
        color: "green",
      },
      {
        icon: FileText,
        value: "18",
        label: "Dalam Investigasi",
        trend: null,
        color: "orange",
      },
      {
        icon: CheckCircle2,
        value: "1,224",
        label: "Selesai",
        trend: "+5%",
        color: "green",
      },
    ],
    distribusiJenis: [
      { name: "KPC (35%)", value: 35, color: "#3b82f6" },
      { name: "KNC (25%)", value: 25, color: "#10b981" },
      { name: "KTC (25%)", value: 25, color: "#f59e0b" },
      { name: "Sentinel (15%)", value: 15, color: "#ef4444" },
    ],
    tingkatKeparahan: [
      { name: "Ekstrem", laporan: 42, color: "bg-red-500" },
      { name: "Tinggi", laporan: 129, color: "bg-orange-500" },
      { name: "Moderat", laporan: 454, color: "bg-yellow-500" },
      { name: "Rendah", laporan: 658, color: "bg-blue-500" },
    ],
    trenBulanan: [
      { bulan: "JAN", insiden: 120 },
      { bulan: "FEB", insiden: 145 },
      { bulan: "MAR", insiden: 165 },
      { bulan: "APR", insiden: 142 },
      { bulan: "MEI", insiden: 185 },
      { bulan: "JUN", insiden: 198 },
    ],
    statusTindakLanjut: {
      persenSelesai: 74,
      waktuRataRataSelesai: "3.2 Hari",
      responsPertama: "< 4 Jam",
      complianceRate: 92.1,
    },
  },

  "Tahun ini": {
    stats: [
      {
        icon: FileText,
        value: "8,940",
        label: "Total Laporan",
        trend: "+15%",
        color: "blue",
      },
      {
        icon: AlertCircle,
        value: "310",
        label: "Laporan Baru",
        trend: "+9%",
        color: "green",
      },
      {
        icon: FileText,
        value: "64",
        label: "Dalam Investigasi",
        trend: null,
        color: "orange",
      },
      {
        icon: CheckCircle2,
        value: "8,566",
        label: "Selesai",
        trend: "+11%",
        color: "green",
      },
    ],
    distribusiJenis: [
      { name: "KPC (33%)", value: 33, color: "#3b82f6" },
      { name: "KNC (27%)", value: 27, color: "#10b981" },
      { name: "KTC (24%)", value: 24, color: "#f59e0b" },
      { name: "Sentinel (16%)", value: 16, color: "#ef4444" },
    ],
    tingkatKeparahan: [
      { name: "Ekstrem", laporan: 310, color: "bg-red-500" },
      { name: "Tinggi", laporan: 980, color: "bg-orange-500" },
      { name: "Moderat", laporan: 3120, color: "bg-yellow-500" },
      { name: "Rendah", laporan: 4530, color: "bg-blue-500" },
    ],
    trenBulanan: [
      { bulan: "JAN", insiden: 620 },
      { bulan: "FEB", insiden: 680 },
      { bulan: "MAR", insiden: 710 },
      { bulan: "APR", insiden: 690 },
      { bulan: "MEI", insiden: 745 },
      { bulan: "JUN", insiden: 800 },
    ],
    statusTindakLanjut: {
      persenSelesai: 78,
      waktuRataRataSelesai: "2.9 Hari",
      responsPertama: "< 4 Jam",
      complianceRate: 93.4,
    },
  },
};
