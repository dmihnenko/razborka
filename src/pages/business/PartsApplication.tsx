import { useState, KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { IMaskInput } from 'react-imask'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  LogIn,
  MapPin,
  Phone,
  Plus,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { submitPartsApplication, getMyPartsApplication } from '@/services/businessService'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/brand/Logo'
import type { PartsApplicationInput } from '@/types/business'

// ============================================================================
// PartsApplication — форма заявки на авторазборку (/business/apply)
// Требует авторизации.
// ============================================================================

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const FADE_UP = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: EASE },
}

// ── Экран «требуется вход» ────────────────────────────────────────────────────
function LoginRequired() {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div {...FADE_UP} className="card max-w-sm w-full text-center">
        <span className="icon-tile-lg bg-blue-50 text-blue-600 mx-auto mb-4">
          <LogIn className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <h1 className="heading-3 mb-2">Войдите, чтобы подать заявку</h1>
        <p className="text-sm text-gray-500 mb-5">
          Для подачи заявки на подключение авторазборки необходима авторизация.
        </p>
        <Link
          to="/login?next=/business/apply"
          className="btn-primary w-full"
        >
          Войти в аккаунт
        </Link>
        <Link
          to="/business"
          className="btn-ghost w-full mt-2"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Назад к лендингу
        </Link>
      </motion.div>
    </div>
  )
}

// ── Экран «заявка на рассмотрении» ───────────────────────────────────────────
function PendingScreen({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div {...FADE_UP} className="card max-w-sm w-full text-center">
        <span className="icon-tile-lg bg-yellow-50 text-yellow-600 mx-auto mb-4">
          <Clock className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <h1 className="heading-3 mb-2">Заявка на рассмотрении</h1>
        {companyName && (
          <p className="text-sm font-semibold text-gray-900 mb-1">«{companyName}»</p>
        )}
        <p className="text-sm text-gray-500 mb-5">
          Ваша заявка отправлена и ожидает одобрения администратора.
          Мы уведомим вас, когда всё будет готово.
        </p>
        <div className="alert alert-info mb-4">
          <Clock className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span>Обычно рассмотрение занимает до 24 часов</span>
        </div>
        <Link to="/business" className="btn-secondary w-full">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          На главную
        </Link>
      </motion.div>
    </div>
  )
}

// ── Экран «авторазборка уже создана» ─────────────────────────────────────────
function ApprovedScreen({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div {...FADE_UP} className="card max-w-sm w-full text-center">
        <span className="icon-tile-lg bg-green-50 text-green-600 mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <h1 className="heading-3 mb-2">Авторазборка создана!</h1>
        {companyName && (
          <p className="text-sm font-semibold text-gray-900 mb-1">«{companyName}»</p>
        )}
        <p className="text-sm text-gray-500 mb-5">
          Ваша заявка одобрена — авторазборка готова к работе. Перейдите в панель управления.
        </p>
        <Link to="/parts/dashboard" className="btn-primary w-full">
          Открыть панель
          <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
        </Link>
      </motion.div>
    </div>
  )
}

// ── Экран «отклонена» + кнопка подать заново ─────────────────────────────────
function RejectedScreen({
  reason,
  onReapply,
}: {
  reason?: string
  onReapply: () => void
}) {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div {...FADE_UP} className="card max-w-sm w-full text-center">
        <span className="icon-tile-lg bg-red-50 text-red-600 mx-auto mb-4">
          <XCircle className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <h1 className="heading-3 mb-2">Заявка отклонена</h1>
        {reason && (
          <div className="alert alert-danger mb-4 text-left">
            <XCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>{reason}</span>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-5">
          Вы можете исправить данные и подать заявку заново.
        </p>
        <button type="button" onClick={onReapply} className="btn-primary w-full">
          Подать повторно
        </button>
        <Link to="/business" className="btn-ghost w-full mt-2">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          На главную
        </Link>
      </motion.div>
    </div>
  )
}

// ── Экран успеха ──────────────────────────────────────────────────────────────
function SuccessScreen() {
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center px-4">
      <motion.div {...FADE_UP} className="card max-w-sm w-full text-center">
        <span className="icon-tile-lg bg-green-50 text-green-600 mx-auto mb-4">
          <CheckCircle2 className="w-6 h-6" strokeWidth={1.5} />
        </span>
        <h1 className="heading-3 mb-2">Заявка отправлена!</h1>
        <p className="text-sm text-gray-500 mb-5">
          Ожидайте одобрения администратора. Как только заявка будет рассмотрена, вы получите уведомление.
        </p>
        <div className="alert alert-success mb-4">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
          <span>Обычно рассмотрение занимает до 24 часов</span>
        </div>
        <Link to="/business" className="btn-secondary w-full">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          На главную
        </Link>
      </motion.div>
    </div>
  )
}

