import { Clock, Wrench, CheckCircle2, Archive, X, Trash2, type LucideIcon } from 'lucide-react'

// ─── Единый источник статусов заявок СТО ──────────────────────────────────────
// Цвета используются динамически через style={{}} — это единый источник, а не ad-hoc hex.

export interface StatusCfg {
  label: string
  color: string
  bg: string
  border: string
  icon: LucideIcon
  next?: string
  nextLabel?: string
}

export const STATUS_CFG: Record<string, StatusCfg> = {
  scheduled:        { label: 'Запланирована',  color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: Clock,        next: 'in_progress', nextLabel: 'В работу' },
  in_progress:      { label: 'В работе',        color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Wrench,       next: 'completed',   nextLabel: 'Готово' },
  completed:        { label: 'Готова',          color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2, next: 'archived',    nextLabel: 'В архив' },
  ready:            { label: 'Готова',          color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2, next: 'archived',    nextLabel: 'В архив' },
  archived:         { label: 'Архив',           color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB', icon: Archive },
  cancelled:        { label: 'Отменена',        color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: X },
  pending_deletion: { label: 'Запрос удаления', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', icon: Trash2 },
}

/** Порядок статусов в линейке прогресса */
export const STATUS_FLOW = ['scheduled', 'in_progress', 'completed', 'archived'] as const

export function statusCfg(status: string): StatusCfg {
  return STATUS_CFG[status] ?? STATUS_CFG.scheduled
}
