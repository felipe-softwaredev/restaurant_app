import { getSupabaseServer } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone_number, customer_name, customer_email, items, total } = body

    if (!items || items.length === 0) {
      return Response.json({ error: "Cart is empty" }, { status: 400 })
    }

    const supabase = await getSupabaseServer()

    // Validate inventory before creating order
    for (const item of items) {
      // Check if menu item exists and is available
      const { data: menuItem, error: menuError } = await supabase
        .from("menu_items")
        .select("id, name, is_available")
        .eq("id", item.id)
        .single()

      if (menuError || !menuItem) {
        return Response.json(
          { error: `Menu item ${item.name || item.id} not found` },
          { status: 400 }
        )
      }

      if (!menuItem.is_available) {
        return Response.json(
          { error: `${menuItem.name} is currently unavailable` },
          { status: 400 }
        )
      }

      // Check if there's sufficient inventory for this menu item
      const { data: inventoryMappings, error: mappingError } = await supabase
        .from("menu_item_inventory")
        .select("quantity_required, inventory_item_id")
        .eq("menu_item_id", item.id)

      if (mappingError) {
        console.error("Error checking inventory:", mappingError)
        // If there's an error but no mappings, allow the order (item might not have inventory requirements)
        if (mappingError.code !== "PGRST116") {
          return Response.json(
            { error: "Error checking inventory availability" },
            { status: 500 }
          )
        }
      }

      // If there are inventory requirements, check if we have enough stock
      if (inventoryMappings && inventoryMappings.length > 0) {
        for (const mapping of inventoryMappings) {
          // Get the inventory item details
          const { data: inventoryItem, error: invError } = await supabase
            .from("inventory_items")
            .select("id, name, quantity, unit")
            .eq("id", mapping.inventory_item_id)
            .single()

          if (invError || !inventoryItem) {
            return Response.json(
              { error: "Error checking inventory item" },
              { status: 500 }
            )
          }

          const requiredQuantity = mapping.quantity_required * item.quantity

          if (inventoryItem.quantity < requiredQuantity) {
            return Response.json(
              {
                error: `Insufficient inventory: ${inventoryItem.name} (need ${requiredQuantity} ${inventoryItem.unit || "units"}, have ${inventoryItem.quantity})`,
              },
              { status: 400 }
            )
          }
        }
      }
    }

    // All validations passed, create the order
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
