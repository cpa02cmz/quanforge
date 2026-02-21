/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Accordion, AccordionItem } from '../../components/Accordion';

describe('Accordion', () => {
  const mockItems = [
    { id: '1', title: 'First Item', content: 'First content' },
    { id: '2', title: 'Second Item', content: 'Second content' },
    { id: '3', title: 'Third Item', content: 'Third content', disabled: true },
  ];

  it('should render all accordion items', () => {
    render(<Accordion items={mockItems} />);
    
    expect(screen.getByText('First Item')).toBeInTheDocument();
    expect(screen.getByText('Second Item')).toBeInTheDocument();
    expect(screen.getByText('Third Item')).toBeInTheDocument();
  });

  it('should expand item on click', () => {
    render(<Accordion items={mockItems} />);
    
    const firstItem = screen.getByText('First Item');
    fireEvent.click(firstItem);
    
    expect(screen.getByText('First content')).toBeInTheDocument();
  });

  it('should respect allowMultiple prop', () => {
    render(<Accordion items={mockItems} allowMultiple />);
    
    fireEvent.click(screen.getByText('First Item'));
    fireEvent.click(screen.getByText('Second Item'));
    
    expect(screen.getByText('First content')).toBeInTheDocument();
    expect(screen.getByText('Second content')).toBeInTheDocument();
  });

  it('should not expand disabled items', () => {
    render(<Accordion items={mockItems} />);
    
    const disabledItem = screen.getByText('Third Item').closest('[role="button"]');
    if (disabledItem) {
      fireEvent.click(disabledItem);
    }
    
    // Content should not be visible since item is disabled
    // Check aria-expanded is not true for disabled item
    expect(disabledItem).toHaveAttribute('aria-expanded', 'false');
  });

  it('should call onChange callback when item is toggled', () => {
    const onChange = vi.fn();
    render(<Accordion items={mockItems} onChange={onChange} />);
    
    fireEvent.click(screen.getByText('First Item'));
    
    expect(onChange).toHaveBeenCalledWith(['1']);
  });

  it('should respect defaultExpandedIds prop', () => {
    render(<Accordion items={mockItems} defaultExpandedIds={['2']} />);
    
    expect(screen.getByText('Second content')).toBeInTheDocument();
  });

  it('should work in controlled mode', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Accordion items={mockItems} expandedIds={['1']} onChange={onChange} />
    );
    
    expect(screen.getByText('First content')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Second Item'));
    expect(onChange).toHaveBeenCalledWith(['2']);
    
    // Rerender with new expandedIds
    rerender(
      <Accordion items={mockItems} expandedIds={['2']} onChange={onChange} />
    );
    
    expect(screen.getByText('Second content')).toBeInTheDocument();
  });

  it('should toggle on Enter key press', () => {
    render(<Accordion items={mockItems} />);
    
    const firstItem = screen.getByText('First Item').closest('[role="button"]');
    if (firstItem) {
      fireEvent.keyDown(firstItem, { key: 'Enter' });
    }
    
    expect(screen.getByText('First content')).toBeInTheDocument();
  });

  it('should toggle on Space key press', () => {
    render(<Accordion items={mockItems} />);
    
    const firstItem = screen.getByText('First Item').closest('[role="button"]');
    if (firstItem) {
      fireEvent.keyDown(firstItem, { key: ' ' });
    }
    
    expect(screen.getByText('First content')).toBeInTheDocument();
  });
});

describe('AccordionItem', () => {
  it('should render with title', () => {
    render(
      <AccordionItem title="Test Title" isExpanded={false} onToggle={() => {}}>
        Test Content
      </AccordionItem>
    );
    
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should show content when expanded', () => {
    render(
      <AccordionItem title="Test Title" isExpanded={true} onToggle={() => {}}>
        Test Content
      </AccordionItem>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should call onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(
      <AccordionItem title="Test Title" isExpanded={false} onToggle={onToggle}>
        Test Content
      </AccordionItem>
    );
    
    fireEvent.click(screen.getByText('Test Title'));
    
    expect(onToggle).toHaveBeenCalled();
  });

  it('should not toggle when disabled', () => {
    const onToggle = vi.fn();
    render(
      <AccordionItem 
        title="Test Title" 
        isExpanded={false} 
        onToggle={onToggle}
        disabled
      >
        Test Content
      </AccordionItem>
    );
    
    fireEvent.click(screen.getByText('Test Title'));
    
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('should render with icon and badge', () => {
    render(
      <AccordionItem 
        title="Test Title" 
        isExpanded={false} 
        onToggle={() => {}}
        icon={<span data-testid="test-icon">Icon</span>}
        badge={5}
      >
        Test Content
      </AccordionItem>
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
