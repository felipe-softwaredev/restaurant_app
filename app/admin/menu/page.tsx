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
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { MenuItem } from "@/types"

interface IngredientRequirement {
  inventory_item_name: string
  quantity_required: number
  unit: string
}

export default function AdminMenuPage() {
  const router = useRouter()
  const [items, setItems] = useState<MenuItem[]>([])
  const [ingredients, setIngredients] = useState<Record<string, IngredientRequirement[]>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    image_url: "",
    is_available: true,
    is_on_menu: true,
  })
  const [inventoryStatus, setInventoryStatus] = useState<Record<string, { hasEnough: boolean; missingItems: string[] }>>({})

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
        
        // Fetch ingredient requirements for each menu item
        if (data && data.length > 0) {
          const menuIds = data.map((item) => item.id)
          
          const { data: ingredientData, error: ingredientError } = await supabase
            .from("menu_item_inventory")
            .select(
              `
              menu_item_id,
              quantity_required,
              inventory_items (
                name,
                unit
              )
            `
            )
            .in("menu_item_id", menuIds)

          if (!ingredientError && ingredientData) {
            const ingredientMap: Record<string, IngredientRequirement[]> = {}
            
            ingredientData.forEach((mapping: any) => {
              const menuItemId = mapping.menu_item_id
              if (!ingredientMap[menuItemId]) {
                ingredientMap[menuItemId] = []
              }
              
              if (mapping.inventory_items) {
                ingredientMap[menuItemId].push({
                  inventory_item_name: mapping.inventory_items.name,
                  quantity_required: mapping.quantity_required,
                  unit: mapping.inventory_items.unit || "units",
                })
              }
            })
            
            setIngredients(ingredientMap)
            
            // Check inventory availability for each menu item
            const inventoryStatusMap: Record<string, { hasEnough: boolean; missingItems: string[] }> = {}
            
            for (const item of data || []) {
              if (ingredientMap[item.id] && ingredientMap[item.id].length > 0) {
                const missingItems: string[] = []
                let hasEnough = true
                
                for (const ingredient of ingredientMap[item.id]) {
                  // Check if we have enough of this ingredient
                  const { data: invData } = await supabase
                    .from("inventory_items")
                    .select("name, quantity")
                    .eq("name", ingredient.inventory_item_name)
                    .single()
                  
                  if (!invData || invData.quantity < ingredient.quantity_required) {
                    hasEnough = false
                    missingItems.push(ingredient.inventory_item_name)
                  }
                }
                
                inventoryStatusMap[item.id] = { hasEnough, missingItems }
              } else {
                // No inventory requirements - always available
                inventoryStatusMap[item.id] = { hasEnough: true, missingItems: [] }
              }
            }
            
            setInventoryStatus(inventoryStatusMap)
          }
        }
      }
      setLoading(false)
    }

    checkAuth()
    
    // Poll every 5 seconds to refresh menu availability when inventory changes
    const pollInterval = setInterval(() => {
      if (!loading) {
        checkAuth()
      }
    }, 5000)

    return () => clearInterval(pollInterval)
  }, [router, loading])

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
        is_on_menu: true,
      })
      setShowForm(false)
    }
  }

  const checkInventoryForItem = async (itemId: string): Promise<{ hasEnough: boolean; missingItems: string[] }> => {
    if (!ingredients[itemId] || ingredients[itemId].length === 0) {
      return { hasEnough: true, missingItems: [] }
    }

    const supabase = getSupabaseClient()
    const missingItems: string[] = []
    let hasEnough = true

    for (const ingredient of ingredients[itemId]) {
      const { data: invData } = await supabase
        .from("inventory_items")
        .select("name, quantity")
        .eq("name", ingredient.inventory_item_name)
        .single()

      if (!invData || invData.quantity < ingredient.quantity_required) {
        hasEnough = false
        missingItems.push(`${ingredient.inventory_item_name} (need ${ingredient.quantity_required} ${ingredient.unit}, have ${invData?.quantity || 0} ${ingredient.unit})`)
      }
    }

    return { hasEnough, missingItems }
  }

  const updateItem = async (id: string, updates: Partial<MenuItem>) => {
    const supabase = getSupabaseClient()
    
    // If trying to set is_available to true, check inventory first
    if (updates.is_available === true) {
      const inventoryCheck = await checkInventoryForItem(id)
      
      if (!inventoryCheck.hasEnough) {
        alert(`Cannot make item available: Not enough ingredients.\nMissing: ${inventoryCheck.missingItems.join(', ')}`)
        // Refresh the item to reset the checkbox
        const { data } = await supabase.from("menu_items").select("*").eq("id", id).single()
        if (data) {
          setItems(items.map((item) => (item.id === id ? data as MenuItem : item)))
        }
        return
      }
    }
    
    const { error } = await supabase.from("menu_items").update(updates).eq("id", id)

    if (error) {
      console.error("Error updating item:", error)
    } else {
      // Update local state
      setItems(items.map((item) => (item.id === id ? { ...item, ...updates } : item)))
      // If availability was manually changed, the client will pick it up on next poll (5 seconds)
      // Database triggers will handle automatic updates based on inventory
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
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="available"
                    checked={formData.is_available}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked as boolean })}
                  />
                  <Label htmlFor="available">Available</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="on-menu"
                    checked={formData.is_on_menu}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_on_menu: checked as boolean })}
                  />
                  <Label htmlFor="on-menu">On Menu</Label>
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
            <Card 
              key={item.id}
              className={!item.is_available ? 'opacity-60 border-destructive/50' : ''}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-semibold ${!item.is_available ? 'text-muted-foreground line-through' : ''}`}>
                        {item.name}
                      </h3>
                      {!item.is_available && (
                        <span className="bg-destructive text-destructive-foreground px-2 py-0.5 rounded text-xs font-semibold">
                          Currently Unavailable
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${!item.is_available ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {item.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4">
                      <span className={`text-lg font-bold ${!item.is_available ? 'text-muted-foreground' : ''}`}>
                        ${item.price.toFixed(2)}
                      </span>
                      <span className={`text-sm ${!item.is_available ? 'text-muted-foreground' : ''}`}>
                        {item.category}
                      </span>
                    </div>
                    
                    {/* Show ingredient requirements */}
                    {ingredients[item.id] && ingredients[item.id].length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                          Ingredients per order:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {ingredients[item.id].map((ingredient, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {ingredient.quantity_required} {ingredient.unit} {ingredient.inventory_item_name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!ingredients[item.id] || ingredients[item.id].length === 0) && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground italic">
                          No inventory mappings configured
                        </p>
                      </div>
                    )}
                    
                    {/* Show inventory status */}
                    {ingredients[item.id] && ingredients[item.id].length > 0 && inventoryStatus[item.id] && (
                      <div className="mt-3 pt-3 border-t">
                        {inventoryStatus[item.id].hasEnough ? (
                          <p className="text-xs text-green-600 font-semibold">
                            ✓ Enough ingredients available
                          </p>
                        ) : (
                          <div className="text-xs text-destructive">
                            <p className="font-semibold mb-1">✗ Not enough ingredients:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              {inventoryStatus[item.id].missingItems.map((missing, idx) => (
                                <li key={idx}>{missing}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteItem(item.id)}>
                    Delete
                  </Button>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`available-${item.id}`}
                      checked={item.is_available}
                      disabled={ingredients[item.id] && ingredients[item.id].length > 0 && inventoryStatus[item.id] && !inventoryStatus[item.id].hasEnough}
                      onCheckedChange={(checked) =>
                        updateItem(item.id, {
                          is_available: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor={`available-${item.id}`} className={ingredients[item.id] && ingredients[item.id].length > 0 && inventoryStatus[item.id] && !inventoryStatus[item.id].hasEnough ? 'text-muted-foreground' : ''}>
                      Available {ingredients[item.id] && ingredients[item.id].length > 0 && inventoryStatus[item.id] && !inventoryStatus[item.id].hasEnough && '(not enough ingredients)'}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`on-menu-${item.id}`}
                      checked={item.is_on_menu ?? true}
                      onCheckedChange={(checked) =>
                        updateItem(item.id, {
                          is_on_menu: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor={`on-menu-${item.id}`}>
                      {(item.is_on_menu ?? true) ? 'Remove from menu' : 'Add to menu'}
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
