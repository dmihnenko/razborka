// Импорт/экспорт авто и их запчастей в XLSX (exceljs, lazy-load).
// ЕДИНЫЙ ФОРМАТ «лист = авто» (экспорт и импорт читают одно и то же):
//   • Строки 1–9 — характеристики авто (A: параметр, B: значение; на 8–9 строках C/D — курс/дата).
//   • Строка 10 — шапка таблицы запчастей.
//   • Строки 11+ — запчасти авто (сортировка: в наличии → бронь → продано).
//   • Справа — предупреждение «строки 1–10 не изменять».
import type { PartsVehicle, PartsInventoryItem, PartsVehicleStatus, VehicleRoi } from '@/types/parts'

async function getExcel() {
  return (await import('exceljs')).default
}

const BRAND = 'FF3538CD'
const BORDER = 'FFE5E8F0'
const ZEBRA = 'FFF7F8FB'
const WARN_BG = 'FFFFF7E6'
const WARN_FG = 'FFB45309'

const V_STATUS_OUT: Record<PartsVehicleStatus, string> = {
  awaiting: 'Ожидает', in_progress: 'В разборе', dismantled: 'Разобран',
}
const COND_OUT: Record<string, string> = { new: 'Новая', used: 'Б/У', damaged: 'Повреждённая' }
const INV_STATUS_OUT: Record<string, string> = {
  available: 'В наличии', reserved: 'Резерв', sold: 'Продано', damaged: 'Брак',
}
// в наличии → бронь → продано → брак (проданные в конце)
const STATUS_RANK: Record<string, number> = { available: 0, reserved: 1, sold: 2, damaged: 3 }

export function vStatusIn(s: string): PartsVehicleStatus {
  const t = (s || '').toLowerCase().trim()
  if (['awaiting', 'ожидает', 'очікує', 'ждет'].includes(t)) return 'awaiting'
  if (t.startsWith('разобран') || t.startsWith('розібран') || t === 'dismantled') return 'dismantled'
  return 'in_progress'
}
export function condIn(s: string): string {
  const t = (s || '').toLowerCase().trim()
  if (['new', 'новая', 'нова', 'новый'].includes(t)) return 'new'
  if (['damaged', 'повреждённая', 'пошкоджена', 'брак'].includes(t)) return 'damaged'
  return 'used'
}
export function invStatusIn(s: string): string {
  const t = (s || '').toLowerCase().trim()
  if (['reserved', 'резерв', 'бронь', 'бронювання'].includes(t)) return 'reserved'
  if (t.startsWith('прода') || t === 'sold') return 'sold'
  if (['damaged', 'брак', 'повреж'].some((k) => t.includes(k))) return 'damaged'
  return 'available'
}

const WARNING = '⚠️ Не изменяйте строки 1–10 (данные авто и шапка). Редактируйте только список запчастей с 11-й строки.'

// Ширины колонок запчастей (1–9) + запас под предупреждение (10–11).
// Подобраны под реальный контент: широкие «Название» и «Место хранения», читаемый OEM.
const SHEET_COLS = [36, 22, 18, 14, 9, 13, 10, 14, 26, 12, 12]
// Числовые колонки таблицы запчастей — выравниваются по правому краю (только тело, НЕ шапка).
const NUM_COLS = [5, 6]

function downloadBlob(buf: ArrayBuffer, name: string) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

 
function applyWidths(ws: any) {
  SHEET_COLS.forEach((w, i) => { ws.getColumn(i + 1).width = w })
}

function writeVehicleBlock(ws: any, v: PartsVehicle, roi?: VehicleRoi) {
  const rows: Array<[string, any, string?, any?]> = [
    ['Марка', v.make],
    ['Модель', v.model],
    ['Год', v.year ?? ''],
    ['VIN', v.vin ?? ''],
    ['Госномер', v.license_plate ?? ''],
    ['Цвет', v.color ?? ''],
    ['Пробег', v.mileage ?? ''],
    ['Цена покупки', v.purchase_price ?? '', 'Курс', v.exchange_rate ?? ''],
    ['Статус', V_STATUS_OUT[v.status] + (roi?.payback_pct != null ? ` · окуп. ${roi.payback_pct}%` : ''),
      'Дата покупки', v.purchase_date ? new Date(v.purchase_date) : ''],
  ]
  rows.forEach(([label, val, label2, val2], i) => {
    const row = ws.getRow(i + 1)
    row.getCell(1).value = label
    row.getCell(1).font = { bold: true, color: { argb: 'FF5B6472' } }
    row.getCell(2).value = val
    row.getCell(2).font = { bold: true, color: { argb: 'FF16181D' } }
    if (label2) {
      row.getCell(3).value = label2
      row.getCell(3).font = { bold: true, color: { argb: 'FF5B6472' } }
      row.getCell(4).value = val2
      row.getCell(4).font = { bold: true, color: { argb: 'FF16181D' } }
    }
  })
  ws.getCell('B8').numFmt = '# ##0'
  ws.getCell('D9').numFmt = 'dd.mm.yyyy'

  // Предупреждение справа
  ws.mergeCells('F1:K4')
  const wc = ws.getCell('F1')
  wc.value = WARNING
  wc.alignment = { wrapText: true, vertical: 'middle', horizontal: 'left' }
  wc.font = { bold: true, color: { argb: WARN_FG }, size: 11 }
  wc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_BG } }
  wc.border = { top: { style: 'thin', color: { argb: WARN_FG } }, bottom: { style: 'thin', color: { argb: WARN_FG } }, left: { style: 'thin', color: { argb: WARN_FG } }, right: { style: 'thin', color: { argb: WARN_FG } } }
}

