/**
 * Скрипт для генерации SQL импорта из Firebase JSON бэкапа
 * Читает tsp-sto-export-2026-02-12.json и генерирует SQL файл для импорта
 */

import fs from 'fs';
import path from 'path';

// Путь к JSON бэкапу
const BACKUP_FILE = 'c:\\Users\\home\\Downloads\\tsp-sto-export-2026-02-12.json';
const OUTPUT_FILE = 'c:\\Users\\home\\Documents\\project\\TSP-V2\\database\\migrations\\safe_import.sql';

// Маппинг статусов из Firebase в Supabase
const STATUS_MAPPING = {
  'В работе': 'in_progress',
  'Активна': 'scheduled',
  'Выполнена': 'completed',
  'Архив': 'archived',
  'Запчасти оплачены': 'in_progress'
};

// Функция для экранирования SQL строк
function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// Функция для форматирования даты
function formatDate(dateStr) {
  if (!dateStr) return 'NULL';
  try {
    const date = new Date(dateStr);
    return `'${date.toISOString()}'::TIMESTAMP WITH TIME ZONE`;
  } catch (e) {
    return 'NULL';
  }
}

// Функция для форматирования числа
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return 'NULL';
  return num;
}

// Функция для парсинга описания работ и извлечения стоимости
// Формат: "Работа 1000\nЕще работа 500"
function parseServices(description) {
  if (!description) return [];
  
  const services = [];
  const lines = description.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Ищем число в конце строки (стоимость)
    const match = trimmed.match(/^(.+?)\s+(\d+)$/);
    if (match) {
      services.push({
        description: match[1].trim(),
        cost: parseFloat(match[2])
      });
    } else {
      // Если нет числа, добавляем без стоимости
      services.push({
        description: trimmed,
        cost: null
      });
    }
  }
  
  return services;
}

