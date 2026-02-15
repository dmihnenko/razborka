-- Проверка конкретной запчасти "Тяга рулевая 1643"

SELECT 
  a.request_number,
  ap.description,
  ap.quantity,
  ap.store_cost,
  ap.client_cost
FROM appointment_parts ap
JOIN appointments a ON ap.appointment_id = a.id
WHERE ap.store_cost = 1643
  OR ap.description ILIKE '%тяга%'
ORDER BY a.request_number;
