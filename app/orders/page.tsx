'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  ArrowRight,
} from 'lucide-react';
import type { Order } from '@/types';

interface OrderWithItems extends Order {
  items: Array<{
    quantity: number;
    name: string;
    price: number;
  }>;
}

export default function OrdersPage() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [countdowns, setCountdowns] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const fetchOrders = async (phoneNumber: string) => {
    if (!phoneNumber.trim()) {
      toast({
        title: 'Phone Number Required',
        description: 'Please enter your phone number to view orders.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const supabase = getSupabaseClient();

      // Fetch orders by phone number (only pending, approved, or completed - not declined)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('phone_number', phoneNumber.trim())
        .in('status', ['pending', 'approved', 'completed'])
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        toast({
          title: 'Error',
          description: 'Failed to fetch orders. Please try again.',
          variant: 'destructive',
        });
        setOrders([]);
        setLoading(false);
        return;
      }

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Fetch items for each order
      const ordersWithItems: OrderWithItems[] = await Promise.all(
        ordersData.map(async (order) => {
          const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('quantity, menu_items(name, price)')
            .eq('order_id', order.id);

          if (!itemsError && itemsData) {
            const items = itemsData.map((item: any) => ({
              quantity: item.quantity,
              name: item.menu_items?.name || 'Unknown item',
              price: item.menu_items?.price || 0,
            }));

            return {
              ...order,
              items,
            } as OrderWithItems;
          }

          return {
            ...order,
            items: [],
          } as OrderWithItems;
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(phone);
  };

  // Calculate countdown for approved orders
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: Record<string, string> = {};

      orders.forEach((order) => {
        if (
          order.status === 'approved' &&
          order.preparation_time &&
          order.created_at
        ) {
          const now = new Date();
          const created = new Date(order.created_at);
          const readyTime = new Date(
            created.getTime() + order.preparation_time * 60 * 1000
          );
          const diff = readyTime.getTime() - now.getTime();

          if (diff <= 0) {
            newCountdowns[order.id] = 'Order should be ready now!';
          } else {
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            newCountdowns[order.id] = `${minutes}m ${seconds}s`;
          }
        }
      });

      setCountdowns(newCountdowns);
    };

    // Calculate immediately
    updateCountdowns();

    // Update countdowns every second
    const interval = setInterval(updateCountdowns, 1000);

    return () => clearInterval(interval);
  }, [orders]);

  // Poll orders every 10 seconds to refresh status
  useEffect(() => {
    if (!searched || !phone.trim()) return;

    const pollInterval = setInterval(() => {
      fetchOrders(phone);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [searched, phone]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-8">
            Back Home
          </Button>
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              My Orders
            </h1>
            <p className="text-muted-foreground">
              Enter your phone number to view your orders
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lookup Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="123-456-7890"
                    required
                    className="mt-2"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Find My Orders
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {searched && !loading && (
            <div>
              {orders.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground mb-2">
                      No orders found for this phone number.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Make sure you entered the correct phone number used when
                      placing the order.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">
                    Your Orders ({orders.length})
                  </h2>
                  {orders.map((order) => (
                    <Card
                      key={order.id}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1">
                              Order #{order.id.slice(0, 8)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(order.created_at)}
                            </p>
                            {order.status === 'approved' &&
                              order.preparation_time && (
                                <div className="mt-2">
                                  <p className="text-xs text-muted-foreground">
                                    Preparation time: {order.preparation_time}{' '}
                                    minutes
                                  </p>
                                  {countdowns[order.id] && (
                                    <div className="mt-1 bg-primary/10 border border-primary/20 rounded px-2 py-1 inline-block">
                                      <p className="text-xs font-semibold text-primary">
                                        {countdowns[order.id] ===
                                        'Order should be ready now!'
                                          ? 'Ready now!'
                                          : `Ready in ${countdowns[order.id]}`}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                          </div>
                          <Badge
                            variant={getStatusColor(order.status) as any}
                            className="flex items-center gap-1.5"
                          >
                            {getStatusIcon(order.status)}
                            {order.status.charAt(0).toUpperCase() +
                              order.status.slice(1)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">Items</h4>
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-1">
                              {order.items.map((item, idx) => (
                                <p key={idx} className="text-sm">
                                  {item.quantity}x {item.name} - $
                                  {(item.price * item.quantity).toFixed(2)}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No items found
                            </p>
                          )}
                        </div>

                        <div className="border-t pt-3 flex items-center justify-between">
                          <span className="font-semibold">Total:</span>
                          <span className="font-bold text-lg">
                            ${order.total.toFixed(2)}
                          </span>
                        </div>

                        <Link href={`/order-status/${order.id}`}>
                          <Button
                            variant="outline"
                            className="w-full"
                            size="sm"
                          >
                            View Order Details
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
