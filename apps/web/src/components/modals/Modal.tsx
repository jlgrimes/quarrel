import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ title, onClose, children }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-[440px] bg-[#313338] border-none p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-center text-xl font-bold text-white">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
