export const SIDEBAR_BADGE_CLASS =
  'flex h-4 min-w-[18px] items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white';

export const SIDEBAR_ITEM_BASE_BUTTON_CLASS =
  'relative flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-colors outline-none hover:bg-bg-modifier-hover hover:text-text-normal';

export function sidebarItemButtonClass({
  isActive,
  hasUnread,
  tall = false,
}: {
  isActive: boolean;
  hasUnread: boolean;
  tall?: boolean;
}) {
  const sizeClass = tall ? 'h-10' : '';
  const emphasisClass = isActive
    ? 'bg-bg-modifier-active text-white font-medium'
    : hasUnread
      ? 'font-bold text-white'
      : 'text-text-muted hover:text-text-normal';

  return [
    SIDEBAR_ITEM_BASE_BUTTON_CLASS,
    sizeClass,
    emphasisClass,
  ].filter(Boolean).join(' ');
}
