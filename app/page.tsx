'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Restaurant Order System
          </h1>
          <p className="text-muted-foreground text-lg">
            Order delicious food online
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Browse our menu and place your order
              </p>
              <div className="space-y-3">
                <Link href="/menu">
                  <Button className="w-full" size="lg">
                    Order Now
                  </Button>
                </Link>
                <Link href="/orders">
                  <Button variant="outline" className="w-full" size="lg">
                    My Orders
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manage orders, inventory, and menu
              </p>
              <Link href="/admin/login">
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="lg"
                >
                  Admin Login
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
