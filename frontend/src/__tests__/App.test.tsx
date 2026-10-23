import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../App'
import { useAuthStore } from '../stores/authStore'

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
    loginUrl: '/api/auth/login',
  },
}))

const mockUseAuthStore = vi.mocked(useAuthStore)

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      logout: vi.fn(),
    })
  })

  it('redirects to login when not authenticated', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    expect(screen.getByText('Signal Lens')).toBeInTheDocument()
    expect(screen.getByText('Redirecting to authentication...')).toBeInTheDocument()
  })

  it('shows dashboard when authenticated', async () => {
    mockUseAuthStore.mockReturnValue({
      user: { id: 1, email: 'test@example.com', name: 'Test User', role: 'viewer' },
      isAuthenticated: true,
      isLoading: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument()
    })
  })
})

describe('Authentication Flow', () => {
  it('handles login redirect', () => {
    mockUseAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      logout: vi.fn(),
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    )

    expect(screen.getByText('Redirecting to authentication...')).toBeInTheDocument()
  })
})