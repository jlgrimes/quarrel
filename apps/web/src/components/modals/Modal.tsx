import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';

type Props = {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ title, description, onClose, children }: Props) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className='w-[440px] max-w-md border-none bg-transparent p-0 shadow-none'
      >
        <Card className='quarrel-panel gap-0 border-white/10 py-0'>
          <DialogHeader className='px-4 pt-4 pb-1 text-left'>
            <DialogTitle className='text-xl font-bold text-white'>{title}</DialogTitle>
            {description && (
              <DialogDescription className='text-sm text-text-label'>
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
          <CardContent className='px-4 pb-4'>{children}</CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
