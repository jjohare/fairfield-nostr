import { writable } from 'svelte/store';

export interface Toast {
  id: string;
  message: string;
  variant: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    callback: () => void | Promise<void>;
  };
}

interface ToastStore {
  toasts: Toast[];
}

function createToastStore() {
  const { subscribe, update } = writable<ToastStore>({ toasts: [] });

  let idCounter = 0;

  function addToast(
    message: string,
    variant: Toast['variant'] = 'info',
    duration = 5000,
    dismissible = true,
    action?: Toast['action']
  ): string {
    const id = `toast-${Date.now()}-${idCounter++}`;
    const toast: Toast = { id, message, variant, duration, dismissible, action };

    update(state => ({
      toasts: [...state.toasts, toast]
    }));

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }

  function removeToast(id: string) {
    update(state => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  }

  function clearAll() {
    update(() => ({ toasts: [] }));
  }

  return {
    subscribe,
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'error', duration, true, action),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
    warning: (message: string, duration?: number, action?: Toast['action']) =>
      addToast(message, 'warning', duration, true, action),
    remove: removeToast,
    clear: clearAll
  };
}

export const toast = createToastStore();
