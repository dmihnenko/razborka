/**
 * Адаптивный компонент таблицы для мобильных устройств
 * На desktop показывает обычную таблицу, на mobile - карточки
 */

import { ReactNode } from 'react'

export interface MobileTableColumn<T> {
  key: string
  header: string
  render: (item: T) => ReactNode
  mobileLabel?: string // Лейбл для мобильной версии
  hideOnMobile?: boolean // Скрыть колонку на мобильных
  className?: string
}

interface MobileTableProps<T> {
  data: T[]
  columns: MobileTableColumn<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  emptyMessage?: string
  mobileCardRender?: (item: T) => ReactNode // Кастомная отрисовка карточки на мобильных
}

export function MobileTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Нет данных',
  mobileCardRender,
}: MobileTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white rounded-lg shadow">
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop таблица */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-4 ${col.className || ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile карточки */}
      <div className="md:hidden space-y-3">
        {data.map((item) => {
          if (mobileCardRender) {
            return (
              <div
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
                  onRowClick ? 'active:bg-gray-50' : ''
                }`}
              >
                {mobileCardRender(item)}
              </div>
            )
          }

          return (
            <div
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`bg-white rounded-lg shadow-sm border border-gray-200 p-4 ${
                onRowClick ? 'active:bg-gray-50' : ''
              }`}
            >
              <div className="space-y-2">
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => (
                    <div key={col.key} className="flex justify-between items-start gap-2">
                      <span className="text-sm font-medium text-gray-500 min-w-[100px]">
                        {col.mobileLabel || col.header}:
                      </span>
                      <div className="text-sm text-gray-900 text-right flex-1">
                        {col.render(item)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
