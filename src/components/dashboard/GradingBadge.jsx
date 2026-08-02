export default function GradingBadge({ grading }) {
  const gradingStyles = {
    hijau: {
      label: "Hijau",
      className: "bg-green-100 text-green-700",
    },
    biru: {
      label: "Biru",
      className: "bg-blue-100 text-blue-700",
    },
    kuning: {
      label: "Kuning",
      className: "bg-amber-100 text-amber-700",
    },
    merah: {
      label: "Merah",
      className: "bg-red-100 text-red-700",
    },
  };

  const style = gradingStyles[grading] ?? gradingStyles.hijau;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      {style.label}
    </span>
  );
}
