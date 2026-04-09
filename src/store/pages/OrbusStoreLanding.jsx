import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShoppingBag, ShieldCheck, Package, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function OrbusStoreLanding() {
  const navigate = useNavigate();
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    base44.functions.invoke('getProductCount', {}).then((response) => {
      setProductCount(response.data?.stats?.total_products || 0);
    }).catch(() => setProductCount(0));
  }, []);

  return (
    <div className="px-6 md:px-12 py-16 md:py-24 max-w-7xl mx-auto">
      <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e2231a]/20 bg-[#e2231a]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#e2231a] mb-6">
            Self-serve Orbus store
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[1.02]">
            Shop individual Orbus products online.
          </h1>
          <p className="mt-5 text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
            Give customers a simple storefront for browsing verified Orbus items while keeping your guided catalog and quote workflow exactly as it is.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button onClick={() => navigate('/store/products')} className="bg-[#e2231a] hover:bg-[#c91e16] text-white h-12 px-6 rounded-xl font-semibold">
              Browse Store
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={() => navigate('/Landing')} className="border-white/15 bg-transparent text-white hover:bg-white/5 h-12 px-6 rounded-xl">
              Back to Main Site
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoCard icon={ShoppingBag} label="Products" value={productCount || 'Catalog'} />
          <InfoCard icon={Package} label="Use case" value="Self-serve checkout" />
          <InfoCard icon={ShieldCheck} label="Source" value="Verified Orbus data" />
          <InfoCard icon={Tags} label="Mode" value="Public + dealer access" />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <Icon className="w-5 h-5 text-[#e2231a] mb-4" />
      <p className="text-sm text-white/45">{label}</p>
      <p className="text-lg font-semibold text-white mt-1">{value}</p>
    </div>
  );
}