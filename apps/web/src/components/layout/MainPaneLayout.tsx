import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LAYOUT } from './layoutTokens';

type MainPaneLayoutProps = {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
};

export function MainPaneLayout({
  header,
  children,
  className,
  headerClassName,
}: MainPaneLayoutProps) {
  return (
    <div className={cn(LAYOUT.mainPane, className)}>
      <div className={cn(LAYOUT.mainHeader, headerClassName)}>{header}</div>
      {children}
    </div>
  );
}

