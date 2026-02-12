import type { ReactNode } from 'react';
import { LAYOUT } from '../layout/layoutTokens';

type SecondarySidebarLayoutProps = {
  header: ReactNode;
  content: ReactNode;
  footer: ReactNode;
};

export function SecondarySidebarLayout({
  header,
  content,
  footer,
}: SecondarySidebarLayoutProps) {
  return (
    <aside className={LAYOUT.secondarySidebar}>
      <div className={LAYOUT.secondarySidebarInner}>
        <div className={LAYOUT.secondarySidebarHeader}>{header}</div>
        <div className={LAYOUT.secondarySidebarContent}>{content}</div>
        <div className={LAYOUT.secondarySidebarFooter}>{footer}</div>
      </div>
    </aside>
  );
}
