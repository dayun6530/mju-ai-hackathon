import { supabase } from '@/supabase.js'
import { supabasePublishableKey, supabaseUrl } from '@/supabasePublic.js'

const USER_KEY = 'stos-user'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function remember(user) {
  const stored = {
    email: typeof user === 'string' ? user : user?.email || '',
    id: typeof user === 'string' ? '' : user?.id || '',
  }
  localStorage.setItem(USER_KEY, JSON.stringify(stored))
  return stored
}

export function getUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
    if (!parsed || typeof parsed.email !== 'string') return null
    return { email: parsed.email, id: typeof parsed.id === 'string' ? parsed.id : '' }
  } catch {
    return null
  }
}

export function logout() {
  localStorage.removeItem(USER_KEY)
  void supabase?.auth.signOut()
}

function authError(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('already registered') || message.includes('already exists')) return 'exists'
  if (message.includes('password') && (message.includes('at least') || message.includes('weak') || message.includes('short'))) return 'short'
  if (message.includes('invalid') && message.includes('email')) return 'email'
  if (message.includes('not confirmed')) return 'confirm'
  if (message.includes('rate limit')) return 'rate'
  return 'invalid'
}

export async function signup({ email, password }) {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) return { ok: false, error: 'email' }
  if (password.length < 8) return { ok: false, error: 'short' }
  if (!supabase) return { ok: false, error: 'config' }
  const { data, error } = await supabase.auth.signUp({
    email: normalized,
    password,
    options: { emailRedirectTo: window.location.origin },
  })
  if (error) return { ok: false, error: authError(error) }
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, error: 'exists' }
  }
  if (!data.session) return { ok: true, pending: true }
  return { ok: true, user: remember(data.user || { email: normalized }) }
}

export async function login({ email, password }) {
  const normalized = email.trim().toLowerCase()
  if (!supabase) return { ok: false, error: 'config' }
  const { data, error } = await supabase.auth.signInWithPassword({ email: normalized, password })
  if (error) return { ok: false, error: authError(error) }
  return { ok: true, user: remember(data.user || { email: normalized }) }
}

async function recovery(body) {
  if (!supabase) return { error: 'config' }
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
      method: 'POST',
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    return await response.json()
  } catch {
    return { error: 'invalid' }
  }
}

export async function findAccount(email) {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) return { ok: false, error: 'email' }
  const result = await recovery({ email: normalized })
  if (result.error === 'missing') return { ok: false, error: 'missing' }
  if (result.error) return { ok: false, error: result.error === 'config' ? 'config' : 'invalid' }
  return { ok: true, email: normalized }
}

export async function resetPassword({ email, password }) {
  const normalized = email.trim().toLowerCase()
  if (password.length < 8) return { ok: false, error: 'short' }
  const result = await recovery({ email: normalized, password })
  if (result.error === 'missing') return { ok: false, error: 'missing' }
  if (result.error === 'short') return { ok: false, error: 'short' }
  if (result.error || result.ok !== true) return { ok: false, error: 'invalid' }
  return { ok: true }
}
