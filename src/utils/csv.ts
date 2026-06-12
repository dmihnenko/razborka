/**
 * CSV-утилита для экспорта склада запчастей
 * UTF-8 с BOM, разделитель ';' — корректно открывается в Excel с кириллицей
 */

/** Экранирует значение ячейки: оборачивает в кавычки, если содержит ';', '"' или перевод строки */
function escapeCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export interface CsvRow {
  name: string
  part_number?: string | null
  category?: string | null
  vehicle?: string | null
  condition?: string | null
  quantity: number
  selling_price?: number | null
  price_currency?: string | null
  purchase_price?: number | null
  location?: string | null
  status: string
}

const HEADERS = [
  'Название',
  'Артикул',
  'Категория',
  'Авто',
  'Состояние',
  'Кол-во',
  'Цена продажи',
  'Валюта',
  'Закупочная цена',
  'Локация',
  'Статус',
]

const CONDITION_LABELS: Record<string, string> = {
  new: 'Новая',
  used: 'Б/У хорошее',
  damaged: 'Повреждена',
}

const STATUS_LABELS: Record<string, string> = {
  available: 'В наличии',
  reserved: 'Зарезервировано',
  sold: 'Продано',
  damaged: 'Повреждено',
}

export function buildCsv(rows: CsvRow[]): string {
  const lines: string[] = [HEADERS.map(escapeCell).join(';')]
  for (const row of rows) {
    const cells = [
      escapeCell(row.name),
      escapeCell(row.part_number),
      escapeCell(row.category),
      escapeCell(row.vehicle),
      escapeCell(CONDITION_LABELS[row.condition ?? ''] ?? row.condition),
      escapeCell(row.quantity),
      escapeCell(row.selling_price),
      escapeCell(row.price_currency),
      escapeCell(row.purchase_price),
      escapeCell(row.location),
      escapeCell(STATUS_LABELS[row.status] ?? row.status),
    ]
    lines.push(cells.join(';'))
  }
  return lines.join('\r\n')
}

/** Скачивает CSV-строку как файл */
export function downloadCsv(csvContent: string, filename: string): void {
  // UTF-8 BOM + content
  const BOM = '﻿'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } finally {
    // Небольшая задержка: браузер должен успеть начать скачивание
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }
}
