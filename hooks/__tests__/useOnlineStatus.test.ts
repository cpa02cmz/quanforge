/**
 * Tests for useOnlineStatus hook
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineStatus, useIsOnline, useIsOffline } from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  const originalNavigator = global.navigator;
  
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    global.navigator = originalNavigator;
  });

  it('should return online status as true when navigator.onLine is true', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOffline).toBe(false);
  });

  it('should return online status as false when navigator.onLine is false', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('should update status when online event is fired', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(false);
    
    // Update navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    expect(result.current.isOnline).toBe(true);
  });

  it('should update status when offline event is fired', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.isOnline).toBe(true);
    
    // Update navigator.onLine
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    expect(result.current.isOnline).toBe(false);
    expect(result.current.disconnectCount).toBe(1);
  });

  it('should call onOnline callback when going online', () => {
    const onOnline = vi.fn();
    
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    renderHook(() => useOnlineStatus({ onOnline }));
    
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    expect(onOnline).toHaveBeenCalled();
  });

  it('should call onOffline callback when going offline', () => {
    const onOffline = vi.fn();
    
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    renderHook(() => useOnlineStatus({ onOffline }));
    
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    expect(onOffline).toHaveBeenCalled();
  });

  it('should return checkStatus function that returns current status', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    const { result } = renderHook(() => useOnlineStatus());
    
    expect(result.current.checkStatus()).toBe(true);
  });
});

describe('useIsOnline', () => {
  it('should return true when online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    const { result } = renderHook(() => useIsOnline());
    
    expect(result.current).toBe(true);
  });

  it('should return false when offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    const { result } = renderHook(() => useIsOnline());
    
    expect(result.current).toBe(false);
  });
});

describe('useIsOffline', () => {
  it('should return false when online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    });
    
    const { result } = renderHook(() => useIsOffline());
    
    expect(result.current).toBe(false);
  });

  it('should return true when offline', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: false,
    });
    
    const { result } = renderHook(() => useIsOffline());
    
    expect(result.current).toBe(true);
  });
});
