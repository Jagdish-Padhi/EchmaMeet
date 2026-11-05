import type { ReactNode } from 'react';

export interface BadgeProps {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'neutral' | 'accent' | 'warning' | 'danger';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
