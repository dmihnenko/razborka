import { useState } from 'react'
import { Car, Wrench, Package, CheckCircle2, Send, LogOut, Sparkles, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface Props {
  profile: any
  onLogout: () => void
}

const roleOptions = [
  {
    id: 'sto_owner',
    icon: Wrench,
    color: 'bg-blue-100 text-blue-600',
    activeColor: 'border-blue-500 bg-blue-50',
    title: 'Владелец СТО',
    desc: 'Управляю автосервисом — клиенты, заявки, сотрудники',
  },
  {
    id: 'sto_worker',
    icon: Wrench,
    color: 'bg-cyan-100 text-cyan-600',
    activeColor: 'border-cyan-500 bg-cyan-50',
    title: 'Работник СТО',
    desc: 'Работаю в автосервисе — принимаю и обрабатываю заявки',
  },
  {
    id: 'parts_owner',
    icon: Package,
    color: 'bg-orange-100 text-orange-600',
    activeColor: 'border-orange-500 bg-orange-50',
    title: 'Владелец авторазборки',
    desc: 'Управляю разборкой — запчасти, заказы, склад',
  },
  {
    id: 'parts_worker',
    icon: Package,
    color: 'bg-amber-100 text-amber-600',
    activeColor: 'border-amber-500 bg-amber-50',
    title: 'Работник разборки',
    desc: 'Работаю на разборке — обрабатываю заказы и склад',
  },
  {
    id: 'user',
    icon: Car,
    color: 'bg-purple-100 text-purple-600',
    activeColor: 'border-purple-500 bg-purple-50',
    title: 'Мои автомобили',
    desc: 'Веду учёт личных авто, расходы, историю обслуживания',
  },
]

export default function WaitingAccessPage({ profile, onLogout }: Props) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const selectedOption = roleOptions.find(r => r.id === selectedRole)

  const handleSend = async () => {
    if (!selectedRole) return
    setSending(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      const fullMessage = `Запрошенная роль: ${selectedOption?.title}\n\n${message.trim() || '(без дополнительного сообщения)'}`

      // Пробуем support_tickets, потом support_chats
      const { error } = await supabase.from('support_tickets').insert({
        user_id: user.id,
        subject: `Запрос доступа: ${selectedOption?.title}`,
        message: fullMessage,
        status: 'open',
        priority: 'normal',
      })

      if (error) {
        await supabase.from('support_chats').insert({
          user_id: user.id,
          title: `Запрос доступа: ${selectedOption?.title}`,
          message: fullMessage,
          status: 'open',
        })
      }

      setSent(true)
      toast.success('Заявка отправлена администратору')
    } catch {
      toast.error('Не удалось отправить. Обратитесь к администратору напрямую.')
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

      <div className="flex-1 overflow-y-auto px-4 py-8 max-w-xl mx-auto w-full pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

        {/* Приветствие */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Sparkles className="w-8 h-8 text-white" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Добро пожаловать{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
          </h1>
          <p className="text-gray-500 text-sm">
            Аккаунт <span className="font-semibold text-gray-700">@{profile?.username || profile?.email}</span> создан.<br/>
            Выберите кто вы — администратор назначит нужный доступ.
          </p>
        </div>

        {!sent ? (
          <>
            {/* Выбор роли */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-gray-400" strokeWidth={1.5} />
                <h2 className="text-sm font-bold text-gray-700">Кто вы?</h2>
                <span className="text-red-400 text-xs">*</span>
              </div>
              <div className="space-y-2.5">
                {roleOptions.map(opt => {
                  const Icon = opt.icon
                  const isActive = selectedRole === opt.id
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => setSelectedRole(opt.id)}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                        isActive ? opt.activeColor : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}>
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${opt.color}`}>
                        <Icon className="w-4 h-4" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                          {opt.title}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isActive ? 'border-current bg-current' : 'border-gray-300'
                      }`}>
                        {isActive && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Доп. сообщение */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
              <h2 className="text-sm font-bold text-gray-700 mb-1">Дополнительно</h2>
              <p className="text-xs text-gray-400 mb-3">Опционально — расскажите подробнее</p>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="Например: СТО «Автомастер» на ул. Центральная, 5 сотрудников..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!selectedRole || sending}
              className="w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {sending
                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Send className="w-4 h-4" strokeWidth={1.5} />
              }
              {sending ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </>
        ) : (
          /* Успех */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" strokeWidth={1.5} />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Заявка отправлена!</h2>
            <p className="text-sm text-gray-500 mb-1">
              Вы выбрали: <span className="font-semibold text-gray-700">{selectedOption?.title}</span>
            </p>
            <p className="text-xs text-gray-400">
              Администратор рассмотрит заявку и назначит вам доступ.<br/>
              После этого обновите страницу.
            </p>
            <button onClick={() => window.location.reload()}
              className="mt-5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors">
              Обновить страницу
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
