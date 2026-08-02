export default function StatCard({ icon: Icon, value, label, color = "blue" }) {
  const colorVariants = {
    blue: {
      bg: "bg-blue-50",
      text: "text-blue-600",
      icon: "bg-blue-100",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-600",
      icon: "bg-amber-100",
    },
    green: {
      bg: "bg-green-50",
      text: "text-green-600",
      icon: "bg-green-100",
    },
    red: {
      bg: "bg-red-50",
      text: "text-red-600",
      icon: "bg-red-100",
    },
  };

  const colors = colorVariants[color] || colorVariants.blue;

  return (
    <div
      className={`rounded-xl border border-slate-200 ${colors.bg} p-5 shadow-sm`}
    >
      <div
        className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${colors.icon}`}
      >
        <Icon className={`h-5 w-5 ${colors.text}`} />
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className={`mt-1 text-sm ${colors.text}`}>{label}</p>
    </div>
  );
}
