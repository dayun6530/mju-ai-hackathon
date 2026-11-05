import { useEffect, useRef, useState } from 'react'
import { findAccount, login, resetPassword, signup } from '@/auth.js'

const fieldClass =
  'h-[3.25rem] w-full rounded-xl border border-[#e6e6ee] px-4 text-[15px] text-black outline-none placeholder:text-[#b4b4c0] focus:border-violet'

const errorText = {
  email: 'errorEmail',
  short: 'errorShort',
  exists: 'errorExists',
  invalid: 'errorInvalid',
  missing: 'errorMissing',
}

export default function LoginModal({ text, logoUrl, onClose, onSuccess }) {
  const firstRef = useRef(null)
  const [view, setView] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    firstRef.current?.focus()
  }, [view])

  function openView(next) {
    setView(next)
    setPassword('')
    setConfirm('')
    setError('')
    setNotice('')
  }

  async function onSubmit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    const needsPassword = view !== 'forgot'
    if (!email.trim() || (needsPassword && !password)) {
      setError(text.errorRequired)
      return
    }
    if ((view === 'signup' || view === 'reset') && password !== confirm) {
      setError(text.errorMismatch)
      return
    }

    setBusy(true)
    try {
      if (view === 'login') {
        const result = await login({ email, password })
        if (!result.ok) {
          setError(text[errorText[result.error]])
          return
        }
        onSuccess(result.user)
        onClose()
        return
      }
      if (view === 'signup') {
        const result = await signup({ email, password })
        if (!result.ok) {
          setError(text[errorText[result.error]])
          return
        }
        onSuccess(result.user)
        onClose()
        return
      }
      if (view === 'forgot') {
        const result = findAccount(email)
        if (!result.ok) {
          setError(text[errorText[result.error]])
          return
        }
        setEmail(result.email)
        setView('reset')
        setPassword('')
        setConfirm('')
        return
      }
      const result = await resetPassword({ email, password })
      if (!result.ok) {
        setError(text[errorText[result.error]])
        return
      }
      setPassword('')
      setConfirm('')
      setView('login')
      setNotice(text.resetDone)
    } finally {
      setBusy(false)
    }
  }

  const title =
    view === 'signup' ? text.signup : view === 'forgot' ? text.forgot : view === 'reset' ? text.resetTitle : text.login
  const submitLabel =
    view === 'signup' ? text.signupSubmit : view === 'forgot' ? text.forgotNext : view === 'reset' ? text.resetSubmit : text.login

  return (
    <div className="fixed inset-0 z-40">
      <img src="/hero.jpeg?v=3" alt="" className="hero-photo" />
      <div className="relative z-10 flex h-full items-center justify-center px-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-title"
          onSubmit={onSubmit}
          className="relative max-h-[calc(100vh-2rem)] w-[min(440px,100%)] overflow-y-auto rounded-[32px] bg-white px-11 pt-10 pb-9 shadow-[0_30px_80px_rgba(20,12,48,0.32)]"
        >
          <button
            type="button"
            aria-label={text.close}
            onClick={onClose}
            className="absolute top-5 right-5 grid size-8 place-items-center rounded-full text-[#6f6f80] hover:bg-[#f3f3f8] hover:text-black"
          >
            <CloseIcon />
          </button>
          <img src={logoUrl} alt="STOS, Scene to Seoul" className="mx-auto h-20 w-auto" />
          <h2 id="login-title" className="mt-6 text-center text-[1.85rem] font-bold tracking-[-0.03em] text-black">
            {title}
          </h2>
          {notice ? <p className="mt-4 text-center text-[13px] leading-5 text-violet">{notice}</p> : null}
          <input
            ref={view === 'reset' ? undefined : firstRef}
            type="email"
            name="email"
            autoComplete="username"
            placeholder={text.email}
            aria-label={text.email}
            value={email}
            readOnly={view === 'reset'}
            onChange={(event) => setEmail(event.target.value)}
            className={`${fieldClass} mt-8 read-only:bg-[#f7f7fb]`}
          />
          {view !== 'forgot' ? (
            <input
              ref={view === 'reset' ? firstRef : undefined}
              type="password"
              name="password"
              autoComplete={view === 'login' ? 'current-password' : 'new-password'}
              placeholder={text.password}
              aria-label={text.password}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${fieldClass} mt-4`}
            />
          ) : null}
          {view === 'signup' || view === 'reset' ? (
            <input
              type="password"
              name="confirm"
              autoComplete="new-password"
              placeholder={text.confirmPassword}
              aria-label={text.confirmPassword}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className={`${fieldClass} mt-4`}
            />
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 text-center text-[13px] leading-5 text-[#d14343]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 h-[3.25rem] w-full rounded-xl bg-gradient-to-r from-[#6d4dff] to-[#c4b5fd] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {submitLabel}
          </button>
          {view === 'login' ? (
            <div className="mt-6 flex items-center justify-center gap-16 text-[13px] text-[#9a9aab]">
              <button type="button" className="hover:text-black" onClick={() => openView('signup')}>
                {text.signup}
              </button>
              <button type="button" className="hover:text-black" onClick={() => openView('forgot')}>
                {text.forgot}
              </button>
            </div>
          ) : (
            <div className="mt-6 text-center text-[13px] text-[#9a9aab]">
              <button type="button" className="hover:text-black" onClick={() => openView('login')}>
                {text.backToLogin}
              </button>
            </div>
          )}
          {view === 'login' ? (
            <p className="mt-10 text-center text-[12.5px] leading-5 text-[#a3a3b2]">{text.loginNote}</p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
