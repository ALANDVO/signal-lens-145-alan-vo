import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { useAuthStore } from '../stores/authStore'
import { renderWithRouter } from './setup'

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('../api/client', () => ({
  authApi: {
    me: vi.fn().mockResolvedValue({ id: 1, email: 'test@example.com', name: 'Test User', role: 'viewer' }),
    logout: vi.fn(),
    loginUrl: vi.fn(() => '/api/auth/login'),
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
    renderWithRouter(<App />)

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

    renderWithRouter(<App />)

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
      isLoading: false,
      setUser: vi.fn(),
      setLoading: vi.fn(),
      logout: vi.fn(),
    })

    renderWithRouter(<App />)

    expect(screen.getByText('Redirecting to authentication...')).toBeInTheDocument()
  })
})