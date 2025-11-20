export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  category: string
  image_url: string
  is_available: boolean
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  category: string
}

export interface Order {
  id: string
  customer_name: string
  customer_email: string
  phone_number: string
  status: "pending" | "approved" | "completed" | "declined"
  total: number
  preparation_time: number | null
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: string
  name: string
  image_url: string
  quantity: number
  unit: string
  min_stock: number
  created_at: string
  updated_at: string
}
