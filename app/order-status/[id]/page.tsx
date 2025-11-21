'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { Order } from '@/types';

interface OrderItem {
  quantity: number;
  menu_items: {
    name: string;
  };
  price: number;
}

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>('');

  // Fetch order data
  const fetchOrder = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) {
      console.error('Error fetching order:', error);
    } else if (data) {
      setOrder(data);
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity, price, menu_items(name)')
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
    } else if (itemsData) {
      setItems(itemsData);
    }

    if (isInitialLoad) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    // Initial fetch with loading state
    fetchOrder(true);

    // Poll every 5 seconds for updates (without page reload)
    const pollInterval = setInterval(() => {
      fetchOrder(false);
    }, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [orderId]);

  // Calculate countdown from preparation_time (only starts after approval)
  useEffect(() => {
    if (!order || order.status !== 'approved' || !order.preparation_time) {
      setCountdown('');
      return;
    }

    const calculateCountdown = async () => {
      const now = new Date();
      // Use updated_at as the approval time (when order was approved)
      const approvedAt = new Date(order.updated_at);
      // Add preparation_time (in minutes) to approval time
      const readyTime = new Date(
        approvedAt.getTime() + order.preparation_time * 60 * 1000
      );
      const diff = readyTime.getTime() - now.getTime();

      if (diff <= 0) {
        // Time is up - auto-mark as completed
        setCountdown('Order ready! Marking as completed...');
        
        // Auto-complete the order when time is up
        const supabase = getSupabaseClient();
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', orderId);
        
        if (!updateError) {
          // Refresh order data to show completed status
          await fetchOrder();
        }
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    // Calculate immediately
    calculateCountdown();

    // Update every second
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, [order?.status, order?.preparation_time, order?.updated_at, orderId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'approved':
        return 'default';
      case 'completed':
        return 'default';
      case 'declined':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'approved':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'declined':
        return <XCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading order...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Order not found</p>
              <Link href="/" className="mt-4 inline-block">
                <Button variant="outline">Back Home</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              Back Home
            </Button>
          </Link>
          <Link href="/orders">
            <Button variant="outline" size="sm" className="bg-transparent">
              My Orders
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">
                    Order #{orderId.slice(0, 8)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Placed on {new Date(order.created_at).toLocaleDateString()}{' '}
                    at {new Date(order.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <Badge
                  variant={getStatusColor(order.status) as any}
                  className="flex items-center gap-1.5"
                >
                  {getStatusIcon(order.status)}
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Messages */}
              {order.status === 'pending' && (
                <div className="bg-secondary/50 border border-secondary p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-secondary-foreground" />
                    <p className="font-semibold text-secondary-foreground">
                      Waiting for Approval
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your order is pending approval. We'll notify you once it's
                    been reviewed.
                  </p>
                </div>
              )}

              {order.status === 'approved' && order.preparation_time && (
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <p className="font-semibold text-primary">
                      Order Approved - Preparation Time:{' '}
                      {order.preparation_time} minutes
                    </p>
                  </div>
                  {countdown && (
                    <p className="text-sm text-muted-foreground">
                      {countdown === 'Order should be ready now!'
                        ? countdown
                        : `Estimated ready time: ${countdown}`}
                    </p>
                  )}
                </div>
              )}

              {order.status === 'completed' && (
                <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    <p className="font-semibold text-primary">
                      Order Completed
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your order is ready for pickup!
                  </p>
                </div>
              )}

              {order.status === 'declined' && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <p className="font-semibold text-destructive">
                      Order Declined
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your order has been declined. Please contact us if you have
                    any questions.
                  </p>
                </div>
              )}

              {/* Customer Information */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Customer Information</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Name:</span>{' '}
                    {order.customer_name}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Phone:</span>{' '}
                    {order.phone_number}
                  </p>
                  {order.customer_email && (
                    <p>
                      <span className="text-muted-foreground">Email:</span>{' '}
                      {order.customer_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Order Items</h3>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm py-1"
                    >
                      <span>
                        {item.quantity}x {item.menu_items.name}
                      </span>
                      <span className="font-medium">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
