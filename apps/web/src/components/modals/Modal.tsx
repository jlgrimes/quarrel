import { useEffect, useRef } from 'react';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ title, onClose, children }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
    >
      <div className="relative max-w-md w-[440px] rounded-lg bg-[#313338] shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[#949ba4] hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.4 4L12 10.4 5.6 4 4 5.6 10.4 12 4 18.4 5.6 20 12 13.6 18.4 20 20 18.4 13.6 12 20 5.6z" />
          </svg>
        </button>
        <div className="p-4">
          <h2 className="text-center text-xl font-bold text-white">{title}</h2>
        </div>
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
