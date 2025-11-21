'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Link from 'next/link';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { Order } from '@/types';

interface OrderWithItems extends Order {
  items: Array<{ quantity: number; name: string; price: number }>;
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [prepTime, setPrepTime] = useState<number>(30);

  const fetchOrders = async () => {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/admin/login');
      return;
    }

    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      setLoading(false);
      return;
    }

    const ordersWithItems: OrderWithItems[] = [];
    for (const order of ordersData || []) {
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

        ordersWithItems.push({
          ...order,
          items,
        } as OrderWithItems);
      } else {
        ordersWithItems.push({
          ...order,
          items: [],
        } as OrderWithItems);
      }
    }

    setOrders(ordersWithItems);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Poll every 10 seconds for real-time updates
    const pollInterval = setInterval(() => {
      fetchOrders();
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [router]);

  const updateOrderStatus = async (
    orderId: string,
    newStatus: string,
    prepTimeMinutes?: number
  ) => {
    const supabase = getSupabaseClient();

    const updateData: any = {
      status: newStatus,
    };

    if (newStatus === 'approved' && prepTimeMinutes) {
      updateData.preparation_time = prepTimeMinutes;
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) {
      console.error('Error updating order:', error);
    } else {
      setOrders(
        orders.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: newStatus,
                preparation_time:
                  newStatus === 'approved'
                    ? prepTimeMinutes || 30
                    : order.preparation_time,
              }
            : order
        )
      );
    }

    setApproveDialogOpen(false);
    setSelectedOrderId(null);
    setPrepTime(30);
  };

  const handleApproveClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setApproveDialogOpen(true);
  };

  const handleApproveConfirm = () => {
    if (selectedOrderId) {
      updateOrderStatus(selectedOrderId, 'approved', prepTime);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    );
  }

  // Active orders: pending, approved, or recently completed (within last hour)
  const activeOrders = orders.filter((o) => {
    if (o.status === 'pending' || o.status === 'approved') {
      return true;
    }
    // Also show recently completed orders (within last hour) so admin can see auto-completed ones
    if (o.status === 'completed') {
      const completedTime = new Date(o.updated_at);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      return completedTime > oneHourAgo;
    }
    return false;
  });

  // Get today's completed orders (excluding recently completed ones shown in active section)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const completedToday = orders.filter((o) => {
    if (o.status !== 'completed') return false;
    const orderDate = new Date(o.created_at);
    orderDate.setHours(0, 0, 0, 0);
    const isToday = orderDate.getTime() === today.getTime();
    const completedTime = new Date(o.updated_at);
    // Only show in accordion if completed more than 1 hour ago
    const isOldCompleted = completedTime <= oneHourAgo;
    return isToday && isOldCompleted;
  });

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm">
              Back
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Orders</h1>

        {/* Active Orders */}
        {activeOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No pending orders</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 mb-8">
            {activeOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Order #{order.id.slice(0, 8)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name} • {order.phone_number}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        order.status === 'pending' ? 'secondary' : 'default'
                      }
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Items</h4>
                    {order.items && order.items.length > 0 ? (
                      <>
                        {order.items.map((item, idx: number) => (
                          <p key={idx} className="text-sm">
                            {item.quantity}x {item.name} - $
                            {(item.price * item.quantity).toFixed(2)}
                          </p>
                        ))}
                        <p className="font-bold mt-2">
                          Total: ${order.total.toFixed(2)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No items</p>
                    )}
                  </div>

                  {order.status === 'pending' && (
                    <div className="flex gap-2 border-t pt-4">
                      <Button
                        onClick={() => handleApproveClick(order.id)}
                        className="flex-1"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateOrderStatus(order.id, 'declined')}
                        className="flex-1"
                      >
                        Decline
                      </Button>
                    </div>
                  )}

                  {order.status === 'approved' && (
                    <div className="space-y-3 border-t pt-4">
                      {order.preparation_time && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>
                            Preparation time: {order.preparation_time} minutes
                          </span>
                        </div>
                      )}
                      <Button
                        onClick={() => {
                          updateOrderStatus(order.id, 'completed');
                          // Refresh orders after marking as completed to see it in completed section
                          setTimeout(() => fetchOrders(), 500);
                        }}
                        className="w-full"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Mark as Completed
                      </Button>
                    </div>
                  )}

                  {order.status === 'completed' && (
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Order completed</span>
                      </div>
                      {order.preparation_time && (
                        <p className="text-xs text-muted-foreground">
                          Preparation time: {order.preparation_time} minutes
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Completed at: {new Date(order.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Completed Orders Accordion */}
        {completedToday.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="completed-today">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">
                    Completed Orders Today ({completedToday.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  {completedToday.map((order) => (
                    <Card key={order.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">
                              Order #{order.id.slice(0, 8)}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {order.customer_name} • {order.phone_number}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(order.created_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant="default">Completed</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div>
                          <h4 className="font-semibold mb-2 text-sm">Items</h4>
                          {order.items && order.items.length > 0 ? (
                            <>
                              {order.items.map((item, idx: number) => (
                                <p key={idx} className="text-sm">
                                  {item.quantity}x {item.name} - $
                                  {(item.price * item.quantity).toFixed(2)}
                                </p>
                              ))}
                              <p className="font-bold mt-2">
                                Total: ${order.total.toFixed(2)}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No items
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Order</DialogTitle>
            <DialogDescription>
              Set the preparation time in minutes for this order.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="prep-time">Preparation Time (minutes)</Label>
            <Input
              id="prep-time"
              type="number"
              min="1"
              value={prepTime}
              onChange={(e) =>
                setPrepTime(Number.parseInt(e.target.value) || 30)
              }
              placeholder="30"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApproveDialogOpen(false);
                setSelectedOrderId(null);
                setPrepTime(30);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleApproveConfirm}>Approve Order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
