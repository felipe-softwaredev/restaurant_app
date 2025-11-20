# Restaurant Ordering Web App

A modern restaurant ordering web application built with Next.js, Supabase, and shadcn/ui. Customers can browse menus and place orders, while admins manage inventory, menu items, and orders in real-time.

## Features

### Customer Side

- Browse menu items organized by category
- Add items to shopping cart
- Place orders with phone number (name and email optional)
- View all orders by phone number lookup
- Real-time order status tracking with live countdown timer

### Admin Side

- Secure email/password login
- Manage orders: approve/decline, set preparation time, mark as completed
- Manage inventory: track stock levels, full CRUD operations
- Manage menu: add/edit/delete menu items with images
- View order history with status filtering

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase (Database, Auth, Realtime)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm, yarn, or pnpm package manager
- Supabase account and project

### Installation

1. **Clone the repository**

```
git clone <your-repo-url>
cd restaurant-ordering-app
```

2. **Install dependencies**

```
npm install
```

or

```
pnpm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

You can find these values in your Supabase Dashboard → Settings → API.

4. **Set up Supabase database**

- Open your [Supabase Dashboard](https://supabase.com/dashboard)
- Navigate to **SQL Editor** → **New Query**
- Open the `supabase-schema.sql` file from this repository
- Copy the entire contents and paste into the SQL Editor
- Click **Run** to execute the schema

This will create all tables, RLS policies, triggers, and sample data.

5. **Admin Login Credentials**

There is already a default admin user registered in the system:

- **Email**: `admin@restaurant.com`
- **Password**: `Admin123!`

You can log in to the admin dashboard using these credentials.

**Note**: If you need to create additional admin users, go to **Authentication** → **Users** in Supabase Dashboard, click **Add user** → **Create new user**, enter email and password, check **Auto Confirm User**, and click **Create user**.

6. **Run the development server**

```
npm run dev
```

or

```
pnpm dev
```

7. **Open the app**

Visit [http://localhost:3000](http://localhost:3000)

- Click "Order Now" to browse the menu
- Click "My Orders" to view your orders
- Click "Admin Login" to access admin dashboard

## Deployment to Vercel

1. Push code to GitHub
2. Import repository in Vercel Dashboard
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

## Project Structure

```
app/
├── admin/          # Admin pages (login, dashboard, orders, inventory, menu, order-history)
├── menu/           # Public menu page
├── cart/           # Shopping cart page
├── orders/         # Customer orders lookup
├── order-status/   # Order status tracking
└── api/orders/     # Order API route
```

## Database Schema

**Tables:**

- `menu_items` - Menu items with name, price, picture, category
- `inventory_items` - Inventory items with name, image, quantity
- `orders` - Orders with customer info, phone_number, status, preparation_time
- `order_items` - Individual items in each order
- `menu_item_inventory` - Mapping for inventory deduction

**Order Status Flow:**
`pending` → `approved` → `completed` (or `declined`)

**Inventory Deduction:**
Automatically triggered when order status changes to 'completed' via database trigger.

## License

ISC
# restaurant_app
