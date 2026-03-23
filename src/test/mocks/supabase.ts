import { vi } from 'vitest'

// ============================================================
// Типы для builder-паттерна (цепочки Supabase)
// ============================================================
interface MockQueryBuilder {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  neq: ReturnType<typeof vi.fn>
  or: ReturnType<typeof vi.fn>
  in: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  limit: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
}

// Создаём builder, который возвращает сам себя для любой цепочки
function createQueryBuilder(resolvedValue: { data: unknown; error: unknown }): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
  }

  // Делаем builder thenable (await builder → resolvedValue)
   
  ;(builder as any).then = (onfulfilled?: ((v: unknown) => unknown) | null) =>
    Promise.resolve(resolvedValue).then(onfulfilled ?? undefined)

  return builder
}

// ============================================================
// Моковый supabase клиент
// ============================================================
export const mockSupabaseFrom = vi.fn()
export const mockSupabaseRpc = vi.fn()
export const mockSupabaseGetSession = vi.fn()
export const mockSupabaseGetUser = vi.fn()
export const mockSupabaseOnAuthStateChange = vi.fn()
export const mockSupabaseSignInWithPassword = vi.fn()
export const mockSupabaseSignOut = vi.fn()

export function setFromResponse(data: unknown, error: unknown = null) {
  const builder = createQueryBuilder({ data, error })
  mockSupabaseFrom.mockReturnValue(builder)
  return builder
}

export function setRpcResponse(data: unknown, error: unknown = null) {
  mockSupabaseRpc.mockResolvedValue({ data, error })
}

export const mockSupabase = {
  from: mockSupabaseFrom,
  rpc: mockSupabaseRpc,
  auth: {
    getSession: mockSupabaseGetSession,
    getUser: mockSupabaseGetUser,
    onAuthStateChange: mockSupabaseOnAuthStateChange,
    signInWithPassword: mockSupabaseSignInWithPassword,
    signOut: mockSupabaseSignOut,
  },
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}))