// ── Основная форма ─────────────────────────────────────────────────────────────
export function PartsApplication() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [showForm, setShowForm] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Поля формы
  const [companyName, setCompanyName] = useState('')
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [vehicleMakes, setVehicleMakes] = useState<string[]>([])
  const [makeInput, setMakeInput] = useState('')

  // Ошибки
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Загрузка авторизации
  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  // Не авторизован
  if (!user) {
    return <LoginRequired />
  }

  return (
    <PartsApplicationInner
      userId={user.id}
      showForm={showForm}
      setShowForm={setShowForm}
      submitted={submitted}
      setSubmitted={setSubmitted}
      companyName={companyName}
      setCompanyName={setCompanyName}
      ownerFirstName={ownerFirstName}
      setOwnerFirstName={setOwnerFirstName}
      ownerLastName={ownerLastName}
      setOwnerLastName={setOwnerLastName}
      phone={phone}
      setPhone={setPhone}
      address={address}
      setAddress={setAddress}
      vehicleMakes={vehicleMakes}
      setVehicleMakes={setVehicleMakes}
      makeInput={makeInput}
      setMakeInput={setMakeInput}
      errors={errors}
      setErrors={setErrors}
      navigate={navigate}
    />
  )
}

// ── Inner (нужен чтобы хуки вызывались только при наличии user) ───────────────
function PartsApplicationInner({
  userId,
  showForm,
  setShowForm,
  submitted,
  setSubmitted,
  companyName,
  setCompanyName,
  ownerFirstName,
  setOwnerFirstName,
  ownerLastName,
  setOwnerLastName,
  phone,
  setPhone,
  address,
  setAddress,
  vehicleMakes,
  setVehicleMakes,
  makeInput,
  setMakeInput,
  errors,
  setErrors,
  navigate,
}: {
  userId: string
  showForm: boolean
  setShowForm: (v: boolean) => void
  submitted: boolean
  setSubmitted: (v: boolean) => void
  companyName: string
  setCompanyName: (v: string) => void
  ownerFirstName: string
  setOwnerFirstName: (v: string) => void
  ownerLastName: string
  setOwnerLastName: (v: string) => void
  phone: string
  setPhone: (v: string) => void
  address: string
  setAddress: (v: string) => void
  vehicleMakes: string[]
  setVehicleMakes: (v: string[]) => void
  makeInput: string
  setMakeInput: (v: string) => void
  errors: Record<string, string>
  setErrors: (v: Record<string, string>) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data: application, isLoading: appLoading } = useQuery({
    queryKey: ['myPartsApplication', userId],
    queryFn: () => getMyPartsApplication(userId),
    enabled: !showForm && !submitted,
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (input: PartsApplicationInput) => submitPartsApplication(userId, input),
    onSuccess: () => {
      toast.success('Заявка отправлена!')
      setSubmitted(true)
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Ошибка при отправке заявки')
    },
  })

  if (appLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  // Заявка успешно отправлена только что
  if (submitted) {
    return <SuccessScreen />
  }

  // Уже есть заявка — показываем статус (pending/approved), или форму (rejected/null)
  if (application && !showForm) {
    if (application.status === 'pending') {
      return <PendingScreen companyName={application.companyName} />
    }
    if (application.status === 'approved') {
      return <ApprovedScreen companyName={application.companyName} />
    }
    if (application.status === 'rejected') {
      return (
        <RejectedScreen
          reason={application.rejectionReason}
          onReapply={() => setShowForm(true)}
        />
      )
    }
  }

  // ── Добавление марки авто ──────────────────────────────────────────────────
  function addMake() {
    const val = makeInput.trim()
    if (!val) return
    if (!vehicleMakes.includes(val)) {
      setVehicleMakes([...vehicleMakes, val])
    }
    setMakeInput('')
  }

  function removeMake(make: string) {
    setVehicleMakes(vehicleMakes.filter(m => m !== make))
  }

  function handleMakeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addMake()
    }
  }

  // ── Валидация ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!companyName.trim()) errs.companyName = 'Обязательное поле'
    if (!ownerFirstName.trim()) errs.ownerFirstName = 'Обязательное поле'
    if (!ownerLastName.trim()) errs.ownerLastName = 'Обязательное поле'
    if (phone.replace(/\D/g, '').length < 10) errs.phone = 'Введите корректный номер телефона'
    if (!address.trim()) errs.address = 'Обязательное поле'
    if (vehicleMakes.length === 0) errs.vehicleMakes = 'Добавьте хотя бы одну марку авто'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    mutation.mutate({
      companyName: companyName.trim(),
      ownerFirstName: ownerFirstName.trim(),
      ownerLastName: ownerLastName.trim(),
      phone,
      address: address.trim(),
      vehicleMakes,
    })
  }

  // ── Форма ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">

      {/* Шапка */}
      <header className="glass border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 h-[60px] flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/business')}
            className="btn-icon"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <Logo size="sm" withText />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <motion.div
          {...FADE_UP}
          className="max-w-xl mx-auto px-4 py-6 sm:py-10 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]"
        >

          {/* Заголовок формы */}
          <div className="text-center mb-8">
            <span className="icon-tile-lg bg-blue-50 text-blue-600 mx-auto mb-3">
              <Building2 className="w-6 h-6" strokeWidth={1.5} />
            </span>
            <h1 className="heading-2">Заявка на авторазборку</h1>
            <p className="page-subtitle mt-2">
              Заполните форму — администратор рассмотрит и создаст вашу компанию
            </p>
          </div>

          {/* Форма */}
          <div className="card space-y-5">

            {/* Название разборки */}
            <div>
              <label htmlFor="companyName" className="form-label">
                Название авторазборки <span className="text-red-500">*</span>
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder='Авторазборка «АвтоДеталь»'
                className={`form-input ${errors.companyName ? 'border-red-400 focus:border-red-400' : ''}`}
              />
              {errors.companyName && <p className="form-error">{errors.companyName}</p>}
            </div>

            {/* Имя и фамилия */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="ownerFirstName" className="form-label">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Имя владельца <span className="text-red-500">*</span>
                  </span>
                </label>
                <input
                  id="ownerFirstName"
                  type="text"
                  value={ownerFirstName}
                  onChange={e => setOwnerFirstName(e.target.value)}
                  placeholder="Иван"
                  className={`form-input ${errors.ownerFirstName ? 'border-red-400' : ''}`}
                />
                {errors.ownerFirstName && <p className="form-error">{errors.ownerFirstName}</p>}
              </div>
              <div>
                <label htmlFor="ownerLastName" className="form-label">
                  Фамилия <span className="text-red-500">*</span>
                </label>
                <input
                  id="ownerLastName"
                  type="text"
                  value={ownerLastName}
                  onChange={e => setOwnerLastName(e.target.value)}
                  placeholder="Петренко"
                  className={`form-input ${errors.ownerLastName ? 'border-red-400' : ''}`}
                />
                {errors.ownerLastName && <p className="form-error">{errors.ownerLastName}</p>}
              </div>
            </div>

            {/* Телефон */}
            <div>
              <label htmlFor="phone" className="form-label">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Телефон <span className="text-red-500">*</span>
                </span>
              </label>
              <IMaskInput
                id="phone"
                mask="+38 000 000 00 00"
                value={phone}
                onAccept={v => setPhone(String(v))}
                placeholder="+38 099 999 99 99"
                className={`form-input ${errors.phone ? 'border-red-400' : ''}`}
              />
              {errors.phone && <p className="form-error">{errors.phone}</p>}
            </div>

            {/* Адрес */}
            <div>
              <label htmlFor="address" className="form-label">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Адрес разборки <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                id="address"
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="г. Киев, ул. Центральная, 15"
                className={`form-input ${errors.address ? 'border-red-400' : ''}`}
              />
              {errors.address && <p className="form-error">{errors.address}</p>}
            </div>

            {/* Марки авто — теги */}
            <div>
              <label htmlFor="makeInput" className="form-label">
                <span className="flex items-center gap-1.5">
                  <Car className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Марки авто <span className="text-red-500">*</span>
                </span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Введите марку и нажмите Enter или кнопку «+»
              </p>
              <div className="flex gap-2">
                <input
                  id="makeInput"
                  type="text"
                  value={makeInput}
                  onChange={e => setMakeInput(e.target.value)}
                  onKeyDown={handleMakeKeyDown}
                  placeholder="BMW, Toyota, Volkswagen…"
                  className={`form-input flex-1 ${errors.vehicleMakes ? 'border-red-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={addMake}
                  disabled={!makeInput.trim()}
                  className="btn-secondary btn-sm flex-shrink-0 px-3"
                  aria-label="Добавить марку"
                >
                  <Plus className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              {errors.vehicleMakes && <p className="form-error">{errors.vehicleMakes}</p>}

              {vehicleMakes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {vehicleMakes.map(make => (
                    <span
                      key={make}
                      className="chip chip-active flex items-center gap-1.5"
                    >
                      {make}
                      <button
                        type="button"
                        onClick={() => removeMake(make)}
                        className="hover:opacity-70 transition-opacity"
                        aria-label={`Удалить ${make}`}
                      >
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Кнопка отправки */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="btn-primary w-full mt-5 btn-lg"
          >
            {mutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Отправка…
              </>
            ) : (
              'Отправить заявку'
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Нажимая «Отправить заявку», вы соглашаетесь с условиями использования платформы.
          </p>
        </motion.div>
      </div>
    </div>
  )
}

export default PartsApplication