// Основная функция генерации SQL
async function generateImportSQL() {
  console.log('Читаем бэкап из:', BACKUP_FILE);
  
  const data = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
  const requests = data.requests || [];
  
  let sql = `-- Автоматически сгенерированный импорт из Firebase
-- Дата генерации: ${new Date().toISOString()}
-- Всего заявок: ${requests.length}

-- ВАЖНО: Перед выполнением замените YOUR_STO_USER_ID на ваш реальный UUID

BEGIN;

`;

  // Статистика
  let imported = 0;
  let skipped = 0;
  const errors = [];

  // Обрабатываем каждую заявку
  for (const req of requests) {
    try {
      // Пропускаем заявки без клиента или автомобиля
      if (!req.clientPhone || !req.vehicleVin) {
        skipped++;
        console.log(`Пропущена заявка ${req.id}: нет телефона клиента или VIN`);
        continue;
      }

      const status = STATUS_MAPPING[req.status] || 'scheduled';
      const requestNumber = req.requestNumber || `STO-${req.id.substring(0, 6)}-${Date.now().toString().slice(-3)}`;

      sql += `
-- Заявка: ${requestNumber} (${req.clientName || 'Без имени'})
INSERT INTO appointments (
  firebase_id,
  request_number,
  customer_id,
  vehicle_id,
  scheduled_date,
  scheduled_time,
  status,
  description,
  parts_paid,
  work_paid,
  parts_cost,
  parts_client_cost,
  created_at,
  completed_at,
  assigned_to_name,
  ready_for_pickup,
  created_by,
  notes
) VALUES (
  ${escapeSql(req.id)},
  ${escapeSql(requestNumber)},
  (SELECT id FROM customers WHERE phone = ${escapeSql(req.clientPhone)} LIMIT 1),
  (SELECT id FROM vehicles WHERE vin = ${escapeSql(req.vehicleVin)} LIMIT 1),
  ${formatDate(req.scheduledDate || req.createdAt)},
  ${escapeSql(req.scheduledTime)},
  ${escapeSql(status)},
  ${escapeSql(req.description)},
  ${req.partsPaid === true ? 'TRUE' : 'FALSE'},
  ${req.workPaid === true ? 'TRUE' : 'FALSE'},
  ${formatNumber(req.partsCost)},
  ${formatNumber(req.partsClientCost)},
  ${formatDate(req.createdAt)},
  ${formatDate(req.completedAt)},
  ${escapeSql(req.assignedToName)},
  ${req.readyForPickup === true ? 'TRUE' : 'FALSE'},
  NULL, -- created_by (заполнить вручную)
  ${escapeSql(req.notes)}
)
ON CONFLICT (request_number) DO NOTHING;

`;

      // Добавляем запчасти
      // Приоритет: partsDetails > parts (чтобы избежать дублирования)
      if (req.partsDetails && Array.isArray(req.partsDetails) && req.partsDetails.length > 0) {
        // Если есть детальные запчасти - импортируем только их
        sql += `-- Детальные запчасти для заявки ${requestNumber}\n`;
        for (const partDetail of req.partsDetails) {
          sql += `INSERT INTO appointment_parts (appointment_id, description, quantity, store_cost, client_cost)
SELECT id, ${escapeSql(partDetail.name)}, ${formatNumber(partDetail.quantity || 1)}, ${formatNumber(partDetail.storeCost)}, ${formatNumber(partDetail.clientCost)}
FROM appointments WHERE firebase_id = ${escapeSql(req.id)}
ON CONFLICT (appointment_id, description) DO NOTHING;

`;
        }
      } else if (req.parts && Array.isArray(req.parts) && req.parts.length > 0) {
        // Если нет детальных, импортируем простые запчасти
        // Парсим цену из названия: "Тяга рулевая 1643" -> description="Тяга рулевая", store_cost=1643
        sql += `-- Запчасти для заявки ${requestNumber}\n`;
        for (const part of req.parts) {
          // Пытаемся извлечь цену из конца строки
          const match = part.match(/^(.+?)\s+(\d+)$/);
          if (match) {
            const description = match[1].trim();
            const cost = parseInt(match[2]);
            sql += `INSERT INTO appointment_parts (appointment_id, description, store_cost, quantity)
SELECT id, ${escapeSql(description)}, ${cost}, 1
FROM appointments WHERE firebase_id = ${escapeSql(req.id)}
ON CONFLICT (appointment_id, description) DO NOTHING;

`;
          } else {
            // Нет цены в названии - просто добавляем описание
            sql += `INSERT INTO appointment_parts (appointment_id, description)
SELECT id, ${escapeSql(part)}
FROM appointments WHERE firebase_id = ${escapeSql(req.id)}
ON CONFLICT (appointment_id, description) DO NOTHING;

`;
          }
        }
      }

      // Добавляем позиции лота (lotItems) только если нет partsDetails
      if (req.lotItems && Array.isArray(req.lotItems) && req.lotItems.length > 0 && 
          (!req.partsDetails || req.partsDetails.length === 0)) {
        sql += `-- Позиции лота для заявки ${requestNumber}\n`;
        for (const lotItem of req.lotItems) {
          sql += `INSERT INTO appointment_parts (appointment_id, description, quantity, store_cost, client_cost)
SELECT id, ${escapeSql(lotItem.name)}, ${formatNumber(lotItem.quantity || 1)}, ${formatNumber(lotItem.storeCost)}, ${formatNumber(lotItem.clientCost)}
FROM appointments WHERE firebase_id = ${escapeSql(req.id)}
ON CONFLICT (appointment_id, description) DO NOTHING;

`;
        }
      }

      // Парсим и добавляем работы из description
      if (req.description) {
        const services = parseServices(req.description);
        if (services.length > 0) {
          sql += `-- Работы для заявки ${requestNumber}\n`;
          for (const service of services) {
            sql += `INSERT INTO appointment_services (appointment_id, description, cost)
SELECT id, ${escapeSql(service.description)}, ${formatNumber(service.cost)}
FROM appointments WHERE firebase_id = ${escapeSql(req.id)}
ON CONFLICT (appointment_id, description) DO NOTHING;

`;
          }
        }
      }

      imported++;
    } catch (error) {
      errors.push({ id: req.id, error: error.message });
      console.error(`Ошибка обработки заявки ${req.id}:`, error.message);
    }
  }

  sql += `
COMMIT;

-- ============================================================
-- СТАТИСТИКА ИМПОРТА:
-- ============================================================
-- Обработано заявок: ${imported}
-- Пропущено: ${skipped}
-- Ошибок: ${errors.length}
`;

  if (errors.length > 0) {
    sql += `\n-- ОШИБКИ:\n`;
    errors.forEach(err => {
      sql += `-- ${err.id}: ${err.error}\n`;
    });
  }

  // Сохраняем в файл
  fs.writeFileSync(OUTPUT_FILE, sql, 'utf8');
  
  console.log('\n=== ГОТОВО ===');
  console.log(`Сгенерирован файл: ${OUTPUT_FILE}`);
  console.log(`Импортировано: ${imported}`);
  console.log(`Пропущено: ${skipped}`);
  console.log(`Ошибок: ${errors.length}`);
}

// Запускаем
generateImportSQL().catch(console.error);
