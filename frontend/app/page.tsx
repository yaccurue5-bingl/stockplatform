import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import LiveEvents from '@/components/landing/LiveEvents';
import DataProducts from '@/components/landing/DataProducts';
import ApiDemo from '@/components/landing/ApiDemo';
import Coverage from '@/components/landing/Coverage';
import UseCases from '@/components/landing/UseCases';
import Pricing from '@/components/landing/Pricing';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <div className="bg-[#0B0F14] text-gray-200 font-sans min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <LiveEvents />
      <DataProducts />
      <ApiDemo />
      <Coverage />
      <UseCases />
      <Pricing />
      <Footer />
    </div>
  );
}
