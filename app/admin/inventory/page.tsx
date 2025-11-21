"use client"

import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import type { InventoryItem } from "@/types"

export default function AdminInventoryPage() {
  const router = useRouter()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    quantity: 0,
    unit: "",
    min_stock: 0,
  })

  const fetchInventory = async (isInitialLoad = false) => {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("inventory_items").select("*").order("name")

    if (error) {
      console.error("Error fetching inventory:", error)
    } else {
      setItems(data || [])
    }
    if (isInitialLoad) {
      setLoading(false)
    }
  }

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push("/admin/login")
        return
      }

      await fetchInventory(true)
    }

    checkAuth()
  }, [router])

  // Poll every 5 seconds to auto-refresh inventory after order completion
  useEffect(() => {
    if (loading) return

    const pollInterval = setInterval(() => {
      fetchInventory(false)
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [loading])

  const addItem = async () => {
    if (!formData.name.trim()) {
      alert("Item name is required")
      return
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("inventory_items").insert([formData]).select()

    if (error) {
      console.error("Error adding item:", error)
    } else {
      await fetchInventory()
      setFormData({ name: "", quantity: 0, unit: "", min_stock: 0 })
      setShowForm(false)
    }
  }

  const updateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("inventory_items").update(updates).eq("id", id)

    if (error) {
      console.error("Error updating item:", error)
    } else {
      await fetchInventory()
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure?")) return

    const supabase = getSupabaseClient()
    const { error } = await supabase.from("inventory_items").delete().eq("id", id)

    if (error) {
      console.error("Error deleting item:", error)
    } else {
      await fetchInventory()
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </main>
    )
  }

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
          <Button onClick={() => setShowForm(!showForm)}>Add Item</Button>
        </div>

        {showForm && (
          <Card className="mb-8">
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Item Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Tomatoes"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        quantity: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., kg"
                  />
                </div>
                <div>
                  <Label>Min Stock</Label>
                  <Input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_stock: Number.parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={addItem} className="flex-1">
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {item.quantity} {item.unit} (Min: {item.min_stock})
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(item.id, {
                        quantity: Number.parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-24"
                  />
                  <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
