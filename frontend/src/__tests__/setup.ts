import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import { ReactElement } from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import React from 'react'

// Mock DataTransfer for file upload tests
class MockDataTransfer {
  items: DataTransferItem[] = []
  files: File[] = []
  types: string[] = []
  dropEffect: 'none' | 'copy' | 'move' | 'link' = 'none'
  effectAllowed: string = 'uninitialized'

  constructor() {
    this.items = []
    this.files = []
    this.types = []
  }

  clearData(format?: string): void {
    if (format) {
      this.items = this.items.filter(item => item.type !== format)
    } else {
      this.items = []
      this.types = []
    }
  }

  getData(format: string): string {
    const item = this.items.find(i => i.type === format)
    return item ? item.data : ''
  }

  setData(format: string, data: string): void {
    this.items.push({ type: format, data })
    if (!this.types.includes(format)) {
      this.types.push(format)
    }
  }

  setDragImage(): void {}
}

Object.defineProperty(window, 'DataTransfer', {
  writable: true,
  value: MockDataTransfer,
})

// Mock File constructor for jsdom
const originalFile = global.File
global.File = class File extends originalFile {
  constructor(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag) {
    const blob = new Blob(fileBits, options)
    return Object.assign(blob, { name: fileName, lastModified: Date.now() })
  }
} as unknown as typeof File

// Mock window.confirm for delete tests
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn(() => true),
})

afterEach(() => {
  cleanup()
})

vi.mock('react-hot-toast', async () => {
  const mockToast = {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
    promise: vi.fn(),
  }
  return {
    __esModule: true,
    default: mockToast,
    toast: mockToast,
    Toaster: () => null,
  }
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Wrapper for React Router context
export const renderWithRouter = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return rtlRender(ui, {
    wrapper: ({ children }) => {
      return React.createElement(MemoryRouter, null, children as React.ReactNode)
    },
    ...options,
  })
}
