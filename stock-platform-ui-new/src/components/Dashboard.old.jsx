import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleStockClick = (ticker) => {
    navigate(`/stock/${ticker}`);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded mb-2">
              Morning Briefing
            </span>
            <h1 className="text-2xl font-bold text-gray-900">
              Semiconductors Lead the Rally amid Nvidia Hopes
            </h1>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500">Updated: 10 mins ago</span>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-3">
            <div className="flex gap-2 items-start">
              <TrendingUp className="w-5 h-5 text-green-500 mt-0.5" />
              <p className="text-gray-700">
                Foreigners bought <strong>$200M</strong> worth of Samsung Electronics today, signaling strong return.
              </p>
            </div>
            <div className="flex gap-2 items-start">
              <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
              <p className="text-gray-700">
                Bank of Korea freezes interest rates, removing market uncertainty.
              </p>
            </div>
            <div className="flex gap-2 items-start">
              <TrendingDown className="w-5 h-5 text-red-500 mt-0.5" />
              <p className="text-gray-700">
                Bio-pharma sector drops due to new regulatory fears (-2.1%).
              </p>
            </div>
          </div>
          
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Market Sentiment</h3>
            <div className="text-3xl font-bold text-green-600">Greed (65)</div>
            <p className="text-xs text-gray-500 mt-1">Investors are optimistic driven by AI chip demand.</p>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            🔥 Top Net Buy <span className="text-xs font-normal text-gray-500">(Foreigners)</span>
          </h2>
          <ul className="space-y-3">
            {[
              { name: 'Samsung Elec', ticker: '005930', amt: '+500B', chg: '+1.5%' },
              { name: 'SK Hynix', ticker: '000660', amt: '+230B', chg: '+3.2%' },
              { name: 'Hyundai Motor', ticker: '005380', amt: '+100B', chg: '-0.5%' },
            ].map((stock, i) => (
              <li 
                key={i} 
                onClick={() => handleStockClick(stock.ticker)} 
                className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400">{i+1}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{stock.name}</div>
                    <div className="text-xs text-gray-400">{stock.ticker}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-red-500 font-medium text-sm">{stock.amt}</div>
                  <div className={`text-xs ${stock.chg.includes('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.chg}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            💧 Top Net Sell <span className="text-xs font-normal text-gray-500">(Foreigners)</span>
          </h2>
          <ul className="space-y-3">
            {[
              { name: 'POSCO Holdings', ticker: '005490', amt: '-120B', chg: '-1.2%' },
              { name: 'EcoPro', ticker: '086520', amt: '-80B', chg: '-4.5%' },
              { name: 'Kakao', ticker: '035720', amt: '-50B', chg: '-0.8%' },
            ].map((stock, i) => (
              <li 
                key={i} 
                onClick={() => handleStockClick(stock.ticker)}
                className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer transition"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400">{i+1}</span>
                  <div>
                    <div className="font-semibold text-gray-800">{stock.name}</div>
                    <div className="text-xs text-gray-400">{stock.ticker}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-blue-500 font-medium text-sm">{stock.amt}</div>
                  <div className="text-xs text-red-600">{stock.chg}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;