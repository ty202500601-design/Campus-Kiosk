-- SchoolBites PostgreSQL / Supabase schema (production target; demo server uses in-memory data)
create type user_role as enum ('student','vendor','admin');
create type order_status as enum ('Pending Confirmation','Accepted','Preparing','Ready for Pickup','Completed','Cancelled');
create table roles(role user_role primary key, permissions jsonb not null default '[]');
create table profiles(id uuid primary key references auth.users, full_name text not null, school_id text, role user_role not null default 'student', canteen_id uuid, created_at timestamptz default now());
create table canteens(id uuid primary key default gen_random_uuid(), name text not null, specialty text, image_url text, hours jsonb, is_open boolean default true, active boolean default true, prep_minutes int default 10, capacity int default 30, created_at timestamptz default now());
alter table profiles add foreign key (canteen_id) references canteens(id);
create table food_categories(id uuid primary key default gen_random_uuid(), name text unique not null, icon text);
create table food_items(id uuid primary key default gen_random_uuid(), canteen_id uuid not null references canteens(id), category_id uuid references food_categories(id), name text not null, description text, image_url text, price_php numeric(8,2) not null check(price_php>=0), available boolean default true, stock int, created_at timestamptz default now(), updated_at timestamptz default now());
create table food_customizations(id uuid primary key default gen_random_uuid(), food_item_id uuid not null references food_items(id) on delete cascade, group_name text not null, choice_name text not null, extra_price numeric(8,2) default 0, multi boolean default false);
create table carts(id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), created_at timestamptz default now());
create table cart_items(id uuid primary key default gen_random_uuid(), cart_id uuid not null references carts(id) on delete cascade, food_item_id uuid not null references food_items(id), canteen_id uuid not null references canteens(id), quantity int not null check(quantity between 1 and 20), customizations jsonb default '[]', note text);
create table parent_orders(id uuid primary key default gen_random_uuid(), order_no text unique not null, user_id uuid not null references profiles(id), idempotency_key text unique not null, customer_name text not null, school_ref text, pickup_type text, pickup_time text, notes text, fee numeric(8,2) default 0, total numeric(10,2) not null, created_at timestamptz default now());
create table vendor_orders(id uuid primary key default gen_random_uuid(), parent_order_id uuid not null references parent_orders(id), canteen_id uuid not null references canteens(id), subtotal numeric(10,2) not null, status order_status default 'Pending Confirmation', updated_at timestamptz default now());
create table order_items(id uuid primary key default gen_random_uuid(), vendor_order_id uuid not null references vendor_orders(id) on delete cascade, food_item_id uuid not null references food_items(id), name_snapshot text not null, unit_price_snapshot numeric(8,2) not null, quantity int not null, customizations_snapshot jsonb default '[]', note text);
create table payments(id uuid primary key default gen_random_uuid(), parent_order_id uuid not null references parent_orders(id), method text not null, amount numeric(10,2) not null, status text default 'unpaid', provider_ref text, verified_at timestamptz);
create table notifications(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), canteen_id uuid references canteens(id), message text not null, read boolean default false, created_at timestamptz default now());
create table sales_reports(id uuid primary key default gen_random_uuid(), canteen_id uuid references canteens(id), report_date date not null, orders int, gross_sales numeric(10,2), unique(canteen_id, report_date));
-- Row Level Security: vendors only see their own canteen
create function my_role() returns user_role language sql stable as $$ select role from profiles where id=auth.uid() $$;
create function my_canteen() returns uuid language sql stable as $$ select canteen_id from profiles where id=auth.uid() $$;
alter table vendor_orders enable row level security; alter table order_items enable row level security; alter table food_items enable row level security; alter table parent_orders enable row level security;
create policy vo_vendor on vendor_orders for all using (my_role()='admin' or canteen_id=my_canteen() or parent_order_id in (select id from parent_orders where user_id=auth.uid()));
create policy oi_vendor on order_items for select using (vendor_order_id in (select id from vendor_orders));
create policy fi_read on food_items for select using (true);
create policy fi_vendor on food_items for all using (my_role()='admin' or canteen_id=my_canteen());
create policy po_own on parent_orders for select using (user_id=auth.uid() or my_role()='admin');
-- Orders must be inserted by a server function (SECURITY DEFINER) that re-prices from food_items, checks is_open/available, and honors idempotency_key.
