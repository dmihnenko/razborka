-- Скрипт для удаления всех существующих политик перед применением schema.sql

-- Roles
drop policy if exists "Allow all authenticated users to read roles" on roles;
drop policy if exists "Allow admins to manage roles" on roles;

-- User Profiles
drop policy if exists "Users can view all profiles" on user_profiles;
drop policy if exists "Users can update own profile" on user_profiles;
drop policy if exists "Allow admins to manage user profiles" on user_profiles;

-- Service Categories  
drop policy if exists "Allow authenticated users to read service_categories" on service_categories;
drop policy if exists "Allow authenticated users to insert service_categories" on service_categories;
drop policy if exists "Allow authenticated users to update service_categories" on service_categories;
drop policy if exists "Allow authenticated users to delete service_categories" on service_categories;

-- Customers
drop policy if exists "Allow authenticated users to read customers" on customers;
drop policy if exists "Allow authenticated users to insert customers" on customers;
drop policy if exists "Allow authenticated users to update customers" on customers;
drop policy if exists "Allow authenticated users to delete customers" on customers;

-- Vehicles
drop policy if exists "Allow authenticated users to read vehicles" on vehicles;
drop policy if exists "Allow authenticated users to insert vehicles" on vehicles;
drop policy if exists "Allow authenticated users to update vehicles" on vehicles;
drop policy if exists "Allow authenticated users to delete vehicles" on vehicles;

-- Services
drop policy if exists "Allow authenticated users to read services" on services;
drop policy if exists "Allow authenticated users to insert services" on services;
drop policy if exists "Allow authenticated users to update services" on services;
drop policy if exists "Allow authenticated users to delete services" on services;

-- Parts
drop policy if exists "Allow authenticated users to read parts" on parts;
drop policy if exists "Allow authenticated users to insert parts" on parts;
drop policy if exists "Allow authenticated users to update parts" on parts;
drop policy if exists "Allow authenticated users to delete parts" on parts;

-- Appointments
drop policy if exists "Allow authenticated users to read appointments" on appointments;
drop policy if exists "Allow authenticated users to insert appointments" on appointments;
drop policy if exists "Allow authenticated users to update appointments" on appointments;
drop policy if exists "Allow authenticated users to delete appointments" on appointments;

-- Work Orders
drop policy if exists "Allow authenticated users to read work_orders" on work_orders;
drop policy if exists "Allow authenticated users to insert work_orders" on work_orders;
drop policy if exists "Allow authenticated users to update work_orders" on work_orders;
drop policy if exists "Allow authenticated users to delete work_orders" on work_orders;

-- Work Order Items
drop policy if exists "Allow authenticated users to read work_order_items" on work_order_items;
drop policy if exists "Allow authenticated users to insert work_order_items" on work_order_items;
drop policy if exists "Allow authenticated users to update work_order_items" on work_order_items;
drop policy if exists "Allow authenticated users to delete work_order_items" on work_order_items;

-- Invoices
drop policy if exists "Allow authenticated users to read invoices" on invoices;
drop policy if exists "Allow authenticated users to insert invoices" on invoices;
drop policy if exists "Allow authenticated users to update invoices" on invoices;
drop policy if exists "Allow authenticated users to delete invoices" on invoices;
