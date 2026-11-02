import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import UploadPage from '../pages/Upload'
import { signalsApi } from '../api/client'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../stores/authStore'
import { renderWithRouter } from './setup'

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}

vi.mock('react-hot-toast', () => ({
  toast: mockToast,
  Toaster: () => null,
  default: mockToast,
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
    })
    mockUseSignalStore.mockReturnValue({
      uploadSignal: vi.fn(),
      clearError: vi.fn(),
      addSignal: vi.fn(),
    })
  })

  it('renders upload form', () => {
    renderWithRouter(<UploadPage />)
    expect(screen.getByText('Upload Signal')).toBeInTheDocument()
    expect(screen.getByLabelText('Signal Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Sample Rate (Hz) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Duration (seconds) *')).toBeInTheDocument()
    expect(screen.getByLabelText('Channels')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByText('Drop your signal file here or click to browse')).toBeInTheDocument()
  })

  it('shows error when submitting without file', async () => {
    renderWithRouter(<UploadPage />)
    fireEvent.click(screen.getByRole('button', { name: /upload signal/i }))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Please select a file')
    })
  })

  it('validates file type', async () => {
    renderWithRouter(<UploadPage />)
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /upload signal/i }))
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('File must be CSV, JSON, or NPY format')
    })
  })

  it('uploads signal successfully', async () => {
    renderWithRouter(<UploadPage />)
    const file = new File(['time,value\n0,1\n1,2'], 'test.csv', { type: 'text/csv' })
    const input = screen.getByTestId('file-input')
    fireEvent.change(input, { target: { files: [file] } })
    fireEvent.change(screen.getByLabelText('Signal Name *'), { target: { value: 'Test Signal' } })
    fireEvent.change(screen.getByLabelText('Sample Rate (Hz) *'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Duration (seconds) *'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Channels'), { target: { value: '1' } })

    mockSignalsApi.upload.mockResolvedValue({ id: 1, name: 'Test Signal' })

    fireEvent.click(screen.getByRole('button', { name: /upload signal/i }))
    await waitFor(() => {
      expect(mockSignalsApi.upload).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Signal uploaded successfully!')
    })
  })
})
