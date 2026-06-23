// Импорт/экспорт авто и их запчастей в XLSX с оформлением (exceljs, lazy-load).
// Экспорт: 2 листа (Автомобили, Запчасти), жирная закреплённая шапка, ширины,
// форматы чисел/дат/процентов, бордеры, заливка статуса.
import type { PartsVehicle, PartsInventoryItem, PartsVehicleStatus, VehicleRoi } from '@/types/parts'

// exceljs тяжёлый — грузим только при экспорте/импорте (отдельный чанк)
async function getExcel() {
  return (await import('exceljs')).default
}

const BRAND = 'FF3538CD'        // индиго шапки
const BORDER = 'FFE5E8F0'
const ZEBRA = 'FFF7F8FB'

const V_STATUS_OUT: Record<PartsVehicleStatus, string> = {
  awaiting: 'Ожидает', in_progress: 'В разборе', dismantled: 'Разобран',
}
const V_STATUS_FILL: Record<PartsVehicleStatus, string> = {
  awaiting: 'FFFFF7E6', in_progress: 'FFEEF0FE', dismantled: 'FFE9FBF1',
}
const COND_OUT: Record<string, string> = { new: 'Новая', used: 'Б/У', damaged: 'Повреждённая' }
const INV_STATUS_OUT: Record<string, string> = {
  available: 'В наличии', reserved: 'Резерв', sold: 'Продано', damaged: 'Брак',
}

export function vStatusIn(s: string): PartsVehicleStatus {
  const t = (s || '').toLowerCase().trim()
  if (['awaiting', 'ожидает', 'очікує', 'ждет'].includes(t)) return 'awaiting'
  if (['dismantled', 'разобран', 'розібран', 'розібраний'].includes(t)) return 'dismantled'
  return 'in_progress'
}
export function condIn(s: string): string {
  const t = (s || '').toLowerCase().trim()
  if (['new', 'новая', 'нова', 'новый'].includes(t)) return 'new'
  if (['damaged', 'повреждённая', 'пошкоджена', 'брак'].includes(t)) return 'damaged'
  return 'used'
}

function downloadBlob(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

 
function styleHeader(row: any) {
  row.height = 22
   
  row.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = { bottom: { style: 'thin', color: { argb: BRAND } } }
  })
}
 
