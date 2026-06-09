import { Link } from 'react-router-dom'
import {
  Shield, Database, ClipboardList, MessageCircle, CreditCard,
  ChevronRight, Server, GitBranch, Globe,
} from 'lucide-react'

const LINKS = [
  { to: '/admin/roles',           icon: Shield,        title: 'Роли и доступ',     desc: 'Управление ролями', cls: 'bg-purple-50 text-purple-600' },
  { to: '/admin/subscriptions',   icon: CreditCard,    title: 'Подписки и тарифы', desc: 'Планы и лимиты',    cls: 'bg-emerald-50 text-emerald-600' },
  { to: '/admin/access-requests', icon: ClipboardList, title: 'Заявки на доступ',  desc: 'Новые регистрации', cls: 'bg-blue-50 text-blue-600' },
  { to: '/admin/support',         icon: MessageCircle, title: 'Поддержка',         desc: 'Обращения',         cls: 'bg-amber-50 text-amber-600' },
  { to: '/admin/database',        icon: Database,      title: 'База данных',       desc: 'Просмотр таблиц',   cls: 'bg-indigo-50 text-indigo-600' },
]

export default function AdminSettings() {
  const version = import.meta.env.VITE_BUILD_HASH || 'dev'
  const env = import.meta.env.PROD ? 'production' : 'development'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Настройки платформы</h1>
        <p className="text-xs text-gray-400 mt-0.5">Глобальные параметры и разделы</p>
      </div>

      {/* Быстрые разделы */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LINKS.map(l => (
          <Link key={l.to} to={l.to}
            className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:border-gray-200 transition-all">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${l.cls}`}>
              <l.icon className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{l.title}</p>
              <p className="text-xs text-gray-400 truncate">{l.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Системная информация */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Система</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          <InfoRow icon={Server} label="Бэкенд" value="Supabase" cls="text-emerald-600 bg-emerald-50" />
          <InfoRow icon={Globe} label="Окружение" value={env} cls="text-blue-600 bg-blue-50" />
          <InfoRow icon={GitBranch} label="Версия сборки" value={version} mono cls="text-indigo-600 bg-indigo-50" />
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, mono, cls }: { icon: any; label: string; value: string; mono?: boolean; cls: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="w-4 h-4" strokeWidth={1.5} />
      </div>
      <span className="text-sm text-gray-500 flex-1">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
