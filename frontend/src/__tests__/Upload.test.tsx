import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadPage from '../pages/Upload'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'

const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  toast,
  Toaster: () => null,
}))

vi.mock('../api/client', () => ({
  signalsApi: {
    upload: vi.fn(),
  },
}))

vi.mock('../stores/signalStore', () => ({
  useSignalStore: vi.fn(),
}))

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

const mockSignalsApi = vi.mocked(signalsApi)
const mockUseSignalStore = vi.mocked(useSignalStore)
const mockUseAuthStore = vi.mocked(useAuthStore)

describe('UploadPage', () => {
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
      currentSignal: null,
      analyses: [],
      currentAnalysis: null,
      pagination: { total: 0, skip: 0, limit: 50 },
      isLoading: false,
      error: null,
      setSignals: vi.fn(),
      setCurrentSignal: vi.fn(),
      setAnalyses: vi.fn(),
      setCurrentAnalysis: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      addSignal: vi.fn(),
      removeSignal: vi.fn(),
    })
  })

  it('renders upload form', () => {
    render(<UploadPage />)

    expect(screen.getByRole('heading', { name: 'Upload Signal' })).toBeInTheDocument()
    expect(screen.getByLabelText('Signal Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Sample Rate (Hz) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Duration (seconds) *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload Signal' })).toBeInTheDocument()
  })

  it('shows error when submitting without file', async () => {
    render(<UploadPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Upload Signal' }))

    await waitFor(() => {
      expect(mockSignalsApi.upload).not.toHaveBeenCalled()
    })
  })

  it('validates file type', async () => {
    render(<UploadPage />)

    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)

    const dropZone = screen.getByText('Drop your signal file here or click to browse').closest('div')
    fireEvent.drop(dropZone!, { dataTransfer })

    fireEvent.click(screen.getByRole('button', { name: 'Upload Signal' }))

    await waitFor(() => {
      expect(mockSignalsApi.upload).not.toHaveBeenCalled()
    })
  })

  it('uploads signal successfully', async () => {
    const mockSignal = {
      id: 1,
      name: 'Test Signal',
      sample_rate: 1000,
      duration_seconds: 10,
      channels: 1,
      description: 'Test',
      created_at: new Date().toISOString(),
    }

    mockSignalsApi.upload.mockResolvedValue(mockSignal)

    render(<UploadPage />)

    fireEvent.change(screen.getByLabelText('Signal Name *'), { target: { value: 'Test Signal' } })
    fireEvent.change(screen.getByLabelText('Sample Rate (Hz) *'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Duration (seconds) *'), { target: { value: '10' } })

    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(file)

    const dropZone = screen.getByText('Drop your signal file here or click to browse').closest('div')
    fireEvent.drop(dropZone!, { dataTransfer })

    fireEvent.click(screen.getByText('Upload Signal'))

    await waitFor(() => {
      expect(mockSignalsApi.upload).toHaveBeenCalled()
    })
  })
})