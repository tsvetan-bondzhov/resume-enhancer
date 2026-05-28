import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import AppShell from './AppShell'

// Mock useAuthStore
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(),
}))

// Mock useSignOut
vi.mock('@/hooks/useSignOut', () => ({
  useSignOut: vi.fn(),
}))

import { useAuthStore } from '@/stores/useAuthStore'
import { useSignOut } from '@/hooks/useSignOut'

const mockUseAuthStore = vi.mocked(useAuthStore)
const mockUseSignOut = vi.mocked(useSignOut)

function renderAppShell(role: 'USER' | 'ADMIN' = 'USER') {
  mockUseAuthStore.mockReturnValue(
    role === 'ADMIN'
      ? { id: '1', email: 'admin@example.com', role: 'ADMIN' }
      : { id: '1', email: 'user@example.com', role: 'USER' }
  )

  return render(
    <MemoryRouter>
      <AppShell>
        <div>Page Content</div>
      </AppShell>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSignOut.mockReturnValue(vi.fn())
  })

  it('renders nav links for USER role (Dashboard and Profile visible, Admin NOT visible)', () => {
    renderAppShell('USER')

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })

  it('renders Admin nav link for ADMIN role', () => {
    renderAppShell('ADMIN')

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('Sign Out button calls useSignOut', async () => {
    const signOutMock = vi.fn()
    mockUseSignOut.mockReturnValue(signOutMock)
    renderAppShell('USER')

    const signOutBtn = screen.getByRole('button', { name: /sign out/i })
    await userEvent.click(signOutBtn)

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('renders children inside the shell', () => {
    renderAppShell('USER')

    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('renders the main navigation landmark', () => {
    renderAppShell('USER')

    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })
})
