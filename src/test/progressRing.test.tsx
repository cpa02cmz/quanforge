import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressRing, ProgressRingGroup } from '../../components/ProgressRing';

describe('ProgressRing', () => {
  it('should render with default props', () => {
    render(<ProgressRing value={50} />);
    
    // Check that progressbar role exists
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should display correct aria-valuenow', () => {
    render(<ProgressRing value={75} />);
    
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '75');
  });

  it('should display percentage label when showLabel is true', () => {
    render(<ProgressRing value={42} showLabel />);
    
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('should render custom label', () => {
    render(<ProgressRing value={50} label={<span>Custom Label</span>} />);
    
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('should respect min and max values', () => {
    render(<ProgressRing value={5} min={0} max={10} showLabel />);
    
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should clamp values outside range', () => {
    render(<ProgressRing value={150} showLabel />);
    
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should clamp negative values', () => {
    render(<ProgressRing value={-50} showLabel />);
    
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should use custom aria-label', () => {
    render(<ProgressRing value={50} aria-label="Upload progress" />);
    
    expect(screen.getByLabelText('Upload progress')).toBeInTheDocument();
  });

  it('should render different sizes', () => {
    const { container } = render(<ProgressRing value={50} size="lg" />);
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('ProgressRingGroup', () => {
  const mockItems = [
    { value: 80, label: 'Completed' },
    { value: 60, label: 'In Progress' },
    { value: 30, label: 'Pending' },
  ];

  it('should render all progress rings', () => {
    render(<ProgressRingGroup items={mockItems} />);
    
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('should render item labels', () => {
    render(<ProgressRingGroup items={mockItems} />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('should support custom colors', () => {
    const itemsWithColors = [
      { value: 50, color: '#ff0000' },
    ];
    
    render(<ProgressRingGroup items={itemsWithColors} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
