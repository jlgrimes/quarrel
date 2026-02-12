import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Channel } from '@quarrel/shared';
import { useServers } from '../../hooks/useServers';
import { useChannels } from '../../hooks/useChannels';
import { useConversations } from '../../hooks/useDMs';
import { useUIStore } from '../../stores/uiStore';
import { Button } from '@/components/ui/button';

export default function MobileSidebar() {
  const navigate = useNavigate();
  const { serverId, channelId, conversationId } = useParams();
  const { data: servers = [] } = useServers();
  const { data: channels = [] } = useChannels(serverId);
  const { data: conversations = [] } = useConversations();
  const mobileSidebarOpen = useUIStore(s => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore(s => s.setMobileSidebarOpen);
  const openModal = useUIStore(s => s.openModal);

  const isDMRoute = !serverId;
  const activeServer = servers.find(server => server.id === serverId);

  const { uncategorized, categorized } = useMemo(() => {
    const cats = channels
      .filter((c: any) => c.type === 'category')
      .sort((a: any, b: any) => a.position - b.position);

    const nonCat = channels
      .filter((c: any) => c.type !== 'category')
      .sort((a: any, b: any) => a.position - b.position);

    return {
      uncategorized: nonCat.filter((c: any) => !c.categoryId),
      categorized: cats.map((cat: any) => ({
        category: cat,
        channels: nonCat.filter((c: any) => c.categoryId === cat.id),
      })),
    };
  }, [channels]);

  const close = () => setMobileSidebarOpen(false);

  const handleServerClick = (id: string) => {
    navigate(`/channels/${id}`);
    close();
  };

  const handleDMClick = (id: string) => {
    navigate(`/channels/@me/${id}`);
    close();
  };

  const handleChannelClick = (id: string) => {
    if (!serverId) return;
    navigate(`/channels/${serverId}/${id}`);
    close();
  };

  return (
    <>
      {mobileSidebarOpen && (
        <button
          aria-label='Close sidebar'
          className='fixed inset-0 z-40 bg-black/55 md:hidden'
          onClick={close}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[320px] max-w-[88vw] border-r border-bg-tertiary bg-bg-secondary transition-transform duration-200 md:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className='flex h-full w-[72px] flex-col items-center border-r border-bg-tertiary bg-bg-tertiary py-3 pt-[env(safe-area-inset-top)]'>
          <Button
            variant='ghost'
            className={`mb-2 h-12 w-12 p-0 text-xl font-bold ${
              isDMRoute
                ? 'bg-brand text-white rounded-[16px] hover:bg-brand'
                : 'bg-bg-primary text-text-normal rounded-[24px] hover:bg-brand hover:text-white'
            }`}
            onClick={() => {
              navigate('/channels/@me');
              close();
            }}
          >
            Q
          </Button>

          <div className='mb-2 h-[2px] w-8 rounded-full bg-bg-modifier-hover' />

          <div className='flex-1 w-full overflow-y-auto px-2'>
            {servers.map(server => (
              <Button
                key={server.id}
                variant='ghost'
                className={`mb-2 h-12 w-12 p-0 text-lg font-semibold text-white ${
                  serverId === server.id
                    ? 'bg-brand rounded-[16px]'
                    : 'bg-bg-primary rounded-[24px] hover:bg-brand hover:rounded-[16px]'
                }`}
                onClick={() => handleServerClick(server.id)}
                title={server.name}
              >
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className='h-full w-full rounded-[inherit] object-cover'
                  />
                ) : (
                  server.name.charAt(0).toUpperCase()
                )}
              </Button>
            ))}
          </div>

          <Button
            variant='ghost'
            className='mb-2 h-12 w-12 rounded-[24px] bg-bg-primary p-0 text-2xl text-green hover:bg-green hover:text-white hover:rounded-[16px]'
            onClick={() => openModal('createServer')}
          >
            +
          </Button>
          <Button
            variant='ghost'
            className='h-12 w-12 rounded-[24px] bg-bg-primary p-0 text-xs font-semibold text-green hover:bg-green hover:text-white hover:rounded-[16px]'
            onClick={() => openModal('joinServer')}
          >
            Join
          </Button>
        </div>

        <div className='flex h-full min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)]'>
          <div className='flex h-12 items-center border-b border-bg-tertiary px-4'>
            <h2 className='truncate text-sm font-semibold text-white'>
              {isDMRoute ? 'Direct Messages' : activeServer?.name || 'Channels'}
            </h2>
          </div>

          <div className='flex-1 overflow-y-auto p-2'>
            {isDMRoute ? (
              <div className='space-y-1'>
                <Button
                  variant='ghost'
                  className={`h-9 w-full justify-start ${
                    !conversationId
                      ? 'bg-bg-modifier-active text-white'
                      : 'text-text-muted hover:text-text-normal'
                  }`}
                  onClick={() => {
                    navigate('/channels/@me');
                    close();
                  }}
                >
                  Friends
                </Button>
                {conversations.map(conv => {
                  const other = conv.members?.[0];
                  const name =
                    other?.displayName || other?.username || 'Direct Message';
                  return (
                    <Button
                      key={conv.id}
                      variant='ghost'
                      className={`h-9 w-full justify-start ${
                        conversationId === conv.id
                          ? 'bg-bg-modifier-active text-white'
                          : 'text-text-muted hover:text-text-normal'
                      }`}
                      onClick={() => handleDMClick(conv.id)}
                    >
                      <span className='truncate'>{name}</span>
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className='space-y-3'>
                {uncategorized.length > 0 && (
                  <div className='space-y-1'>
                    {uncategorized.map((ch: Channel & { unreadCount?: number }) => (
                      <Button
                        key={ch.id}
                        variant='ghost'
                        className={`h-9 w-full justify-start ${
                          channelId === ch.id
                            ? 'bg-bg-modifier-active text-white'
                            : 'text-text-muted hover:text-text-normal'
                        }`}
                        onClick={() => handleChannelClick(ch.id)}
                      >
                        <span className='mr-2'>{ch.type === 'voice' ? '🔊' : '#'}</span>
                        <span className='truncate'>{ch.name}</span>
                      </Button>
                    ))}
                  </div>
                )}

                {categorized.map(
                  ({
                    category,
                    channels: categoryChannels,
                  }: {
                    category: Channel;
                    channels: (Channel & { unreadCount?: number })[];
                  }) => (
                    <div key={category.id} className='space-y-1'>
                      <p className='px-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted'>
                        {category.name}
                      </p>
                      {categoryChannels.map(ch => (
                        <Button
                          key={ch.id}
                          variant='ghost'
                          className={`h-9 w-full justify-start ${
                            channelId === ch.id
                              ? 'bg-bg-modifier-active text-white'
                              : 'text-text-muted hover:text-text-normal'
                          }`}
                          onClick={() => handleChannelClick(ch.id)}
                        >
                          <span className='mr-2'>
                            {ch.type === 'voice' ? '🔊' : '#'}
                          </span>
                          <span className='truncate'>{ch.name}</span>
                        </Button>
                      ))}
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
