import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronRight, Check, X } from 'lucide-react'
import { ROLE_COLORS } from '@/utils/roles'

export interface RoleOption {
  id: string
  name: string
  display_name: string
  description?: string | null
}

interface Props {
  /** Доступные для выбора роли */
  roles: RoleOption[]
  /** Выбранные id ролей */
  selectedIds: string[]
  /** id основной роли */
  primaryId: string
  /** Колбэк изменения: новый список id и id основной роли */
  onChange: (selectedIds: string[], primaryId: string) => void
}

/**
 * Единый селектор ролей: выбранные роли — съёмными тегами, добавление через
 * выпадающий список, выбор основной роли чипами (когда выбрано больше одной).
 */
export default function RoleSelector({ roles, selectedIds, primaryId, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedRoles = useMemo(
    () => roles.filter(r => selectedIds.includes(r.id)),
    [roles, selectedIds],
  )

  const toggleRole = (roleId: string) => {
    if (selectedIds.includes(roleId)) {
      const newIds = selectedIds.filter(id => id !== roleId)
      onChange(newIds, primaryId === roleId ? newIds[0] || '' : primaryId)
    } else {
      const newIds = [...selectedIds, roleId]
      onChange(newIds, primaryId || roleId)
    }
  }

  return (
    <div>
      {/* Выбранные теги */}
      {selectedRoles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedRoles.map(role => {
            const c = ROLE_COLORS[role.name] || ROLE_COLORS.user
            return (
              <span key={role.id} className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-xl text-sm font-semibold ${c.bg} ${c.text}`}>
                {role.display_name}
                {primaryId === role.id && <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded font-bold">осн.</span>}
                <button type="button" onClick={() => toggleRole(role.id)} className="p-0.5 rounded hover:bg-black/10">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Дропдаун */}
      <div className="relative" ref={dropdownRef}>
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-white hover:border-indigo-300 transition-all min-h-[44px]">
          <span>{selectedRoles.length === 0 ? 'Выберите роль...' : 'Добавить ещё'}</span>
          <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} strokeWidth={1.5} />
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
            {roles.map(role => {
              const c = ROLE_COLORS[role.name] || ROLE_COLORS.user
              const isSelected = selectedIds.includes(role.id)
              return (
                <button key={role.id} type="button" onClick={() => toggleRole(role.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-100 last:border-0 ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.bg}`}>
                    <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{role.display_name}</p>
                    {role.description && <p className="text-xs text-gray-400 mt-0.5">{role.description}</p>}
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" strokeWidth={2.5} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Выбор основной роли */}
      {selectedRoles.length > 1 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Основная роль</p>
          <div className="flex flex-wrap gap-2">
            {selectedRoles.map(role => (
              <button key={role.id} type="button" onClick={() => onChange(selectedIds, role.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                  primaryId === role.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}>
                {primaryId === role.id && <Check className="w-3 h-3" strokeWidth={3} />}
                {role.display_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