function styleBody(ws: any, fromRow: number, fillForRow?: (i: number) => string | null) {
  for (let i = fromRow; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const custom = fillForRow?.(i)
     
    row.eachCell((c: any) => {
      c.border = {
        bottom: { style: 'hair', color: { argb: BORDER } },
        right: { style: 'hair', color: { argb: BORDER } },
      }
      const fill = custom || ((i % 2 === 0) ? ZEBRA : null)
      if (fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      if (!c.alignment) c.alignment = { vertical: 'middle' }
    })
  }
}

export interface ExportOpts {
  vehicles: PartsVehicle[]
  parts: PartsInventoryItem[]
  roi: Map<string, VehicleRoi>
}

export async function exportVehiclesXlsx({ vehicles, parts, roi }: ExportOpts) {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  wb.creator = 'Razborka.net'

  // ── Лист «Автомобили» ──
  const ws = wb.addWorksheet('Автомобили', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Марка', key: 'make', width: 16 },
    { header: 'Модель', key: 'model', width: 18 },
    { header: 'Год', key: 'year', width: 8 },
    { header: 'VIN', key: 'vin', width: 20 },
    { header: 'Госномер', key: 'plate', width: 12 },
    { header: 'Цвет', key: 'color', width: 12 },
    { header: 'Пробег', key: 'mileage', width: 11 },
    { header: 'Цена покупки', key: 'price', width: 13 },
    { header: 'Курс', key: 'rate', width: 8 },
    { header: 'Дата покупки', key: 'pdate', width: 13 },
    { header: 'Статус', key: 'status', width: 13 },
    { header: 'Окуп. %', key: 'pct', width: 9 },
    { header: 'Вложено $', key: 'inv', width: 11 },
    { header: 'Возвращено $', key: 'real', width: 13 },
    { header: 'Остаток $', key: 'stock', width: 11 },
  ]
  vehicles.forEach((v) => {
    const r = roi.get(v.id)
    ws.addRow({
      make: v.make, model: v.model, year: v.year ?? null, vin: v.vin ?? null,
      plate: v.license_plate ?? null, color: v.color ?? null, mileage: v.mileage ?? null,
      price: v.purchase_price ?? null, rate: v.exchange_rate ?? null,
      pdate: v.purchase_date ? new Date(v.purchase_date) : null,
      status: V_STATUS_OUT[v.status], pct: r?.payback_pct ?? null,
      inv: r?.investment_usd != null ? Math.round(r.investment_usd) : null,
      real: r ? Math.round(r.realized_usd) : null,
      stock: r ? Math.round(r.stock_usd) : null,
    })
  })
  ws.getColumn('price').numFmt = '# ##0'
  ws.getColumn('mileage').numFmt = '# ##0'
  ws.getColumn('pdate').numFmt = 'dd.mm.yyyy'
  ws.getColumn('pct').numFmt = '0"%"'
  ;['inv', 'real', 'stock'].forEach((k) => (ws.getColumn(k).numFmt = '# ##0'))
  ;['year', 'mileage', 'price', 'rate', 'pct', 'inv', 'real', 'stock'].forEach((k) => {
    ws.getColumn(k).alignment = { horizontal: 'right' }
  })
  styleHeader(ws.getRow(1))
  styleBody(ws, 2, (i) => {
    const v = vehicles[i - 2]
    return v ? V_STATUS_FILL[v.status] : null
  })

  // ── Лист «Запчасти» ──
  const ps = wb.addWorksheet('Запчасти', { views: [{ state: 'frozen', ySplit: 1 }] })
  ps.columns = [
    { header: 'Авто', key: 'vehicle', width: 24 },
    { header: 'VIN авто', key: 'vin', width: 20 },
    { header: 'Название', key: 'name', width: 32 },
    { header: 'OEM-номер', key: 'oem', width: 18 },
    { header: 'Артикул', key: 'article', width: 12 },
    { header: 'Категория', key: 'category', width: 18 },
    { header: 'Состояние', key: 'condition', width: 12 },
    { header: 'Кол-во', key: 'qty', width: 8 },
    { header: 'Цена', key: 'price', width: 10 },
    { header: 'Валюта', key: 'currency', width: 8 },
    { header: 'Статус', key: 'status', width: 12 },
    { header: 'Место хранения', key: 'location', width: 22 },
  ]
  const vehById = new Map(vehicles.map((v) => [v.id, v]))
  parts.filter((p) => p.vehicle_id).forEach((p) => {
    const v = vehById.get(p.vehicle_id!)
    ps.addRow({
      vehicle: v ? `${v.make} ${v.model}${v.year ? ' ' + v.year : ''}` : '',
      vin: v?.vin ?? null,
      name: p.name, oem: p.part_number ?? null, article: p.article ?? null,
      category: p.category?.name ?? null, condition: COND_OUT[p.condition] || p.condition,
      qty: p.quantity, price: p.selling_price ?? null, currency: p.price_currency ?? 'USD',
      status: INV_STATUS_OUT[p.status] || p.status,
      location: p.storage_location?.name || p.location || null,
    })
  })
  ps.getColumn('price').numFmt = '# ##0.##'
  ;['qty', 'price'].forEach((k) => (ps.getColumn(k).alignment = { horizontal: 'right' }))
  styleHeader(ps.getRow(1))
  styleBody(ps, 2)

  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(await wb.xlsx.writeBuffer(), `avto_i_zapchasti_${date}.xlsx`)
  return { vehicles: vehicles.length, parts: parts.filter((p) => p.vehicle_id).length }
}

export async function downloadVehiclesTemplate() {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  const ws = wb.addWorksheet('Автомобили', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = [
    { header: 'Марка*', key: 'make', width: 16 },
    { header: 'Модель*', key: 'model', width: 18 },
    { header: 'Год', key: 'year', width: 8 },
    { header: 'VIN', key: 'vin', width: 20 },
    { header: 'Госномер', key: 'plate', width: 12 },
    { header: 'Цвет', key: 'color', width: 12 },
    { header: 'Пробег', key: 'mileage', width: 11 },
    { header: 'Цена покупки', key: 'price', width: 13 },
    { header: 'Курс', key: 'rate', width: 8 },
    { header: 'Дата покупки', key: 'pdate', width: 13 },
    { header: 'Статус', key: 'status', width: 13 },
  ]
  ws.addRow({ make: 'Tesla', model: 'Model 3', year: 2021, vin: '5YJ3E1EA2MF000001', plate: 'AA1234BB', color: 'Чёрный', mileage: 80000, price: 466000, rate: 43, pdate: new Date(), status: 'В разборе' })
  styleHeader(ws.getRow(1)); styleBody(ws, 2)

  const ps = wb.addWorksheet('Запчасти', { views: [{ state: 'frozen', ySplit: 1 }] })
  ps.columns = [
    { header: 'VIN авто*', key: 'vin', width: 20 },
    { header: 'Название*', key: 'name', width: 32 },
    { header: 'OEM-номер', key: 'oem', width: 18 },
    { header: 'Категория', key: 'category', width: 18 },
    { header: 'Состояние', key: 'condition', width: 12 },
    { header: 'Кол-во', key: 'qty', width: 8 },
    { header: 'Цена', key: 'price', width: 10 },
    { header: 'Валюта', key: 'currency', width: 8 },
    { header: 'Место хранения', key: 'location', width: 22 },
  ]
  ps.addRow({ vin: '5YJ3E1EA2MF000001', name: 'Фара передняя правая', oem: '1077411-00-G', category: 'Оптика', condition: 'Б/У', qty: 1, price: 120, currency: 'USD', location: 'Стеллаж 1 / Полка 2' })
  styleHeader(ps.getRow(1)); styleBody(ps, 2)

  downloadBlob(await wb.xlsx.writeBuffer(), 'shablon_avto_zapchasti.xlsx')
}

export interface ParsedVehicle {
  make: string; model: string; year?: number; vin?: string; license_plate?: string
  color?: string; mileage?: number; purchase_price?: number; exchange_rate?: number
  purchase_date?: string; status: PartsVehicleStatus; _row: number; _error?: string
}
export interface ParsedPart {
  vin?: string; name: string; part_number?: string; category?: string; condition: string
  quantity: number; selling_price?: number; price_currency: 'UAH' | 'USD'; location?: string
  _row: number; _error?: string
}

 
function cell(row: any, idx: number): string {
  const v = row.getCell(idx).value
  if (v == null) return ''
  if (typeof v === 'object' && 'text' in v) return String((v as any).text).trim()
  if (typeof v === 'object' && 'result' in v) return String((v as any).result).trim()
  return String(v).trim()
}
function num(s: string): number | undefined {
  const n = parseFloat((s || '').replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(n) ? undefined : n
}
// Карта заголовок→индекс (по подстроке, регистронезависимо)
 
function headerMap(ws: any): Record<string, number> {
  const map: Record<string, number> = {}
  const hr = ws.getRow(1)
  hr.eachCell((c: any, col: number) => { map[String(c.value ?? '').toLowerCase().trim()] = col })
  return map
}
function find(map: Record<string, number>, ...keys: string[]): number {
  for (const k of keys) {
    const hit = Object.keys(map).find((h) => h.includes(k))
    if (hit) return map[hit]
  }
  return 0
}

export async function parseVehiclesFile(file: File): Promise<{ vehicles: ParsedVehicle[]; parts: ParsedPart[] }> {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())

  const vehicles: ParsedVehicle[] = []
  const vs = wb.getWorksheet('Автомобили') || wb.worksheets[0]
  if (vs) {
    const m = headerMap(vs)
    const ci = {
      make: find(m, 'марка', 'make'), model: find(m, 'модель', 'model'), year: find(m, 'год', 'рік', 'year'),
      vin: find(m, 'vin'), plate: find(m, 'номер', 'plate'), color: find(m, 'цвет', 'колір', 'color'),
      mileage: find(m, 'пробег', 'пробіг', 'mileage'), price: find(m, 'цена', 'ціна', 'price'),
      rate: find(m, 'курс', 'rate'), pdate: find(m, 'дата'), status: find(m, 'статус', 'status'),
    }
    vs.eachRow((row: any, i: number) => {
      if (i === 1) return
      const make = ci.make ? cell(row, ci.make) : ''
      const model = ci.model ? cell(row, ci.model) : ''
      if (!make && !model) return
      const pd = ci.pdate ? row.getCell(ci.pdate).value : null
      vehicles.push({
        make, model,
        year: ci.year ? num(cell(row, ci.year)) : undefined,
        vin: ci.vin ? cell(row, ci.vin) || undefined : undefined,
        license_plate: ci.plate ? cell(row, ci.plate) || undefined : undefined,
        color: ci.color ? cell(row, ci.color) || undefined : undefined,
        mileage: ci.mileage ? num(cell(row, ci.mileage)) : undefined,
        purchase_price: ci.price ? num(cell(row, ci.price)) : undefined,
        exchange_rate: ci.rate ? num(cell(row, ci.rate)) : undefined,
        purchase_date: pd instanceof Date ? pd.toISOString().slice(0, 10) : undefined,
        status: vStatusIn(ci.status ? cell(row, ci.status) : ''),
        _row: i,
        _error: !make || !model ? 'Не заполнены марка/модель' : undefined,
      })
    })
  }

  const parts: ParsedPart[] = []
  const psheet = wb.getWorksheet('Запчасти')
  if (psheet) {
    const m = headerMap(psheet)
    const ci = {
      vin: find(m, 'vin'), name: find(m, 'назв', 'name'), oem: find(m, 'oem', 'номер'),
      category: find(m, 'категор', 'category'), condition: find(m, 'состоян', 'стан', 'condition'),
      qty: find(m, 'кол-во', 'кільк', 'qty', 'количество'), price: find(m, 'цена', 'ціна', 'price'),
      currency: find(m, 'валют', 'currency'), location: find(m, 'место', 'місце', 'location'),
    }
    psheet.eachRow((row: any, i: number) => {
      if (i === 1) return
      const name = ci.name ? cell(row, ci.name) : ''
      if (!name) return
      const cur = (ci.currency ? cell(row, ci.currency) : '').toUpperCase()
      parts.push({
        vin: ci.vin ? cell(row, ci.vin) || undefined : undefined,
        name,
        part_number: ci.oem ? cell(row, ci.oem) || undefined : undefined,
        category: ci.category ? cell(row, ci.category) || undefined : undefined,
        condition: condIn(ci.condition ? cell(row, ci.condition) : ''),
        quantity: (ci.qty ? num(cell(row, ci.qty)) : undefined) ?? 1,
        selling_price: ci.price ? num(cell(row, ci.price)) : undefined,
        price_currency: cur === 'UAH' || cur === 'ГРН' ? 'UAH' : 'USD',
        location: ci.location ? cell(row, ci.location) || undefined : undefined,
        _row: i,
        _error: !name ? 'Нет названия' : undefined,
      })
    })
  }

  return { vehicles, parts }
}
