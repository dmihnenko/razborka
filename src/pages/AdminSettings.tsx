import { Link } from 'react-router-dom'
import {
  Shield, Database, ClipboardList, MessageCircle, CreditCard,
  ChevronRight, Server, GitBranch, Globe, ToggleRight,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { setFeatureFlag } from '@/services/featureFlagsService'

const LINKS = [
  { to: '/admin/roles',           icon: Shield,        title: 'Роли и доступ',     desc: 'Управление ролями', tileClass: 'bg-purple-50 text-purple-600' },
  { to: '/admin/subscriptions',   icon: CreditCard,    title: 'Подписки и тарифы', desc: 'Планы и лимиты',    tileClass: 'bg-emerald-50 text-emerald-600' },
  { to: '/admin/access-requests', icon: ClipboardList, title: 'Заявки на доступ',  desc: 'Новые регистрации', tileClass: 'bg-blue-50 text-blue-600' },
  { to: '/admin/support',         icon: MessageCircle, title: 'Поддержка',         desc: 'Обращения',         tileClass: 'bg-amber-50 text-amber-600' },
  { to: '/admin/database',        icon: Database,      title: 'База данных',       desc: 'Просмотр таблиц',   tileClass: 'bg-indigo-50 text-indigo-600' },
]

export default function AdminSettings() {
  const version = import.meta.env.VITE_BUILD_HASH || 'dev'
  const env = import.meta.env.PROD ? 'production' : 'development'

  return (
    <div className="space-y-6">
      {/* Заголовок страницы */}
      <div className="page-header mb-0">
        <div>
          <h1 className="page-title">Настройки платформы</h1>
          <p className="page-subtitle">Глобальные параметры и разделы</p>
        </div>
      </div>

      {/* Быстрые разделы */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LINKS.map(l => (
          <Link key={l.to} to={l.to}
            className="card card-interactive group flex items-center gap-3 p-4">
            <div className={`icon-tile flex-shrink-0 ${l.tileClass}`}>
              <l.icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{l.title}</p>
              <p className="text-xs text-gray-500 truncate">{l.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Функции (фиче-флаги) */}
      <FeatureFlagsCard />

      {/* Системная информация */}
      <div>
        <p className="kicker mb-2.5">Система</p>
        <div className="card p-0 overflow-hidden panel-divided">
          <InfoRow icon={Server}    label="Бэкенд"        value="Supabase" tileClass="text-emerald-600 bg-emerald-50" />
          <InfoRow icon={Globe}     label="Окружение"     value={env}      tileClass="text-blue-600 bg-blue-50" />
          <InfoRow icon={GitBranch} label="Версия сборки" value={version}  mono tileClass="text-indigo-600 bg-indigo-50" />
        </div>
      </div>
    </div>
  )
}

function FeatureFlagsCard() {
  const qc = useQueryClient()
  const { data: flags = [], isLoading } = useFeatureFlags()
  const mutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => setFeatureFlag(key, enabled),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); toast.success('Сохранено') },
    onError: (e: Error) => toast.error(e?.message || 'Не удалось сохранить'),
  })

  return (
    <div>
      <p className="kicker mb-2.5">Функции (опции маркета)</p>
      <div className="card p-0 overflow-hidden panel-divided">
        {isLoading ? (
          <div className="px-4 py-3 text-sm text-gray-400">Загрузка…</div>
        ) : flags.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-400">Нет настраиваемых опций</div>
        ) : flags.map(f => (
          <div key={f.key} className="flex items-center gap-3 px-4 py-3">
            <div className="icon-tile-sm flex-shrink-0 text-indigo-600 bg-indigo-50">
              <ToggleRight className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{f.label || f.key}</p>
              <p className="text-xs text-gray-400 font-mono truncate">{f.key}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ key: f.key, enabled: !f.enabled })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${f.enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
              aria-label={`${f.enabled ? 'Выключить' : 'Включить'} ${f.label || f.key}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${f.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon, label, value, mono, tileClass,
}: {
  icon: React.ElementType
  label: string
  value: string
  mono?: boolean
  tileClass: string
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`icon-tile-sm flex-shrink-0 ${tileClass}`}>
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <span className="text-sm text-gray-500 flex-1">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono text-xs tabular' : ''}`}>
        {value}
      </span>
    </div>
  )
}
