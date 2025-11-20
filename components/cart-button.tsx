"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function CartButton() {
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    // Set initial count
    const savedCart = localStorage.getItem("cart")
    if (savedCart) {
      const cart = JSON.parse(savedCart)
      const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0)
      setCartCount(totalItems)
    }

    // Listen for storage changes
    const handleStorageChange = () => {
      const savedCart = localStorage.getItem("cart")
      if (savedCart) {
        const cart = JSON.parse(savedCart)
        const totalItems = cart.reduce((sum: number, item: any) => sum + item.quantity, 0)
        setCartCount(totalItems)
      } else {
        setCartCount(0)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    // Also listen for custom events from the same tab
    window.addEventListener("cartUpdated", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("cartUpdated", handleStorageChange)
    }
  }, [])

  return (
    <Link href="/cart">
      <Button variant="outline" className="relative bg-transparent">
        Cart
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </Button>
    </Link>
  )
}
