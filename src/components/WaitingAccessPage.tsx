import { useState } from 'react'
import { Car, Wrench, Package, CheckCircle2, Send, LogOut, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Props {
  profile: any
  onLogout: () => void
}

const features = [
  {
    icon: Wrench,
    color: 'bg-blue-100 text-blue-600',
    title: 'СТО / Автосервис',
    desc: 'Клиенты, автомобили, заявки, заказ-наряды, аналитика',
  },
  {
    icon: Package,
    color: 'bg-orange-100 text-orange-600',
    title: 'Авторазборка',
    desc: 'Склад запчастей, заказы, клиенты, аналитика продаж',
  },
  {
    icon: Car,
    color: 'bg-purple-100 text-purple-600',
    title: 'Мои автомобили',
    desc: 'Учёт личных авто, расходы, история обслуживания',
  },
]

export default function WaitingAccessPage({ profile, onLogout }: Props) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return
    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      // Создаём обращение в support
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        subject: 'Запрос доступа к системе',
        message: message.trim(),
        status: 'open',
        priority: 'normal',
      })

      if (error) {
        // Если таблицы нет — пробуем support_chats
        await supabase.from('support_chats').insert({
          user_id: user.id,
          title: 'Запрос доступа',
          message: message.trim(),
          status: 'open',
        })
      }

      setSent(true)
      toast.success('Сообщение отправлено администратору')
    } catch {
      toast.error('Не удалось отправить. Свяжитесь с администратором напрямую.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
      {/* Хедер */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-sm font-bold text-gray-900">TSP CRM</span>
        </div>
        <button onClick={onLogout}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors">
          <LogOut className="w-4 h-4" strokeWidth={1.5} />
          Выйти
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-2xl mx-auto w-full">

        {/* Приветствие */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Добро пожаловать{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Ваш аккаунт <span className="font-semibold text-gray-700">@{profile?.username || profile?.email}</span> успешно создан.<br />
            Администратор назначит вам доступ в ближайшее время.
          </p>
        </div>

        {/* Доступный функционал */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
            Что доступно в системе
          </h2>
          <div className="space-y-3">
            {features.map(f => {
              const Icon = f.icon
              return (
                <div key={f.title} className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>
                    <Icon className="w-4.5 h-4.5" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Форма обращения */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-1">
            Сообщение администратору
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Укажите какой доступ вам нужен и для чего планируете использовать систему
          </p>

          {sent ? (
            <div className="flex items-center gap-3 py-4 text-emerald-600">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold">Сообщение отправлено</p>
                <p className="text-xs text-gray-400">Администратор рассмотрит вашу заявку</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                placeholder="Например: Нужен доступ к СТО — я владелец автосервиса. Хочу вести клиентов и заявки."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
              <button
                onClick={handleSend}
                disabled={!message.trim() || sending}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sending
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Send className="w-4 h-4" strokeWidth={1.5} />
                }
                {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
