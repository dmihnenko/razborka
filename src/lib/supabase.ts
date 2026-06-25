import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// ВАЖНО: единственный экземпляр клиента на вкладку. Если этот модуль исполнится повторно
// (HMR в dev, дублирующийся чанк, двойная загрузка), второй createClient поднял бы СВОЙ
// GoTrueClient с тем же storage и СВОИМ autoRefreshToken-таймером. Два клиента начинают
// рефрешить токен наперегонки — а при сдвиге часов на устройстве (токен сразу выглядит
// протухшим) это вырождается в «шторм» POST /auth/v1/token → Supabase отвечает 429 →
// SDK трактует как провал → SIGNED_OUT → пользователя выкидывает на лендинг.
// Кешируем экземпляр на globalThis, чтобы второй раз клиент не создавался.
// storageKey НЕ задаём явно — остаётся дефолтный (sb-<ref>-auth-token), чтобы не
// инвалидировать уже сохранённые сессии действующих пользователей.
const globalForSupabase = globalThis as unknown as { __sbClient?: SupabaseClient }

export const supabase =
  globalForSupabase.__sbClient ??
  createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // PKCE — рекомендованный безопасный флоу OAuth: возврат с «?code», который
      // supabase-js меняет на сессию (виден как /token в логах). Implicit (дефолт)
      // отдаёт токен в URL-хеше и у нас не подхватывался при возврате с Google.
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  })

globalForSupabase.__sbClient = supabase
