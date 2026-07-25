'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single()

        if (profileError) throw profileError

        if (profile) {
          switch (profile.role) {
            case 'admin':
              router.push('/admin/dashboard')
              break
            case 'pelatih':
              router.push('/pelatih/dashboard')
              break
            case 'ortu':
              router.push('/ortu/dashboard')
              break
            default:
              throw new Error('Role tidak dikenali')
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat login.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8 flex flex-col gap-6 items-center">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-white border-4 border-dark shadow-brutal flex items-center justify-center overflow-hidden">
            <img 
              src="/logo-siger.png" 
              alt="Logo Siger Taekwondo Club" 
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-sans text-dark">Siger TKD Manager</h1>
            <p className="text-dark/80 mt-2 font-sans">Masuk ke akun Anda</p>
          </div>
        </div>

        {error && (
          <div className="bg-accent/20 border-2 border-accent text-dark p-3 rounded-xl font-sans text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input 
            label="Email" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
            placeholder="nama@email.com"
          />
          <Input 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
            placeholder="••••••••"
          />
          <Button type="submit" variant="primary" disabled={loading} className="mt-4">
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>
      </Card>
    </main>
  )
}
