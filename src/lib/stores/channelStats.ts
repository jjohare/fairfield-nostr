import { writable, derived, get } from 'svelte/store';
import { db } from '$lib/db';
import type { Message } from './messages';

/**
 * Channel statistics interface
 */
export interface ChannelStats {
  channelId: string;
  messageCount: number;
  uniquePosters: number;
  avgMessagesPerDay: number;
  peakHour: number;
  topPosters: TopPoster[];
  activityByDay: DayActivity[];
  activityByHour: HourActivity[];
  memberGrowth: MemberGrowthPoint[];
  lastUpdated: number;
}

/**
 * Top poster information
 */
export interface TopPoster {
  pubkey: string;
  name?: string;
  avatar?: string;
  messageCount: number;
  percentage: number;
}

/**
 * Daily activity data
 */
export interface DayActivity {
  date: string;
  count: number;
  timestamp: number;
}

/**
 * Hourly activity data
 */
export interface HourActivity {
  hour: number;
  count: number;
}

/**
 * Member growth point
 */
export interface MemberGrowthPoint {
  date: string;
  memberCount: number;
  timestamp: number;
}

/**
 * Global platform statistics
 */
export interface PlatformStats {
  totalChannels: number;
  totalMessages: number;
  totalUsers: number;
  activeChannels: number;
  channelStats: ChannelStats[];
  lastUpdated: number;
}

/**
 * Channel statistics store state
 */
interface StatsState {
  stats: Map<string, ChannelStats>;
  isLoading: boolean;
  error: string | null;
}

const initialState: StatsState = {
  stats: new Map(),
  isLoading: false,
  error: null
};

/**
 * Create the channel statistics store
 */
