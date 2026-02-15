import { DayPicker, DateRange } from 'react-day-picker'
import { ru } from 'date-fns/locale'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import 'react-day-picker/dist/style.css'

interface DatePickerProps {
  selected?: Date
  onSelect: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
}

export function DatePicker({
  selected,
  onSelect,
  placeholder = 'Выберите дату',
  disabled = false,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-primary focus:ring-2 focus:ring-primary focus:border-transparent'}
        `}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-500'}>
          {selected ? format(selected, 'dd.MM.yyyy', { locale: ru }) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onSelect(date)
              setIsOpen(false)
            }}
            locale={ru}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            className="p-3"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
              caption: "flex justify-center pt-1 relative items-center",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md hover:bg-gray-100",
              nav_button_previous: "absolute left-1",
              nav_button_next: "absolute right-1",
              table: "w-full border-collapse space-y-1",
              head_row: "flex",
              head_cell: "text-gray-500 rounded-md w-9 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-gray-100/50 [&:has([aria-selected])]:bg-gray-100 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 rounded-md inline-flex items-center justify-center",
              day_range_end: "day-range-end",
              day_selected: "bg-primary text-white hover:bg-primary hover:text-white focus:bg-primary focus:text-white",
              day_today: "bg-gray-100 text-gray-900",
              day_outside: "day-outside text-gray-500 opacity-50 aria-selected:bg-gray-100/50 aria-selected:text-gray-500 aria-selected:opacity-30",
              day_disabled: "text-gray-500 opacity-50",
              day_hidden: "invisible",
            }}
          />
        </div>
      )}
    </div>
  )
}

interface DateRangePickerProps {
  selected?: DateRange
  onSelect: (range: DateRange | undefined) => void
  placeholder?: string
  disabled?: boolean
}

export function DateRangePicker({
  selected,
  onSelect,
  placeholder = 'Выберите диапазон дат',
  disabled = false,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const formatRange = (range?: DateRange) => {
    if (!range?.from) return placeholder
    if (!range.to) return format(range.from, 'dd.MM.yyyy', { locale: ru })
    return `${format(range.from, 'dd.MM.yyyy', { locale: ru })} - ${format(range.to, 'dd.MM.yyyy', { locale: ru })}`
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-left flex items-center justify-between
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:border-primary focus:ring-2 focus:ring-primary focus:border-transparent'}
        `}
      >
        <span className={selected?.from ? 'text-gray-900' : 'text-gray-500'}>
          {formatRange(selected)}
        </span>
        <Calendar className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
          <DayPicker
            mode="range"
            selected={selected}
            onSelect={onSelect}
            locale={ru}
            numberOfMonths={2}
            className="p-3"
          />
        </div>
      )}
    </div>
  )
}
