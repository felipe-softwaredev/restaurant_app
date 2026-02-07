"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronDown, ChevronUp } from "lucide-react";

export default function MyOrdersFloat() {
  const [phone, setPhone] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      router.push(`/orders?phone=${encodeURIComponent(phone.trim())}`);
    }
  };

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-primary/20 bg-card px-4 py-2.5 shadow-lg transition-colors hover:bg-muted/50 md:bottom-6 md:right-6"
      >
        <span className="text-sm font-semibold">My Orders</span>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-56 border-primary/20 shadow-lg md:bottom-6 md:right-6 md:w-64">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-3 py-2">
        <h3 className="text-sm font-semibold">My Orders</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <Label htmlFor="float-phone" className="text-xs">
              Phone
            </Label>
            <Input
              id="float-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="123-456-7890"
              className="mt-0.5 h-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" className="h-8 w-full gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" />
            Find Orders
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
