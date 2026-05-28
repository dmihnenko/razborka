import { useState, useEffect } from 'react'
import { Car, Wrench, Package, CheckCircle2, LogOut, Sparkles, Clock, XCircle, RefreshCw, ChevronRight, ArrowLeft, Building2, Users, Phone, MapPin, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { IMaskInput } from 'react-imask'

interface Props {
  profile: any
  onLogout: () => void
}

type Step = 'select' | 'form' | 'status'
type RequestType = 'sto_owner' | 'sto_worker' | 'parts_owner' | 'parts_worker' | 'user'

interface AccessRequest {
  id: string
  request_type: RequestType
  status: 'pending' | 'approved' | 'rejected'
  company_name?: string
  owner_phone?: string
  rejection_reason?: string
  created_at: string
}

const roleLabels: Record<string, string> = {
  sto_owner: 'Владелец СТО',
  sto_worker: 'Работник СТО',
  parts_owner: 'Владелец авторазборки',
  parts_worker: 'Авторазборка',
  user: 'Личные автомобили',
}

export default function WaitingAccessPage({ profile, onLogout }: Props) {
  const [authUsername, setAuthUsername] = useState<string>('')
  
  useEffect(() => {
    // Берём username из auth metadata если нет в профиле
    if (!profile?.username) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        const uname = user?.user_metadata?.username || user?.email?.split('@')[0] || ''
        setAuthUsername(uname)
      })
    }
  }, [profile?.username])

  const displayUsername = profile?.username || authUsername

  const [step, setStep] = useState<Step>('select')
  const [selectedType, setSelectedType] = useState<RequestType | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<'sto' | 'parts' | 'user' | null>(null)
  const [existingRequest, setExistingRequest] = useState<AccessRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Форма для владельцев
  const [companyName, setCompanyName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')

  // Форма для работников
  const [ownerPhone, setOwnerPhone] = useState('')

  useEffect(() => {
    loadExistingRequest()
  }, [])

  const loadExistingRequest = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setLoading(false)

    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      setExistingRequest(data)
      setStep('status')
    }
    setLoading(false)
  }

  const handleSelectType = (type: RequestType) => {
    setSelectedType(type)
    if (type === 'user') {
      handleSubmitUser()
      return
    }
    setStep('form')
  }

  const handleSubmitUser = async () => {
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error()
      const { error } = await supabase.from('access_requests').insert({
        user_id: user.id,
        request_type: 'user',
        status: 'pending',
      })
      if (error) throw error
      await loadExistingRequest()
    } catch {
      toast.error('Ошибка при отправке')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitForm = async () => {
    const isOwner = selectedType === 'sto_owner' || selectedType === 'parts_owner'
    const isWorker = selectedType === 'sto_worker' || selectedType === 'parts_worker'

    if (isOwner && !companyName.trim()) return toast.error('Укажите название компании')
    if (isOwner && companyPhone.replace(/\D/g, '').length < 10) return toast.error('Укажите телефон компании — по нему работники найдут вас')
    if (isWorker && ownerPhone.replace(/\D/g, '').length < 10) return toast.error('Введите корректный номер телефона')

    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error()

      const payload: any = {
        user_id: user.id,
        request_type: selectedType,
        status: 'pending',
      }

      if (isOwner) {
        payload.company_name = companyName.trim()
        payload.company_address = companyAddress.trim() || null
        payload.company_phone = companyPhone || null
      }

      if (isWorker) {
        // Нормализуем телефон
        const digits = ownerPhone.replace(/\D/g, '')
        payload.owner_phone = digits.length === 10 ? `+38${digits}` : `+${digits}`
      }

      const { error } = await supabase.from('access_requests').insert(payload)
      if (error) throw error
      toast.success('Заявка отправлена!')
      await loadExistingRequest()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка при отправке')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!existingRequest) return
    setSubmitting(true)
    try {
      await supabase.from('access_requests').delete().eq('id', existingRequest.id)
      setExistingRequest(null)
      setSelectedType(null)
      setCompanyName('')
      setCompanyAddress('')
      setCompanyPhone('')
      setOwnerPhone('')
      setStep('select')
      toast.success('Заявка отменена')
    } catch {
      toast.error('Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  const isOwnerType = selectedType === 'sto_owner' || selectedType === 'parts_owner'
  const isWorkerType = selectedType === 'sto_worker' || selectedType === 'parts_worker'
  const isStoType = selectedType === 'sto_owner' || selectedType === 'sto_worker'

  if (loading) return (
    <div className="min-h-dvh bg-[#F4F6FA] flex items-center justify-center">
      <span className="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
      {/* Хедер */}
      <header className="bg-white border-b border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            {step === 'form' && (
              <button onClick={() => setStep('select')} className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 mr-1">
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-bold text-gray-900">TSP CRM</span>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-600 transition-colors min-h-[44px]">
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
            <span>Выйти</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">

          {/* Приветствие */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-primary to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Sparkles className="w-7 h-7 text-white" strokeWidth={1.5} />
            </div>
            <h1 className="text-xl font-bold text-gray-900">
              Добро пожаловать{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {displayUsername ? '@' + displayUsername : profile?.email || ''}
            </p>
          </div>

          {/* ─── ШАГ 1: Выбор категории ─── */}
          {step === 'select' && !selectedCategory && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-800">Выберите направление</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Вы работаете с СТО, авторазборкой или ведёте личные авто?</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { id: 'sto' as const, icon: Wrench, color: 'text-blue-600 bg-blue-50', label: 'СТО', desc: 'Автосервис, заявки, ремонт автомобилей' },
                    { id: 'parts' as const, icon: Package, color: 'text-orange-600 bg-orange-50', label: 'Авторазборка', desc: 'Склад запчастей, заказы, продажи' },
                    { id: 'user' as const, icon: Car, color: 'text-purple-600 bg-purple-50', label: 'Личные автомобили', desc: 'Учёт своих авто, расходы, история' },
                  ].map(opt => {
                    const Icon = opt.icon
                    return (
                      <button key={opt.id} type="button"
                        onClick={() => {
                          if (opt.id === 'user') { handleSelectType('user'); return }
                          setSelectedCategory(opt.id)
                        }}
                        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${opt.color}`}>
                          <Icon className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── ШАГ 1б: Выбор роли внутри категории ─── */}
          {step === 'select' && selectedCategory && selectedCategory !== 'user' && (
            <div className="space-y-3">
              <button type="button" onClick={() => setSelectedCategory(null)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
                Назад
              </button>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedCategory === 'sto' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                      {selectedCategory === 'sto' ? <Wrench className="w-4 h-4" strokeWidth={1.5} /> : <Package className="w-4 h-4" strokeWidth={1.5} />}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-800">{selectedCategory === 'sto' ? 'СТО' : 'Авторазборка'}</h2>
                      <p className="text-xs text-gray-400">Кем вы являетесь?</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    {
                      type: (selectedCategory + '_owner') as RequestType,
                      label: 'Владелец',
                      desc: selectedCategory === 'sto' ? 'Управляю СТО — клиенты, заявки, сотрудники' : 'Управляю разборкой — запчасти, заказы, склад',
                      icon: Building2,
                    },
                    {
                      type: (selectedCategory + '_worker') as RequestType,
                      label: 'Работник',
                      desc: selectedCategory === 'sto' ? 'Работаю в СТО — принимаю и обрабатываю заявки' : 'Работаю на разборке — обрабатываю заказы и склад',
                      icon: Users,
                    },
                  ].map(opt => {
                    const Icon = opt.icon
                    return (
                      <button key={opt.type} type="button" onClick={() => handleSelectType(opt.type)}
                        className="w-full flex items-center gap-4 px-5 py-5 hover:bg-gray-50 transition-colors text-left">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${selectedCategory === 'sto' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                          <Icon className="w-6 h-6" strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-1">{opt.desc}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" strokeWidth={1.5} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── ШАГ 2: Форма ─── */}
          {step === 'form' && selectedType && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="text-sm font-bold text-gray-800">{roleLabels[selectedType]}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {isOwnerType ? 'Данные вашей компании' : 'Данные для привязки к компании'}
                  </p>
                </div>
                <div className="p-5 space-y-4">
                  {/* ВЛАДЕЛЕЦ — данные компании */}
                  {isOwnerType && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Название {isStoType ? 'СТО' : 'авторазборки'} <span className="text-red-400 normal-case font-normal">*</span>
                        </label>
                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                          placeholder={isStoType ? 'Автосервис "Мастер"' : 'Авторазборка "Запчасти"'}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Адрес</label>
                        <div className="relative">
                          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                          <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                            placeholder="ул. Центральная, 15"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Телефон компании <span className="text-red-400 normal-case font-normal">*</span> <span className="text-gray-400 normal-case font-normal text-[11px]">— по нему вас найдут работники</span></label>
                        <div className="relative">
                          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                          <IMaskInput
                            mask="+38 000 000 00 00"
                            value={companyPhone}
                            onAccept={v => setCompanyPhone(String(v))}
                            placeholder="+38 099 999 99 99"
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* РАБОТНИК — телефон владельца */}
                  {isWorkerType && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Телефон {isStoType ? 'владельца СТО' : 'владельца разборки'} <span className="text-red-400 normal-case font-normal">*</span>
                      </label>
                      <p className="text-xs text-gray-400 mb-2">
                        Введите номер — система найдёт компанию и отправит запрос владельцу
                      </p>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.5} />
                        <IMaskInput
                          mask="+38 000 000 00 00"
                          value={ownerPhone}
                          onAccept={v => setOwnerPhone(String(v))}
                          placeholder="+38 099 999 99 99"
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep('select')}
                  className="flex-1 py-3 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  Назад
                </button>
                <button onClick={handleSubmitForm} disabled={submitting}
                  className="flex-1 py-3 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                  {submitting
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : null}
                  {submitting ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </div>
            </div>
          )}

          {/* ─── ШАГ 3: Статус заявки ─── */}
          {step === 'status' && existingRequest && (
            <div className="space-y-4">
              {/* Статус */}
              <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                existingRequest.status === 'rejected' ? 'border-red-200' : 'border-gray-100'
              }`}>
                <div className={`px-5 py-4 border-b flex items-center gap-3 ${
                  existingRequest.status === 'rejected' ? 'border-red-100 bg-red-50' : 'border-gray-100'
                }`}>
                  {existingRequest.status === 'pending' && (
                    <><Clock className="w-5 h-5 text-amber-500 flex-shrink-0" strokeWidth={1.5} />
                    <div><p className="text-sm font-bold text-gray-800">Заявка на рассмотрении</p>
                    <p className="text-xs text-gray-400">Ожидайте ответа</p></div></>
                  )}
                  {existingRequest.status === 'rejected' && (
                    <><XCircle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1.5} />
                    <div><p className="text-sm font-bold text-red-700">Заявка отклонена</p>
                    <p className="text-xs text-red-400">Вы можете подать новую</p></div></>
                  )}
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Тип доступа</span>
                    <span className="font-semibold text-gray-800">{roleLabels[existingRequest.request_type]}</span>
                  </div>
                  {existingRequest.company_name && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Компания</span>
                      <span className="font-semibold text-gray-800">{existingRequest.company_name}</span>
                    </div>
                  )}
                  {existingRequest.owner_phone && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Телефон владельца</span>
                      <span className="font-semibold text-gray-800 font-mono">{existingRequest.owner_phone}</span>
                    </div>
                  )}
                  {existingRequest.rejection_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                      <p className="text-xs text-red-600">{existingRequest.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Действия */}
              <div className="space-y-2.5">
                {existingRequest.status === 'pending' && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={1.5} />
                    <div className="flex-1 text-sm text-gray-600">
                      Заявка отправлена. После одобрения обновите страницу.
                    </div>
                    <button onClick={() => window.location.reload()}
                      className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
                      Обновить
                    </button>
                  </div>
                )}

                <button onClick={handleCancelRequest} disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                  Отменить и подать новую заявку
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
