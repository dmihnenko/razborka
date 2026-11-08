import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  assertNotConverted: vi.fn(),
  link: vi.fn(),
  createOrder: vi.fn(),
  createItem: vi.fn(),
  updateTotal: vi.fn(),
  deleteOrder: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/services/marketplaceService', () => {
  class MarketOrderAlreadyConvertedError extends Error {
    orderId: string
    constructor(id: string) { super('converted'); this.orderId = id }
  }
  return {
    MarketOrderAlreadyConvertedError,
    assertMarketOrderNotConverted: m.assertNotConverted,
    linkMarketplaceOrderToPartsOrder: m.link,
  }
})
vi.mock('@/services/partsService', () => ({
  createPartsCustomer: vi.fn(),
  createPartsOrder: m.createOrder,
  createPartsOrderItem: m.createItem,
  deletePartsOrder: m.deleteOrder,
  updatePartsInventoryItem: vi.fn(),
  updatePartsOrderTotal: m.updateTotal,
}))

import { createPartsSale } from './partsSaleService'
import { MarketOrderAlreadyConvertedError } from '@/services/marketplaceService'
import type { SalePlan } from '@/components/parts/sale/saleLogic'

const plan = (over: Partial<SalePlan> = {}): SalePlan => ({
  customer: { kind: 'none' },
  items: [{ inventory_item_id: 'i1', quantity: 1, price_at_sale: 10, price_at_sale_currency: 'UAH' }],
  complete: false,
  rate: 40,
  finalize: [],
  marketOrderId: 'mk1',
  ...over,
})

describe('createPartsSale: заявка с маркета', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.createOrder.mockResolvedValue({ id: 'o1' })
  })

  it('уже конвертированная заявка не создаёт второй заказ', async () => {
    m.assertNotConverted.mockRejectedValue(new MarketOrderAlreadyConvertedError('o0'))
    await expect(createPartsSale('c1', plan())).rejects.toBeInstanceOf(MarketOrderAlreadyConvertedError)
    expect(m.createOrder).not.toHaveBeenCalled()
  })

  it('привязка заявки идёт до завершения заказа', async () => {
    m.assertNotConverted.mockResolvedValue(undefined)
    m.link.mockResolvedValue(undefined)
    const r = await createPartsSale('c1', plan())
    expect(m.link).toHaveBeenCalledWith('mk1', 'o1')
    expect(r).toMatchObject({ orderId: 'o1' })
  })

  it('привязка вернула 0 строк — откат заказа и ошибка', async () => {
    m.assertNotConverted.mockResolvedValue(undefined)
    m.link.mockRejectedValue(new MarketOrderAlreadyConvertedError('mk1'))
    await expect(createPartsSale('c1', plan())).rejects.toBeInstanceOf(MarketOrderAlreadyConvertedError)
    expect(m.deleteOrder).toHaveBeenCalledWith('o1')
  })

  it('без marketOrderId проверок и связывания нет', async () => {
    const r = await createPartsSale('c1', plan({ marketOrderId: undefined }))
    expect(m.assertNotConverted).not.toHaveBeenCalled()
    expect(r.orderId).toBe('o1')
  })
})
