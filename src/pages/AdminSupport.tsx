import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Send, Trash2 } from 'lucide-react'

interface Chat {
  id: string
  owner_id: string
  status: 'active' | 'closed'
  subject: string | null
  created_at: string
  updated_at: string
  owner?: {
    full_name: string | null
    username: string | null
  }
}

interface Message {
  id: string
  chat_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: {
    full_name: string | null
    username: string | null
  }
}

export default function AdminSupport() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all')
  const queryClient = useQueryClient()

  // Получаем текущего пользователя (админа)
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // Загрузка всех чатов
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['admin_support_chats', filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('support_chats')
        .select(`
          *,
          owner:user_profiles!owner_id(full_name, username)
        `)
        .order('updated_at', { ascending: false })

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Chat[]
    }
  })

  // Загрузка сообщений выбранного чата
  const { data: messages = [] } = useQuery({
    queryKey: ['admin_support_messages', selectedChat],
    queryFn: async () => {
      if (!selectedChat) return []

      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          *,
          sender:user_profiles!sender_id(full_name, username)
        `)
        .eq('chat_id', selectedChat)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
    enabled: !!selectedChat,
    refetchInterval: 30000 // Автообновление каждые 30 секунд
  })

  // Realtime подписка на новые сообщения в выбранном чате
  useEffect(() => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`admin_chat_${selectedChat}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `chat_id=eq.${selectedChat}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin_support_messages', selectedChat] })
          queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChat, queryClient])

  // Глобальная подписка на все новые сообщения для уведомлений
  useEffect(() => {
    // Запрос разрешения на уведомления
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const channel = supabase
      .channel('admin_all_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages'
        },
        async (payload: any) => {
          const newMessage = payload.new
          
          // Пропускаем если это наше сообщение или сообщение в текущем чате
          if (newMessage.sender_id === currentUser?.id || newMessage.chat_id === selectedChat) {
            return
          }

          // Получаем данные чата и отправителя
          const { data: chatData } = await supabase
            .from('support_chats')
            .select(`
              subject,
              owner:user_profiles!owner_id(full_name, username)
            `)
            .eq('id', newMessage.chat_id)
            .single()

          if (!chatData) return

          const senderName = (chatData.owner as any)?.full_name || (chatData.owner as any)?.username || 'Пользователь'
          const subject = chatData.subject || 'Обращение'

          // Обновляем список чатов
          queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })

          // Toast уведомление
          toast.info(`Новое сообщение в "${subject}"`, {
            description: `От: ${senderName}`,
            action: {
              label: 'Открыть',
              onClick: () => setSelectedChat(newMessage.chat_id)
            }
          })

          // Browser notification если окно не в фокусе
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(`Новое сообщение: ${subject}`, {
              body: `От: ${senderName}\n${newMessage.message.substring(0, 100)}`,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: newMessage.chat_id
            })

            notification.onclick = () => {
              window.focus()
              setSelectedChat(newMessage.chat_id)
              notification.close()
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser?.id, selectedChat, queryClient])

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChat || !currentUser?.id) throw new Error('Invalid state')

      const { error } = await supabase
        .from('support_messages')
        .insert({
          chat_id: selectedChat,
          sender_id: currentUser.id,
          message: newMessage
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_messages', selectedChat] })
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      setNewMessage('')
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Удаление чата
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase
        .from('support_chats')
        .delete()
        .eq('id', chatId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      toast.success('Чат удален')
      setSelectedChat(null)
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Изменение статуса чата
  const updateChatStatusMutation = useMutation({
    mutationFn: async ({ chatId, status }: { chatId: string; status: 'active' | 'closed' }) => {
      const { error } = await supabase
        .from('support_chats')
        .update({ status })
        .eq('id', chatId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      toast.success('Статус обновлен')
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    sendMessageMutation.mutate()
  }

  const selectedChatData = chats.find((c) => c.id === selectedChat)

  if (chatsLoading) {
    return <div className="p-6">Загрузка...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Поддержка пользователей</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Все ({chats.length})
          </button>
          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'active'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Активные
          </button>
          <button
            onClick={() => setFilterStatus('closed')}
            className={`px-3 py-1 rounded ${
              filterStatus === 'closed'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            Закрытые
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список чатов */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Обращения</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Нет обращений</div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => setSelectedChat(chat.id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedChat === chat.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <h3 className="font-medium truncate">
                        {chat.subject || 'Обращение'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {chat.owner?.full_name || chat.owner?.username || 'Неизвестный'}
                      </p>
                    </div>
                    <span
                      className={`text-xs px-2 py-1 rounded ml-2 ${
                        chat.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {chat.status === 'active' ? 'Активен' : 'Закрыт'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(chat.updated_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Чат */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col" style={{ height: '650px' }}>
          {selectedChat ? (
            <>
              <div className="p-4 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-semibold">
                      {selectedChatData?.subject || 'Чат'}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {selectedChatData?.owner?.full_name || selectedChatData?.owner?.username}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {selectedChatData?.status === 'active' ? (
                      <button
                        onClick={() =>
                          updateChatStatusMutation.mutate({
                            chatId: selectedChat,
                            status: 'closed'
                          })
                        }
                        className="text-sm px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Закрыть
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          updateChatStatusMutation.mutate({
                            chatId: selectedChat,
                            status: 'active'
                          })
                        }
                        className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        Открыть
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Вы уверены, что хотите удалить этот чат?')) {
                          deleteChatMutation.mutate(selectedChat)
                        }
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Сообщения */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                  const isAdmin = msg.sender_id === currentUser?.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isAdmin
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {!isAdmin && (
                          <p className="text-xs font-medium mb-1">
                            {msg.sender?.full_name || msg.sender?.username || 'Пользователь'}
                          </p>
                        )}
                        <p className="text-sm mb-1">{msg.message}</p>
                        <p className={`text-xs ${isAdmin ? 'text-purple-100' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Форма отправки */}
              <form onSubmit={handleSendMessage} className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Введите сообщение..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="submit"
                    disabled={sendMessageMutation.isPending || !newMessage.trim()}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Выберите чат для просмотра
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
