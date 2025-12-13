# Channel Statistics Dashboard - Usage Guide

## Overview

The Channel Statistics Dashboard provides comprehensive analytics for both individual channels and platform-wide metrics.

## Components

### 1. Channel Statistics Store (`src/lib/stores/channelStats.ts`)

Main store for managing channel statistics:

```typescript
import { channelStatsStore } from '$lib/stores/channelStats';

// Refresh statistics for a channel
await channelStatsStore.refreshStats(channelId);

// Get statistics (uses cache if recent)
const stats = await channelStatsStore.getStats(channelId);

// Get platform-wide statistics
const platformStats = await channelStatsStore.getPlatformStats();

// Clear cache
channelStatsStore.clear();
```

### 2. Channel Stats Component (`src/lib/components/forum/ChannelStats.svelte`)

Displays detailed statistics for a single channel:

```svelte
<script>
  import ChannelStats from '$lib/components/forum/ChannelStats.svelte';

  let channelId = 'your-channel-id';
  let showStats = false;
</script>

<button on:click={() => showStats = !showStats}>
  Toggle Stats
</button>

<ChannelStats {channelId} isExpanded={showStats} />
```

### 3. Activity Graph Component (`src/lib/components/forum/ActivityGraph.svelte`)

Displays message activity over time:

```svelte
<script>
  import ActivityGraph from '$lib/components/forum/ActivityGraph.svelte';

  let activityData = [
    { date: '2025-12-01', count: 45, timestamp: 1733011200000 },
    { date: '2025-12-02', count: 67, timestamp: 1733097600000 },
    // ...
  ];
</script>

<ActivityGraph data={activityData} days={7} height={200} />
```

### 4. Admin Statistics Page (`src/routes/admin/stats/+page.svelte`)

Platform-wide analytics dashboard (admin only):
- Navigate to `/admin/stats`
- View all channel statistics
- Compare channel performance
- Export data to CSV

## Features

### Channel-Level Statistics

1. **Key Metrics**
   - Total messages
   - Unique posters
   - Average messages per day
   - Peak activity hour

2. **Activity Graph**
   - Last 7/30 days activity
   - Hover for exact counts
   - Responsive SVG visualization

3. **Top Contributors**
   - Top 5 posters
   - Avatar display
   - Message count and percentage
   - Visual progress bars

4. **Activity Heatmap**
   - 24-hour activity breakdown
   - Visual intensity representation
   - Identify peak hours

5. **Member Growth**
   - Growth over time
   - Based on first message dates

### Platform-Level Statistics

1. **Global Metrics**
   - Total channels
   - Total messages
   - Total users
   - Engagement rate

2. **Channel Comparison**
   - Sortable table
   - Side-by-side comparison
   - Top performer identification

3. **Export Functionality**
   - CSV export
   - All statistics included
   - Timestamped files

## Implementation Examples

### Basic Usage in Channel Page

```svelte
<script lang="ts">
  import { channelStatsStore } from '$lib/stores/channelStats';
  import ChannelStats from '$lib/components/forum/ChannelStats.svelte';

  let channelId = 'channel-123';
  let showStats = false;

  async function toggleStats() {
    showStats = !showStats;
    if (showStats) {
      // Optionally preload stats
      await channelStatsStore.refreshStats(channelId);
    }
  }
</script>

<button on:click={toggleStats}>
  {showStats ? 'Hide' : 'Show'} Statistics
</button>

<ChannelStats {channelId} isExpanded={showStats} />
```

### Custom Activity Visualization

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { channelStatsStore } from '$lib/stores/channelStats';
  import ActivityGraph from '$lib/components/forum/ActivityGraph.svelte';

  let stats = null;
  let channelId = 'channel-123';

  onMount(async () => {
    stats = await channelStatsStore.getStats(channelId);
  });
</script>

