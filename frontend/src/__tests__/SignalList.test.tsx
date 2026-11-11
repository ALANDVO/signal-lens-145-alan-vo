import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SignalListPage from '../pages/SignalList'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'
import { renderWithRouter } from './setup'

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
  Toaster: () => null,
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
    mockUseSignalStore.mockReturnValue({
      signals: [],
      pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setPagination: vi.fn(),
      addSignal: vi.fn(),
      deleteSignal: vi.fn(),
      currentSignal: null,
      analyses: [],
      setCurrentSignal: vi.fn(),
      setAnalyses: vi.fn(),
    })
    mockSignalsApi.list.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    })
  })

  it('renders signal list with empty state', () => {
    renderWithRouter(<SignalListPage />)

    expect(screen.getByText('No signals found')).toBeInTheDocument()
    expect(screen.getByText('Upload your first signal to get started')).toBeInTheDocument()
  })

  it('renders signal list with data', () => {
    const mockSignals = [
      { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
      { id: 2, name: 'Signal 2', sample_rate: 2000, duration_seconds: 5, channels: 1, created_at: '2024-01-02T00:00:00Z' },
    ]
    mockUseSignalStore.mockReturnValue({
      ...mockUseSignalStore.mock.results[0]?.value,
      signals: mockSignals,
      pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 },
    })

    renderWithRouter(<SignalListPage />)

    expect(screen.getByText('Signal 1')).toBeInTheDocument()
    expect(screen.getByText('Signal 2')).toBeInTheDocument()
    expect(screen.getByText('1,000 Hz')).toBeInTheDocument()
    expect(screen.getByText('2,000 Hz')).toBeInTheDocument()
  })

  it('deletes signal', async () => {
    const mockSignals = [
      { id: 1, name: 'Signal 1', sample_rate: 1000, duration_seconds: 10, channels: 1, created_at: '2024-01-01T00:00:00Z' },
    ]
    mockUseSignalStore.mockReturnValue({
      signals: mockSignals,
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      setPagination: vi.fn(),
      addSignal: vi.fn(),
      deleteSignal: vi.fn(),
      currentSignal: null,
      analyses: [],
      setCurrentSignal: vi.fn(),
      setAnalyses: vi.fn(),
    })
    mockSignalsApi.delete.mockResolvedValue(undefined)

    renderWithRouter(<SignalListPage />)

    const deleteButton = screen.getByRole('button', { name: /delete signal 1/i })
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockSignalsApi.delete).toHaveBeenCalledWith(1)
    })
  })
})