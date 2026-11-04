'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  function switchMode() {
    setIsRegister((prev) => !prev)
    setError('')
    setSuccess('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    resetMessages()

    if (!email || !password) {
      setError('Email dan password harus diisi.')
      return
    }

    if (isRegister && password !== confirmPassword) {
      setError('Password tidak cocok.')
      return
    }

    if (password.length < 6) {
      setError('Password minimal 6 karakter.')
      return
    }

    setLoading(true)
    const supabase = supabaseBrowser()

    if (isRegister) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      setLoading(false)

      if (signUpError) {
        setError(signUpError.message)
        return
      }

      setSuccess('Registrasi berhasil! Silakan cek email untuk verifikasi, lalu login.')
      setIsRegister(false)
      setPassword('')
      setConfirmPassword('')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      setLoading(false)

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.push('/kasir')
      router.refresh()
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 p-4">
      {/* Decorative background shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-orange-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] bg-amber-200 rounded-full opacity-30 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-yellow-200 rounded-full opacity-20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-orange-200/50 overflow-hidden border border-orange-100/60">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-8 py-8 text-center">
            <div className="text-5xl mb-2">🍽️</div>
            <h1 className="text-2xl font-extrabold text-white tracking-wide">
              POS
            </h1>
            <p className="text-orange-100 text-sm mt-1 font-medium">
              Sistem Kasir & Manajemen Restoran
            </p>
          </div>

          {/* Mode Toggle Tabs */}
          <div className="flex border-b border-orange-100">
            <button
              type="button"
              onClick={() => { if (isRegister) switchMode() }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-300 ${!isRegister
                  ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                  : 'text-gray-400 hover:text-gray-500'
                }`}
            >
              🔑 Masuk
            </button>
            <button
              type="button"
              onClick={() => { if (!isRegister) switchMode() }}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all duration-300 ${isRegister
                  ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50/50'
                  : 'text-gray-400 hover:text-gray-500'
                }`}
            >
              📝 Daftar
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-7 space-y-5">
            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
                <span className="mt-0.5 shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 animate-[fadeIn_0.3s_ease-out]">
                <span className="mt-0.5 shrink-0">✅</span>
                <span>{success}</span>
              </div>
            )}

            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
                📧 Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent focus:bg-white transition-all duration-200"
                required
              />
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                🔒 Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent focus:bg-white transition-all duration-200"
                required
              />
            </div>

            {/* Confirm password field (register only) */}
            {isRegister && (
              <div className="space-y-1.5 animate-[fadeIn_0.3s_ease-out]">
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700">
                  🔒 Konfirmasi Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-800 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent focus:bg-white transition-all duration-200"
                  required
                />
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-[0.98] shadow-lg shadow-orange-300/40 hover:shadow-orange-400/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {isRegister ? 'Mendaftarkan...' : 'Memproses...'}
                </span>
              ) : (
                isRegister ? '📝 Daftar Sekarang' : '🔑 Masuk'
              )}
            </button>

            {/* Switch mode link */}
            <p className="text-center text-sm text-gray-500 pt-1">
              {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
              <button
                type="button"
                onClick={switchMode}
                className="text-orange-600 font-semibold hover:text-orange-700 hover:underline transition-colors"
              >
                {isRegister ? 'Masuk di sini' : 'Daftar di sini'}
              </button>
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-orange-400/70 mt-6 font-medium">
          © 2024 POS — Solusi Kasir Modern untuk Restoran Anda
        </p>
      </div>
    </main>
  )
}
