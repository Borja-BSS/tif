'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  OAuthProvider,
  type User,
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
  user:           AuthUser | null
  loading:        boolean
  signInGoogle:   () => Promise<void>
  signInApple:    () => Promise<void>
  signInEmail:    (email: string, password: string) => Promise<void>
  registerEmail:  (email: string, password: string) => Promise<void>
  signOut:        () => Promise<void>
  error:          string | null
  clearError:     () => void
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

  useEffect(() => {
    // Capture redirect result (Google/Apple redirect flow)
    getRedirectResult(firebaseAuth).catch(e => {
      const err = e as { code?: string; message?: string }
      setError(err.code || err.message || 'Erreur de connexion')
    })

    const unsub = onAuthStateChanged(firebaseAuth, fbUser => {
      setUser(fbUser ? toAuthUser(fbUser) : null)
      setLoading(false)
    })
    return unsub
  }, [])

  const signInGoogle = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    await signInWithRedirect(firebaseAuth, provider)
  }

  const signInApple = async () => {
    setError(null)
    const provider = new OAuthProvider('apple.com')
    provider.addScope('email')
    provider.addScope('name')
    await signInWithRedirect(firebaseAuth, provider)
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

  const signOut = async () => {
    await firebaseSignOut(firebaseAuth)
  }

  return (
    <AuthContext.Provider value={{
      user, loading,
      signInGoogle, signInApple, signInEmail, registerEmail,
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
