/**
 * Скрипт для генерации SQL импорта клиентов и автомобилей из Firebase бэкапа
 */

import fs from 'fs';

const BACKUP_FILE = 'c:\\Users\\home\\Downloads\\tsp-sto-export-2026-02-12.json';
const OUTPUT_FILE = 'c:\\Users\\home\\Documents\\project\\TSP-V2\\database\\migrations\\import_clients_vehicles.sql';

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

async function generateImportSQL() {
  console.log('Читаем бэкап из:', BACKUP_FILE);
  
  const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  const requests = data.requests || [];
  
  // Собираем уникальных клиентов
  const clientsMap = new Map();
  const vehiclesMap = new Map();
  
  for (const req of requests) {
    // Пропускаем заявки из другого СТО
    if (req.stoId !== 'MMtgV1oLNmifXB6Gi8sk') continue;
    
    // Добавляем клиента
    if (req.client && req.clientPhone) {
      if (!clientsMap.has(req.clientPhone)) {
        clientsMap.set(req.clientPhone, {
          phone: req.clientPhone,
          name: req.client.name || req.clientName || 'Без имени',
          email: req.client.email || null,
          address: req.client.address || null,
          notes: req.client.notes || null
        });
      }
    }
    
    // Добавляем автомобиль
    if (req.vehicle && req.vehicleVin) {
      if (!vehiclesMap.has(req.vehicleVin)) {
        vehiclesMap.set(req.vehicleVin, {
          vin: req.vehicleVin,
          brand: req.vehicle.make || req.vehicleMake || 'Неизвестно',
          model: req.vehicle.model || '',
          year: req.vehicle.year || req.vehicleYear || 2020,
          licensePlate: req.vehicle.licensePlate || req.vehicleNumber || '',
          color: req.vehicle.color || null,
          mileage: req.vehicle.mileage || null,
          clientPhone: req.clientPhone
        });
      }
    }
  }
  
  console.log(`Найдено уникальных клиентов: ${clientsMap.size}`);
  console.log(`Найдено уникальных автомобилей: ${vehiclesMap.size}`);
  
  let sql = `-- Импорт клиентов и автомобилей из Firebase бэкапа
-- Дата генерации: ${new Date().toISOString()}
-- Клиентов: ${clientsMap.size}
-- Автомобилей: ${vehiclesMap.size}

BEGIN;

-- ============================================================
-- ИМПОРТ КЛИЕНТОВ
-- ============================================================

`;

  // Генерируем INSERT для клиентов
  for (const [phone, client] of clientsMap) {
    sql += `-- Клиент: ${client.name}
INSERT INTO customers (name, phone, email, address, notes)
VALUES (
  ${escapeSql(client.name)},
  ${escapeSql(client.phone)},
  ${escapeSql(client.email)},
  ${escapeSql(client.address)},
  ${escapeSql(client.notes)}
)
ON CONFLICT (phone) DO UPDATE SET
  name = EXCLUDED.name,
  email = COALESCE(EXCLUDED.email, customers.email),
  address = COALESCE(EXCLUDED.address, customers.address),
  notes = COALESCE(EXCLUDED.notes, customers.notes);

`;
  }

  sql += `
-- ============================================================
-- ИМПОРТ АВТОМОБИЛЕЙ
-- ============================================================

`;

  // Генерируем INSERT для автомобилей
  for (const [vin, vehicle] of vehiclesMap) {
    sql += `-- Автомобиль: ${vehicle.brand} ${vehicle.model} (${vehicle.year})
INSERT INTO vehicles (customer_id, brand, model, year, vin, license_plate, color, mileage)
VALUES (
  (SELECT id FROM customers WHERE phone = ${escapeSql(vehicle.clientPhone)} LIMIT 1),
  ${escapeSql(vehicle.brand)},
  ${escapeSql(vehicle.model)},
  ${vehicle.year},
  ${escapeSql(vehicle.vin)},
  ${escapeSql(vehicle.licensePlate)},
  ${escapeSql(vehicle.color)},
  ${vehicle.mileage || 'NULL'}
)
ON CONFLICT (vin) DO UPDATE SET
  brand = EXCLUDED.brand,
  model = EXCLUDED.model,
  year = EXCLUDED.year,
  license_plate = COALESCE(EXCLUDED.license_plate, vehicles.license_plate),
  color = COALESCE(EXCLUDED.color, vehicles.color),
  mileage = COALESCE(EXCLUDED.mileage, vehicles.mileage);

`;
  }

  sql += `
COMMIT;

-- ============================================================
-- СТАТИСТИКА
-- ============================================================
-- Импортировано клиентов: ${clientsMap.size}
-- Импортировано автомобилей: ${vehiclesMap.size}
`;

  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');
  
  console.log('\n=== ГОТОВО ===');
  console.log(`Сгенерирован файл: ${OUTPUT_FILE}`);
  console.log(`Клиентов: ${clientsMap.size}`);
  console.log(`Автомобилей: ${vehiclesMap.size}`);
}

generateImportSQL().catch(console.error);
