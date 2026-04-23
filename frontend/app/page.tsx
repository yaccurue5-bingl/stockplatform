import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import Problem from '@/components/landing/Problem';
import HotStocks from '@/components/landing/HotStocks';
import LiveEvents from '@/components/landing/LiveEvents';
import DataProducts from '@/components/landing/DataProducts';
import HowItWorks from '@/components/landing/HowItWorks';
import UseCases from '@/components/landing/UseCases';
import Pricing from '@/components/landing/Pricing';
import FinalCTA from '@/components/landing/FinalCTA';
import Footer from '@/components/landing/Footer';

export const revalidate = 300; // 5분마다 재검증 — LiveEvents 데이터 최신화

export default function LandingPage() {
  return (
    <div className="bg-[#0B0F14] text-gray-200 font-sans min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Problem />
      <HotStocks />
      <LiveEvents />
      <DataProducts />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FinalCTA />
      <Footer />
    </div>
  );
}
