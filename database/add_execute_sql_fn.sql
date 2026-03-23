-- Функция для выполнения произвольного SQL (только для Edge Function с service_role)
-- ВАЖНО: Эта функция вызывается ТОЛЬКО через Edge Function execute-sql,
--        которая проверяет что вызывающий является администратором.

CREATE OR REPLACE FUNCTION execute_sql(query_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  RETURN COALESCE(result, '[]'::JSON);
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Только service_role может вызывать эту функцию
REVOKE ALL ON FUNCTION execute_sql(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_sql(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION execute_sql(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
