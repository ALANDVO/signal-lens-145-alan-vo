import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadPage from '../pages/Upload'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'
import { renderWithRouter } from './setup'

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
    mockSignalsApi.upload.mockResolvedValue({
      id: 1,
      name: 'test.csv',
      fileType: 'csv',
      fileSize: 1024,
      sampleRate: 1000,
      duration: 10,
      createdAt: '2024-01-01T00:00:00Z',
      ownerId: 1,
    })
  })

  it('renders upload form', () => {
    renderWithRouter(<UploadPage />)

    expect(screen.getByText('Upload Signal')).toBeInTheDocument()
    expect(screen.getByLabelText(/file/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
  })

  it('uploads signal file', async () => {
    renderWithRouter(<UploadPage />)

    const fileInput = screen.getByLabelText(/file/i)
    const file = new File(['test data'], 'test.csv', { type: 'text/csv' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    const uploadButton = screen.getByRole('button', { name: /upload/i })
    fireEvent.click(uploadButton)

    await waitFor(() => {
      expect(mockSignalsApi.upload).toHaveBeenCalled()
    })
  })
})