function createChannelStatsStore() {
  const { subscribe, set, update } = writable<StatsState>(initialState);

  /**
   * Calculate statistics for a channel
   */
  async function calculateStats(channelId: string): Promise<ChannelStats> {
    // Fetch messages from database
    const messages = await db.getChannelMessagesWithAuthors(channelId);

    if (messages.length === 0) {
      return {
        channelId,
        messageCount: 0,
        uniquePosters: 0,
        avgMessagesPerDay: 0,
        peakHour: 0,
        topPosters: [],
        activityByDay: [],
        activityByHour: [],
        memberGrowth: [],
        lastUpdated: Date.now()
      };
    }

    // Calculate basic stats
    const messageCount = messages.length;
    const uniquePubkeys = new Set(messages.map(m => m.pubkey));
    const uniquePosters = uniquePubkeys.size;

    // Calculate time range
    const timestamps = messages.map(m => m.created_at * 1000);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const daysSpan = Math.max(1, (maxTime - minTime) / (1000 * 60 * 60 * 24));
    const avgMessagesPerDay = messageCount / daysSpan;

    // Calculate activity by hour
    const hourCounts = new Array(24).fill(0);
    messages.forEach(msg => {
      const hour = new Date(msg.created_at * 1000).getHours();
      hourCounts[hour]++;
    });

    const activityByHour: HourActivity[] = hourCounts.map((count, hour) => ({
      hour,
      count
    }));

    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Calculate activity by day (last 30 days)
    const now = Date.now();
    const dayMap = new Map<string, number>();

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dayMap.set(dateStr, 0);
    }

    messages.forEach(msg => {
      const date = new Date(msg.created_at * 1000).toISOString().split('T')[0];
      if (dayMap.has(date)) {
        dayMap.set(date, (dayMap.get(date) || 0) + 1);
      }
    });

    const activityByDay: DayActivity[] = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
      timestamp: new Date(date).getTime()
    }));

    // Calculate top posters
    const posterCounts = new Map<string, number>();
    messages.forEach(msg => {
      posterCounts.set(msg.pubkey, (posterCounts.get(msg.pubkey) || 0) + 1);
    });

    const sortedPosters = Array.from(posterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topPosters: TopPoster[] = await Promise.all(
      sortedPosters.map(async ([pubkey, count]) => {
        const user = await db.getUser(pubkey);
        return {
          pubkey,
          name: user?.name || user?.displayName || undefined,
          avatar: user?.avatar || undefined,
          messageCount: count,
          percentage: (count / messageCount) * 100
        };
      })
    );

    // Calculate member growth (simplified - based on first message date)
    const channel = await db.getChannel(channelId);
    const memberGrowth: MemberGrowthPoint[] = [];

    if (channel) {
      // Group messages by date to estimate when users joined
      const firstMessageByUser = new Map<string, number>();
      messages.forEach(msg => {
        if (!firstMessageByUser.has(msg.pubkey) || msg.created_at < firstMessageByUser.get(msg.pubkey)!) {
          firstMessageByUser.set(msg.pubkey, msg.created_at);
        }
      });

      const joinDates = Array.from(firstMessageByUser.values())
        .sort((a, b) => a - b);

      const growthByDate = new Map<string, number>();
      joinDates.forEach((timestamp, index) => {
        const date = new Date(timestamp * 1000).toISOString().split('T')[0];
        growthByDate.set(date, index + 1);
      });

      memberGrowth.push(...Array.from(growthByDate.entries()).map(([date, count]) => ({
        date,
        memberCount: count,
        timestamp: new Date(date).getTime()
      })));
    }

    return {
      channelId,
      messageCount,
      uniquePosters,
      avgMessagesPerDay,
      peakHour,
      topPosters,
      activityByDay,
      activityByHour,
      memberGrowth,
      lastUpdated: Date.now()
    };
  }

  return {
    subscribe,

    /**
     * Refresh statistics for a channel
     */
    async refreshStats(channelId: string): Promise<void> {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const stats = await calculateStats(channelId);

        update(state => {
          const newStats = new Map(state.stats);
          newStats.set(channelId, stats);
          return {
            ...state,
            stats: newStats,
            isLoading: false
          };
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to calculate statistics';
        console.error('refreshStats error:', error);

        update(state => ({
          ...state,
          error: errorMsg,
          isLoading: false
        }));
      }
    },

    /**
     * Get statistics for a channel
     */
    async getStats(channelId: string): Promise<ChannelStats | null> {
      const state = get({ subscribe });
      const cached = state.stats.get(channelId);

      // Return cached if less than 5 minutes old
      if (cached && Date.now() - cached.lastUpdated < 5 * 60 * 1000) {
        return cached;
      }

      // Refresh if stale or missing
      await this.refreshStats(channelId);
      const newState = get({ subscribe });
      return newState.stats.get(channelId) || null;
    },

    /**
     * Calculate platform-wide statistics
     */
    async getPlatformStats(): Promise<PlatformStats> {
      update(state => ({ ...state, isLoading: true, error: null }));

      try {
        const channels = await db.channels.toArray();
        const allMessages = await db.messages.toArray();
        const allUsers = await db.users.toArray();

        // Calculate stats for each channel
        const channelStats: ChannelStats[] = [];
        for (const channel of channels) {
          const stats = await calculateStats(channel.id);
          channelStats.push(stats);
        }

        // Count active channels (with messages in last 7 days)
        const sevenDaysAgo = Date.now() / 1000 - 7 * 24 * 60 * 60;
        const activeChannels = new Set(
          allMessages
            .filter(m => m.created_at > sevenDaysAgo)
            .map(m => m.channelId)
        ).size;

        const platformStats: PlatformStats = {
          totalChannels: channels.length,
          totalMessages: allMessages.filter(m => !m.deleted).length,
          totalUsers: allUsers.length,
          activeChannels,
          channelStats,
          lastUpdated: Date.now()
        };

        update(state => ({ ...state, isLoading: false }));
        return platformStats;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to calculate platform statistics';
        console.error('getPlatformStats error:', error);

        update(state => ({
          ...state,
          error: errorMsg,
          isLoading: false
        }));

        throw error;
      }
    },

    /**
     * Clear error
     */
    clearError(): void {
      update(state => ({ ...state, error: null }));
    },

    /**
     * Clear all cached statistics
     */
    clear(): void {
      set(initialState);
    }
  };
}

export const channelStatsStore = createChannelStatsStore();

/**
 * Derived store for loading state
 */
export const statsLoading = derived(
  channelStatsStore,
  $stats => $stats.isLoading
);

/**
 * Derived store for error state
 */
export const statsError = derived(
  channelStatsStore,
  $stats => $stats.error
);
