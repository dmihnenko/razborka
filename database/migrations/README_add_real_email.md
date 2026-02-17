# Миграция: Улучшенная система регистрации с username и real_email

## Дата: 2026-02-18

## Описание изменений

Улучшена система аутентификации для поддержки регистрации через username с опциональным email:

### 1. **База данных**
- ✅ Добавлено поле `real_email` в таблицу `user_profiles`
- ✅ Создан индекс для быстрого поиска по `real_email`
- ✅ Обновлён триггер `handle_new_user()` для сохранения `username` и `real_email` из метаданных

### 2. **Frontend (Login.tsx)**
- ✅ Отдельные поля для `username` (обязательно) и `email` (опционально) при регистрации
- ✅ Валидация username: 3-20 символов, латиница, цифры, подчёркивание
- ✅ Проверка уникальности username перед регистрацией
- ✅ Генерация технического email для Supabase: `username@internal.local`
- ✅ Обратная совместимость со старыми пользователями (`username@example.com`)

### 3. **Логика работы**

#### Регистрация:
1. Пользователь вводит **username** (обязательно) и **email** (опционально)
2. Проверяется уникальность username в БД
3. Валидируется формат username (regex: `^[a-zA-Z0-9_]{3,20}$`)
4. Если email не введён → генерируется `username@internal.local` для Supabase Auth
5. Сохраняются в метаданные:
   - `username` → сохраняется в `user_profiles.username`
   - `real_email` → сохраняется в `user_profiles.real_email` (если введён)

#### Вход:
1. Пользователь вводит **email или username**
2. Если это username:
   - Ищется в `user_profiles` по полю `username`
   - Пробуется новый формат: `username@internal.local`
   - Если не получилось → пробуется старый формат: `username@example.com` (обратная совместимость)
3. Если это email → используется напрямую

### 4. **Обратная совместимость**

✅ **Старые пользователи продолжат работать без проблем:**
- Пользователи с email `username@example.com` смогут входить по username
- Логика входа проверяет оба формата (новый и старый)

## Применение миграции

### Шаг 1: Применить SQL миграцию

```bash
# В Supabase Dashboard → SQL Editor
```

Выполните файл:
```
database/migrations/add_real_email_to_user_profiles.sql
```

Или вручную:

```sql
-- 1. Добавить поле real_email
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS real_email text;

-- 2. Создать индекс
CREATE INDEX IF NOT EXISTS idx_user_profiles_real_email ON user_profiles(real_email);

-- 3. Обновить триггер
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, phone, username, real_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'username', ''),
    COALESCE(new.raw_user_meta_data->>'real_email', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Пересоздать триггер
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### Шаг 2: Деплой изменений

```bash
git add -A
git commit -m "Улучшена система регистрации с username и опциональным email"
git push
```

Netlify автоматически задеплоит изменения.

## Тестирование

### Тест 1: Новая регистрация с username и email
1. Перейти на страницу логина
2. Нажать "Зарегистрироваться"
3. Ввести:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Пароль: `password123`
4. ✅ Должна пройти регистрация

### Тест 2: Регистрация только с username
1. Нажать "Зарегистрироваться"
2. Ввести:
   - Username: `testuser456`
   - Email: (оставить пустым)
   - Пароль: `password123`
3. ✅ Должна пройти регистрация с автогенерацией email

### Тест 3: Валидация username
1. Попробовать username с кириллицей: `тестюзер` → ❌ Ошибка
2. Попробовать короткий username: `ab` → ❌ Ошибка
3. Попробовать username с пробелами: `test user` → ❌ Ошибка

### Тест 4: Вход старого пользователя
1. Ввести username старого пользователя
2. Ввести пароль
3. ✅ Должен войти (через формат `username@example.com`)

### Тест 5: Вход нового пользователя
1. Ввести username нового пользователя
2. Ввести пароль
3. ✅ Должен войти (через формат `username@internal.local`)

## Изменённые файлы

- ✅ `src/pages/Login.tsx` - обновлена логика регистрации и входа
- ✅ `database/user_profile_trigger.sql` - обновлён триггер
- ✅ `database/migrations/add_real_email_to_user_profiles.sql` - новая миграция

## Возможные проблемы и решения

### Проблема: Пользователь не может войти после обновления
**Решение:** Проверьте, что миграция применена в БД. Логика входа поддерживает оба формата.

### Проблема: Ошибка "Username уже занят"
**Решение:** Это нормально, система проверяет уникальность. Попробуйте другой username.

### Проблема: Старые пользователи не могут войти
**Решение:** Логика входа автоматически пробует старый формат `username@example.com`.

## Следующие шаги (опционально)

1. **Добавить восстановление пароля:**
   - Использовать `real_email` для отправки письма
   - Fallback на технический email, если `real_email` пустой

2. **Миграция старых пользователей:**
   - Скрипт для обновления старых записей
   - Преобразование `username@example.com` → `username@internal.local`

3. **Email верификация:**
   - Отправка письма подтверждения на `real_email`
   - Добавить поле `email_verified` в `user_profiles`
