'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MenuItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import CartButton from '@/components/cart-button';

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const categories = Array.from(new Set(items.map((item) => item.category)));

  const fetchMenu = async () => {
    try {
      const supabase = getSupabaseClient();
      // Fetch items that are on the menu (is_on_menu = true)
      // Show both available and unavailable items
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_on_menu', true)
        .order('category');

      if (error) {
        console.error('Error fetching menu:', error);
        setError('Failed to load menu items');
      } else {
        setItems(data || []);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to initialize Supabase';
      setError(errorMessage);
      console.error('Menu fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMenu();

    // Poll every 5 seconds to refresh menu availability
    const pollInterval = setInterval(() => {
      if (!loading) {
        fetchMenu();
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [loading]);

  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const addToCart = (item: MenuItem) => {
    if (typeof window === 'undefined') return;
    
    // Prevent adding unavailable items to cart
    if (!item.is_available) {
      toast({
        title: 'Item Unavailable',
        description: `${item.name} is currently unavailable.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const existingItem = cart.find(
        (cartItem: any) => cartItem.id === item.id
      );

      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.push({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          category: item.category,
        });
      }

      localStorage.setItem('cart', JSON.stringify(cart));
      toast({
        title: 'Added to cart',
        description: `${item.name} has been added to your cart.`,
      });
      window.dispatchEvent(new Event('cartUpdated'));
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: 'Error',
        description: 'Failed to add item to cart. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm">
              Back
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

        <h1 className="text-3xl font-bold text-foreground mb-8">Our Menu</h1>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading menu...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-6">
            <div className="flex gap-3">
              <div>
                <h3 className="font-semibold text-destructive mb-2">
                  Setup Required
                </h3>
                <p className="text-sm text-destructive mb-4">{error}</p>
                <p className="text-sm text-muted-foreground">
                  To get started, please add your Supabase environment variables
                  in the Vars section and run the SQL schema on your Supabase
                  dashboard.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {categories.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? 'default' : 'outline'
                    }
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`overflow-hidden transition-shadow ${
                    !item.is_available
                      ? 'opacity-60 grayscale'
                      : 'hover:shadow-lg'
                  }`}
                >
                  {item.image_url ? (
                    <div className="relative w-full h-48 bg-muted">
                      <Image
                        src={item.image_url || '/placeholder.svg'}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm font-semibold">
                            Currently Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-muted flex items-center justify-center relative">
                      <p className="text-muted-foreground">No image</p>
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm font-semibold">
                            Currently Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className={`text-lg ${!item.is_available ? 'text-muted-foreground' : ''}`}>
                      {item.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={`text-sm line-clamp-2 ${!item.is_available ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {item.description}
                    </p>
                    <p className={`text-xl font-bold ${!item.is_available ? 'text-muted-foreground' : 'text-primary'}`}>
                      ${item.price.toFixed(2)}
                    </p>
                    {!item.is_available && (
                      <p className="text-xs text-destructive font-semibold">
                        Currently Unavailable
                      </p>
                    )}
                    <Button 
                      onClick={() => addToCart(item)} 
                      className="w-full"
                      disabled={!item.is_available}
                    >
                      {item.is_available ? 'Add to Cart' : 'Unavailable'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No items available in this category
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
