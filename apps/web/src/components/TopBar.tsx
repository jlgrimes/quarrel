import { useParams } from 'react-router-dom';
import { useServerStore } from '../stores/serverStore';
import { useUIStore } from '../stores/uiStore';

export default function TopBar() {
  const { channelId } = useParams();
  const channels = useServerStore((s) => s.channels);
  const toggleMemberList = useUIStore((s) => s.toggleMemberList);
  const showMemberList = useUIStore((s) => s.showMemberList);

  const channel = channels.find((c) => c.id === channelId);

  return (
    <div className="flex h-12 items-center border-b border-[#1f2023] bg-[#313338] px-4 shadow-sm">
      {channel && (
        <>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#949ba4" className="mr-2 shrink-0">
            <path d="M5.88 21l.54-3H2.5l.34-2h3.92l.72-4H3.56l.34-2h3.92l.54-3h2l-.54 3h4l.54-3h2l-.54 3h3.42l-.34 2h-3.92l-.72 4h3.92l-.34 2h-3.92l-.54 3h-2l.54-3h-4l-.54 3h-2zm3.46-5h4l.72-4h-4l-.72 4z" />
          </svg>
          <span className="font-semibold text-white">{channel.name}</span>
          {channel.topic && (
            <>
              <div className="mx-3 h-6 w-px bg-[#3f4147]" />
              <span className="truncate text-sm text-[#949ba4]">{channel.topic}</span>
            </>
          )}
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggleMemberList}
          className={`rounded p-1 transition-colors ${showMemberList ? 'text-white' : 'text-[#b5bac1]'} hover:text-white`}
          title="Member List"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006ZM20 20.006H22V19.006C22 16.165 20.052 14.0177 17 13.29V13.006C17 13.006 17 13.006 17 13.006C17 13.006 20 15.473 20 19.006V20.006Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