const PARTS_HEADERS = ['Название', 'OEM-номер', 'Категория', 'Состояние', 'Кол-во', 'Цена', 'Валюта', 'Статус', 'Место хранения']

function writePartsHeader(ws: any) {
  const hr = ws.getRow(10)
  hr.height = 30
  // Все 9 ячеек шапки — единое оформление и выравнивание (по центру, перенос).
  for (let i = 1; i <= PARTS_HEADERS.length; i++) {
    const c = hr.getCell(i)
    c.value = PARTS_HEADERS[i - 1]
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } }
  }
  ws.views = [{ state: 'frozen', ySplit: 10 }]
}

function stylePartsBody(ws: any) {
  ws.getColumn(6).numFmt = '# ##0.##'
  for (let i = 11; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    for (let cn = 1; cn <= PARTS_HEADERS.length; cn++) {
      const c = row.getCell(cn)
      c.border = { bottom: { style: 'hair', color: { argb: BORDER } }, right: { style: 'hair', color: { argb: BORDER } } }
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      // Числовые — вправо; остальные — влево; всё по вертикали по центру, с переносом длинного текста.
      c.alignment = { horizontal: NUM_COLS.includes(cn) ? 'right' : 'left', vertical: 'middle', wrapText: cn === 1 || cn === 9 }
    }
  }
}

function sheetNamer() {
  const used = new Set<string>()
  return (v: PartsVehicle) => {
    const base = `${v.make} ${v.model}${v.year ? ' ' + v.year : ''}`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Авто'
    let n = base, i = 2
    while (used.has(n)) { n = `${base.slice(0, 25)} ${i++}` }
    used.add(n)
    return n
  }
}

// ── Лист «Сводка» — все авто + итоги ───────────────────────────────────────
const SUMMARY_HEADERS = ['Авто', 'Год', 'Статус', 'Цена покупки', 'Курс', 'Запчастей', 'В наличии', 'Резерв', 'Продано', 'Окуп. %']
const SUMMARY_COLS = [28, 8, 14, 14, 9, 11, 11, 9, 10, 10]

function writeSummarySheet(ws: any, vehicles: PartsVehicle[], partsByVeh: Map<string, PartsInventoryItem[]>, roi: Map<string, VehicleRoi>) {
  SUMMARY_COLS.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const title = ws.getRow(1)
  title.getCell(1).value = 'Сводка по автомобилям'
  title.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF16181D' } }
  title.height = 24

  const hr = ws.getRow(2)
  SUMMARY_HEADERS.forEach((h, i) => { hr.getCell(i + 1).value = h })
  hr.height = 22
  hr.eachCell((c: any) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })

  let tPrice = 0, tParts = 0, tAvail = 0, tReserved = 0, tSold = 0
  vehicles.forEach((v, idx) => {
    const list = partsByVeh.get(v.id) || []
    const avail = list.filter((p) => p.status === 'available').length
    const reserved = list.filter((p) => p.status === 'reserved').length
    const soldN = list.filter((p) => p.status === 'sold').length
    tPrice += v.purchase_price ?? 0; tParts += list.length
    tAvail += avail; tReserved += reserved; tSold += soldN
    const row = ws.getRow(3 + idx)
    const r = roi.get(v.id)
    row.getCell(1).value = `${v.make} ${v.model}`.trim()
    row.getCell(2).value = v.year ?? ''
    row.getCell(3).value = V_STATUS_OUT[v.status]
    row.getCell(4).value = v.purchase_price ?? ''
    row.getCell(5).value = v.exchange_rate ?? ''
    row.getCell(6).value = list.length
    row.getCell(7).value = avail
    row.getCell(8).value = reserved
    row.getCell(9).value = soldN
    row.getCell(10).value = r?.payback_pct != null ? r.payback_pct : ''
    row.eachCell((c: any) => {
      c.border = { bottom: { style: 'hair', color: { argb: BORDER } } }
      if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
    })
  })

  // Итоговая строка
  const totalRow = ws.getRow(3 + vehicles.length)
  totalRow.getCell(1).value = `ИТОГО: ${vehicles.length} авто`
  totalRow.getCell(4).value = tPrice
  totalRow.getCell(6).value = tParts
  totalRow.getCell(7).value = tAvail
  totalRow.getCell(8).value = tReserved
  totalRow.getCell(9).value = tSold
  totalRow.eachCell((c: any) => {
    c.font = { bold: true, color: { argb: 'FF16181D' } }
    c.border = { top: { style: 'thin', color: { argb: 'FF5B6472' } } }
  })

  ws.getColumn(4).numFmt = '# ##0'
  ws.views = [{ state: 'frozen', ySplit: 2 }]
}

