import { describe, it, expect } from 'vitest'
import {
  buildSalePlan,
  calcTotals,
  clampQty,
  customerFromMarketBuyer,
  defaultSaleMode,
  marketItemsToSaleLines,
  marketOrderNotes,
  filterCustomers,
  isFullySold,
  lineFromInventory,
  parsePrice,
  normalizePhone,
  phoneDigitsMatch,
  samePhone,
  validateSale,
  type SaleLine,
} from './saleLogic'

const line = (over: Partial<SaleLine> = {}): SaleLine => ({
  itemId: 'a', name: 'Фара', maxQty: 1, quantity: 1, price: '100', currency: 'UAH', ...over,
})
const none = { kind: 'none' as const }

describe('parsePrice / clampQty', () => {
  it('разбирает цену', () => {
    expect(parsePrice('12,5')).toBe(12.5)
    expect(parsePrice('0')).toBe(0)
    expect(parsePrice('')).toBeNull()
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('-1')).toBeNull()
  })
  it('ограничивает количество', () => {
    expect(clampQty(0, 5)).toBe(1)
    expect(clampQty(9, 5)).toBe(5)
    expect(clampQty(NaN, 5)).toBe(1)
    expect(clampQty(3, 5)).toBe(3)
  })
})

describe('calcTotals', () => {
  it('считает UAH + USD по курсу', () => {
    const t = calcTotals([line({ price: '100', quantity: 2, maxQty: 2 }), line({ itemId: 'b', currency: 'USD', price: '10' })], 40)
    expect(t).toMatchObject({ uah: 200, usd: 10, totalUah: 600, hasUsd: true })
  })
  it('без курса USD-итог в грн неизвестен', () => {
    expect(calcTotals([line({ currency: 'USD' })], null).totalUah).toBeNull()
    expect(calcTotals([line()], null).totalUah).toBe(100)
  })
})

describe('validateSale', () => {
  const ok = { mode: 'sell' as const, rate: 40, customer: none }
  it('пустой список', () => expect(validateSale([], ok)?.code).toBe('noItems'))
  it('количество больше остатка', () => {
    const i = validateSale([line({ maxQty: 2, quantity: 3 })], ok)
    expect(i).toMatchObject({ code: 'overStock', available: 2 })
  })
  it('количество < 1 или дробное', () => {
    expect(validateSale([line({ quantity: 0 })], ok)?.code).toBe('badQty')
    expect(validateSale([line({ quantity: 1.5, maxQty: 3 })], ok)?.code).toBe('badQty')
  })
  it('цена: пустая — ошибка; 0 допустим в продаже, но не в резерве', () => {
    expect(validateSale([line({ price: '' })], ok)?.code).toBe('badPrice')
    expect(validateSale([line({ price: '0' })], ok)).toBeNull()
    expect(validateSale([line({ price: '0' })], { ...ok, mode: 'reserve' })?.code).toBe('badPrice')
  })
  it('USD без курса', () => {
    expect(validateSale([line({ currency: 'USD' })], { ...ok, rate: null })?.code).toBe('rateMissing')
    expect(validateSale([line()], { ...ok, rate: null })).toBeNull()
  })
  it('новый клиент без имени', () => {
    expect(validateSale([line()], { ...ok, customer: { kind: 'new', name: '  ', phone: '1' } })?.code).toBe('customerName')
  })
})

describe('buildSalePlan', () => {
  it('sell: завершает заказ и помечает только полностью проданные позиции', () => {
    const plan = buildSalePlan(
      [line({ itemId: 'full', maxQty: 2, quantity: 2 }), line({ itemId: 'part', maxQty: 5, quantity: 1, currency: 'USD', price: '7' })],
      { mode: 'sell', rate: 41, customer: { kind: 'existing', id: 'c1' }, notes: '  привет ' },
    )
    expect(plan.complete).toBe(true)
    expect(plan.rate).toBe(41)
    expect(plan.notes).toBe('привет')
    expect(plan.items).toEqual([
      { inventory_item_id: 'full', quantity: 2, price_at_sale: 100, price_at_sale_currency: 'UAH' },
      { inventory_item_id: 'part', quantity: 1, price_at_sale: 7, price_at_sale_currency: 'USD' },
    ])
    expect(plan.finalize).toEqual([{ itemId: 'full', sold_price: 100, price_currency: 'UAH' }])
  })
  it('reserve: заказ остаётся новым, меток «продано» нет', () => {
    const plan = buildSalePlan([line()], { mode: 'reserve', rate: null, customer: none })
    expect(plan.complete).toBe(false)
    expect(plan.finalize).toEqual([])
    expect(plan.notes).toBeUndefined()
    expect(plan.rate).toBeNull()
  })
})

