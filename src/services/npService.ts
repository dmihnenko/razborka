import { getNpApiKey } from '@/utils/npApiKey'
import { getNpConfig } from '@/utils/npConfig'

const NP_API_URL = 'https://api.novaposhta.ua/v2.0/json/'

interface NpResponse<T = unknown> {
  success: boolean
  errors: string[]
  data: T[]
}

async function npRequest<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>
): Promise<T[]> {
  const apiKey = getNpApiKey()
  if (!apiKey) {
    throw new Error('Укажите API-ключ Новой почты в настройках')
  }

  const res = await fetch(NP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, modelName, calledMethod, methodProperties }),
  })

  if (!res.ok) {
    throw new Error(`Ошибка сети: ${res.status}`)
  }

  const json: NpResponse<T> = await res.json()

  if (!json.success) {
    throw new Error(json.errors?.[0] || 'Ошибка API Новой почты')
  }

  return json.data
}

/* ─── Типы ────────────────────────────────────────────────────────── */

export interface NpCity {
  ref: string
  name: string
  area?: string
}

export interface NpWarehouse {
  ref: string
  description: string
}

/* ─── Адрес-запись из searchSettlements ─── */
interface NpSettlementAddress {
  Present: string
  DeliveryCity: string
}

interface NpSettlementGroup {
  Addresses: NpSettlementAddress[]
}

/* ─── Отделение из getWarehouses ─── */
interface NpWarehouseRaw {
  Ref: string
  Description: string
}

/* ─── Counterparty raw types ──────────────────────────────────────── */
interface NpCounterpartyRaw {
  Ref: string
  ContactPerson?: { data?: Array<{ Ref: string }> }
}

interface NpContactPersonRaw {
  Ref: string
}

interface NpInternetDocumentRaw {
  IntDocNumber: string
  Ref: string
}

/* ─── API-функции ─────────────────────────────────────────────────── */

/**
 * Поиск населённых пунктов по строке.
 * Возвращает [] при q < 2 символов.
 */
export async function searchCities(q: string): Promise<NpCity[]> {
  if (q.length < 2) return []

  const data = await npRequest<NpSettlementGroup>(
    'Address',
    'searchSettlements',
    { CityName: q, Limit: '20' }
  )

  const group = data[0]
  if (!group || !Array.isArray(group.Addresses)) return []

  return group.Addresses.map((a) => ({
    ref: a.DeliveryCity,
    name: a.Present,
  }))
}

/**
 * Список отделений НП в указанном городе (опционально с фильтром по строке).
 */
export async function searchWarehouses(
  cityRef: string,
  q?: string
): Promise<NpWarehouse[]> {
  const data = await npRequest<NpWarehouseRaw>(
    'Address',
    'getWarehouses',
    { CityRef: cityRef, FindByString: q || '', Limit: '50' }
  )

  return data.map((w) => ({
    ref: w.Ref,
    description: w.Description,
  }))
}

/* ─── TTN helpers ─────────────────────────────────────────────────── */

/**
 * Получает Ref первого контрагента-отправителя из кабинета НП.
 */
export async function getSenderCounterpartyRef(): Promise<string> {
  const data = await npRequest<NpCounterpartyRaw>(
    'Counterparty',
    'getCounterparties',
    { CounterpartyProperty: 'Sender', Page: '1' }
  )
  if (!data[0]?.Ref) throw new Error('Не найден контрагент-отправитель в кабинете НП')
  return data[0].Ref
}

/**
 * Получает Ref первого контактного лица указанного контрагента.
 */
export async function getSenderContactRef(counterpartyRef: string): Promise<string> {
  const data = await npRequest<NpContactPersonRaw>(
    'Counterparty',
    'getCounterpartyContactPersons',
    { Ref: counterpartyRef, Page: '1' }
  )
  if (!data[0]?.Ref) throw new Error('Не найдено контактное лицо отправителя в кабинете НП')
  return data[0].Ref
}

/**
 * Приводит украинский номер к формату 380XXXXXXXXX (требование API Новой почты).
 * Принимает любые варианты ввода: +38 (095)…, 095…, 80…, 38095…, голые 9 цифр.
 */
