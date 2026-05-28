import { useState, useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { MessageSquare, Send, X, ArrowLeft, CheckCheck, AlertCircle, Trash2 } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  getSupportChats,
  getSupportMessages,
  createSupportChat,
  sendSupportMessage,
  deleteSupportChat,
  updateSupportChatStatus,
} from '@/services/supportService'
import type { SupportChat, SupportMessage } from '@/services/supportService'
import { supabase } from '@/lib/supabase'

export default function Support() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  const [isChatListOpen, setIsChatListOpen] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [newChatSubject, setNewChatSubject] = useState('')
  const [newChatMessage, setNewChatMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { data: currentUserProfile } = useUserProfile()
  
  useBlockScroll(isNewChatOpen)
  
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  // Загрузка чатов текущего пользователя
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['support_chats', currentUserProfile?.id],
    queryFn: () => getSupportChats(currentUserProfile!.id),
    enabled: !!currentUserProfile?.id
  })

  // Загрузка сообщений выбранного чата
  const { data: messages = [] } = useQuery({
    queryKey: ['support_messages', selectedChat],
    queryFn: () => getSupportMessages(selectedChat!),
    enabled: !!selectedChat,
    refetchInterval: 30000
  })

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Закрыть список чатов на мобильных при выборе чата
  useEffect(() => {
    if (selectedChat && window.innerWidth < 1024) {
      setIsChatListOpen(false)
    }
  }, [selectedChat])

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
    mutationFn: () => {
      if (!currentUserProfile?.id) throw new Error('User not found')
      return createSupportChat(currentUserProfile.id, newChatSubject, newChatMessage)
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
    mutationFn: () => {
      if (!selectedChat || !currentUserProfile?.id) throw new Error('Invalid state')
      return sendSupportMessage(selectedChat, currentUserProfile.id, newMessage)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_messages', selectedChat] })
      setNewMessage('')
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Удаление чата
  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => deleteSupportChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support_chats'] })
      toast.success('Обращение удалено')
      setSelectedChat(null)
    },
    onError: (error: any) => {
      toast.error('Ошибка: ' + error.message)
    }
  })

  // Закрытие чата
  const closeChatMutation = useMutation({
    mutationFn: (chatId: string) => updateSupportChatStatus(chatId, 'closed'),
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

  const handleBackToList = () => {
    setSelectedChat(null)
    setIsChatListOpen(true)
  }

  const formatMessageTime = (date: string) => {
    const messageDate = new Date(date)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (messageDate.toDateString() === today.toDateString()) {
      return messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Вчера ' + messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    } else {
      return messageDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' + 
             messageDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }
  }

  const activeChats = chats.filter((c: SupportChat) => c.status === 'active')
  const closedChats = chats.filter((c: SupportChat) => c.status === 'closed')

  if (chatsLoading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="h-dvh bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Поддержка</h1>
          </div>
          <button
            onClick={() => setIsNewChatOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base"
          >
            <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Новое обращение</span>
            <span className="sm:hidden">Новый чат</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        <div className="h-full flex">
          {/* Список чатов */}
          <div 
            className={`
              ${isChatListOpen ? 'flex' : 'hidden'} 
              lg:flex flex-col bg-white border-r border-gray-200
              w-full lg:w-80 xl:w-96 flex-shrink-0
            `}
          >
            <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0">
              <h2 className="font-semibold text-sm sm:text-base text-gray-900">Мои обращения</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-3 sm:mb-4" />
                  <p className="text-sm sm:text-base text-gray-500 mb-2">Нет обращений</p>
                  <p className="text-xs sm:text-sm text-gray-400">Создайте новое обращение для связи с поддержкой</p>
                </div>
              ) : (
                <>
                  {/* Активные чаты */}
                  {activeChats.length > 0 && (
                    <div>
                      <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Активные ({activeChats.length})</p>
                      </div>
                      {activeChats.map((chat: SupportChat) => (
                        <div
                          key={chat.id}
                          onClick={() => {
                            setSelectedChat(chat.id)
                            if (window.innerWidth < 1024) setIsChatListOpen(false)
                          }}
                          className={`
                            p-3 sm:p-4 cursor-pointer border-b border-gray-100 
                            hover:bg-gray-50 transition-colors
                            ${selectedChat === chat.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}
                          `}
                        >
                          <div className="flex items-start justify-between mb-1 sm:mb-2">
                            <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate pr-2 flex-1">
                              {chat.subject || 'Обращение'}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                Активен
                              </span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const ok = await showConfirm({
                                    title: 'Удалить обращение?',
                                    message: `«${chat.subject || 'Обращение'}» и все сообщения будут удалены безвозвратно.`,
                                    confirmText: 'Удалить',
                                    danger: true,
                                  })
                                  if (ok) deleteChatMutation.mutate(chat.id)
                                }}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Удалить обращение"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatMessageTime(chat.updated_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Закрытые чаты */}
                  {closedChats.length > 0 && (
                    <div>
                      <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Закрытые ({closedChats.length})</p>
                      </div>
                      {closedChats.map((chat: SupportChat) => (
                        <div
                          key={chat.id}
                          onClick={() => {
                            setSelectedChat(chat.id)
                            if (window.innerWidth < 1024) setIsChatListOpen(false)
                          }}
                          className={`
                            p-3 sm:p-4 cursor-pointer border-b border-gray-100 
                            hover:bg-gray-50 transition-colors opacity-60
                            ${selectedChat === chat.id ? 'bg-primary/5 border-l-4 border-l-primary opacity-100' : ''}
                          `}
                        >
                          <div className="flex items-start justify-between mb-1 sm:mb-2">
                            <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate pr-2 flex-1">
                              {chat.subject || 'Обращение'}
                            </h3>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                Закрыт
                              </span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const ok = await showConfirm({
                                    title: 'Удалить обращение?',
                                    message: `«${chat.subject || 'Обращение'}» и все сообщения будут удалены безвозвратно.`,
                                    confirmText: 'Удалить',
                                    danger: true,
                                  })
                                  if (ok) deleteChatMutation.mutate(chat.id)
                                }}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                title="Удалить обращение"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatMessageTime(chat.updated_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Область чата */}
          <div className={`
            ${selectedChat && !isChatListOpen ? 'flex' : 'hidden'} 
            lg:flex flex-col flex-1 bg-white
          `}>
            {selectedChat ? (
              <>
                {/* Заголовок чата */}
                <div className="px-3 sm:px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button
                      onClick={handleBackToList}
                      className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                        {chats.find((c: SupportChat) => c.id === selectedChat)?.subject || 'Чат'}
                      </h2>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        {chats.find((c: SupportChat) => c.id === selectedChat)?.status === 'active' ? (
                          <>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                            Активный чат
                          </>
                        ) : (
                          <>
                            <CheckCheck className="w-3 h-3" />
                            Чат закрыт
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {chats.find((c: SupportChat) => c.id === selectedChat)?.status === 'active' && (
                    <button
                      onClick={() => closeChatMutation.mutate(selectedChat)}
                      className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      Закрыть
                    </button>
                  )}
                </div>

                {/* Сообщения */}
                <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-400">Нет сообщений</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg: SupportMessage, index: number) => {
                        const isOwn = msg.sender_id === currentUserProfile?.id
                        const showDate = index === 0 || 
                          new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                        
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center justify-center my-3 sm:my-4">
                                <div className="px-3 py-1 bg-white rounded-full shadow-sm">
                                  <p className="text-xs text-gray-500">
                                    {new Date(msg.created_at).toLocaleDateString('ru-RU', { 
                                      day: 'numeric', 
                                      month: 'long',
                                      year: new Date(msg.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                    })}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <div className={`
                                max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm
                                ${isOwn 
                                  ? 'bg-primary text-white rounded-br-sm' 
                                  : 'bg-white text-gray-900 rounded-bl-sm'
                                }
                              `}>
                                {!isOwn && msg.sender?.full_name && (
                                  <p className="text-xs font-medium mb-1 text-gray-600">
                                    {msg.sender.full_name}
                                  </p>
                                )}
                                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.message}
                                </p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <p className={`text-xs sm:text-xs ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString('ru-RU', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </p>
                                  {isOwn && (
                                    <CheckCheck className={`w-3 h-3 ${msg.is_read ? 'text-blue-200' : 'text-blue-300'}`} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Форма отправки */}
                {chats.find((c: SupportChat) => c.id === selectedChat)?.status === 'active' ? (
                  <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-gray-200 flex-shrink-0">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Введите сообщение..."
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        autoFocus={window.innerWidth > 768}
                      />
                      <button
                        type="submit"
                        disabled={sendMessageMutation.isPending || !newMessage.trim()}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      >
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Чат закрыт. Создайте новое обращение для продолжения общения.</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <MessageSquare className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Выберите чат</h3>
                <p className="text-sm sm:text-base text-gray-500 mb-4 max-w-sm">
                  Выберите существующий чат из списка или создайте новое обращение
                </p>
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>Новое обращение</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />

      {/* Модальное окно создания чата */}
      {isNewChatOpen && (
        <div className="modal-overlay">
          <div className="bg-white rounded-t-2xl sm:rounded-lg w-full sm:max-w-md sm:w-full animate-slide-up sm:animate-none shadow-xl">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Новое обращение</h2>
              <button 
                onClick={() => setIsNewChatOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleCreateChat} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тема обращения <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newChatSubject}
                  onChange={(e) => setNewChatSubject(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Например: Проблема с оплатой"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Сообщение <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Опишите вашу проблему или вопрос подробно"
                  required
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewChatOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={createChatMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm sm:text-base text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {createChatMutation.isPending ? 'Создание...' : 'Создать обращение'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
