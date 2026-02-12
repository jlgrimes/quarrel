import { useParams } from 'react-router-dom';
import { useConversations } from '../hooks/useDMs';
import { DMChat } from '../components/chat/DMChat';

export default function DMPage() {
  const { conversationId } = useParams();
  const { data: conversations = [] } = useConversations();

  const activeConversation = conversations.find((c) => c.id === conversationId);

  if (!conversationId) {
    return (
      <div className="m-1 flex flex-1 flex-col items-center justify-center rounded-2xl border border-white/10 bg-card/70 text-text-muted">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mb-4 opacity-30">
          <path d="M14 8.00598C14 10.211 12.206 12.006 10 12.006C7.795 12.006 6 10.211 6 8.00598C6 5.80098 7.795 4.00598 10 4.00598C12.206 4.00598 14 5.80098 14 8.00598ZM2 19.006C2 15.473 5.29 13.006 10 13.006C14.711 13.006 18 15.473 18 19.006V20.006H2V19.006Z" />
        </svg>
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  return <DMChat conversationId={conversationId} conversation={activeConversation} />;
}
