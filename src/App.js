import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CommonLayout from './components/CommonLayout';
import Dashboard from './components/Dashboard';
import StockDetailPage from './components/StockDetailPage';

function App() {
  return (
    <Router>
      <CommonLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
        </Routes>
      </CommonLayout>
    </Router> 
  );
}
             
export default App;