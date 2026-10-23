import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignalListPage from '../pages/SignalList'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'

vi.mock('../api/client', () => ({
  signalsApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../stores/signalStore', () => ({
  useSignalStore: vi.fn(),
}))

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockSignalsApi = vi.mocked(signalsApi)
const mockUseSignalStore = vi.mocked(useSignalStore)
const mockUseAuthStore = vi.mocked(useAuthStore)

describe('SignalListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, email: 'test@example.com', name: 'Test User', role: 'viewer' },
      isAuthenticated: true,
      isLoading: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('renders signal list with empty state', () => {
    mockUseSignalStore.mockReturnValue({
      signals: [],
      pagination: { total: 0, skip: 0, limit: 50 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      addSignal: vi.fn(),
      removeSignal: vi.fn(),
    })

    mockSignalsApi.list.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 50 })

    render(<SignalListPage />)

    expect(screen.getByText('My Signals')).toBeInTheDocument()
    expect(screen.getByText('No signals found')).toBeInTheDocument()
    expect(screen.getByText('Upload Signal')).toBeInTheDocument()
  })

  it('renders signal list with data', () => {
    const mockSignals = [
      { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, analysis_count: 2, created_at: new Date().toISOString(), description: null },
      { id: 2, name: 'Signal 2', sample_rate: 2000, duration_seconds: 5, channels: 2, analysis_count: 1, created_at: new Date().toISOString(), description: null },
    ]

    mockUseSignalStore.mockReturnValue({
      signals: mockSignals,
      pagination: { total: 2, skip: 0, limit: 50 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      addSignal: vi.fn(),
      removeSignal: vi.fn(),
    })

    mockSignalsApi.list.mockResolvedValue({ items: mockSignals, total: 2, skip: 0, limit: 50 })

    render(<SignalListPage />)

    expect(screen.getByText('Signal 1')).toBeInTheDocument()
    expect(screen.getByText('Signal 2')).toBeInTheDocument()
    expect(screen.getByText('1,000 Hz')).toBeInTheDocument()
    expect(screen.getByText('2,000 Hz')).toBeInTheDocument()
  })

  it('deletes signal', async () => {
    const mockSignals = [
      { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, analysis_count: 2, created_at: new Date().toISOString(), description: null },
    ]

    mockUseSignalStore.mockReturnValue({
      signals: mockSignals,
      pagination: { total: 1, skip: 0, limit: 50 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      addSignal: vi.fn(),
      removeSignal: vi.fn(),
    })

    mockSignalsApi.list.mockResolvedValue({ items: mockSignals, total: 1, skip: 0, limit: 50 })
    mockSignalsApi.delete.mockResolvedValue(undefined)

    render(<SignalListPage />)

    const deleteButton = screen.getByTitle('Delete')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockSignalsApi.delete).toHaveBeenCalledWith(1)
    })
  })
})