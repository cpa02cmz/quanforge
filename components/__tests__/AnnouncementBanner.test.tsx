/**
 * Tests for AnnouncementBanner component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnnouncementBanner, useAnnouncements } from '../AnnouncementBanner';

// Mock useReducedMotion hook
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

describe('AnnouncementBanner', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders message content', () => {
    render(
      <AnnouncementBanner
        id="test-banner"
        message="Test announcement message"
      />
    );

    expect(screen.getByText('Test announcement message')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(
      <AnnouncementBanner
        id="test-banner"
        title="Test Title"
        message="Test message"
      />
    );

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders different variants', () => {
    const { rerender } = render(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        variant="info"
      />
    );

    expect(document.querySelector('.bg-blue-900\\/30')).toBeInTheDocument();

    rerender(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        variant="success"
      />
    );

    expect(document.querySelector('.bg-green-900\\/30')).toBeInTheDocument();

    rerender(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        variant="warning"
      />
    );

    expect(document.querySelector('.bg-yellow-900\\/30')).toBeInTheDocument();

    rerender(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        variant="error"
      />
    );

    expect(document.querySelector('.bg-red-900\\/30')).toBeInTheDocument();
  });

  it('shows dismiss button when dismissible', () => {
    render(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        dismissible
      />
    );

    expect(screen.getByLabelText('Dismiss announcement')).toBeInTheDocument();
  });

  it('calls onDismiss when dismissed', async () => {
    const onDismiss = vi.fn();
    render(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        dismissible
        onDismiss={onDismiss}
        persistDismissal={false}
      />
    );

    const dismissButton = screen.getByLabelText('Dismiss announcement');
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('renders action button when provided', () => {
    const onAction = vi.fn();
    render(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
        actionText="Click me"
        onAction={onAction}
      />
    );

    const actionButton = screen.getByText('Click me');
    expect(actionButton).toBeInTheDocument();
    
    fireEvent.click(actionButton);
    expect(onAction).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(
      <AnnouncementBanner
        id="test-banner"
        message="Test"
      />
    );

    const banner = screen.getByRole('alert');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });
});

describe('useAnnouncements hook', () => {
  it('provides dismiss, isDismissed, reset, and resetAll functions', () => {
    const { result } = renderHook(() => useAnnouncements());
    
    expect(typeof result.current.dismiss).toBe('function');
    expect(typeof result.current.isDismissed).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.resetAll).toBe('function');
  });
});

// Helper for testing hooks
function renderHook<T>(hook: () => T) {
  let result: { current: T } = { current: null as unknown as T };
  
  function TestComponent() {
    result.current = hook();
    return null;
  }
  
  render(<TestComponent />);
  
  return { result };
}
