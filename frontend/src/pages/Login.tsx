import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Signal, Brain } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (code && state) {
      setLoading(true)
      authApi.me().then((user) => {
        setUser(user)
        navigate('/dashboard')
      }).catch(() => {
        setLoading(false)
      })
    } else {
      window.location.href = authApi.loginUrl()
    }
  }, [navigate, setUser, setLoading])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-8">
          <Brain className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Signal Lens</h1>
        <p className="text-gray-600 mb-8">AI/ML-powered signal analysis platform</p>
        <div className="card p-8">
          <div className="animate-pulse flex items-center justify-center gap-3 text-gray-600">
            <Signal className="w-6 h-6" />
            <span>Redirecting to authentication...</span>
          </div>
        </div>
      </div>
    </div>
  )
}