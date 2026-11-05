import { supabase } from '@/supabase.js'

const ACCOUNTS_KEY = 'stos-accounts'
const USER_KEY = 'stos-user'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function remember(user) {
  const stored = {
    email: typeof user === 'string' ? user : user?.email || '',
    id: typeof user === 'string' ? '' : user?.id || '',
  }
  localStorage.setItem(USER_KEY, JSON.stringify(stored))
  return stored
}

async function hashPassword(password, salt) {
  const encoded = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoded.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoded.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return [...new Uint8Array(bits)].map((value) => value.toString(16).padStart(2, '0')).join('')
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

export function findAccount(email) {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) return { ok: false, error: 'email' }
  const account = readAccounts().find((item) => item.email === normalized)
  if (!account) return { ok: false, error: 'missing' }
  return { ok: true, email: normalized }
}

export async function resetPassword({ email, password }) {
  const normalized = email.trim().toLowerCase()
  if (password.length < 8) return { ok: false, error: 'short' }
  const accounts = readAccounts()
  const account = accounts.find((item) => item.email === normalized)
  if (!account) return { ok: false, error: 'missing' }
  account.salt = crypto.randomUUID()
  account.passwordHash = await hashPassword(password, account.salt)
  writeAccounts(accounts)
  return { ok: true }
}
