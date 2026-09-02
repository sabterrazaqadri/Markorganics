"use client";

import { create } from "zustand";

interface ToastState {
  message: string | null;
  key: number;
  show: (message: string) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  key: 0,
  show: (message) => {
    if (timer) clearTimeout(timer);
    set((s) => ({ message, key: s.key + 1 }));
    timer = setTimeout(() => set({ message: null }), 2400);
  },
  hide: () => set({ message: null }),
}));

export function ToastViewport() {
  const { message, key } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 sm:bottom-6"
    >
      {message ? (
        <div key={key} className="anim-toast rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {message}
        </div>
      ) : null}
    </div>
  );
}
