-- Каскадное удаление: клиент → автомобили → заявки
-- При удалении клиента автоматически удаляются его авто и все заявки по ним

-- 1. Пересоздаём FK на vehicles.customer_id с CASCADE
ALTER TABLE vehicles
  DROP CONSTRAINT IF EXISTS vehicles_customer_id_fkey;

ALTER TABLE vehicles
  ADD CONSTRAINT vehicles_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 2. Пересоздаём FK на appointments.customer_id с CASCADE
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_customer_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 3. Пересоздаём FK на appointments.vehicle_id с CASCADE
--    (чтобы при удалении авто удалялись и его заявки)
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_vehicle_id_fkey;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_vehicle_id_fkey
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;
