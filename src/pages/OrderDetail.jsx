import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import OrderHeader from '@/components/order/OrderHeader';
import OrderFields from '@/components/order/OrderFields';
import DesignSection from '@/components/order/DesignSection';
import LineItemsSection from '@/components/order/LineItemsSection';
import RelatedTab from '@/components/order/RelatedTab';

export default function OrderDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id') || searchParams.get('orderId');

  const [order, setOrder] = useState(null);
  const [boothDesign, setBoothDesign] = useState(null);
  const [products, setProducts] = useState([]);
  const [lineItems, setLineItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate(-1);
      return;
    }
    loadOrderDetails();
  }, [orderId]);

  const loadOrderDetails = async () => {
    setIsLoading(true);
    const orderData = await base44.entities.Order.filter({ id: orderId });
    if (!orderData || orderData.length === 0) {
      navigate(-1);
      return;
    }
    const currentOrder = orderData[0];
    setOrder(currentOrder);

    // Load booth design + line items in parallel
    const promises = [];

    if (currentOrder.selected_booth_design_id) {
      promises.push(
        base44.entities.BoothDesign.filter({ id: currentOrder.selected_booth_design_id }).then(async (designData) => {
          if (designData?.length > 0) {
            const design = designData[0];
            setBoothDesign(design);
            if (design.product_skus?.length > 0) {
              const allProducts = await base44.entities.Product.list();
              setProducts(allProducts.filter(p => design.product_skus.includes(p.sku)));
            }
          }
        })
      );
    }

    promises.push(
      base44.entities.LineItem.filter({ order_id: orderId }, 'created_date').then(setLineItems)
    );

    await Promise.all(promises);
    setIsLoading(false);
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price || 0);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#e2231a] animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 pb-24 md:pb-10">
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-5 md:pt-8">
        <OrderHeader order={order} formatPrice={formatPrice} />

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="mb-4 bg-white border shadow-sm">
            <TabsTrigger value="details" className="data-[state=active]:bg-[#e2231a] data-[state=active]:text-white">
              Details
            </TabsTrigger>
            <TabsTrigger value="related" className="data-[state=active]:bg-[#e2231a] data-[state=active]:text-white">
              Related
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                <OrderFields order={order} formatPrice={formatPrice} />
              </div>
              {/* Right column */}
              <div className="space-y-4">
                <DesignSection boothDesign={boothDesign} />
                <LineItemsSection lineItems={lineItems} products={products} order={order} formatPrice={formatPrice} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="related">
            <RelatedTab order={order} formatPrice={formatPrice} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}