import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, Play, Download, Trash2, FileText, BarChart2 } from 'lucide-react'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

export default function SignalDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentSignal, analyses, isLoading, error, setCurrentSignal, setCurrentAnalysis, setLoading, setError, setAnalyses } = useSignalStore()

  const [activeTab, setActiveTab] = useState<'overview' | 'analyses'>('overview')
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('comprehensive')
  const [methodParams, setMethodParams] = useState<Record<string, unknown>>({})

  const signalId = id ? parseInt(id, 10) : 0

  useEffect(() => {
    if (signalId) {
      loadSignal()
      loadAnalyses()
    }
  }, [signalId])

  const loadSignal = async () => {
    setLoading(true)
    try {
      const signal = await signalsApi.get(signalId)
      setCurrentSignal(signal)
    } catch (err) {
      setError('Failed to load signal')
    }
  }

  const loadAnalyses = async () => {
    try {
      const response = await signalsApi.getAnalyses(signalId)
      setAnalyses(response.items, { total: response.total, skip: 0, limit: 50 })
    } catch (err) {
      console.error('Failed to load analyses:', err)
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const analysis = await signalsApi.analyze(signalId, selectedMethod, methodParams)
      setCurrentAnalysis(analysis)
      toast.success(`Analysis complete: ${analysis.anomaly_count} anomalies detected`)
      loadAnalyses()
      setActiveTab('analyses')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleExport = async (analysisId: number, format: 'json' | 'csv') => {
    try {
      const response = await signalsApi.export(analysisId, format)
      const blob = format === 'csv' ? new Blob([response.data], { type: 'text/csv' }) : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analysis_${analysisId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${format.toUpperCase()}`)
    } catch (err) {
      toast.error('Export failed')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this signal? This action cannot be undone.')) return
    try {
      await signalsApi.delete(signalId)
      toast.success('Signal deleted')
      navigate('/signals')
    } catch (err) {
      toast.error('Failed to delete signal')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !currentSignal) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Signal not found</h3>
        <p className="text-gray-500 mb-4">{error || 'The signal may have been deleted'}</p>
        <button onClick={() => navigate('/signals')} className="btn btn-primary">Back to Signals</button>
      </div>
    )
  }

  const signal = currentSignal

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{signal.name}</h1>
          <p className="page-description">{signal.description || 'No description provided'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDelete} className="btn btn-danger">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <InfoCard title="Sample Rate" value={`${signal.sample_rate.toLocaleString()} Hz`} icon={BarChart2} color="blue" />
        <InfoCard title="Duration" value={`${signal.duration_seconds}s`} icon={FileText} color="green" />
        <InfoCard title="Channels" value={signal.channels.toString()} icon={BarChart2} color="purple" />
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex gap-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={clsx('pb-4 text-sm font-medium border-b-2 transition-colors', activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('analyses')}
            className={clsx('pb-4 text-sm font-medium border-b-2 transition-colors', activeTab === 'analyses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
          >
            Analyses ({analyses.length})
          </button>
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Run Analysis</h2>
          </div>
          <div className="card-body space-y-6">
            <div>
              <label className="label">Analysis Method</label>
              <select
                value={selectedMethod}
                onChange={(e) => setSelectedMethod(e.target.value)}
                className="input"
              >
                <option value="comprehensive">Comprehensive (Statistical + Spectral + ML)</option>
                <option value="statistical">Statistical Analysis</option>
                <option value="spectral">Spectral Analysis</option>
                <option value="isolation_forest">Isolation Forest (ML Anomaly Detection)</option>
              </select>
            </div>

            <div>
              <label className="label">Parameters (JSON)</label>
              <textarea
                value={JSON.stringify(methodParams, null, 2)}
                onChange={(e) => {
                  try {
                    setMethodParams(JSON.parse(e.target.value))
                  } catch {
                    // Ignore invalid JSON while typing
                  }
                }}
                className="input font-mono text-sm"
                rows={6}
                placeholder='{"sample_rate": 1000, "window_size": 50, "contamination": 0.1}'
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="btn btn-primary"
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
              ) : (
                <><Play className="w-4 h-4 mr-2" /> Run Analysis</>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'analyses' && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Analysis Results</h2>
          </div>
          <div className="card-body">
            {analyses.length === 0 ? (
              <div className="text-center py-8">
                <BarChart2 className="mx-auto w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No analyses yet</h3>
                <p className="text-gray-500 mb-4">Run an analysis from the Overview tab</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Anomalies</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((analysis) => (
                      <tr key={analysis.id}>
                        <td className="font-medium text-gray-900">{analysis.method.replace('_', ' ')}</td>
                        <td>
                          <span className={clsx('badge', analysis.anomaly_count > 0 ? 'badge-warning' : 'badge-success')}>
                            {analysis.anomaly_count}
                          </span>
                        </td>
                        <td>
                          <span className={clsx('badge', analysis.status === 'completed' ? 'badge-success' : 'badge-info')}>
                            {analysis.status}
                          </span>
                        </td>
                        <td className="text-gray-600">{new Date(analysis.created_at).toLocaleString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExport(analysis.id, 'json')}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Export JSON"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExport(analysis.id, 'csv')}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Export CSV"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={clsx('p-3 rounded-xl', colorClasses[color as keyof typeof colorClasses])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}