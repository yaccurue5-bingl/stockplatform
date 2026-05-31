/**
 * BetaBanner — 랜딩/마케팅 페이지 상단 Public Beta 안내 배너
 */
export default function BetaBanner() {
  return (
    <div className="w-full bg-[#00D4A6]/10 border-b border-[#00D4A6]/20 py-2.5 px-4 text-center">
      <p className="text-xs text-[#00D4A6] font-medium">
        <span className="font-bold">Public Beta</span>
        {' · '}
        Coverage and signal quality are actively improving.
        Data completeness may vary by period.
      </p>
    </div>
  );
}
