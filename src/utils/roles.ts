// Shared role utilities — используй везде вместо дублирования

export const ROLE_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  admin:        { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    border: 'border-red-200' },
  sto_owner:    { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500',   border: 'border-blue-200' },
  sto_worker:   { bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500',   border: 'border-cyan-200' },
  parts_owner:  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  parts_worker: { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500',  border: 'border-amber-200' },
  user:         { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400',   border: 'border-gray-200' },
}

export function getRoleBadgeColor(roleName?: string): string {
  const c = ROLE_COLORS[roleName || ''] || ROLE_COLORS.user
  return `${c.bg} ${c.text} ${c.border}`
}

export function shouldShowStoCompany(roleNames: string[]): boolean {
  return roleNames.some(n => ['admin', 'sto_owner', 'sto_worker'].includes(n))
}

export function shouldShowPartsCompany(roleNames: string[]): boolean {
  return roleNames.some(n => ['admin', 'parts_owner', 'parts_worker'].includes(n))
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Администратор',
  sto_owner: 'Владелец СТО',
  sto_worker: 'Работник СТО',
  parts_owner: 'Владелец разборки',
  parts_worker: 'Авторазборка',
  user: 'Пользователь',
}
