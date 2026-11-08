import { describe, it, expect } from 'vitest'
import { newBulkRow, buildBulkInputs, bulkHasPending } from './partsInventoryShared'

const shared = { category_id: '', vehicle_id: 'v1', condition: 'used', storage_location_id: '', price_currency: 'UAH' }
const photo = { url: 'u', medium_url: 'm', thumb_url: 't', delete_url: 'd' } as never

describe('buildBulkInputs', () => {
  it('отбрасывает пустые названия и несёт фото строки', () => {
    const a = newBulkRow({ name: ' Фара ', selling_price: '100', part_number: 'ab1' })
    a.photos = [photo]
    const b = newBulkRow({ name: '  ' })
    const res = buildBulkInputs([a, b], shared)
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ name: 'Фара', selling_price: 100, part_number: 'AB1', vehicle_id: 'v1', quantity: 1, photos: [photo] })
    expect(res[0].category_id).toBeUndefined()
  })
  it('bulkHasPending видит незавершённые загрузки', () => {
    const r = newBulkRow({ name: 'x' })
    expect(bulkHasPending([r])).toBe(false)
    r.pending = [{ id: '1', localUrl: 'blob:x' }]
    expect(bulkHasPending([r])).toBe(true)
  })
  it('id строк уникальны', () => {
    expect(newBulkRow().id).not.toBe(newBulkRow().id)
  })
})
