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

// Mock useTheme
vi.mock('@/components/theme-provider', () => ({
  useTheme: vi.fn(),
}))

import { useAuthStore } from '@/stores/useAuthStore'
import { useSignOut } from '@/hooks/useSignOut'
import { useTheme } from '@/components/theme-provider'

const mockUseAuthStore = vi.mocked(useAuthStore)
const mockUseSignOut = vi.mocked(useSignOut)
const mockUseTheme = vi.mocked(useTheme)

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
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: vi.fn() })
    Object.defineProperty(globalThis, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    })
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

  it('renders Moon icon and "Switch to dark mode" label when theme is light', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme: vi.fn() })
    renderAppShell('USER')

    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument()
  })

  it('renders Sun icon and "Switch to light mode" label when theme is dark', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme: vi.fn() })
    renderAppShell('USER')

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })

  it('calls setTheme with "dark" when toggle is clicked in light mode', async () => {
    const setTheme = vi.fn()
    mockUseTheme.mockReturnValue({ theme: 'light', setTheme })
    renderAppShell('USER')

    await userEvent.click(screen.getByRole('button', { name: /switch to dark mode/i }))

    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('calls setTheme with "light" when toggle is clicked in dark mode', async () => {
    const setTheme = vi.fn()
    mockUseTheme.mockReturnValue({ theme: 'dark', setTheme })
    renderAppShell('USER')

    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }))

    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('resolves system theme via matchMedia and renders correct label', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    })
    mockUseTheme.mockReturnValue({ theme: 'system', setTheme: vi.fn() })
    renderAppShell('USER')

    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument()
  })
})
