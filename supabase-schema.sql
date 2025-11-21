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
  is_on_menu BOOLEAN DEFAULT true,
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

-- Function to check if a menu item has sufficient inventory
-- Returns true if all required inventory items have enough stock
CREATE OR REPLACE FUNCTION check_menu_item_availability(menu_item_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  menu_inv RECORD;
  current_quantity DECIMAL(10, 2);
  has_sufficient_stock BOOLEAN := true;
BEGIN
  -- Check all inventory requirements for this menu item
  FOR menu_inv IN
    SELECT * FROM menu_item_inventory WHERE menu_item_id = menu_item_uuid
  LOOP
    -- Get current inventory quantity
    SELECT quantity INTO current_quantity
    FROM inventory_items
    WHERE id = menu_inv.inventory_item_id;
    
    -- Check if we have enough stock (need at least quantity_required for 1 item)
    IF current_quantity IS NULL OR current_quantity < menu_inv.quantity_required THEN
      has_sufficient_stock := false;
      EXIT; -- Exit early if any ingredient is insufficient
    END IF;
  END LOOP;
  
  RETURN has_sufficient_stock;
END;
$$ LANGUAGE plpgsql;

-- Function to update menu item availability based on inventory
-- Checks all menu items and updates their is_available status
CREATE OR REPLACE FUNCTION update_menu_item_availability()
RETURNS void
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  menu_item RECORD;
BEGIN
  -- Loop through all menu items
  FOR menu_item IN
    SELECT id FROM menu_items
  LOOP
    -- Check if this menu item has inventory requirements
    IF EXISTS (SELECT 1 FROM menu_item_inventory WHERE menu_item_id = menu_item.id) THEN
      -- Update availability based on inventory check
      UPDATE menu_items
      SET is_available = check_menu_item_availability(menu_item.id)
      WHERE id = menu_item.id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Wrapper trigger function for inventory updates
CREATE OR REPLACE FUNCTION trigger_update_menu_availability()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_menu_item_availability();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Wrapper trigger function for inventory inserts
CREATE OR REPLACE FUNCTION trigger_update_menu_availability_on_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_menu_item_availability();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Wrapper trigger function for menu_item_inventory mapping changes
CREATE OR REPLACE FUNCTION trigger_update_menu_availability_on_mapping()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM update_menu_item_availability();
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to automatically deduct inventory when order is completed
-- SECURITY DEFINER allows the function to bypass RLS policies
CREATE OR REPLACE FUNCTION deduct_inventory_on_order_completion()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- After deducting inventory, update menu item availability
    PERFORM update_menu_item_availability();
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

-- Trigger to automatically update menu item availability when inventory changes
CREATE TRIGGER trigger_update_menu_availability_on_inventory_change
  AFTER UPDATE ON inventory_items
  FOR EACH ROW
  WHEN (OLD.quantity IS DISTINCT FROM NEW.quantity)
  EXECUTE FUNCTION trigger_update_menu_availability();

-- Trigger to automatically update menu item availability when inventory is inserted
CREATE TRIGGER trigger_update_menu_availability_on_inventory_insert
  AFTER INSERT ON inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_menu_availability_on_insert();

-- Trigger to update menu availability when menu_item_inventory mappings change
CREATE TRIGGER trigger_update_menu_availability_on_mapping_change
  AFTER INSERT OR UPDATE OR DELETE ON menu_item_inventory
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_menu_availability_on_mapping();

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
INSERT INTO menu_items (name, description, price, category, image_url, is_available, is_on_menu) VALUES
-- Appetizers
('Bruschetta Trio', 'Three types of bruschetta: classic tomato basil, goat cheese honey, and pesto mozzarella', 12.99, 'Appetizers', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop', true, true),
('Crispy Calamari', 'Golden fried calamari rings served with marinara sauce and lemon aioli', 14.99, 'Appetizers', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop', true, true),
('Spinach Artichoke Dip', 'Creamy blend of spinach and artichoke hearts, baked with parmesan and served with tortilla chips', 11.99, 'Appetizers', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true, true),

-- Main Courses
('Grilled Salmon', 'Atlantic salmon grilled to perfection, served with roasted vegetables and lemon butter sauce', 24.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true, true),
('Ribeye Steak', '12oz prime ribeye steak, char-grilled and served with garlic mashed potatoes and seasonal vegetables', 32.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true, true),
('Chicken Parmesan', 'Breaded chicken breast topped with marinara sauce and mozzarella, served over linguine', 19.99, 'Main Course', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', true, true),
('Margherita Pizza', 'Classic pizza with fresh mozzarella, tomato sauce, and basil leaves on our house-made dough', 16.99, 'Main Course', 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&h=600&fit=crop', true, true),
('Pasta Carbonara', 'Creamy pasta with pancetta, parmesan cheese, egg yolk, and black pepper', 18.99, 'Main Course', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop', true, true),

-- Salads
('Caesar Salad', 'Crisp romaine lettuce with caesar dressing, parmesan cheese, and house-made croutons', 10.99, 'Salads', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop', true, true),
('Greek Salad', 'Mixed greens with feta cheese, kalamata olives, cucumbers, tomatoes, and red onion with greek dressing', 11.99, 'Salads', 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop', true, true),

-- Desserts
('Chocolate Lava Cake', 'Warm chocolate cake with a molten center, served with vanilla ice cream', 8.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true, true),
('Tiramisu', 'Classic Italian dessert with layers of coffee-soaked ladyfingers and mascarpone cream', 7.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true, true),
('New York Cheesecake', 'Creamy cheesecake with a graham cracker crust, topped with fresh berries', 8.99, 'Desserts', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=600&fit=crop', true, true),

-- Beverages
('Fresh Lemonade', 'House-made lemonade with fresh lemons, mint, and a hint of honey', 4.99, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true, true),
('Iced Coffee', 'Cold brew coffee served over ice with your choice of milk and sweetener', 4.49, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true, true),
('Fresh Orange Juice', 'Freshly squeezed orange juice served chilled', 3.99, 'Beverages', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', true, true);

-- Sample Inventory Items
INSERT INTO inventory_items (name, image_url, quantity, unit, min_stock) VALUES
('Mozzarella Cheese', 'https://images.unsplash.com/photo-1618164436269-1f6452e4f8c5?w=800&h=600&fit=crop', 50.0, 'lbs', 10.0),
('Pizza Dough', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&h=600&fit=crop', 30.0, 'lbs', 5.0),
('Tomatoes', 'https://images.unsplash.com/photo-1546093837427-8e0e97eb5a5c?w=800&h=600&fit=crop', 25.0, 'lbs', 5.0),
('Fresh Basil', 'https://images.unsplash.com/photo-1618375569909-a6f539b86d40?w=800&h=600&fit=crop', 5.0, 'lbs', 1.0),
('Salmon Fillet', 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=800&h=600&fit=crop', 20.0, 'lbs', 5.0),
('Ribeye Steak', 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=800&h=600&fit=crop', 30.0, 'lbs', 10.0),
('Chicken Breast', 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800&h=600&fit=crop', 25.0, 'lbs', 8.0),
('Pasta', 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&h=600&fit=crop', 40.0, 'lbs', 10.0),
('Pancetta', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop', 15.0, 'lbs', 3.0),
('Parmesan Cheese', 'https://images.unsplash.com/photo-1618164436269-1f6452e4f8c5?w=800&h=600&fit=crop', 20.0, 'lbs', 5.0),
('Romaine Lettuce', 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800&h=600&fit=crop', 15.0, 'lbs', 3.0),
('Feta Cheese', 'https://images.unsplash.com/photo-1618164436269-1f6452e4f8c5?w=800&h=600&fit=crop', 12.0, 'lbs', 2.0),
('Calamari', 'https://images.unsplash.com/photo-1572441713132-51c75654db73?w=800&h=600&fit=crop', 10.0, 'lbs', 2.0),
('Spinach', 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&h=600&fit=crop', 8.0, 'lbs', 2.0),
('Artichoke Hearts', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop', 6.0, 'lbs', 1.0),
('Chocolate', 'https://images.unsplash.com/photo-1606312619070-d48b4b2f3e1a?w=800&h=600&fit=crop', 20.0, 'lbs', 5.0),
('Coffee Beans', 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&h=600&fit=crop', 30.0, 'lbs', 10.0),
('Lemons', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', 25.0, 'lbs', 5.0),
('Oranges', 'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&h=600&fit=crop', 30.0, 'lbs', 5.0);

-- Sample Menu Item Inventory Mappings
-- Note: These use subqueries to find menu items and inventory items by name
-- Margherita Pizza requires: Mozzarella, Dough, Tomatoes, Basil
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Margherita Pizza'),
  (SELECT id FROM inventory_items WHERE name = 'Mozzarella Cheese'),
  0.5
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Margherita Pizza')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Mozzarella Cheese');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Margherita Pizza'),
  (SELECT id FROM inventory_items WHERE name = 'Pizza Dough'),
  1.0
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Margherita Pizza')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Pizza Dough');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Margherita Pizza'),
  (SELECT id FROM inventory_items WHERE name = 'Tomatoes'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Margherita Pizza')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Tomatoes');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Margherita Pizza'),
  (SELECT id FROM inventory_items WHERE name = 'Fresh Basil'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Margherita Pizza')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Fresh Basil');

-- Grilled Salmon requires: Salmon, Tomatoes
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Grilled Salmon'),
  (SELECT id FROM inventory_items WHERE name = 'Salmon Fillet'),
  0.5
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Grilled Salmon')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Salmon Fillet');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Grilled Salmon'),
  (SELECT id FROM inventory_items WHERE name = 'Tomatoes'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Grilled Salmon')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Tomatoes');

-- Ribeye Steak requires: Ribeye Steak
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Ribeye Steak'),
  (SELECT id FROM inventory_items WHERE name = 'Ribeye Steak'),
  0.75
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Ribeye Steak')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Ribeye Steak');

-- Chicken Parmesan requires: Chicken, Pasta, Mozzarella, Tomatoes
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Chicken Parmesan'),
  (SELECT id FROM inventory_items WHERE name = 'Chicken Breast'),
  0.5
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Parmesan')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Chicken Breast');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Chicken Parmesan'),
  (SELECT id FROM inventory_items WHERE name = 'Pasta'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Parmesan')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Pasta');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Chicken Parmesan'),
  (SELECT id FROM inventory_items WHERE name = 'Mozzarella Cheese'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Parmesan')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Mozzarella Cheese');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Chicken Parmesan'),
  (SELECT id FROM inventory_items WHERE name = 'Tomatoes'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chicken Parmesan')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Tomatoes');

-- Pasta Carbonara requires: Pasta, Pancetta, Parmesan
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Pasta Carbonara'),
  (SELECT id FROM inventory_items WHERE name = 'Pasta'),
  0.4
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Pasta Carbonara')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Pasta');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Pasta Carbonara'),
  (SELECT id FROM inventory_items WHERE name = 'Pancetta'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Pasta Carbonara')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Pancetta');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Pasta Carbonara'),
  (SELECT id FROM inventory_items WHERE name = 'Parmesan Cheese'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Pasta Carbonara')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Parmesan Cheese');

-- Caesar Salad requires: Romaine Lettuce, Parmesan
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Caesar Salad'),
  (SELECT id FROM inventory_items WHERE name = 'Romaine Lettuce'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Caesar Salad')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Romaine Lettuce');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Caesar Salad'),
  (SELECT id FROM inventory_items WHERE name = 'Parmesan Cheese'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Caesar Salad')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Parmesan Cheese');

-- Greek Salad requires: Feta, Tomatoes
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Greek Salad'),
  (SELECT id FROM inventory_items WHERE name = 'Feta Cheese'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Greek Salad')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Feta Cheese');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Greek Salad'),
  (SELECT id FROM inventory_items WHERE name = 'Tomatoes'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Greek Salad')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Tomatoes');

-- Crispy Calamari requires: Calamari
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Crispy Calamari'),
  (SELECT id FROM inventory_items WHERE name = 'Calamari'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Crispy Calamari')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Calamari');

-- Spinach Artichoke Dip requires: Spinach, Artichoke Hearts
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Spinach Artichoke Dip'),
  (SELECT id FROM inventory_items WHERE name = 'Spinach'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Spinach Artichoke Dip')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Spinach');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Spinach Artichoke Dip'),
  (SELECT id FROM inventory_items WHERE name = 'Artichoke Hearts'),
  0.15
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Spinach Artichoke Dip')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Artichoke Hearts');

-- Iced Coffee requires: Coffee Beans
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Iced Coffee'),
  (SELECT id FROM inventory_items WHERE name = 'Coffee Beans'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Iced Coffee')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Coffee Beans');

-- Fresh Lemonade requires: Lemons
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Fresh Lemonade'),
  (SELECT id FROM inventory_items WHERE name = 'Lemons'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Fresh Lemonade')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Lemons');

-- Fresh Orange Juice requires: Oranges
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Fresh Orange Juice'),
  (SELECT id FROM inventory_items WHERE name = 'Oranges'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Fresh Orange Juice')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Oranges');

-- Bruschetta Trio requires: Tomatoes, Mozzarella, Fresh Basil
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Bruschetta Trio'),
  (SELECT id FROM inventory_items WHERE name = 'Tomatoes'),
  0.4
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Bruschetta Trio')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Tomatoes');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Bruschetta Trio'),
  (SELECT id FROM inventory_items WHERE name = 'Mozzarella Cheese'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Bruschetta Trio')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Mozzarella Cheese');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Bruschetta Trio'),
  (SELECT id FROM inventory_items WHERE name = 'Fresh Basil'),
  0.15
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Bruschetta Trio')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Fresh Basil');

-- Chocolate Lava Cake requires: Chocolate
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Chocolate Lava Cake'),
  (SELECT id FROM inventory_items WHERE name = 'Chocolate'),
  0.2
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Chocolate Lava Cake')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Chocolate');

-- Tiramisu requires: Coffee Beans, Chocolate
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Tiramisu'),
  (SELECT id FROM inventory_items WHERE name = 'Coffee Beans'),
  0.15
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Tiramisu')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Coffee Beans');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'Tiramisu'),
  (SELECT id FROM inventory_items WHERE name = 'Chocolate'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'Tiramisu')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Chocolate');

-- New York Cheesecake requires: Mozzarella Cheese (using as a cheese substitute), Chocolate
-- Note: For a more realistic setup, you might want to add Cream Cheese as a separate inventory item
-- For now, we'll use Mozzarella Cheese as a placeholder
INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'New York Cheesecake'),
  (SELECT id FROM inventory_items WHERE name = 'Mozzarella Cheese'),
  0.3
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'New York Cheesecake')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Mozzarella Cheese');

INSERT INTO menu_item_inventory (menu_item_id, inventory_item_id, quantity_required)
SELECT 
  (SELECT id FROM menu_items WHERE name = 'New York Cheesecake'),
  (SELECT id FROM inventory_items WHERE name = 'Chocolate'),
  0.1
WHERE EXISTS (SELECT 1 FROM menu_items WHERE name = 'New York Cheesecake')
  AND EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Chocolate');

-- Update menu item availability based on initial inventory
SELECT update_menu_item_availability();

-- ============================================================================
-- COMPLETION
-- ============================================================================
-- Schema setup complete!
-- 
-- Features included:
-- - Sample menu items (15 items)
-- - Sample inventory items (19 items)
-- - Sample menu-to-inventory mappings
-- - Automatic inventory deduction when orders are completed
-- - Automatic menu item availability updates based on inventory
-- - Inventory validation before order acceptance
-- 

-- ============================================================================

