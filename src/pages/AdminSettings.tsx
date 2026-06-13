import { Link } from 'react-router-dom'
import {
  Shield, Database, ClipboardList, MessageCircle, CreditCard,
  ChevronRight, Server, GitBranch, Globe,
} from 'lucide-react'

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
