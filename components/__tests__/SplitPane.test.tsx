/**
 * Tests for SplitPane component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SplitPane } from '../SplitPane';

// Mock useReducedMotion hook
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

describe('SplitPane', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders primary and secondary content', () => {
    render(
      <SplitPane
        primary={<div data-testid="primary">Primary Content</div>}
        secondary={<div data-testid="secondary">Secondary Content</div>}
      />
    );

    expect(screen.getByTestId('primary')).toBeInTheDocument();
    expect(screen.getByTestId('secondary')).toBeInTheDocument();
  });

  it('renders horizontal split by default', () => {
    render(
      <SplitPane
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
      />
    );

    const container = document.querySelector('.split-pane');
    expect(container).toHaveAttribute('data-direction', 'horizontal');
  });

  it('renders vertical split when specified', () => {
    render(
      <SplitPane
        direction="vertical"
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
      />
    );

    const container = document.querySelector('.split-pane');
    expect(container).toHaveAttribute('data-direction', 'vertical');
  });

  it('has proper accessibility attributes', () => {
    render(
      <SplitPane
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
        ariaLabel="Resize panel"
      />
    );

    const splitter = screen.getByRole('separator');
    expect(splitter).toHaveAttribute('aria-label', 'Resize panel');
    expect(splitter).toHaveAttribute('tabindex', '0');
  });

  it('supports keyboard navigation', async () => {
    const onSizeChange = vi.fn();
    render(
      <SplitPane
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
        onSizeChange={onSizeChange}
      />
    );

    const splitter = screen.getByRole('separator');
    fireEvent.focus(splitter);
    fireEvent.keyDown(splitter, { key: 'ArrowRight' });

    // Keyboard should trigger size change
    await waitFor(() => {
      expect(onSizeChange).toHaveBeenCalled();
    });
  });
});

describe('SplitPane - Collapsible', () => {
  it('shows collapse button when enabled', () => {
    render(
      <SplitPane
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
        allowCollapse
        showCollapseButton
      />
    );

    const collapseButton = screen.getByLabelText('Collapse pane');
    expect(collapseButton).toBeInTheDocument();
  });

  it('toggles collapse state on button click', async () => {
    const onCollapseChange = vi.fn();
    render(
      <SplitPane
        primary={<div>Primary</div>}
        secondary={<div>Secondary</div>}
        allowCollapse
        showCollapseButton
        onCollapseChange={onCollapseChange}
      />
    );

    const collapseButton = screen.getByLabelText('Collapse pane');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(onCollapseChange).toHaveBeenCalledWith(true);
    });
  });
});
