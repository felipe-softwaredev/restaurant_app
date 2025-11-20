"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import type { MenuItem } from "@/types"

export default function AdminMenuPage() {
  const router = useRouter()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    image_url: "",
    is_available: true,
  })

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

      const { data, error } = await supabase.from("menu_items").select("*").order("category")

      if (error) {
        console.error("Error fetching menu:", error)
      } else {
        setItems(data || [])
      }
      setLoading(false)
    }

    checkAuth()
  }, [router])

  const addItem = async () => {
    if (!formData.name.trim() || !formData.category.trim()) {
      alert("Name and category are required")
      return
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase.from("menu_items").insert([formData]).select()

    if (error) {
      console.error("Error adding item:", error)
    } else {
      setItems([...items, data[0]])
      setFormData({
        name: "",
        description: "",
        price: 0,
        category: "",
        image_url: "",
        is_available: true,
      })
      setShowForm(false)
    }
  }

  const updateItem = async (id: string, updates: Partial<MenuItem>) => {
    const supabase = getSupabaseClient()
    const { error } = await supabase.from("menu_items").update(updates).eq("id", id)

    if (error) {
      console.error("Error updating item:", error)
    } else {
      setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)))
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm("Are you sure?")) return

    const supabase = getSupabaseClient()
    const { error } = await supabase.from("menu_items").delete().eq("id", id)

    if (error) {
      console.error("Error deleting item:", error)
    } else {
      setItems(items.filter((item) => item.id !== id))
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
          <h1 className="text-3xl font-bold text-foreground">Menu Items</h1>
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
                  placeholder="e.g., Caesar Salad"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Item description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Category</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Salads"
                  />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: Number.parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Image URL</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="available"
                  checked={formData.is_available}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked as boolean })}
                />
                <Label htmlFor="available">Available</Label>
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
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-lg font-bold">${item.price.toFixed(2)}</span>
                      <span className="text-sm">{item.category}</span>
                      {!item.is_available && <span className="text-sm text-destructive">Unavailable</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`available-${item.id}`}
                    checked={item.is_available}
                    onCheckedChange={(checked) =>
                      updateItem(item.id, {
                        is_available: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor={`available-${item.id}`}>Available</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
