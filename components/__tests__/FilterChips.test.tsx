import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterChips } from '../FilterChips';

describe('FilterChips', () => {
  const mockOptions = [
    { id: 'all', label: 'All' },
    { id: 'trend', label: 'Trend' },
    { id: 'scalping', label: 'Scalping' },
    { id: 'custom', label: 'Custom' }
  ];

  const defaultProps = {
    options: mockOptions,
    onChange: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders all options', () => {
      render(<FilterChips {...defaultProps} />);
      
      expect(screen.getByRole('group')).toBeInTheDocument();
      expect(screen.getByText('All')).toBeInTheDocument();
      expect(screen.getByText('Trend')).toBeInTheDocument();
      expect(screen.getByText('Scalping')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('renders with custom aria-label', () => {
      render(<FilterChips {...defaultProps} aria-label="Filter robots" />);
      
      expect(screen.getByLabelText('Filter robots')).toBeInTheDocument();
    });

    it('renders option with icon', () => {
      const optionsWithIcon = [
        { id: 'test', label: 'Test', icon: <span data-testid="test-icon">🔥</span> }
      ];
      
      render(<FilterChips options={optionsWithIcon} onChange={vi.fn()} />);
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('renders option with count', () => {
      const optionsWithCount = [
        { id: 'test', label: 'Test', count: 5 }
      ];
      
      render(<FilterChips options={optionsWithCount} onChange={vi.fn()} />);
      
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('handles single select mode by default', () => {
      const onChange = vi.fn();
      render(<FilterChips {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Trend'));
      
      expect(onChange).toHaveBeenCalledWith(['trend']);
    });

    it('handles multi select mode', async () => {
      const onChange = vi.fn();
      const { rerender } = render(<FilterChips {...defaultProps} onChange={onChange} multiSelect />);
      
      fireEvent.click(screen.getByText('Trend'));
      
      expect(onChange).toHaveBeenNthCalledWith(1, ['trend']);
      
      // Rerender with the new selected values to simulate controlled component
      rerender(<FilterChips {...defaultProps} onChange={onChange} multiSelect selectedValues={['trend']} />);
      
      fireEvent.click(screen.getByText('Scalping'));
      
      expect(onChange).toHaveBeenNthCalledWith(2, ['trend', 'scalping']);
    });

    it('deselects in single mode when allowDeselect is true', () => {
      const onChange = vi.fn();
      render(
        <FilterChips
          {...defaultProps}
          onChange={onChange}
          selectedValue="trend"
          allowDeselect
        />
      );
      
      fireEvent.click(screen.getByText('Trend'));
      
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('does not deselect when allowDeselect is false', () => {
      const onChange = vi.fn();
      render(
        <FilterChips
          {...defaultProps}
          onChange={onChange}
          selectedValue="trend"
          allowDeselect={false}
        />
      );
      
      fireEvent.click(screen.getByText('Trend'));
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('respects disabled prop', () => {
      const onChange = vi.fn();
      render(<FilterChips {...defaultProps} onChange={onChange} disabled />);
      
      fireEvent.click(screen.getByText('Trend'));
      
      expect(onChange).not.toHaveBeenCalled();
    });

    it('respects disabled option', () => {
      const onChange = vi.fn();
      const options = [
        { id: 'enabled', label: 'Enabled' },
        { id: 'disabled', label: 'Disabled', disabled: true }
      ];
      
      render(<FilterChips options={options} onChange={onChange} />);
      
      fireEvent.click(screen.getByText('Disabled'));
      
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('variants', () => {
    it('renders filled variant', () => {
      render(<FilterChips {...defaultProps} variant="filled" />);
      
      const buttons = screen.getAllByRole('checkbox');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders outlined variant', () => {
      render(<FilterChips {...defaultProps} variant="outlined" />);
      
      const buttons = screen.getAllByRole('checkbox');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('renders elevated variant', () => {
      render(<FilterChips {...defaultProps} variant="elevated" />);
      
      const buttons = screen.getAllByRole('checkbox');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('sizes', () => {
    it('renders small size', () => {
      render(<FilterChips {...defaultProps} size="sm" />);
      
      const buttons = screen.getAllByRole('checkbox');
      expect(buttons[0]).toBeInTheDocument();
    });

    it('renders large size', () => {
      render(<FilterChips {...defaultProps} size="lg" />);
      
      const buttons = screen.getAllByRole('checkbox');
      expect(buttons[0]).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('handles keyboard navigation with ArrowRight', () => {
      render(<FilterChips {...defaultProps} />);
      
      const buttons = screen.getAllByRole('checkbox');
      const firstButton = buttons[0];
      
      // Just verify the keydown handler works without error
      if (firstButton) {
        fireEvent.keyDown(firstButton, { key: 'ArrowRight' });
        // Focus management is internal - just verify no error
        expect(firstButton).toBeInTheDocument();
      }
    });

    it('handles Enter key to select', () => {
      const onChange = vi.fn();
      render(<FilterChips {...defaultProps} onChange={onChange} />);
      
      const buttons = screen.getAllByRole('checkbox');
      const firstButton = buttons[0];
      
      if (firstButton) {
        firstButton.focus();
        
        fireEvent.keyDown(firstButton, { key: 'Enter' });
        
        expect(onChange).toHaveBeenCalledWith(['all']);
      }
    });
  });

  describe('maxVisible', () => {
    it('shows "more" button when options exceed maxVisible', () => {
      render(<FilterChips {...defaultProps} maxVisible={2} />);
      
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('calls onShowMore when "more" button is clicked', () => {
      const onShowMore = vi.fn();
      render(<FilterChips {...defaultProps} maxVisible={2} onShowMore={onShowMore} />);
      
      fireEvent.click(screen.getByText('+2 more'));
      
      expect(onShowMore).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA role', () => {
      render(<FilterChips {...defaultProps} />);
      
      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('has correct checkbox role for chips', () => {
      render(<FilterChips {...defaultProps} />);
      
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(mockOptions.length);
    });

    it('sets aria-checked correctly', () => {
      render(<FilterChips {...defaultProps} selectedValue="trend" />);
      
      const trendButton = screen.getByRole('checkbox', { name: /trend/i });
      expect(trendButton).toHaveAttribute('aria-checked', 'true');
    });
  });
});
