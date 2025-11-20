-- ============================================================================
-- Complete Database Schema for Restaurant Ordering Web App
-- ============================================================================
-- Run this entire file in your Supabase SQL Editor to set up the complete database
-- This file consolidates all schema, updates, and sample data in one place
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Menu Items Table
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory Items Table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  image_url TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  min_stock DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders Table (includes assignment requirements: phone_number, preparation_time, correct status enum)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_name VARCHAR(255),
  customer_email VARCHAR(255),
  phone_number VARCHAR(20),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'declined')),
  total DECIMAL(10, 2) NOT NULL,
  preparation_time INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Menu Item Inventory Mapping Table (for automatic inventory deduction)
CREATE TABLE menu_item_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_required DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_inventory ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Public can view menu items (no login required)
CREATE POLICY "Menu items are viewable by everyone" ON menu_items
  FOR SELECT USING (true);

-- Public can create orders (no login required)
CREATE POLICY "Anyone can insert orders" ON orders
  FOR INSERT WITH CHECK (true);

-- Public can insert order items (no login required)
CREATE POLICY "Anyone can insert order items" ON order_items
  FOR INSERT WITH CHECK (true);

-- Public can view their own orders via order status page (by order ID in URL)
-- Note: For production, you might want to add phone number verification
CREATE POLICY "Anyone can view orders" ON orders
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view order items" ON order_items
  FOR SELECT USING (true);

-- Authenticated users (admins) have full access to all tables
CREATE POLICY "Admins have full access to inventory" ON inventory_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins have full access to menu" ON menu_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins have full access to orders" ON orders
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins have full access to order items" ON order_items
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins have full access to menu_item_inventory" ON menu_item_inventory
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically deduct inventory when order is completed
CREATE OR REPLACE FUNCTION deduct_inventory_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  order_item RECORD;
  menu_inv RECORD;
BEGIN
  -- Only run when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Loop through all items in the order
    FOR order_item IN 
      SELECT * FROM order_items WHERE order_id = NEW.id
    LOOP
      -- Find all inventory items needed for this menu item
      FOR menu_inv IN
        SELECT * FROM menu_item_inventory WHERE menu_item_id = order_item.menu_item_id
      LOOP
        -- Deduct the required quantity (order quantity * inventory requirement per item)
        UPDATE inventory_items
        SET quantity = quantity - (order_item.quantity * menu_inv.quantity_required)
        WHERE id = menu_inv.inventory_item_id;
        
        -- Ensure quantity doesn't go negative
        UPDATE inventory_items
        SET quantity = 0
        WHERE id = menu_inv.inventory_item_id AND quantity < 0;
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Triggers to automatically update updated_at timestamp
CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically deduct inventory when order is completed
CREATE TRIGGER trigger_deduct_inventory_on_order_completion
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION deduct_inventory_on_order_completion();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Sample Menu Items
INSERT INTO menu_items (name, description, price, category, image_url, is_available) VALUES
-- Appetizers
('Bruschetta Trio', 'Three types of bruschetta: classic tomato basil, goat cheese honey, and pesto mozzarella', 12.99, 'Appetizers', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop', true),
('Crispy Calamari', 'Golden fried calamari rings served with marinara sauce and lemon aioli', 14.99, 'Appetizers', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop', true),
('Spinach Artichoke Dip', 'Creamy blend of spinach and artichoke hearts, baked with parmesan and served with tortilla chips', 11.99, 'Appetizers', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true),

-- Main Courses
('Grilled Salmon', 'Atlantic salmon grilled to perfection, served with roasted vegetables and lemon butter sauce', 24.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true),
('Ribeye Steak', '12oz prime ribeye steak, char-grilled and served with garlic mashed potatoes and seasonal vegetables', 32.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true),
('Chicken Parmesan', 'Breaded chicken breast topped with marinara sauce and mozzarella, served over linguine', 19.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true),
('Margherita Pizza', 'Classic pizza with fresh mozzarella, tomato sauce, and basil leaves on our house-made dough', 16.99, 'Main Course', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=600&fit=crop', true),
('Pasta Carbonara', 'Creamy pasta with pancetta, parmesan cheese, egg yolk, and black pepper', 18.99, 'Main Course', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop', true),

-- Salads
('Caesar Salad', 'Crisp romaine lettuce with caesar dressing, parmesan cheese, and house-made croutons', 10.99, 'Salads', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop', true),
('Greek Salad', 'Mixed greens with feta cheese, kalamata olives, cucumbers, tomatoes, and red onion with greek dressing', 11.99, 'Salads', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop', true),

-- Desserts
('Chocolate Lava Cake', 'Warm chocolate cake with a molten center, served with vanilla ice cream', 8.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true),
('Tiramisu', 'Classic Italian dessert with layers of coffee-soaked ladyfingers and mascarpone cream', 7.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true),
('New York Cheesecake', 'Creamy cheesecake with a graham cracker crust, topped with fresh berries', 8.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true),

-- Beverages
('Fresh Lemonade', 'House-made lemonade with fresh lemons, mint, and a hint of honey', 4.99, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true),
('Iced Coffee', 'Cold brew coffee served over ice with your choice of milk and sweetener', 4.49, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true),
('Fresh Orange Juice', 'Freshly squeezed orange juice served chilled', 3.99, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true);

-- ============================================================================
-- COMPLETION
-- ============================================================================
-- Schema setup complete!
-- 
-- Next steps:
-- 1. Create an admin user via Supabase Dashboard > Authentication > Users
-- 2. Optionally add inventory items and map them to menu items in menu_item_inventory table
-- 3. Start using the application!
-- ============================================================================

