import { writable, derived, get } from 'svelte/store';
import { currentPubkey } from './user';
import { browser } from '$app/environment';

/**
 * Notification types
 */
export type NotificationType = 'message' | 'dm' | 'mention' | 'join-request' | 'system';

/**
 * Notification interface
 */
export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  channelId?: string;
  channelName?: string;
  senderPubkey?: string;
  senderName?: string;
  timestamp: number;
  read: boolean;
  url?: string;
}

/**
 * Notification store state
 */
export interface NotificationState {
  notifications: Notification[];
  lastChecked: number;
}

/**
 * Storage key for persisting notifications
 */
const STORAGE_KEY = 'fairfield-nostr-notifications';

/**
 * Load notifications from localStorage
 */
function loadFromStorage(): NotificationState {
  if (!browser) {
    return { notifications: [], lastChecked: Date.now() };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Filter out notifications older than 7 days
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const validNotifications = parsed.notifications.filter(
        (n: Notification) => n.timestamp > sevenDaysAgo
      );
      return {
        notifications: validNotifications,
        lastChecked: parsed.lastChecked || Date.now()
      };
    }
  } catch (error) {
    console.error('Failed to load notifications from storage:', error);
  }

  return { notifications: [], lastChecked: Date.now() };
}

/**
 * Save notifications to localStorage
 */
function saveToStorage(state: NotificationState): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save notifications to storage:', error);
  }
}

/**
 * Create the notification store
 */
function createNotificationStore() {
  const initialState = loadFromStorage();
  const { subscribe, set, update } = writable<NotificationState>(initialState);

  // Save to storage whenever state changes
  subscribe((state) => {
    saveToStorage(state);
  });

  return {
    subscribe,

    /**
     * Add a new notification
     */
    addNotification(
      type: NotificationType,
      message: string,
      options?: {
        channelId?: string;
        channelName?: string;
        senderPubkey?: string;
        senderName?: string;
        url?: string;
      }
    ): void {
      const notification: Notification = {
        id: Math.random().toString(36).substring(2, 15),
        type,
        message,
        channelId: options?.channelId,
        channelName: options?.channelName,
        senderPubkey: options?.senderPubkey,
        senderName: options?.senderName,
        timestamp: Date.now(),
        read: false,
        url: options?.url
      };

      update((state) => ({
        notifications: [notification, ...state.notifications],
        lastChecked: state.lastChecked
      }));

      // Show browser notification if supported and permission granted
      if (browser && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('Fairfield Nostr', {
            body: message,
            icon: '/favicon.png',
            tag: notification.id
          });
        } catch (error) {
          console.error('Failed to show browser notification:', error);
        }
      }
    },

    /**
     * Mark a notification as read
     */
    markAsRead(id: string): void {
      update((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        lastChecked: state.lastChecked
      }));
    },

    /**
     * Mark all notifications as read
     */
    markAllAsRead(): void {
      update((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        lastChecked: Date.now()
      }));
    },

    /**
     * Clear all notifications
     */
    clearAll(): void {
      set({ notifications: [], lastChecked: Date.now() });
    },

    /**
     * Remove a specific notification
     */
    removeNotification(id: string): void {
      update((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        lastChecked: state.lastChecked
      }));
    },

    /**
     * Clear old notifications (older than 7 days)
     */
    clearOld(): void {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      update((state) => ({
        notifications: state.notifications.filter((n) => n.timestamp > sevenDaysAgo),
        lastChecked: state.lastChecked
      }));
    },

    /**
     * Request browser notification permission
     */
    async requestPermission(): Promise<NotificationPermission> {
      if (!browser || !('Notification' in window)) {
        return 'denied';
      }

      if (Notification.permission === 'granted') {
        return 'granted';
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission;
      }

      return Notification.permission;
    },

    /**
     * Add a mention notification
     */
    addMentionNotification(params: {
      channelId: string;
      channelName: string;
      senderPubkey: string;
      senderName: string;
      messagePreview: string;
    }): void {
      this.addNotification('mention', `${params.senderName} mentioned you in ${params.channelName}`, {
        channelId: params.channelId,
        channelName: params.channelName,
        senderPubkey: params.senderPubkey,
        senderName: params.senderName,
        url: `/channels/${params.channelId}`
      });
    }
  };
}

export const notificationStore = createNotificationStore();

/**
 * Derived store for unread notifications
 */
export const unreadNotifications = derived(notificationStore, ($store) =>
  $store.notifications.filter((n) => !n.read)
);

/**
 * Derived store for unread count
 */
export const unreadCount = derived(unreadNotifications, ($notifications) => $notifications.length);

/**
 * Derived store for recent notifications (last 10)
 */
export const recentNotifications = derived(notificationStore, ($store) =>
  $store.notifications.slice(0, 10)
);

/**
 * Helper to check if user should see a notification for a message
 * Don't notify for messages from the current user or in the currently viewed channel
 */
export function shouldNotify(
  senderPubkey: string,
  channelId: string,
  currentChannelId: string | null
): boolean {
  const userPubkey = get(currentPubkey);

  // Don't notify for own messages
  if (senderPubkey === userPubkey) {
    return false;
  }

  // Don't notify if viewing the channel
  if (channelId === currentChannelId) {
    return false;
  }

  return true;
}

/**
 * Auto-cleanup old notifications on initialization
 */
if (browser) {
  notificationStore.clearOld();
}
