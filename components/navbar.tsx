"use client";

import Link from "next/link";
import CartButton from "@/components/cart-button";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="font-bold text-xl text-foreground hover:opacity-80">
          Bella Tavola
        </Link>
        <div className="flex items-center gap-2">
          <CartButton />
          <Link href="/admin/login">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Staff</span>
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
