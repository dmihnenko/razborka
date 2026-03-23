import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  Database,
  Play,
  Table,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'

// ── known tables grouped by subsystem ────────────────────────────────────────
const TABLE_GROUPS = [
  {
    label: 'Пользователи',
    tables: ['user_profiles', 'roles', 'user_roles'],
  },
  {
    label: 'СТО',
    tables: ['sto_companies', 'customers', 'vehicles', 'appointments', 'work_orders', 'services', 'invoices'],
  },
  {
    label: 'Авторазборка',
    tables: ['parts_companies', 'parts_vehicles', 'parts_inventory', 'parts_orders', 'parts_order_items', 'parts_customers', 'parts_categories'],
  },
  {
    label: 'Система',
    tables: ['subscriptions', 'company_subscriptions', 'trash_bin'],
  },
]

const QUICK_QUERIES = [
  { label: 'Все пользователи', sql: 'SELECT id, full_name, email, username, is_active FROM user_profiles ORDER BY created_at DESC LIMIT 50' },
  { label: 'Все роли', sql: 'SELECT * FROM roles ORDER BY name' },
  { label: 'Активные подписки', sql: "SELECT cs.*, s.name as plan FROM company_subscriptions cs JOIN subscriptions s ON s.id = cs.subscription_id WHERE cs.is_active = true" },
  { label: 'Корзина', sql: 'SELECT id, entity_type, entity_label, deleted_at, expires_at FROM trash_bin ORDER BY deleted_at DESC LIMIT 50' },
  { label: 'Компании СТО', sql: 'SELECT * FROM sto_companies ORDER BY name' },
  { label: 'Компании разборки', sql: 'SELECT * FROM parts_companies ORDER BY name' },
]

// ── component ─────────────────────────────────────────────────────────────────

export default function DatabaseAdmin() {
  const [sql, setSql] = useState('SELECT id, full_name, email, username FROM user_profiles ORDER BY created_at DESC LIMIT 20')
  const [result, setResult] = useState<any[] | null>(null)
  const [execError, setExecError] = useState<string | null>(null)
  const [execTime, setExecTime] = useState<number | null>(null)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ 'Пользователи': true })
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── table row counts ──────────────────────────────────────────────────────
  const { data: counts, refetch: refetchCounts } = useQuery({
    queryKey: ['db-admin-counts'],
    queryFn: async () => {
      const allTables = TABLE_GROUPS.flatMap(g => g.tables)
      const results = await Promise.all(
        allTables.map(t =>
          supabase.from(t as any).select('*', { count: 'exact', head: true }).then(({ count }) => [t, count ?? 0] as const)
        )
      )
      return Object.fromEntries(results) as Record<string, number>
    },
    staleTime: 30_000,
  })

  // ── execute SQL via edge function ─────────────────────────────────────────
  const executeMutation = useMutation({
    mutationFn: async (query: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Нет сессии')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-sql`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ query }),
        }
      )

      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Ошибка запроса')
      return json.data as any[]
    },
    onSuccess: (data, _vars, _ctx) => {
      setResult(data ?? [])
      setExecError(null)
    },
    onError: (err: any) => {
      setExecError(err.message)
      setResult(null)
    },
  })

  const handleRun = () => {
    const query = sql.trim()
    if (!query) return
    setExecTime(null)
    const start = Date.now()
    executeMutation.mutate(query, {
      onSettled: () => setExecTime(Date.now() - start),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }

  const handleQuick = (querySql: string) => {
    setSql(querySql)
    setResult(null)
    setExecError(null)
    textareaRef.current?.focus()
  }

  const handleTableClick = (table: string) => {
    setSql(`SELECT * FROM ${table} LIMIT 50`)
    setResult(null)
    setExecError(null)
  }

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const copyResult = () => {
    if (!result) return
    navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    toast.success('Скопировано в буфер')
  }

  const columns = result && result.length > 0 ? Object.keys(result[0]) : []

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-6 h-6 text-orange-600" />
            База данных
          </h1>
          <p className="text-sm text-gray-500 mt-1">SQL-редактор · только admin</p>
        </div>
        <button
          onClick={() => refetchCounts()}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: table browser ─────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 bg-white border border-gray-200 rounded-lg overflow-y-auto">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Таблицы</p>
          </div>
          {TABLE_GROUPS.map(group => (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <span>{group.label}</span>
                {openGroups[group.label]
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {openGroups[group.label] && group.tables.map(t => (
                <button
                  key={t}
                  onClick={() => handleTableClick(t)}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 group"
                >
                  <span className="flex items-center gap-1.5">
                    <Table className="w-3 h-3 text-gray-400 group-hover:text-orange-400" />
                    {t}
                  </span>
                  {counts?.[t] !== undefined && (
                    <span className="text-gray-400 tabular-nums">{counts[t].toLocaleString('ru-RU')}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* ── Right: editor + results ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Quick queries */}
          <div className="flex flex-wrap gap-2">
            {QUICK_QUERIES.map(q => (
              <button
                key={q.label}
                onClick={() => handleQuick(q.sql)}
                className="px-2.5 py-1 text-xs bg-white border border-gray-200 rounded-md hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* SQL editor */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-mono">SQL</span>
              <span className="text-xs text-gray-400">Ctrl+Enter — выполнить</span>
            </div>
            <textarea
              ref={textareaRef}
              value={sql}
              onChange={e => setSql(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              spellCheck={false}
              className="w-full px-4 py-3 font-mono text-sm text-gray-900 bg-white outline-none resize-y"
              placeholder="SELECT * FROM user_profiles LIMIT 10"
            />
            <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {execTime !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {execTime} мс
                  </span>
                )}
                {result !== null && !execError && (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    {result.length} строк
                  </span>
                )}
                {execError && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" />
                    Ошибка
                  </span>
                )}
              </div>
              <button
                onClick={handleRun}
                disabled={executeMutation.isPending}
                className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md disabled:opacity-50 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                {executeMutation.isPending ? 'Запрос...' : 'Выполнить'}
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Только SELECT запросы. DROP TABLE, TRUNCATE и DELETE FROM auth заблокированы.
          </div>

          {/* Error */}
          {execError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 mb-1">Ошибка выполнения</p>
              <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{execError}</pre>
            </div>
          )}

          {/* Results table */}
          {result !== null && !execError && (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex-1">
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">
                  Результат · {result.length} строк
                </span>
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Копировать JSON
                </button>
              </div>
              {result.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">Запрос выполнен, результат пуст</div>
              ) : (
                <div className="overflow-auto max-h-96">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-400 font-medium">#</th>
                        {columns.map(col => (
                          <th key={col} className="px-3 py-2 text-left text-gray-700 font-medium whitespace-nowrap border-l border-gray-100">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {result.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                          {columns.map(col => (
                            <td key={col} className="px-3 py-1.5 border-l border-gray-100 max-w-xs truncate text-gray-700 font-mono">
                              {row[col] === null
                                ? <span className="text-gray-300 italic">null</span>
                                : typeof row[col] === 'object'
                                  ? JSON.stringify(row[col])
                                  : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
