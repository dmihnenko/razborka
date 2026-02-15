/**
 * Импорт данных через Supabase API с правильной кодировкой UTF-8
 * Использует прямой SQL запрос через REST API
 */

import fs from 'fs';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Установите переменные окружения:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY (из Settings -> API -> service_role)');
  process.exit(1);
}

const sqlFile = 'database/migrations/generated_import.sql';
const sql = fs.readFileSync(sqlFile, 'utf-8');

console.log('📥 Импорт данных через Supabase API...');
console.log(`📄 Файл: ${sqlFile}`);
console.log(`📊 Размер: ${(sql.length / 1024).toFixed(2)} KB`);

const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({ query: sql })
});

if (!response.ok) {
  const error = await response.text();
  console.error('❌ Ошибка импорта:', error);
  process.exit(1);
}

console.log('✅ Импорт завершен успешно!');
console.log('🔄 Обновите страницу приложения');
