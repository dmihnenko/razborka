import { supabase } from '@/lib/supabase'

// ============================================================================
// TYPES
// ============================================================================

export interface SupportChat {
  id: string
  owner_id: string
  status: 'active' | 'closed'
  subject: string | null
  created_at: string
  updated_at: string
  unread_count?: number
}

export interface SupportMessage {
  id: string
  chat_id: string
  sender_id: string
  message: string
  created_at: string
  is_read: boolean
  sender?: {
    full_name: string | null
  }
}

export interface AdminSupportChat extends SupportChat {
  owner?: {
    full_name: string | null
    username: string | null
    email?: string | null
  }
}

export interface AdminSupportMessage {
  id: string
  chat_id: string
  sender_id: string
  message: string
  created_at: string
  is_read: boolean
  sender?: {
    full_name: string | null
    username: string | null
  }
}

// ============================================================================
// USER SUPPORT FUNCTIONS
// ============================================================================

/** Get all chats owned by a user */
export async function getSupportChats(userId: string): Promise<SupportChat[]> {
  const { data, error } = await supabase
    .from('support_chats')
    .select('*')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as SupportChat[]
}

/** Get messages for a chat (user view — sender full_name only) */
export async function getSupportMessages(chatId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*, sender:user_profiles!sender_id(full_name)')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as SupportMessage[]
}

/** Create a new chat with first message */
export async function createSupportChat(
  userId: string,
  subject: string,
  firstMessage: string
): Promise<SupportChat> {
  const { data: chatData, error: chatError } = await supabase
    .from('support_chats')
    .insert({ owner_id: userId, subject, status: 'active' })
    .select()
    .single()
  if (chatError) throw chatError

  const { error: msgError } = await supabase
    .from('support_messages')
    .insert({ chat_id: chatData.id, sender_id: userId, message: firstMessage })
  if (msgError) throw msgError

  return chatData as SupportChat
}

/** Send a message to a chat */
export async function sendSupportMessage(
  chatId: string,
  senderId: string,
  message: string
): Promise<void> {
  const { error } = await supabase
    .from('support_messages')
    .insert({ chat_id: chatId, sender_id: senderId, message })
  if (error) throw error
}

/** Delete a support chat */
export async function deleteSupportChat(chatId: string): Promise<void> {
  const { error } = await supabase.from('support_chats').delete().eq('id', chatId)
  if (error) throw error
}

/** Update chat status (open / close) */
export async function updateSupportChatStatus(
  chatId: string,
  status: 'active' | 'closed'
): Promise<void> {
  const { error } = await supabase
    .from('support_chats')
    .update({ status })
    .eq('id', chatId)
  if (error) throw error
}

// ============================================================================
// ADMIN SUPPORT FUNCTIONS
// ============================================================================

/** Get all chats with owner info (admin view) */
export async function getAdminSupportChats(
  status?: 'active' | 'closed'
): Promise<AdminSupportChat[]> {
  let query = supabase
    .from('support_chats')
    .select('*, owner:user_profiles!owner_id(full_name, username, email)')
    .order('updated_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) throw error
  return data as AdminSupportChat[]
}

/** Get messages for a chat (admin view — sender full_name + username) */
export async function getAdminSupportMessages(
  chatId: string
): Promise<AdminSupportMessage[]> {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*, sender:user_profiles!sender_id(full_name, username)')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as AdminSupportMessage[]
}

/** Get a single chat with owner info (used in realtime notifications) */
export async function getSupportChatWithOwner(
  chatId: string
): Promise<AdminSupportChat | null> {
  const { data, error } = await supabase
    .from('support_chats')
    .select('*, owner:user_profiles!owner_id(full_name, username)')
    .eq('id', chatId)
    .single()
  if (error) return null
  return data as AdminSupportChat
}
