'use client'; // 클라이언트 컴퍼넌트임을 선언

interface Props {
  sentiment: string;
}

export default function StockSentiment({ sentiment }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-medium">AI 감성 분석 결과:</span>
      <span className={`px-3 py-1 rounded-full text-white ${
        sentiment === 'POSITIVE' ? 'bg-green-500' : 'bg-gray-500'
      }`}>
        {sentiment}
      </span>
      <button 
        onClick={() => alert('공유하기 기능은 준비 중입니다!')}
        className="ml-4 text-blue-500 underline"
      >
        공유하기
      </button>
    </div>
  );
}