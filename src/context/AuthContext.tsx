'use client'

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  type User,
  type ConfirmationResult,
} from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:    string
  email: string | null
  name:  string | null
  image: string | null
  role:  'USER' | 'ADMIN'
}

interface AuthContextValue {
  user:             AuthUser | null
  loading:          boolean
  signInGoogle:     () => Promise<void>
  signInApple:      () => Promise<void>
  signInEmail:      (email: string, password: string) => Promise<void>
  registerEmail:    (email: string, password: string) => Promise<void>
  sendPhoneCode:    (phone: string) => Promise<void>
  confirmPhoneCode: (code: string) => Promise<void>
  signOut:          () => Promise<void>
  error:            string | null
  clearError:       () => void
}

// ── Context ───────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(u: User): AuthUser {
  return {
    id:    u.uid,
    email: u.email,
    name:  u.displayName,
    image: u.photoURL,
    role:  'USER',
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null)
  const phoneConfirmation = useRef<ConfirmationResult | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async fbUser => {
      if (fbUser) {
        // Exchange Firebase token for a server-side session cookie
        // so the Next.js middleware lets this user through
        try {
          const idToken = await fbUser.getIdToken()
          await fetch('/api/auth/firebase-session', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ idToken }),
          })
        } catch {}
        setUser(toAuthUser(fbUser))
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signInGoogle = async () => {
    setError(null)
    try {
      // Charge GIS dynamiquement si pas encore disponible
      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).google?.accounts?.oauth2) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://accounts.google.com/gsi/client'
        s.async = true
        s.onload = () => resolve()
        s.onerror = () => reject(new Error('Impossible de charger Google Identity Services'))
        document.head.appendChild(s)
      })

      await new Promise<void>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gis = (window as any).google?.accounts?.oauth2
        const client = gis.initTokenClient({
          client_id: '260165983011-fimavk84mn6uqom3cglhc0mholfaoc8p.apps.googleusercontent.com',
          scope: 'openid profile email',
          callback: async (response: { access_token?: string; error?: string }) => {
            if (!response.access_token) {
              const msg = response.error ?? 'Connexion Google annulée'
              setError(msg)
              reject(new Error(msg))
              return
            }
            try {
              const credential = GoogleAuthProvider.credential(null, response.access_token)
              await signInWithCredential(firebaseAuth, credential)
              resolve()
            } catch (e) {
              const err = e as { message?: string; code?: string }
              setError(err.message ?? err.code ?? 'Erreur de connexion')
              reject(e)
            }
          },
          error_callback: (e: { type: string }) => {
            if (e.type !== 'popup_closed') setError('Erreur Google: ' + e.type)
            reject(new Error(e.type))
          },
        })
        client.requestAccessToken()
      })
    } catch (e) {
      const err = e as { message?: string }
      if (err.message) setError(err.message)
    }
  }

  const signInApple = async () => {
    setError(null)
    setError('Apple Sign-In non configuré — utilisez Google, SMS ou Email')
  }

  const signInEmail = async (email: string, password: string) => {
    setError(null)
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Email ou mot de passe incorrect')
    }
  }

  const registerEmail = async (email: string, password: string) => {
    setError(null)
    try {
      await createUserWithEmailAndPassword(firebaseAuth, email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création du compte')
    }
  }

  const sendPhoneCode = async (phone: string) => {
    setError(null)
    if (recaptchaVerifier.current) {
      recaptchaVerifier.current.clear()
      recaptchaVerifier.current = null
    }
    recaptchaVerifier.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
      size: 'invisible',
    })
    try {
      phoneConfirmation.current = await signInWithPhoneNumber(firebaseAuth, phone, recaptchaVerifier.current)
    } catch (e) {
      recaptchaVerifier.current?.clear()
      recaptchaVerifier.current = null
      const err = e as { message?: string; code?: string }
      setError(err.message ?? err.code ?? 'Impossible d\'envoyer le SMS')
      throw e
    }
  }

  const confirmPhoneCode = async (code: string) => {
    setError(null)
    try {
      if (!phoneConfirmation.current) {
        setError('Aucune vérification en attente — renvoyez le code')
        return
      }
      await phoneConfirmation.current.confirm(code)
    } catch (e) {
      const err = e as { message?: string; code?: string }
      setError(err.message ?? err.code ?? 'Code incorrect')
    }
  }

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth)
  }

  return (
    <AuthContext.Provider value={{
      user, loading,
      signInGoogle, signInApple, signInEmail, registerEmail,
      sendPhoneCode, confirmPhoneCode,
      signOut,
      error, clearError: () => setError(null),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

// Alias compatible avec l'ancien useSession de NextAuth
export function useSession() {
  const { user, loading } = useAuth()
  return {
    data:   user ? { user } : null,
    status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
  }
}
