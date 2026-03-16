interface StatBadgeProps {
  value: string;
  label: string;
}

export default function StatBadge({ value, label }: StatBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-[#121821] border border-gray-800 rounded-full px-4 py-2">
      <span className="text-[#00D4A6] font-semibold text-sm">{value}</span>
      <span className="text-gray-400 text-sm">{label}</span>
    </div>
  );
}
