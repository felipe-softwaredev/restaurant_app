import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone_number, customer_name, customer_email, items, total } = body

    const supabase = await getSupabaseServer()

    const { data, error } = await supabase
      .from("orders")
      .insert({
        phone_number: phone_number,
        customer_name: customer_name || "Guest",
        customer_email: customer_email || null,
        total: total,
        status: "pending",
      })
      .select("id")
      .single()

    if (error) {
      console.error("Database error:", error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    if (items && items.length > 0 && data) {
      const orderItems = items.map((item: any) => ({
        order_id: data.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }))

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems)

      if (itemsError) {
        console.error("Error inserting order items:", itemsError)
        return Response.json({ error: itemsError.message }, { status: 500 })
      }
    }

    return Response.json({ orderId: data.id })
  } catch (error) {
    console.error("Error creating order:", error)
    return Response.json({ error: "Failed to create order" }, { status: 500 })
  }
}