export interface ExportOpts {
  vehicles: PartsVehicle[]
  parts: PartsInventoryItem[]
  roi: Map<string, VehicleRoi>
  summary?: boolean
  fileName?: string
}

export async function exportVehiclesXlsx({ vehicles, parts, roi, summary, fileName }: ExportOpts) {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  wb.creator = 'Razborka.net'

  const partsByVeh = new Map<string, PartsInventoryItem[]>()
  parts.filter((p) => p.vehicle_id).forEach((p) => {
    const a = partsByVeh.get(p.vehicle_id!) || []
    a.push(p); partsByVeh.set(p.vehicle_id!, a)
  })

  // Лист «Сводка» первым — когда авто больше одного (или явно запрошено)
  if (summary || vehicles.length > 1) {
    writeSummarySheet(wb.addWorksheet('Сводка'), vehicles, partsByVeh, roi)
  }

  const nameOf = sheetNamer()
  let totalParts = 0

  vehicles.forEach((v) => {
    const ws = wb.addWorksheet(nameOf(v))
    applyWidths(ws)
    writeVehicleBlock(ws, v, roi.get(v.id))
    writePartsHeader(ws)

    const list = (partsByVeh.get(v.id) || []).slice()
      .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9))
    list.forEach((p, idx) => {
      const row = ws.getRow(11 + idx)
      row.getCell(1).value = p.name
      row.getCell(2).value = p.part_number ?? ''
      row.getCell(3).value = p.category?.name ?? ''
      row.getCell(4).value = COND_OUT[p.condition] || p.condition
      row.getCell(5).value = p.quantity ?? 1
      row.getCell(6).value = p.selling_price ?? ''
      row.getCell(7).value = p.price_currency ?? 'USD'
      row.getCell(8).value = INV_STATUS_OUT[p.status] || p.status
      row.getCell(9).value = p.storage_location?.name || p.location || ''
      totalParts++
    })
    stylePartsBody(ws)
  })

  const date = new Date().toISOString().slice(0, 10)
  downloadBlob(await wb.xlsx.writeBuffer(), fileName || `avto_i_zapchasti_${date}.xlsx`)
  return { vehicles: vehicles.length, parts: totalParts }
}

/** Экспорт одного авто (со страницы детали): один лист, без сводки. */
export async function exportSingleVehicleXlsx(vehicle: PartsVehicle, parts: PartsInventoryItem[], roi?: VehicleRoi) {
  const safe = `${vehicle.make}_${vehicle.model}${vehicle.year ? '_' + vehicle.year : ''}`.replace(/[^\wа-яА-ЯёЁ-]+/gi, '_')
  return exportVehiclesXlsx({
    vehicles: [vehicle],
    parts: parts.map((p) => ({ ...p, vehicle_id: vehicle.id })),
    roi: roi ? new Map([[vehicle.id, roi]]) : new Map(),
    summary: false,
    fileName: `${safe}.xlsx`,
  })
}

export async function downloadVehiclesTemplate() {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  const ws = wb.addWorksheet('Tesla Model 3 2021')
  applyWidths(ws)
  writeVehicleBlock(ws, {
    id: '', parts_company_id: '', make: 'Tesla', model: 'Model 3', year: 2021,
    vin: '5YJ3E1EA2MF000001', license_plate: 'AA1234BB', color: 'Чёрный', mileage: 80000,
    purchase_price: 466000, exchange_rate: 43, purchase_date: new Date().toISOString(),
    status: 'in_progress', created_at: '', updated_at: '',
  } as PartsVehicle)
  writePartsHeader(ws)
  const ex = ws.getRow(11)
  ;['Фара передняя правая', '1077411-00-G', 'Оптика', 'Б/У', 1, 120, 'USD', 'В наличии', 'Стеллаж 1 / Полка 2']
    .forEach((val, i) => { ex.getCell(i + 1).value = val as any })
  stylePartsBody(ws)
  downloadBlob(await wb.xlsx.writeBuffer(), 'shablon_avto_zapchasti.xlsx')
}

