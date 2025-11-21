// Vitest setup file
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock navigator.geolocation
Object.defineProperty(globalThis, 'navigator', {
  value: {
    geolocation: {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 4.711,
            longitude: -74.0721,
            accuracy: 10
          }
        })
      })
    }
  },
  writable: true
})

// Mock document.execCommand for RichTextEditor
if (typeof document !== 'undefined') {
  document.execCommand = vi.fn()
}

// Mock URL constructor and its methods
class MockURL {
  href: string = '';
  origin: string = '';
  pathname: string = '';
  search: string = '';
  hash: string = '';
  
  constructor(url: string, base?: string) {
    // Simple URL parsing mock - avoid recursion by not calling new URL()
    let fullUrl = url;
    if (base && !url.includes('://')) {
      fullUrl = base.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
    }
    
    this.href = fullUrl;
    
    if (fullUrl.includes('://')) {
      const parts = fullUrl.split('/');
      this.origin = parts.slice(0, 3).join('/');
      this.pathname = '/' + parts.slice(3).join('/');
    } else {
      this.origin = '';
      this.pathname = fullUrl;
    }
    
    if (fullUrl.includes('?')) {
      const [path, query] = fullUrl.split('?');
      this.search = '?' + query;
      this.pathname = path;
    }
    
    if (fullUrl.includes('#')) {
      const [base, fragment] = fullUrl.split('#');
      this.hash = '#' + fragment;
      this.href = base;
    }
  }
  
  static createObjectURL = vi.fn(() => 'blob:mock-url');
  static revokeObjectURL = vi.fn();
}

Object.defineProperty(globalThis, 'URL', {
  value: MockURL,
  writable: true
})

// Mock URLSearchParams
class MockURLSearchParams {
  private params: Map<string, string>;
  
  constructor(init?: string | string[][] | Record<string, string>) {
    this.params = new Map();
    if (typeof init === 'string') {
      if (init.startsWith('?')) init = init.slice(1);
      init.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key) this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
      });
    } else if (Array.isArray(init)) {
      init.forEach(([key, value]) => this.params.set(key, value));
    } else if (init) {
      Object.entries(init).forEach(([key, value]) => this.params.set(key, value));
    }
  }
  
  get(name: string): string | null {
    return this.params.get(name) || null;
  }
  
  has(name: string): boolean {
    return this.params.has(name);
  }
  
  set(name: string, value: string): void {
    this.params.set(name, value);
  }
  
  delete(name: string): void {
    this.params.delete(name);
  }
  
  toString(): string {
    return Array.from(this.params.entries())
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }
}

Object.defineProperty(globalThis, 'URLSearchParams', {
  value: MockURLSearchParams,
  writable: true
})