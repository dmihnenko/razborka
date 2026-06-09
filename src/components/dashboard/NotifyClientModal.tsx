import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Star, Send } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useUserProfile } from '@/hooks/useUserProfile'
import { markAppointmentReminded } from '@/services/stoService'

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', cls: 'border-green-300 bg-green-50 text-green-700' },
  { key: 'telegram', label: 'Telegram', cls: 'border-blue-300 bg-blue-50 text-blue-700' },
  { key: 'viber',    label: 'Viber',    cls: 'border-purple-300 bg-purple-50 text-purple-700' },
] as const
type ChannelKey = typeof CHANNELS[number]['key']

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
const PREF_KEY = 'sto_notify_channel'

function buildLink(channel: ChannelKey, phone: string | null, text: string) {
  const t = encodeURIComponent(text)
  const digits = (phone || '').replace(/\D/g, '')
  if (channel === 'whatsapp') return `https://wa.me/${digits}?text=${t}`
  if (channel === 'telegram') return `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${t}`
  return `viber://forward?text=${t}`
}

function buildTemplate(appt: any, name: string) {
  const ds = String(appt?.scheduled_date || '')
  const d = new Date(ds)
  const date = isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`
  const time = (ds.match(/T(\d{2}:\d{2})/) || [])[1] || ''
  const v = appt?.vehicles
  const veh = v ? `${v.brand || ''} ${v.model || ''}`.trim() : ''
  const plateOrVin = v?.license_plate ? v.license_plate : (v?.vin ? `VIN ${v.vin}` : '')
  const works = (appt?.work_items || []).map((w: any) => `• ${w.name}`).join('\n')
  const hours = (Number(appt?.total_norm_hours) || 0) + (Number(appt?.extra_hours) || 0)
  const comp = appt?.sto_companies
  const where = [comp?.name && `на ${comp.name}`, comp?.address && `по адресу ${comp.address}`].filter(Boolean).join(' ')

  const firstName = (name || '').trim().split(/\s+/)[0] || ''
  let t = `Здравствуйте${firstName ? ', ' + firstName : ''}!\nНапоминаем о записи${date ? ' ' + date : ''}${time ? ' в ' + time : ''}${where ? ' ' + where : ''}.`
  if (veh) t += `\nАвтомобиль: ${veh}${plateOrVin ? `, ${plateOrVin}` : ''}`
  if (works) t += `\nРаботы:\n${works}`
  if (hours > 0) t += `\nОриентировочное время работ: ${hours} ч.`
  t += `\nБудем Вас ждать!`
  return t
}

interface Props {
  appointmentId: string
  customerName: string
  phone: string | null
  onClose: () => void
}

export default function NotifyClientModal({ appointmentId, customerName, phone, onClose }: Props) {
  const qc = useQueryClient()
  const { data: profile } = useUserProfile()
  const pref = (typeof localStorage !== 'undefined' && localStorage.getItem(PREF_KEY)) as ChannelKey | null
  const [channel, setChannel] = useState<ChannelKey>(pref || 'whatsapp')
  const [text, setText] = useState('')
  const [edited, setEdited] = useState(false)

  const { data: appt } = useQuery({
    queryKey: ['notify-appt', appointmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('scheduled_date, work_items, total_norm_hours, extra_hours, vehicles(brand, model, license_plate, vin)')
        .eq('id', appointmentId).single()
      return data
    },
  })

  const { data: company } = useQuery({
    queryKey: ['sto-company-notify', profile?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase.from('sto_companies').select('name, address').eq('id', profile!.sto_company_id!).single()
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  useEffect(() => {
    if (appt && !edited) setText(buildTemplate({ ...appt, sto_companies: company }, customerName))
  }, [appt, company]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMutation = useMutation({
    mutationFn: () => markAppointmentReminded(appointmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sto-alerts'] }),
  })

  // Список каналов: избранный (pref) — первым
  const ordered = [...CHANNELS].sort((a, b) => (a.key === pref ? -1 : b.key === pref ? 1 : 0))

  const handleSend = () => {
    localStorage.setItem(PREF_KEY, channel)
    window.open(buildLink(channel, phone, text), '_blank')
    sendMutation.mutate(undefined, {
      onSuccess: () => { toast.success('Напоминание отправлено'); onClose() },
      onError: () => { toast.error('Не удалось отметить отправку') },
    })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title="Напоминание клиенту"
      subtitle={customerName}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Отмена</button>
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            className="flex-1 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Send className="w-4 h-4" /> Отправить
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Канал связи */}
        <div>
          <p className="form-label">Канал связи</p>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {ordered.map(ch => {
              const active = channel === ch.key
              const isPref = pref === ch.key
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => setChannel(ch.key)}
                  className={`relative rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-all ${active ? ch.cls : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                >
                  {isPref && <Star className="w-3 h-3 absolute top-1 right-1 fill-amber-400 text-amber-400" />}
                  {ch.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">★ избранный — предлагается по умолчанию. Выбранный канал станет избранным.</p>
        </div>

        {/* Текст сообщения */}
        <div>
          <p className="form-label">Текст сообщения</p>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setEdited(true) }}
            rows={8}
            className="form-input mt-1 resize-none font-normal leading-relaxed"
            placeholder="Текст напоминания…"
          />
        </div>
      </div>
    </Modal>
  )
}
