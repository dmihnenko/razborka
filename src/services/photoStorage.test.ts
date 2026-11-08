import { describe, it, expect, vi, beforeEach } from 'vitest'
import '../test/mocks/supabase'
import { mockSupabase } from '../test/mocks/supabase'
import { deletePhotosIfUnused } from '@/services/photoStorage'

const photo = (n: string) => ({
  url: `https://razborka.net/photos/c/1/${n}/full.jpg`,
  medium_url: `https://razborka.net/photos/c/1/${n}/medium.jpg`,
  thumb_url: `https://razborka.net/photos/c/1/${n}/thumb.jpg`,
  delete_url: '',
})

describe('deletePhotosIfUnused', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    mockSupabase.rpc = vi.fn()
    mockSupabase.auth.getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } })
  })

  it('не удаляет фото, если используется хотя бы один его URL', async () => {
    const used = photo('a')
    mockSupabase.rpc.mockResolvedValue({ data: [used.thumb_url], error: null })
    await deletePhotosIfUnused([used])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('удаляет только неиспользуемые', async () => {
    const a = photo('a'), b = photo('b')
    mockSupabase.rpc.mockResolvedValue({ data: [a.url], error: null })
    await deletePhotosIfUnused([a, b])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body).urls as string[]
    expect(sent).toEqual([b.url, b.medium_url, b.thumb_url])
  })

  it('при сбое RPC ничего не удаляет', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await deletePhotosIfUnused([photo('a')])
    expect(fetchMock).not.toHaveBeenCalled()
    mockSupabase.rpc.mockRejectedValue(new Error('network'))
    await deletePhotosIfUnused([photo('a')])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