export interface ParsedPart {
  name: string; part_number?: string; category?: string; condition: string
  quantity: number; selling_price?: number; price_currency: 'UAH' | 'USD'
  location?: string; status: string; _error?: string
}
export interface ParsedVehicle {
  make: string; model: string; year?: number; vin?: string; license_plate?: string
  color?: string; mileage?: number; purchase_price?: number; exchange_rate?: number
  purchase_date?: string; status: PartsVehicleStatus
  parts: ParsedPart[]; sheet: string; _error?: string
}

function cellStr(row: any, idx: number): string {
  const v = row.getCell(idx).value
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('text' in v) return String((v as any).text).trim()
    if ('result' in v) return String((v as any).result).trim()
    if (v instanceof Date) return v.toISOString()
  }
  return String(v).trim()
}
function num(s: string): number | undefined {
  const n = parseFloat((s || '').replace(/[^\d.,-]/g, '').replace(',', '.'))
  return isNaN(n) ? undefined : n
}

export async function parseVehiclesFile(file: File): Promise<{ vehicles: ParsedVehicle[] }> {
  const Excel = await getExcel()
  const wb = new Excel.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())

  const vehicles: ParsedVehicle[] = []

  wb.eachSheet((ws: any) => {
    // Карта характеристик: A→B и C→D на строках 1–9
    const m: Record<string, string> = {}
    for (let i = 1; i <= 9; i++) {
      const row = ws.getRow(i)
      const a = cellStr(row, 1).toLowerCase()
      if (a) m[a] = cellStr(row, 2)
      const c = cellStr(row, 3).toLowerCase()
      if (c) m[c] = cellStr(row, 4)
    }
    const pick = (...keys: string[]) => {
      for (const k of keys) { const hit = Object.keys(m).find((h) => h.includes(k)); if (hit) return m[hit] }
      return ''
    }
    const make = pick('марка', 'make')
    const model = pick('модель', 'model')
    if (!make && !model) return // не лист авто

    // Шапка запчастей: ищем строку с «название» (обычно 10), читаем колонки
    let headerRow = 10
    for (let i = 8; i <= 14; i++) {
      if (cellStr(ws.getRow(i), 1).toLowerCase().includes('назв')) { headerRow = i; break }
    }
    const hr = ws.getRow(headerRow)
    const col: Record<string, number> = {}
    for (let c = 1; c <= 12; c++) {
      const h = cellStr(hr, c).toLowerCase()
      if (h) col[h] = c
    }
    const cidx = (...keys: string[]) => {
      for (const k of keys) { const hit = Object.keys(col).find((h) => h.includes(k)); if (hit) return col[hit] }
      return 0
    }
    const ci = {
      name: cidx('назв', 'name'), oem: cidx('oem', 'номер'), category: cidx('категор'),
      condition: cidx('состоян', 'стан'), qty: cidx('кол', 'кільк'), price: cidx('цена', 'ціна'),
      currency: cidx('валют'), status: cidx('статус'), location: cidx('место', 'місце'),
    }

    const parts: ParsedPart[] = []
    for (let i = headerRow + 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i)
      const name = ci.name ? cellStr(row, ci.name) : cellStr(row, 1)
      if (!name) continue
      const cur = (ci.currency ? cellStr(row, ci.currency) : '').toUpperCase()
      parts.push({
        name,
        part_number: ci.oem ? cellStr(row, ci.oem) || undefined : undefined,
        category: ci.category ? cellStr(row, ci.category) || undefined : undefined,
        condition: condIn(ci.condition ? cellStr(row, ci.condition) : ''),
        quantity: (ci.qty ? num(cellStr(row, ci.qty)) : undefined) ?? 1,
        selling_price: ci.price ? num(cellStr(row, ci.price)) : undefined,
        price_currency: cur === 'UAH' || cur === 'ГРН' ? 'UAH' : 'USD',
        status: invStatusIn(ci.status ? cellStr(row, ci.status) : ''),
        location: ci.location ? cellStr(row, ci.location) || undefined : undefined,
      })
    }

    vehicles.push({
      make, model,
      year: num(pick('год', 'рік', 'year')),
      vin: pick('vin') || undefined,
      license_plate: pick('госномер', 'номер авто', 'plate') || undefined,
      color: pick('цвет', 'колір') || undefined,
      mileage: num(pick('пробег', 'пробіг')),
      purchase_price: num(pick('цена', 'ціна')),
      exchange_rate: num(pick('курс', 'rate')),
      purchase_date: (() => { const d = pick('дата'); if (!d) return undefined; const dd = new Date(d); return isNaN(dd.getTime()) ? undefined : dd.toISOString().slice(0, 10) })(),
      status: vStatusIn(pick('статус', 'status')),
      parts,
      sheet: ws.name,
      _error: !make || !model ? 'Не заполнены марка/модель' : undefined,
    })
  })

  return { vehicles }
}
