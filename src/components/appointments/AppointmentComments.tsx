import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AppointmentComment } from '@/types/appointments'

interface Props {
  appointmentId: string
  stoCompanyId: string
}

export default function AppointmentComments({ appointmentId, stoCompanyId }: Props) {
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: comments = [], isLoading } = useQuery<AppointmentComment[]>({
    queryKey: ['appointment-comments', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment_comments')
        .select('*, author_profile:user_profiles(full_name, email)')
        .eq('appointment_id', appointmentId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as AppointmentComment[]
    },
    enabled: !!appointmentId,
  })

  useEffect(() => {
    if (comments.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [comments.length])

  const addMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const { error } = await supabase
        .from('appointment_comments')
        .insert({
          appointment_id: appointmentId,
          sto_company_id: stoCompanyId,
          user_id: profile?.id,
          text: commentText.trim(),
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-comments', appointmentId] })
      setText('')
    },
    onError: () => toast.error('Ошибка при добавлении комментария'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('appointment_comments')
        .delete()
        .eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-comments', appointmentId] })
    },
    onError: () => toast.error('Ошибка при удалении комментария'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    addMutation.mutate(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (text.trim()) addMutation.mutate(text)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })

  const authorName = (c: AppointmentComment) =>
    c.author_profile?.full_name || c.author_profile?.email || 'Неизвестно'

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="heading-mobile-2 mb-4 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
        Комментарии
        {comments.length > 0 && (
          <span className="text-sm font-normal text-gray-400">({comments.length})</span>
        )}
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-mobile-sm text-gray-400 italic mb-4">Нет комментариев. Будьте первым!</p>
      ) : (
        <div className="space-y-2 mb-4 max-h-80 overflow-y-auto pr-1">
          {comments.map((comment) => {
            const isMe = comment.user_id === profile?.id
            return (
              <div
                key={comment.id}
                className={`relative group flex flex-col gap-1 p-3 rounded-lg ${
                  isMe
                    ? 'bg-blue-50 border border-blue-100'
                    : 'bg-gray-50 border border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {authorName(comment)}
                    {isMe && <span className="text-blue-500 ml-1">(Вы)</span>}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                    {isMe && (
                      <button
                        onClick={() => deleteMutation.mutate(comment.id)}
                        disabled={deleteMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                        title="Удалить комментарий"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-mobile-sm text-gray-800 whitespace-pre-wrap break-words">{comment.text}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Добавить комментарий… (Enter — отправить, Shift+Enter — новая строка)"
          rows={2}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim() || addMutation.isPending}
          className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 self-end"
          title="Отправить"
        >
          {addMutation.isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  )
}