describe('сценарии и склад', () => {
  it('режим по умолчанию', () => {
    expect(defaultSaleMode('manual')).toBe('sell')
    expect(defaultSaleMode('stock')).toBe('sell')
    expect(defaultSaleMode('stock-bulk')).toBe('sell')
  })
  it('isFullySold', () => {
    expect(isFullySold({ maxQty: 3, quantity: 3 })).toBe(true)
    expect(isFullySold({ maxQty: 3, quantity: 2 })).toBe(false)
  })
  it('lineFromInventory берёт объявленную цену и валюту', () => {
    expect(lineFromInventory({ id: 'x', name: 'N', quantity: 4, selling_price: 55, price_currency: 'UAH' }))
      .toMatchObject({ itemId: 'x', maxQty: 4, quantity: 1, price: '55', currency: 'UAH' })
    expect(lineFromInventory({ id: 'x', name: 'N', quantity: 1 })).toMatchObject({ price: '', currency: 'USD' })
  })
})

describe('поиск клиента', () => {
  const list = [
    { full_name: 'Иван Петров', phone: '0953552553' },
    { full_name: 'Олег', phone: null },
  ]
  it('телефон — подпоследовательность цифр', () => {
    expect(phoneDigitsMatch('0953552553', '355253')).toBe(true)
    expect(phoneDigitsMatch('0953552553', '999')).toBe(false)
  })
  it('фильтр по имени и телефону', () => {
    expect(filterCustomers(list, 'петр')).toHaveLength(1)
    expect(filterCustomers(list, '355253')).toHaveLength(1)
    expect(filterCustomers(list, '')).toHaveLength(2)
  })
})

describe('samePhone / normalizePhone', () => {
  it('нормализует до цифр', () => {
    expect(normalizePhone('+38 (095) 355-25-53')).toBe('380953552553')
    expect(normalizePhone(null)).toBe('')
  })
  it('сравнивает по последним 9 цифрам', () => {
    expect(samePhone('+380953552553', '095 355 25 53')).toBe(true)
    expect(samePhone('0953552553', '0953552554')).toBe(false)
    expect(samePhone('12345', '12345')).toBe(false)
    expect(samePhone(null, '0953552553')).toBe(false)
  })
})

describe('lineFromInventory: исходная валюта', () => {
  it('сохраняет listCurrency независимо от переключения валюты строки', () => {
    const l = lineFromInventory({ id: 'x', name: 'Фара', quantity: 1, selling_price: 50, price_currency: 'UAH' })
    expect(l.listCurrency).toBe('UAH')
    expect({ ...l, currency: 'USD' as const }.listCurrency).toBe('UAH')
    expect(lineFromInventory({ id: 'y', name: 'Б', quantity: 1 }).listCurrency).toBe('USD')
  })
})

describe('заявка с маркета', () => {
  const item = (over = {}) => ({ name: 'Фара', sellingPrice: 50, priceCurrency: 'USD' as const, quantity: 2, inventoryId: 'inv1', ...over })
  it('режим по умолчанию — заказ в работе', () => expect(defaultSaleMode('market')).toBe('reserve'))
  it('маппит позицию: количество и цена из заявки', () => {
    const { lines, skipped } = marketItemsToSaleLines([item()], { inv1: { quantity: 5, reserved_quantity: 1, status: 'reserved' } })
    expect(skipped).toEqual([])
    expect(lines[0]).toMatchObject({ itemId: 'inv1', quantity: 2, maxQty: 4, price: '50', currency: 'USD' })
  })
  it('пропускает позиции без наличия и без привязки', () => {
    const { lines, skipped } = marketItemsToSaleLines(
      [item({ inventoryId: 'gone' }), item({ inventoryId: null, name: 'Х' }), item({ inventoryId: 's', name: 'Продан' })],
      { s: { quantity: 1, status: 'sold' } },
    )
    expect(lines).toEqual([])
    expect(skipped.map(k => k.reason)).toEqual(['unavailable', 'noInventory', 'unavailable'])
  })
  it('клиент: существующий по телефону, иначе новый', () => {
    const customers = [{ id: 'c1', phone: '+38 (095) 355-25-53' }]
    expect(customerFromMarketBuyer({ name: 'Ив', phone: '0953552553' }, customers, 'П')).toEqual({ kind: 'existing', id: 'c1' })
    expect(customerFromMarketBuyer({ name: ' Ив ', phone: '0501112233' }, customers, 'П')).toEqual({ kind: 'new', name: 'Ив', phone: '0501112233' })
    expect(customerFromMarketBuyer({ name: '', phone: '0501112233' }, [], 'П')).toMatchObject({ name: 'П' })
  })
  it('комментарий и marketOrderId в плане', () => {
    expect(marketOrderNotes('Заявка с маркета')).toBe('Заявка с маркета')
    expect(marketOrderNotes('Заявка с маркета', ' срочно ')).toBe('Заявка с маркета: срочно')
    const plan = buildSalePlan([line()], { mode: 'reserve', rate: 40, customer: none, marketOrderId: 'm1' })
    expect(plan.marketOrderId).toBe('m1')
  })
})
