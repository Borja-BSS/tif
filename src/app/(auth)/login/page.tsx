'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setLoading(true)
    await signIn('google', { callbackUrl: '/map' })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="text-[22px] font-bold tracking-tight"
            style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, Inter, sans-serif' }}
          >
            Börja
          </Link>
          <div
            className="w-8 h-px mx-auto my-4"
            style={{ background: 'var(--border)' }}
          />
          <h1 className="text-[28px] font-bold tracking-[-0.015em]" style={{ color: 'var(--text-primary)' }}>
            Accès Grand{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--italic)', fontWeight: 700 }}>Genève.</em>
          </h1>
          <p className="text-[14px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            Plateforme d'intelligence territoriale
          </p>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 transition-all duration-200"
          style={{
            background: '#FFFFFF',
            color: '#1F2937',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 20px',
            fontSize: '15px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <GoogleIcon />
          {loading ? 'Connexion…' : 'Continuer avec Google'}
        </button>

        {/* Disclaimer */}
        <p className="text-center text-[12px] mt-6" style={{ color: 'var(--text-tertiary)' }}>
          Accès restreint — personnel autorisé uniquement
        </p>

        {/* Back */}
        <div className="text-center mt-8">
          <Link
            href="/"
            className="text-[13px] transition-colors duration-150"
            style={{ color: 'var(--text-tertiary)' }}
          >
            ← Retour à l'accueil
          </Link>
        </div>

      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}
