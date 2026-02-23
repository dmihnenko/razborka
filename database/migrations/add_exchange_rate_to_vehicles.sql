-- Добавляем курс доллара для каждого автомобиля (разборка)
-- Используется для расчёта доходности в $

ALTER TABLE parts_vehicles
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10, 2) DEFAULT 41;
