# Применение миграции управления меню услуг

Откройте Supabase Dashboard:
1. Перейдите на https://supabase.com/dashboard/project/hwckvddevjucuzxdoqqh
2. Откройте SQL Editor
3. Скопируйте и выполните следующий SQL:

```sql
-- Добавляем поле services_menu_enabled в таблицу sto_companies
-- Это поле контролирует доступ работников к меню услуг
ALTER TABLE sto_companies
ADD COLUMN IF NOT EXISTS services_menu_enabled BOOLEAN DEFAULT TRUE;

-- По умолчанию включаем для всех существующих СТО
UPDATE sto_companies
SET services_menu_enabled = TRUE
WHERE services_menu_enabled IS NULL;
```

4. Нажмите RUN

Готово! Теперь владелец СТО может включать/отключать доступ к меню услуг для работников.

## Что изменилось:

- **Убрана** система is_active для отдельных услуг
- **Добавлена** глобальная настройка на уровне СТО: `services_menu_enabled`
- Владелец управляет этой настройкой в разделе СТО (кнопка "Меню услуг")
- Когда выключено - работники не видят кнопку "Добавить из справочника"
- Владелец всегда видит кнопку независимо от настройки

