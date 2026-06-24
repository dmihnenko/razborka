-- Фикс данных: у безлимитных тарифов (выше Профи) аналитика была выключена.
-- Гейт аналитики = subscriptions.has_analytics. Профи (800₴, лимиты 30/3000) = true, а «Бессрочная»
-- (12000/39999₴, безлимит) и безлимитные «1000₴» стояли false → «доступно в Профи и выше» на самом
-- топовом тарифе. Правило: безлимитный план (max_vehicles IS NULL AND max_parts IS NULL) = топ-тариф → аналитика.

update public.subscriptions
   set has_analytics = true
 where max_vehicles is null and max_parts is null
   and has_analytics is distinct from true;
-- Затронуты: «Бессрочная подписка разборки», «Бессрочная Разборка», «Подписка Разборка», «Месячная подписка разборки».
