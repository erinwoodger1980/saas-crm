// super light event bus for cross-component signals
export type AppEventMap = {
  "open-lead": { leadId: string };
  "lead-action-completed": { leadId: string; taskId?: string };
};

export function emit<K extends keyof AppEventMap>(type: K, detail: AppEventMap[K]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

export function on<K extends keyof AppEventMap>(
  type: K,
  handler: (_detail: AppEventMap[K]) => void
) {
  if (typeof window === "undefined") return () => {};
  const fn = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(type, fn as any);
  return () => window.removeEventListener(type, fn as any);
}