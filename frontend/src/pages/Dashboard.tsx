import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Upload, Activity, ArrowRight, AlertTriangle } from 'lucide-react'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'
import { clsx } from 'clsx'

export default function DashboardPage() {
  const { signals, isLoading, error, setSignals, setLoading, setError } = useSignalStore()
  const { user } = useAuthStore()

  useEffect(() => {
    loadSignals()
  }, [])

  const loadSignals = async () => {
    setLoading(true)
    try {
      const response = await signalsApi.list(0, 10)
      setSignals(response.items, { total: response.total, skip: 0, limit: 10 })
    } catch (err) {
      setError('Failed to load signals')
    }
  }

  const recentSignals = signals.slice(0, 5)
  const totalAnalyses = signals.reduce((sum, s) => sum + (s.analysis_count || 0), 0)

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Welcome back, {user?.name}. Here's an overview of your signal analyses.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Signals"
          value={signals.length}
          icon={FileText}
          color="blue"
          href="/signals"
        />
        <StatCard
          title="Total Analyses"
          value={totalAnalyses}
          icon={Activity}
          color="green"
          href="/signals"
        />
        <StatCard
          title="Anomalies Detected"
          value={signals.reduce((sum, s) => sum + (s.anomaly_count || 0), 0)}
          icon={AlertTriangle}
          color="orange"
          href="/signals"
        />
        <StatCard
          title="Upload New Signal"
          value="+"
          icon={Upload}
          color="purple"
          href="/upload"
        />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Signals</h2>
          <Link to="/signals" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="card-body">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Activity className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              Loading...
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">{error}</div>
          ) : recentSignals.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="mx-auto w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No signals yet</h3>
              <p className="text-gray-500 mb-4">Upload your first signal to start analyzing</p>
              <Link to="/upload" className="btn btn-primary">
                <Upload className="w-4 h-4 mr-2" />
                Upload Signal
              </Link>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Sample Rate</th>
                    <th>Duration</th>
                    <th>Analyses</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentSignals.map((signal) => (
                    <tr key={signal.id}>
                      <td className="font-medium text-gray-900">{signal.name}</td>
                      <td className="text-gray-600">{signal.sample_rate.toLocaleString()} Hz</td>
                      <td className="text-gray-600">{signal.duration_seconds}s</td>
                      <td className="text-gray-600">{signal.analysis_count || 0}</td>
                      <td className="text-gray-600">{new Date(signal.created_at).toLocaleDateString()}</td>
                      <td>
                        <Link to={`/signals/${signal.id}`} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon, color, href }: { title: string; value: number | string; icon: React.ComponentType<{ className?: string }>; color: string; href: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <Link to={href} className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color as keyof typeof colorClasses])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Link>
  )
}