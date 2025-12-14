/**
 * Central export for all stores
 */

export { authStore } from './auth';
export type { AuthState } from './auth';

export {
  userStore,
  whitelistStatusStore,
  isAuthenticated,
  isAdmin,
  isAdminVerified,
  whitelistSource,
  isApproved,
  currentPubkey,
  currentCohorts,
  currentDisplayName
} from './user';
export type { UserProfile, UserState, CohortType } from './user';

export {
  saveKeys,
  loadKeys,
  clearKeys,
  hasStoredKeys,
  getStoredPubkey,
  setMnemonicShown,
  hasMnemonicBeenShown
} from '../utils/storage';
export type { StoredKeys } from '../utils/storage';

export {
  notificationStore,
  unreadNotifications,
  unreadCount,
  recentNotifications,
  shouldNotify
} from './notifications';
export type { Notification, NotificationType, NotificationState } from './notifications';

export {
  installPrompt,
  updateAvailable,
  isOnline,
  swRegistration,
  isPWAInstalled,
  queuedMessageCount,
  canInstall,
  initPWA,
  triggerInstall,
  registerServiceWorker,
  updateServiceWorker,
  queueMessage,
  getQueuedMessages,
  clearMessageQueue,
  triggerBackgroundSync
} from './pwa';

export {
  muteStore,
  mutedCount,
  mutedUsersList,
  createIsMutedStore
} from './mute';
export type { MutedUser, MuteState } from './mute';

export {
  sectionStore,
  accessibleSections,
  pendingSections,
  pendingRequestCount,
  canSeeChannel
} from './sections';

export {
  SECTION_CONFIG
} from '$lib/types/channel';
export type {
  ChannelSection,
  ChannelVisibility,
  SectionAccessStatus,
  SectionStats,
  UserSectionAccess,
  SectionAccessRequest,
  CalendarAccessLevel,
  SectionConfig
} from '$lib/types/channel';
