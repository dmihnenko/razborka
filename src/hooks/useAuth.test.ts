import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import '../test/mocks/supabase'
import { useAuth, __resetAuthCacheForTests } from '@/hooks/useAuth'
import { mockSupabase } from '../test/mocks/supabase'

describe('useAuth', () => {
  beforeEach(() => {
    // Сбрасываем модульный кэш auth, иначе состояние течёт между тестами
    __resetAuthCacheForTests()
    // По умолчанию — нет сессии
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })
    mockSupabase.auth.onAuthStateChange.mockImplementation((_cb: unknown) => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))
  })

  it('изначально loading = true, user = null', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('после загрузки сессии, loading = false', async () => {
    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })

  it('user = null если нет сессии', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })

  it('user заполняется при наличии сессии', async () => {
    const fakeUser = { id: 'user-1', email: 'test@test.com' }
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(fakeUser)
  })

  it('обновляет user при изменении auth state (SIGNED_IN)', async () => {
    let authCallback: (event: string, session: unknown) => void = () => {}

    mockSupabase.auth.onAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const fakeUser = { id: 'user-2', email: 'new@test.com' }
    act(() => {
      authCallback('SIGNED_IN', { user: fakeUser })
    })

    expect(result.current.user).toEqual(fakeUser)
  })

  it('сбрасывает user при SIGNED_OUT', async () => {
    const fakeUser = { id: 'user-1', email: 'test@test.com' }
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { user: fakeUser } },
    })

    let authCallback: (event: string, session: unknown) => void = () => {}
    mockSupabase.auth.onAuthStateChange.mockImplementation((cb: typeof authCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      authCallback('SIGNED_OUT', null)
    })

    expect(result.current.user).toBeNull()
  })

  it('вызывает unsubscribe при размонтировании', async () => {
    const unsubscribeMock = vi.fn()
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: unsubscribeMock } },
    })

    const { unmount } = renderHook(() => useAuth())
    await waitFor(() => {})

    unmount()
    expect(unsubscribeMock).toHaveBeenCalled()
  })
})