{#if stats}
  <h3>Last 30 Days</h3>
  <ActivityGraph data={stats.activityByDay} days={30} height={300} />
{/if}
```

### Programmatic Stats Access

```typescript
import { channelStatsStore } from '$lib/stores/channelStats';

// Get stats for multiple channels
async function compareChannels(channelIds: string[]) {
  const statsPromises = channelIds.map(id =>
    channelStatsStore.getStats(id)
  );

  const allStats = await Promise.all(statsPromises);

  // Find most active channel
  const mostActive = allStats.reduce((prev, current) =>
    (current.messageCount > prev.messageCount) ? current : prev
  );

  console.log('Most active channel:', mostActive.channelId);
  console.log('Messages:', mostActive.messageCount);
}

// Platform-wide analysis
async function analyzePlatform() {
  const platformStats = await channelStatsStore.getPlatformStats();

  console.log('Total channels:', platformStats.totalChannels);
  console.log('Active channels:', platformStats.activeChannels);
  console.log('Engagement rate:',
    (platformStats.activeChannels / platformStats.totalChannels * 100).toFixed(1) + '%'
  );

  // Find top 3 channels by activity
  const topChannels = platformStats.channelStats
    .sort((a, b) => b.avgMessagesPerDay - a.avgMessagesPerDay)
    .slice(0, 3);

  topChannels.forEach((ch, i) => {
    console.log(`${i + 1}. ${ch.channelId}: ${ch.avgMessagesPerDay.toFixed(1)} msgs/day`);
  });
}
```

## Statistics Data Structure

### ChannelStats Interface

```typescript
interface ChannelStats {
  channelId: string;
  messageCount: number;
  uniquePosters: number;
  avgMessagesPerDay: number;
  peakHour: number; // 0-23
  topPosters: TopPoster[];
  activityByDay: DayActivity[];
  activityByHour: HourActivity[];
  memberGrowth: MemberGrowthPoint[];
  lastUpdated: number;
}
```

### TopPoster Interface

```typescript
interface TopPoster {
  pubkey: string;
  name?: string;
  avatar?: string;
  messageCount: number;
  percentage: number;
}
```

### Activity Interfaces

```typescript
interface DayActivity {
  date: string; // YYYY-MM-DD
  count: number;
  timestamp: number;
}

interface HourActivity {
  hour: number; // 0-23
  count: number;
}

interface MemberGrowthPoint {
  date: string;
  memberCount: number;
  timestamp: number;
}
```

## Performance Considerations

### Caching

Statistics are cached for 5 minutes to reduce database queries:

```typescript
// This will use cached data if less than 5 minutes old
const stats = await channelStatsStore.getStats(channelId);

// Force refresh
await channelStatsStore.refreshStats(channelId);
const freshStats = await channelStatsStore.getStats(channelId);
```

### Lazy Loading

Statistics are only loaded when the stats panel is expanded:

```svelte
<ChannelStats channelId={channelId} isExpanded={showStats} />
```

The component only fetches data when `isExpanded` becomes `true`.

### Database Optimization

All statistics are calculated from cached messages in IndexedDB, avoiding network requests to relays.

## Admin Dashboard

### Access Control

The admin statistics page at `/admin/stats` checks user permissions:

```typescript
onMount(async () => {
  const admins = await adminStore.getAdmins();
  const isAdmin = admins.includes($authStore.publicKey);

  if (!isAdmin) {
    goto('/'); // Redirect non-admins
  }
});
```

### CSV Export

Export all statistics to CSV:

```typescript
async function exportToCSV() {
  const platformStats = await channelStatsStore.getPlatformStats();

  const headers = [
    'Channel ID',
    'Messages',
    'Members',
    'Avg Messages/Day',
    'Peak Hour',
    'Top Poster',
    'Top Poster Messages'
  ];

  const rows = platformStats.channelStats.map(stats => [
    stats.channelId,
    stats.messageCount.toString(),
    stats.uniquePosters.toString(),
    stats.avgMessagesPerDay.toFixed(2),
    stats.peakHour.toString(),
    stats.topPosters[0]?.name || 'N/A',
    stats.topPosters[0]?.messageCount.toString() || '0'
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Download file
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `platform-stats-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

## Customization

### Custom Styling

Override component styles:

```svelte
<ChannelStats channelId={channelId} isExpanded={showStats} />

<style>
  :global(.channel-stats) {
    background: #custom-color;
  }

  :global(.metric-card) {
    border-radius: 16px;
  }
</style>
```

### Custom Visualizations

Create custom graphs using the stats data:

```svelte
<script>
  import { channelStatsStore } from '$lib/stores/channelStats';

  let stats;

  async function loadStats() {
    stats = await channelStatsStore.getStats(channelId);
  }

  // Custom visualization function
  function renderCustomChart(activityData) {
    // Use your preferred charting library
    // e.g., Chart.js, D3, ApexCharts, etc.
  }
</script>

{#if stats}
  <div class="custom-chart">
    {renderCustomChart(stats.activityByDay)}
  </div>
{/if}
```

## Troubleshooting

### Statistics Not Loading

1. Check if messages exist in the database:
```typescript
import { db } from '$lib/db';
const messages = await db.getChannelMessagesWithAuthors(channelId);
console.log('Message count:', messages.length);
```

2. Verify channel exists:
```typescript
const channel = await db.getChannel(channelId);
console.log('Channel:', channel);
```

3. Check for errors in console

### Performance Issues

1. Reduce graph resolution for large datasets
2. Limit number of days displayed
3. Use pagination for channel lists
4. Clear cache periodically

### Admin Access Issues

1. Verify user is authenticated
2. Check admin list:
```typescript
import { adminStore } from '$lib/stores/admin';
const admins = await adminStore.getAdmins();
console.log('Admins:', admins);
```

## Future Enhancements

Potential improvements:
- Real-time statistics updates
- Comparative analytics
- Trend predictions
- User engagement metrics
- Custom time ranges
- Advanced filtering
- Scheduled reports
- Notification thresholds
