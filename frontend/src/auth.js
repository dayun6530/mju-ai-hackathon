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

function remember(email) {
  const user = { email }
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  return user
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
    return { email: parsed.email }
  } catch {
    return null
  }
}

export function logout() {
  localStorage.removeItem(USER_KEY)
}

export async function signup({ email, password }) {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) return { ok: false, error: 'email' }
  if (password.length < 8) return { ok: false, error: 'short' }
  const accounts = readAccounts()
  if (accounts.some((account) => account.email === normalized)) return { ok: false, error: 'exists' }
  const salt = crypto.randomUUID()
  accounts.push({ email: normalized, salt, passwordHash: await hashPassword(password, salt) })
  writeAccounts(accounts)
  return { ok: true, user: remember(normalized) }
}

export async function login({ email, password }) {
  const normalized = email.trim().toLowerCase()
  const account = readAccounts().find((item) => item.email === normalized)
  if (!account) return { ok: false, error: 'invalid' }
  const passwordHash = await hashPassword(password, account.salt)
  if (passwordHash !== account.passwordHash) return { ok: false, error: 'invalid' }
  return { ok: true, user: remember(normalized) }
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
