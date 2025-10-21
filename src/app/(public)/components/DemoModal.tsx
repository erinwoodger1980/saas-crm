"use client";

import * as Dialog from "@radix-ui/react-dialog";

export type DemoModalProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  videoUrl: string;
};

export default function DemoModal({ open, onOpenChange, videoUrl }: DemoModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/70 backdrop-blur" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <Dialog.Title className="text-lg font-semibold text-slate-900">See JoineryAI in action</Dialog.Title>
              <Dialog.Close
                aria-label="Close demo"
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </Dialog.Close>
            </div>
            <div className="aspect-video bg-slate-900">
              <iframe
                src={videoUrl}
                title="JoineryAI demo video"
                className="h-full w-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
