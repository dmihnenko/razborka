import { useState, useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { 
  Send, 
  Trash2, 
  ArrowLeft, 
  CheckCheck, 
  MessageSquare,
  Search,
  Archive,
  MoreVertical,
  Users
} from 'lucide-react'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import {
  getAdminSupportChats,
  getAdminSupportMessages,
  getSupportChatWithOwner,
  sendSupportMessage,
  deleteSupportChat,
  updateSupportChatStatus,
} from '@/services/supportService'
import type { AdminSupportChat, AdminSupportMessage } from '@/services/supportService'
import { supabase } from '@/lib/supabase'

export default function AdminSupport() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [isChatListOpen, setIsChatListOpen] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showChatMenu, setShowChatMenu] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  // Получаем текущего пользователя (админа)
  const { data: currentUser } = useQuery({
    queryKey: ['current_user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user
    }
  })

  // Закрыть список чатов на мобильных при выборе чата
  useEffect(() => {
    if (selectedChat && window.innerWidth < 1024) {
      setIsChatListOpen(false)
    }
  }, [selectedChat])

  // Загрузка всех чатов
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ['admin_support_chats', filterStatus],
    queryFn: () => getAdminSupportChats(filterStatus === 'all' ? undefined : filterStatus)
  })

  // Загрузка сообщений выбранного чата
  const { data: messages = [] } = useQuery({
    queryKey: ['admin_support_messages', selectedChat],
    queryFn: () => getAdminSupportMessages(selectedChat!),
    enabled: !!selectedChat,
  })

  // Автопрокрутка к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Realtime подписка
  useEffect(() => {
    const chatsChannel = supabase
      .channel('admin_all_chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_chats' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      })
      .subscribe()

    const messagesChannel = supabase
      .channel('admin_all_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, 
        async (payload) => {
          const incomingMessage = payload.new as AdminSupportMessage

          if (incomingMessage.sender_id !== currentUser?.id) {
            queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
            
            if (selectedChat === incomingMessage.chat_id) {
              queryClient.invalidateQueries({ queryKey: ['admin_support_messages', selectedChat] })
            }

            const chatData = await getSupportChatWithOwner(incomingMessage.chat_id)
            if (!chatData) return

            const senderName = chatData.owner?.full_name || chatData.owner?.username || 'Пользователь'
            const subject = chatData.subject || 'Обращение'

            toast.info(`Новое сообщение в "${subject}"`, {
              description: `От: ${senderName}`,
              action: {
                label: 'Открыть',
                onClick: () => {
                  setSelectedChat(incomingMessage.chat_id)
                  if (window.innerWidth < 1024) setIsChatListOpen(false)
                }
              }
            })

            if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification(`Новое сообщение: ${subject}`, {
                body: `От: ${senderName}\n${incomingMessage.message.substring(0, 100)}`,
                icon: '/favicon.ico',
                tag: incomingMessage.chat_id
              })
              notification.onclick = () => {
                window.focus()
                setSelectedChat(incomingMessage.chat_id)
                notification.close()
              }
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(chatsChannel)
      supabase.removeChannel(messagesChannel)
    }
  }, [currentUser?.id, selectedChat, queryClient])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const sendMessageMutation = useMutation({
    mutationFn: () => {
      if (!selectedChat || !currentUser?.id) throw new Error('Invalid state')
      return sendSupportMessage(selectedChat, currentUser.id, newMessage)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_messages', selectedChat] })
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      setNewMessage('')
    },
    onError: (error: any) => toast.error('Ошибка: ' + error.message)
  })

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => deleteSupportChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      toast.success('Чат удален')
      setSelectedChat(null)
      setShowChatMenu(null)
    },
    onError: (error: any) => toast.error('Ошибка: ' + error.message)
  })

  const updateChatStatusMutation = useMutation({
    mutationFn: ({ chatId, status }: { chatId: string; status: 'active' | 'closed' }) =>
      updateSupportChatStatus(chatId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_support_chats'] })
      toast.success('Статус обновлен')
      setShowChatMenu(null)
    },
    onError: (error: any) => toast.error('Ошибка: ' + error.message)
  })

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    sendMessageMutation.mutate()
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

  const filteredChats = chats.filter((chat: AdminSupportChat) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      chat.subject?.toLowerCase().includes(query) ||
      chat.owner?.full_name?.toLowerCase().includes(query) ||
      chat.owner?.username?.toLowerCase().includes(query) ||
      chat.owner?.email?.toLowerCase().includes(query)
    )
  })

  const activeChats = filteredChats.filter((c: AdminSupportChat) => c.status === 'active')
  const closedChats = filteredChats.filter((c: AdminSupportChat) => c.status === 'closed')

  const stats = {
    total: chats.length,
    active: chats.filter((c: AdminSupportChat) => c.status === 'active').length,
    closed: chats.filter((c: AdminSupportChat) => c.status === 'closed').length
  }

  if (chatsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Spinner size="md" />
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Поддержка</h1>
              <p className="text-xs sm:text-sm text-gray-500">Админ-панель</p>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 sm:gap-4">
            <div className="text-center px-3 py-1 bg-green-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">{stats.active}</p>
              <p className="text-[10px] text-gray-600">Активных</p>
            </div>
            <div className="text-center px-3 py-1 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-600">{stats.closed}</p>
              <p className="text-[10px] text-gray-600">Закрытых</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full">
        <div className="h-full flex">
          <div className={`${isChatListOpen ? 'flex' : 'hidden'} lg:flex flex-col bg-white border-r border-gray-200 w-full lg:w-80 xl:w-96 flex-shrink-0`}>
            <div className="p-3 sm:p-4 border-b border-gray-200 space-y-3 flex-shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по чатам..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => setFilterStatus('all')} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Все ({stats.total})
                </button>
                <button onClick={() => setFilterStatus('active')} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterStatus === 'active' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Активные ({stats.active})
                </button>
                <button onClick={() => setFilterStatus('closed')} className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterStatus === 'closed' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Закрытые ({stats.closed})
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  {searchQuery ? (
                    <>
                      <Search className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-3" />
                      <p className="text-sm sm:text-base text-gray-500">Ничего не найдено</p>
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-gray-300 mb-3" />
                      <p className="text-sm sm:text-base text-gray-500 mb-2">Нет обращений</p>
                      <p className="text-xs sm:text-sm text-gray-400">
                        {filterStatus === 'active' ? 'Нет активных чатов' : filterStatus === 'closed' ? 'Нет закрытых чатов' : 'Пользователи еще не создали обращения'}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {filterStatus !== 'closed' && activeChats.length > 0 && (
                    <div>
                      {filterStatus === 'all' && (
                        <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            Активные ({activeChats.length})
                          </p>
                        </div>
                      )}
                      {activeChats.map((chat: AdminSupportChat) => (
                        <div key={chat.id} onClick={() => { setSelectedChat(chat.id); if (window.innerWidth < 1024) setIsChatListOpen(false) }}
                          className={`p-3 sm:p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors relative ${selectedChat === chat.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 pr-2">
                              <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate">{chat.subject || 'Обращение'}</h3>
                              <p className="text-xs text-gray-600 truncate">{chat.owner?.full_name || chat.owner?.username || chat.owner?.email || 'Пользователь'}</p>
                            </div>
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                              Активен
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">{formatMessageTime(chat.updated_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {filterStatus !== 'active' && closedChats.length > 0 && (
                    <div>
                      {filterStatus === 'all' && (
                        <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide flex items-center gap-2">
                            <Archive className="w-3 h-3" />
                            Закрытые ({closedChats.length})
                          </p>
                        </div>
                      )}
                      {closedChats.map((chat: AdminSupportChat) => (
                        <div key={chat.id} onClick={() => { setSelectedChat(chat.id); if (window.innerWidth < 1024) setIsChatListOpen(false) }}
                          className={`p-3 sm:p-4 cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors opacity-60 ${selectedChat === chat.id ? 'bg-primary/5 border-l-4 border-l-primary opacity-100' : ''}`}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 pr-2">
                              <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate">{chat.subject || 'Обращение'}</h3>
                              <p className="text-xs text-gray-600 truncate">{chat.owner?.full_name || chat.owner?.username || 'Пользователь'}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">Закрыт</span>
                          </div>
                          <p className="text-xs text-gray-500">{formatMessageTime(chat.updated_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className={`${selectedChat && !isChatListOpen ? 'flex' : 'hidden'} lg:flex flex-col flex-1 bg-white`}>
            {selectedChat ? (
              <>
                <div className="px-3 sm:px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button onClick={handleBackToList} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{chats.find((c: AdminSupportChat) => c.id === selectedChat)?.subject || 'Чат'}</h2>
                      <p className="text-xs text-gray-500 truncate">{chats.find((c: AdminSupportChat) => c.id === selectedChat)?.owner?.full_name || chats.find((c: AdminSupportChat) => c.id === selectedChat)?.owner?.username || 'Пользователь'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {chats.find((c: AdminSupportChat) => c.id === selectedChat)?.status === 'active' ? (
                      <button onClick={() => updateChatStatusMutation.mutate({ chatId: selectedChat, status: 'closed' })}
                        className="text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <Archive className="w-4 h-4 sm:hidden" />
                        <span className="hidden sm:inline">Закрыть</span>
                      </button>
                    ) : (
                      <button onClick={() => updateChatStatusMutation.mutate({ chatId: selectedChat, status: 'active' })}
                        className="text-xs sm:text-sm font-medium px-2 sm:px-3 py-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                        Открыть
                      </button>
                    )}
                    
                    <div className="relative">
                      <button onClick={() => setShowChatMenu(showChatMenu === selectedChat ? null : selectedChat)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {showChatMenu === selectedChat && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowChatMenu(null)} />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                            <button onClick={async () => { const ok = await showConfirm({ message: 'Удалить этот чат? Это действие нельзя отменить.', danger: true }); if (!ok) return; deleteChatMutation.mutate(selectedChat) }}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2">
                              <Trash2 className="w-4 h-4" />
                              Удалить чат
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3 sm:space-y-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-gray-400">Нет сообщений</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg: AdminSupportMessage, index: number) => {
                        const isAdmin = msg.sender_id === currentUser?.id
                        const showDate = index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                        
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center justify-center my-3 sm:my-4">
                                <div className="px-3 py-1 bg-white rounded-full shadow-sm">
                                  <p className="text-xs text-gray-500">{new Date(msg.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: new Date(msg.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })}</p>
                                </div>
                              </div>
                            )}
                            <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm ${isAdmin ? 'bg-primary text-white rounded-br-sm' : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200'}`}>
                                {!isAdmin && msg.sender?.full_name && (
                                  <p className="text-xs font-medium mb-1 text-primary">{msg.sender.full_name}</p>
                                )}
                                <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                                <div className="flex items-center justify-end gap-1 mt-1">
                                  <p className={`text-[10px] sm:text-xs ${isAdmin ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                                  {isAdmin && <CheckCheck className="w-3 h-3 text-blue-200" />}
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

                {chats.find((c: AdminSupportChat) => c.id === selectedChat)?.status === 'active' ? (
                  <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white border-t border-gray-200 flex-shrink-0">
                    <div className="flex gap-2">
                      <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Введите сообщение..."
                        className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        autoFocus={window.innerWidth > 768} />
                      <button type="submit" disabled={sendMessageMutation.isPending || !newMessage.trim()}
                        className="px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
                      <Archive className="w-4 h-4" />
                      <span>Чат закрыт</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                <Users className="w-16 h-16 sm:w-20 sm:h-20 text-gray-300 mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Выберите чат</h3>
                <p className="text-sm sm:text-base text-gray-500 max-w-sm">Выберите чат из списка слева для просмотра сообщений и ответа пользователю</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
