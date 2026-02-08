'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MenuItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function Home() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const categories = Array.from(new Set(items.map((item) => item.category)));

  const fetchMenu = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('is_on_menu', true)
        .order('category');

      if (fetchError) {
        console.error('Error fetching menu:', fetchError);
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
    const pollInterval = setInterval(() => {
      if (!loading) fetchMenu();
    }, 5000);
    return () => clearInterval(pollInterval);
  }, [loading]);

  const filteredItems = selectedCategory
    ? items.filter((item) => item.category === selectedCategory)
    : items;

  const addToCart = (item: MenuItem) => {
    if (typeof window === 'undefined') return;
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
      const existingItem = cart.find((c: { id: string }) => c.id === item.id);
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
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast({
        title: 'Error',
        description: 'Failed to add item to cart. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative h-[40vh] min-h-[280px] w-full overflow-hidden">
        <Image
          src="/banner.jpg"
          alt="Fresh restaurant food"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="hero-overlay absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
          <h1 className="text-4xl font-bold text-white drop-shadow-lg md:text-5xl lg:text-6xl">
            Bella Tavola
          </h1>
          <p className="mt-3 max-w-lg text-lg text-white/95 md:text-xl">
            Fresh ingredients, made to order. Order online and pick up when
            it&apos;s ready.
          </p>
        </div>
      </div>

      {/* Order Now + Menu */}
      <div id="menu" className="mx-auto max-w-6xl px-4 py-12 scroll-mt-20">
        <div className="mb-10">
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            Order Now
          </h2>
          <p className="mt-1 text-muted-foreground">Fresh, made to order</p>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Loading menu...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-6">
            <h3 className="mb-2 font-semibold text-destructive">
              Setup Required
            </h3>
            <p className="mb-4 text-sm text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">
              Please add your Supabase environment variables and run the SQL
              schema on your Supabase dashboard.
            </p>
          </div>
        ) : (
          <>
            {categories.length > 0 && (
              <div className="mb-10 flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  className={
                    selectedCategory === null
                      ? ''
                      : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
                  }
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
                    className={
                      selectedCategory === category
                        ? ''
                        : 'border-primary/30 hover:border-primary/50 hover:bg-primary/5'
                    }
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <Card
                  key={item.id}
                  className={`overflow-hidden border-primary/10 shadow-md transition-all ${
                    !item.is_available
                      ? 'opacity-60 grayscale'
                      : 'hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-xl'
                  }`}
                >
                  {item.image_url ? (
                    <div className="relative h-52 w-full overflow-hidden bg-muted">
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                      {!item.is_available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="rounded bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground">
                            Currently Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex h-52 w-full items-center justify-center bg-muted">
                      <p className="text-muted-foreground">No image</p>
                      {!item.is_available && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="rounded bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground">
                            Currently Unavailable
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <CardTitle
                      className={
                        !item.is_available ? 'text-muted-foreground' : ''
                      }
                    >
                      {item.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className={`line-clamp-2 text-sm text-muted-foreground`}>
                      {item.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-xl font-bold ${
                          !item.is_available
                            ? 'text-muted-foreground'
                            : 'text-primary'
                        }`}
                      >
                        ${item.price.toFixed(2)}
                      </p>
                      <Button
                        onClick={() => addToCart(item)}
                        size="sm"
                        disabled={!item.is_available}
                      >
                        {item.is_available ? 'Add to Cart' : 'Unavailable'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">
                  No items in this category
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
