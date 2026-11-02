import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignalListPage from '../pages/SignalList'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'
import { renderWithRouter } from './setup'

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}

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
  toast: mockToast,
  Toaster: () => null,
  default: mockToast,
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
    })
    // Mock window.confirm
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('renders signal list with empty state', () => {
    mockUseSignalStore.mockReturnValue({
      signals: [],
      isLoading: false,
      error: null,
      fetchSignals: vi.fn(),
      deleteSignal: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      pagination: { total: 0, skip: 0, limit: 50 },
    })

    mockSignalsApi.list.mockResolvedValue({ items: [], total: 0, skip: 0, limit: 50 })

    renderWithRouter(<SignalListPage />)

    expect(screen.getByText('My Signals')).toBeInTheDocument()
    expect(screen.getByText('No signals found')).toBeInTheDocument()
    expect(screen.getAllByText('Upload Signal')).toHaveLength(2)
  })

  it('renders signal list with data', () => {
    mockUseSignalStore.mockReturnValue({
      signals: [
        { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'Signal 2', sample_rate: 500, duration_seconds: 5, channels: 2, created_at: '2024-01-02T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
      fetchSignals: vi.fn(),
      deleteSignal: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      pagination: { total: 2, skip: 0, limit: 50 },
    })

    mockSignalsApi.list.mockResolvedValue({
      items: [
        { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'Signal 2', sample_rate: 500, duration_seconds: 5, channels: 2, created_at: '2024-01-02T00:00:00Z' },
      ],
      total: 2,
      skip: 0,
      limit: 50,
    })

    renderWithRouter(<SignalListPage />)

    expect(screen.getByText('Signal 1')).toBeInTheDocument()
    expect(screen.getByText('Signal 2')).toBeInTheDocument()
    expect(screen.getByText(/1,000/)).toBeInTheDocument()
    expect(screen.getByText(/500/)).toBeInTheDocument()
  })

  it('deletes signal', async () => {
    mockUseSignalStore.mockReturnValue({
      signals: [
        { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
      ],
      isLoading: false,
      error: null,
      fetchSignals: vi.fn(),
      deleteSignal: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      pagination: { total: 1, skip: 0, limit: 50 },
    })

    mockSignalsApi.list.mockResolvedValue({
      items: [
        { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
      ],
      total: 1,
      skip: 0,
      limit: 50,
    })
    mockSignalsApi.delete.mockResolvedValue(undefined)

    renderWithRouter(<SignalListPage />)

    fireEvent.click(screen.getByTitle('Delete'))
    await waitFor(() => {
      expect(mockSignalsApi.delete).toHaveBeenCalledWith(1)
    })
  })
})