export function formatUaPhone(raw: string): string {
  let d = (raw || '').replace(/\D/g, '')
  if (d.startsWith('380')) {
    // уже в нужном формате
  } else if (d.startsWith('80')) {
    d = '3' + d            // 80XXXXXXXXX → 380XXXXXXXXX
  } else if (d.startsWith('0')) {
    d = '38' + d           // 0XXXXXXXXX → 380XXXXXXXXX
  } else if (d.length === 9) {
    d = '380' + d          // XXXXXXXXX → 380XXXXXXXXX (без ведущего 0)
  }
  return d
}

/**
 * Создаёт получателя (физическое лицо) и возвращает его Ref и contactRef.
 */
export async function createRecipientPrivatePerson(params: {
  firstName: string
  lastName: string
  phone: string
}): Promise<{ ref: string; contactRef: string | undefined }> {
  const data = await npRequest<NpCounterpartyRaw>(
    'Counterparty',
    'save',
    {
      FirstName: params.firstName,
      LastName: params.lastName,
      Phone: params.phone,
      CounterpartyType: 'PrivatePerson',
      CounterpartyProperty: 'Recipient',
    }
  )
  if (!data[0]?.Ref) throw new Error('Не вдалося створити одержувача в НП')
  return {
    ref: data[0].Ref,
    contactRef: data[0].ContactPerson?.data?.[0]?.Ref,
  }
}

export interface CreateTtnParams {
  recipientCityRef: string
  recipientWarehouseRef: string
  recipientName: string
  recipientPhone: string
  description?: string
  cost?: number
  weight?: number
}

/**
 * Создаёт ТТН (накладную) Новой почты.
 * Требует заполненного отправителя в Настройках → Новая почта.
 */
export async function createTtn(
  p: CreateTtnParams
): Promise<{ ttn: string; ref: string }> {
  const sender = getNpConfig()

  if (!sender.senderCityRef || !sender.senderWarehouseRef || !sender.senderPhone) {
    throw new Error('Заполните отправителя в Настройках → Новая почта')
  }

  const [senderCounterparty, ] = await Promise.all([getSenderCounterpartyRef()])
  const senderContact = await getSenderContactRef(senderCounterparty)

  // Разбиваем имя получателя на имя и фамилию
  const nameParts = p.recipientName.trim().split(/\s+/)
  const lastName = nameParts[0] || 'Клієнт'
  const firstName = nameParts.slice(1).join(' ') || 'Клієнт'

  // Номер получателя — строго в формате 380XXXXXXXXX (иначе НП отклоняет)
  const recipientPhone = formatUaPhone(p.recipientPhone)

  const recipient = await createRecipientPrivatePerson({
    firstName,
    lastName,
    phone: recipientPhone,
  })

  // Используем npRequest напрямую через fetch, т.к. InternetDocument/save
  // возвращает иной shape — но success/errors такой же, так что используем npRequest
  // с кастомным типом:
  const apiKey = getNpApiKey()
  if (!apiKey) throw new Error('Укажите API-ключ Новой почты в настройках')

  const body = {
    apiKey,
    modelName: 'InternetDocument',
    calledMethod: 'save',
    methodProperties: {
      PayerType: 'Recipient',
      PaymentMethod: 'Cash',
      CargoType: 'Parcel',
      Weight: String(p.weight ?? 1),
      ServiceType: 'WarehouseWarehouse',
      SeatsAmount: '1',
      Description: p.description || 'Автозапчастини',
      Cost: String(p.cost ?? 500),
      CitySender: sender.senderCityRef,
      Sender: senderCounterparty,
      SenderAddress: sender.senderWarehouseRef,
      ContactSender: senderContact,
      SendersPhone: sender.senderPhone,
      CityRecipient: p.recipientCityRef,
      Recipient: recipient.ref,
      RecipientAddress: p.recipientWarehouseRef,
      ContactRecipient: recipient.contactRef ?? '',
      RecipientsPhone: recipientPhone,
    },
  }

  const res = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Помилка мережі: ${res.status}`)

  const json = await res.json() as { success: boolean; errors: string[]; data: NpInternetDocumentRaw[] }

  if (!json.success) {
    const msg = (json.errors ?? []).filter(Boolean).join('; ') || 'Ошибка API Новой почты'
    throw new Error(msg)
  }

  const doc = json.data?.[0]
  if (!doc?.IntDocNumber) throw new Error('НП не повернула номер ТТН')

  return { ttn: doc.IntDocNumber, ref: doc.Ref }
}
