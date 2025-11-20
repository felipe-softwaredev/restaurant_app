'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import CartButton from '@/components/cart-button';

export default function CartPage() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadCart = () => {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          if (Array.isArray(parsedCart)) {
            setCart(parsedCart);
          } else {
            setCart([]);
          }
        } catch (error) {
          console.error('Error parsing cart from localStorage:', error);
          setCart([]);
        }
      } else {
        setCart([]);
      }
    };

    // Load cart on mount
    loadCart();

    // Listen for cart updates from other pages/components
    const handleCartUpdate = () => {
      loadCart();
    };

    window.addEventListener('cartUpdated', handleCartUpdate);
    window.addEventListener('storage', handleCartUpdate);

    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate);
      window.removeEventListener('storage', handleCartUpdate);
    };
  }, []);

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const updateQuantity = (id: string, quantity: number) => {
    setCart((currentCart) => {
      let updatedCart;
      if (quantity <= 0) {
        updatedCart = currentCart.filter((item) => item.id !== id);
      } else {
        updatedCart = currentCart.map((item) =>
          item.id === id ? { ...item, quantity } : item
        );
      }
      localStorage.setItem('cart', JSON.stringify(updatedCart));
      window.dispatchEvent(new Event('cartUpdated'));
      return updatedCart;
    });
  };

  const removeItem = (id: string) => {
    setCart((currentCart) => {
      const updatedCart = currentCart.filter((item) => item.id !== id);
      localStorage.setItem('cart', JSON.stringify(updatedCart));
      window.dispatchEvent(new Event('cartUpdated'));
      return updatedCart;
    });
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Phone number is required to place an order.',
        variant: 'destructive',
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: 'Empty Cart',
        description: 'Please add items to your cart before placing an order.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Get the latest cart from localStorage to ensure we have the most up-to-date data
      const latestCart =
        typeof window !== 'undefined'
          ? JSON.parse(localStorage.getItem('cart') || '[]')
          : cart;

      if (latestCart.length === 0) {
        toast({
          title: 'Empty Cart',
          description:
            'Your cart appears to be empty. Please add items before placing an order.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const latestTotal = latestCart.reduce(
        (sum: number, item: CartItem) => sum + item.price * item.quantity,
        0
      );

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number: phone,
          customer_name: name || 'Guest',
          customer_email: email || null,
          items: latestCart,
          total: latestTotal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit order');
      }

      const { orderId } = await response.json();

      toast({
        title: 'Order Placed Successfully',
        description: `Your order has been received. Order ID: ${orderId}`,
      });

      localStorage.removeItem('cart');
      setCart([]);
      setTimeout(() => {
        window.location.href = `/order-status/${orderId}`;
      }, 1000);
    } catch (error) {
      console.error('Error submitting order:', error);
      toast({
        title: 'Order Failed',
        description: 'Failed to submit order. Please try again.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/menu">
            <Button variant="ghost" size="sm">
              Back to Menu
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/orders">
              <Button variant="outline" size="sm" className="bg-transparent">
                My Orders
              </Button>
            </Link>
            <CartButton />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-8">
          Shopping Cart
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {cart.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Your cart is empty</p>
                </CardContent>
              </Card>
            ) : (
              cart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        ${item.price.toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(
                            item.id,
                            Number.parseInt(e.target.value) || 0
                          )
                        }
                        className="w-16"
                      />
                      <p className="font-semibold w-20 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>

                <form onSubmit={submitOrder} className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="123-456-7890"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || cart.length === 0}
                  >
                    {loading ? 'Placing Order...' : 'Place Order'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
