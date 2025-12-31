import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const FearGreedGauge = ({ score = 50 }) => {
  // 1. 게이지 배경 데이터 (공포 ~ 탐욕 구간 설정)
  const data = [
    { name: 'Extreme Fear', value: 25, color: '#ff4d4f' },
    { name: 'Fear', value: 25, color: '#ffa940' },
    { name: 'Greed', value: 25, color: '#bae637' },
    { name: 'Extreme Greed', value: 25, color: '#52c41a' },
  ];

  // 2. 바늘(Needle) 계산 로직
  const RADIAN = Math.PI / 180;
  const cx = 150; // 중심 X
  const cy = 150; // 중심 Y
  const iR = 60;  // 내부 반경
  const oR = 100; // 외부 반경
  
  const needle = (value, data, cx, cy, iR, oR, color) => {
    const ang = 180.0 * (1 - value / 100);
    const length = (iR + oR) / 2;
    const sin = Math.sin(-RADIAN * ang);
    const cos = Math.cos(-RADIAN * ang);
    const r = 5;
    const x0 = cx + 5;
    const y0 = cy;
    const xba = cx + r * sin;
    const yba = cy - r * cos;
    const xbb = cx - r * sin;
    const ybb = cy + r * cos;
    const xp = cx + length * cos;
    const yp = cy + length * sin;

    return [
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" key="circle" />,
      <path d={`M${xba} ${yba}L${xbb} ${ybb}L${xp} ${yp}Z`} fill={color} stroke="none" key="path" />,
    ];
  };

  const getStatusText = (s) => {
    if (s <= 25) return { text: "극심한 공포", color: "#ff4d4f" };
    if (s <= 50) return { text: "공포", color: "#ffa940" };
    if (s <= 75) return { text: "탐욕", color: "#bae637" };
    return { text: "극심한 탐욕", color: "#52c41a" };
  };

  const status = getStatusText(score);

  return (
    <div style={{ width: '100%', height: '220px', textAlign: 'center', position: 'relative' }}>
      <h3 style={{ marginBottom: '0' }}>K-Market Fear & Greed</h3>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            dataKey="value"
            startAngle={180}
            endAngle={0}
            data={data}
            cx={cx}
            cy={cy}
            innerRadius={iR}
            outerRadius={oR}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          {needle(score, data, cx, cy, iR, oR, '#333')}
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)' }}>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: status.color }}>{score}</span>
        <p style={{ margin: 0, fontWeight: '600' }}>{status.text}</p>
      </div>
    </div>
  );
};

export default FearGreedGauge;