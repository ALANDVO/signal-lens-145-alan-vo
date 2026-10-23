import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Filter, Trash2, Loader2, FileText, AlertTriangle } from 'lucide-react'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import toast from 'react-hot-toast'

export default function SignalListPage() {
  const { signals, pagination, isLoading, error, setSignals, setLoading, setError, removeSignal } = useSignalStore()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    loadSignals()
  }, [currentPage])

  const loadSignals = async () => {
    setLoading(true)
    try {
      const response = await signalsApi.list((currentPage - 1) * pagination.limit, pagination.limit)
      setSignals(response.items, { total: response.total, skip: response.skip, limit: response.limit })
    } catch (err) {
      setError('Failed to load signals')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this signal? This action cannot be undone.')) return

    setDeletingId(id)
    try {
      await signalsApi.delete(id)
      removeSignal(id)
      toast.success('Signal deleted')
    } catch (err) {
      toast.error('Failed to delete signal')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div className="space-y-6">
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">My Signals</h1>
          <p className="page-description">Manage and analyze your uploaded signals</p>
        </div>
        <Link to="/upload" className="btn btn-primary">
          <FileText className="w-4 h-4 mr-2" />
          Upload Signal
        </Link>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search signals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select className="input py-2" defaultValue="all">
                <option value="all">All Signals</option>
                <option value="recent">Recent First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              <AlertTriangle className="mx-auto w-12 h-12 mb-4" />
              <p>{error}</p>
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No signals found</h3>
              <p className="text-gray-500 mb-4">Upload your first signal to get started</p>
              <Link to="/upload" className="btn btn-primary inline-flex">
                <FileText className="w-4 h-4 mr-2" />
                Upload Signal
              </Link>
            </div>
          ) : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-40">Signal</th>
                      <th>Sample Rate</th>
                      <th>Duration</th>
                      <th>Channels</th>
                      <th>Analyses</th>
                      <th className="w-36">Created</th>
                      <th className="w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((signal) => (
                      <tr key={signal.id}>
                        <td>
                          <Link to={`/signals/${signal.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                            {signal.name}
                          </Link>
                        </td>
                        <td className="text-gray-600">{signal.sample_rate.toLocaleString()} Hz</td>
                        <td className="text-gray-600">{signal.duration_seconds}s</td>
                        <td className="text-gray-600">{signal.channels}</td>
                        <td className="text-gray-600">{signal.analysis_count || 0}</td>
                        <td className="text-gray-600">{new Date(signal.created_at).toLocaleString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Link to={`/signals/${signal.id}`} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="View Details">
                              <FileText className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDelete(signal.id)}
                              disabled={deletingId === signal.id}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === signal.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Showing {((currentPage - 1) * pagination.limit) + 1} to {Math.min(currentPage * pagination.limit, pagination.total)} of {pagination.total} signals
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}