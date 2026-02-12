import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { MessageSquare, Send, X } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Chat {
  id: string
  owner_id: string
  status: 'active' | 'closed'
  subject: string | null
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  chat_id: string
  sender_id: string
  message: string
  created_at: string
  sender?: {
    full_name: string | null
  }
}

export default function Support() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [newChatSubject, setNewChatSubject] = useState('')
  const [newChatMessage, setNewChatMessage] = useState('')
  const { data: currentUserProfile } = useUserProfile()
  const queryClient = useQueryClient()

  // Загрузка чатов текущего пользователя
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['support_chats', currentUserProfile?.id],
    queryFn: async () => {
      if (!currentUserProfile?.id) return []
      
      const { data, error } = await supabase
        .from('support_chats')
        .select('*')
        .eq('owner_id', currentUserProfile.id)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data as Chat[]
    },
    enabled: !!currentUserProfile?.id
  })

  // Загрузка сообщений выбранного чата
  const { data: messages = [] } = useQuery({
    queryKey: ['support_messages', selectedChat],
    queryFn: async () => {
      if (!selectedChat) return []

      const { data, error } = await supabase
        .from('support_messages')
        .select(`
          *,
          sender:user_profiles!sender_id(full_name)
        `)
        .eq('chat_id', selectedChat)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Message[]
    },
    enabled: !!selectedChat,
    refetchInterval: 30000 // Автообновление каждые 30 секунд
  })

  // Realtime подписка на новые сообщения
  useEffect(() => {
    if (!selectedChat) return

    const channel = supabase
      .channel(`chat_${selectedChat}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `chat_id=eq.${selectedChat}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['support_messages', selectedChat] })
          queryClient.invalidateQueries({ queryKey: ['support_chats'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedChat, queryClient])

  // Создание нового чата
  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserProfile?.id) throw new Error('User not found')

      // Создаем чат
      const { data: chatData, error: chatError } = await supabase
        .from('support_chats')
        .insert({
          owner_id: currentUserProfile.id,
          subject: newChatSubject,
          status: 'active'
        })
        .select()
        .single()

      if (chatError) throw chatError

      // Создаем первое сообщение
      const { error: messageError } = await supabase
        .from('support_messages')
        .insert({
          chat_id: chatData.id,
          sender_id: currentUserProfile.id,
          message: newChatMessage
        })

      if (messageError) throw messageError

      return chatData
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['support_chats'] })
      toast.success('Чат создан')
      setIsNewChatOpen(false)
      setNewChatSubject('')
      setNewChatMessage('')
      setSelectedChat(data.id)
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!selectedChat || !currentUserProfile?.id) throw new Error('Invalid state')

      const { error } = await supabase
        .from('support_messages')
        .insert({
          chat_id: selectedChat,
          sender_id: currentUserProfile.id,
          message: newMessage
        })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_messages', selectedChat] })
      setNewMessage('')
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Закрытие чата
  const closeChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const { error } = await supabase
        .from('support_chats')
        .update({ status: 'closed' })
        .eq('id', chatId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_chats'] })
      toast.success('Чат закрыт')
      setSelectedChat(null)
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

  const handleCreateChat = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChatSubject.trim() || !newChatMessage.trim()) {
      toast.error('Заполните все поля')
      return
    }
    createChatMutation.mutate()
  }

  if (chatsLoading) {
    return <div className="p-6">Загрузка...</div>
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Поддержка</h1>
        <button
          onClick={() => setIsNewChatOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <MessageSquare className="w-5 h-5" />
          <span>Новое обращение</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Список чатов */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Мои обращения</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Нет обращений
              </div>
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
                    <h3 className="font-medium truncate">
                      {chat.subject || 'Обращение'}
                    </h3>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
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
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold">
                  {chats.find((c) => c.id === selectedChat)?.subject || 'Чат'}
                </h2>
                <button
                  onClick={() => closeChatMutation.mutate(selectedChat)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Закрыть чат
                </button>
              </div>

              {/* Сообщения */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUserProfile?.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          isOwn
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm mb-1">{msg.message}</p>
                        <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
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
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={sendMessageMutation.isPending || !newMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Выберите чат или создайте новое обращение
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания чата */}
      {isNewChatOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Новое обращение</h2>
              <button onClick={() => setIsNewChatOpen(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateChat} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тема обращения *
                </label>
                <input
                  type="text"
                  value={newChatSubject}
                  onChange={(e) => setNewChatSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Краткое описание проблемы"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сообщение *
                </label>
                <textarea
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Опишите вашу проблему или вопрос"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createChatMutation.isPending}
                  className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {createChatMutation.isPending ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
