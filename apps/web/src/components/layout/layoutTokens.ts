export const LAYOUT = {
  mainPane: 'flex h-full min-h-0 flex-col px-1 pb-1.5 pt-1',
  mainHeader: 'mb-1.5 flex h-12 shrink-0 items-center px-3',
  secondarySidebar: 'shrink-0 bg-transparent',
  secondarySidebarInner:
    'grid h-full grid-rows-[3rem_minmax(0,1fr)_auto] gap-1.5 pl-1.5 pt-1.5 pb-1.5 pr-1',
  secondarySidebarHeader:
    'group quarrel-panel flex h-12 items-center border-none px-2.5 py-0',
  secondarySidebarContent:
    'quarrel-panel flex min-h-0 flex-1 flex-col gap-2 overflow-auto border-none px-1 py-1',
  secondarySidebarFooter: 'flex flex-col gap-1.5 p-0',
} as const;
