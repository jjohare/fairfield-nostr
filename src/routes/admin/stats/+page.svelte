<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';
  import { adminStore } from '$lib/stores/admin';
  import { channelStatsStore, type PlatformStats } from '$lib/stores/channelStats';
  import ActivityGraph from '$lib/components/forum/ActivityGraph.svelte';

  let platformStats: PlatformStats | null = null;
  let isLoading: boolean = false;
  let error: string | null = null;
  let isAdmin: boolean = false;
  let sortBy: 'messages' | 'members' | 'activity' = 'messages';
  let sortOrder: 'asc' | 'desc' = 'desc';

  $: sortedChannels = platformStats?.channelStats
    ? [...platformStats.channelStats].sort((a, b) => {
        let aVal: number, bVal: number;

        switch (sortBy) {
          case 'messages':
            aVal = a.messageCount;
            bVal = b.messageCount;
            break;
          case 'members':
            aVal = a.uniquePosters;
            bVal = b.uniquePosters;
            break;
          case 'activity':
            aVal = a.avgMessagesPerDay;
            bVal = b.avgMessagesPerDay;
            break;
        }

        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      })
    : [];

  onMount(async () => {
    // Check if user is admin
    if (!$authStore.publicKey) {
      goto('/');
      return;
    }

    // For now, allow any authenticated user to view stats
    // In production, implement proper admin role checking
    isAdmin = true;

    loadStats();
  });

  async function loadStats() {
    isLoading = true;
    error = null;

    try {
      platformStats = await channelStatsStore.getPlatformStats();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load statistics';
      console.error('Failed to load platform stats:', err);
    } finally {
      isLoading = false;
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString();
  }

  function setSortBy(field: 'messages' | 'members' | 'activity') {
    if (sortBy === field) {
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      sortBy = field;
      sortOrder = 'desc';
    }
  }

  async function exportToCSV() {
    if (!platformStats) return;

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
      stats.topPosters[0]?.name || stats.topPosters[0]?.pubkey.slice(0, 16) || 'N/A',
      stats.topPosters[0]?.messageCount.toString() || '0'
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function calculateTotalActivity(): number {
    if (!platformStats) return 0;
    return platformStats.channelStats.reduce((sum, ch) => sum + ch.messageCount, 0);
  }

  function getAverageMembersPerChannel(): number {
    if (!platformStats || platformStats.totalChannels === 0) return 0;
    const total = platformStats.channelStats.reduce((sum, ch) => sum + ch.uniquePosters, 0);
    return total / platformStats.totalChannels;
  }
</script>

<svelte:head>
  <title>Platform Statistics - Admin</title>
</svelte:head>

<div class="admin-stats-page">
  <div class="page-header">
    <div class="header-content">
      <h1>Platform Statistics</h1>
      <p class="subtitle">Comprehensive analytics for all channels</p>
    </div>
    <div class="header-actions">
      <button class="refresh-button" on:click={loadStats} disabled={isLoading}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
        Refresh
      </button>
      <button class="export-button" on:click={exportToCSV} disabled={!platformStats}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export CSV
      </button>
    </div>
  </div>

  {#if isLoading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading platform statistics...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button class="retry-button" on:click={loadStats}>
        Retry
      </button>
    </div>
  {:else if platformStats}
    <div class="stats-content">
      <!-- Global Metrics -->
      <div class="global-metrics">
        <div class="metric-card">
          <div class="metric-icon channels">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div class="metric-content">
            <div class="metric-value">{formatNumber(platformStats.totalChannels)}</div>
            <div class="metric-label">Total Channels</div>
            <div class="metric-detail">
              {platformStats.activeChannels} active in last 7 days
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon messages">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div class="metric-content">
            <div class="metric-value">{formatNumber(platformStats.totalMessages)}</div>
            <div class="metric-label">Total Messages</div>
            <div class="metric-detail">
              {formatNumber(calculateTotalActivity())} including deleted
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon users">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div class="metric-content">
            <div class="metric-value">{formatNumber(platformStats.totalUsers)}</div>
            <div class="metric-label">Total Users</div>
            <div class="metric-detail">
              {getAverageMembersPerChannel().toFixed(1)} avg per channel
            </div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon engagement">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
          </div>
          <div class="metric-content">
            <div class="metric-value">
              {((platformStats.activeChannels / platformStats.totalChannels) * 100).toFixed(0)}%
            </div>
            <div class="metric-label">Engagement Rate</div>
            <div class="metric-detail">
              Based on 7-day activity
            </div>
          </div>
        </div>
      </div>

      <!-- Channel Comparison -->
      <div class="section">
        <div class="section-header">
          <h2>Channel Comparison</h2>
          <div class="sort-controls">
            <button
              class="sort-button"
              class:active={sortBy === 'messages'}
              on:click={() => setSortBy('messages')}
            >
              Messages
              {#if sortBy === 'messages'}
                <span class="sort-arrow">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
            <button
              class="sort-button"
              class:active={sortBy === 'members'}
              on:click={() => setSortBy('members')}
            >
              Members
              {#if sortBy === 'members'}
                <span class="sort-arrow">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
            <button
              class="sort-button"
              class:active={sortBy === 'activity'}
              on:click={() => setSortBy('activity')}
            >
              Activity
              {#if sortBy === 'activity'}
                <span class="sort-arrow">{sortOrder === 'desc' ? '↓' : '↑'}</span>
              {/if}
            </button>
          </div>
        </div>

        <div class="channel-table">
          <div class="table-header">
            <div class="col-channel">Channel</div>
            <div class="col-stat">Messages</div>
            <div class="col-stat">Members</div>
            <div class="col-stat">Avg/Day</div>
            <div class="col-stat">Peak Hour</div>
            <div class="col-top-poster">Top Poster</div>
          </div>

          {#each sortedChannels as stats}
            <div class="table-row">
              <div class="col-channel">
                <div class="channel-id">{stats.channelId.slice(0, 16)}...</div>
              </div>
              <div class="col-stat">
                <strong>{formatNumber(stats.messageCount)}</strong>
              </div>
              <div class="col-stat">
                <strong>{formatNumber(stats.uniquePosters)}</strong>
              </div>
              <div class="col-stat">
                <strong>{stats.avgMessagesPerDay.toFixed(1)}</strong>
              </div>
              <div class="col-stat">
                {stats.peakHour}:00
              </div>
              <div class="col-top-poster">
                {#if stats.topPosters[0]}
                  <div class="top-poster">
                    {#if stats.topPosters[0].avatar}
                      <img src={stats.topPosters[0].avatar} alt="" class="poster-avatar-small" />
                    {/if}
                    <span>
                      {stats.topPosters[0].name || `${stats.topPosters[0].pubkey.slice(0, 8)}...`}
                    </span>
                    <span class="poster-count">({stats.topPosters[0].messageCount})</span>
                  </div>
                {:else}
                  <span class="text-muted">N/A</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Platform Activity Trend -->
      {#if sortedChannels.length > 0 && sortedChannels[0].activityByDay.length > 0}
        <div class="section">
          <h2>Platform Activity Trend</h2>
          <ActivityGraph
            data={sortedChannels[0].activityByDay}
            days={30}
            height={300}
          />
        </div>
      {/if}

      <!-- Last Updated -->
      <div class="stats-footer">
        <span class="last-updated">
          Last updated: {new Date(platformStats.lastUpdated).toLocaleString()}
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-stats-page {
    min-height: 100vh;
    background: #f9fafb;
    padding: 2rem;
  }

  .page-header {
    max-width: 1400px;
    margin: 0 auto 2rem;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .header-content h1 {
    margin: 0 0 0.25rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  .subtitle {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .refresh-button,
  .export-button {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: white;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
  }

  .refresh-button:hover,
  .export-button:hover {
    background: #f9fafb;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .refresh-button:disabled,
  .export-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .loading-state,
  .error-state {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    color: #6b7280;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-message {
    margin-bottom: 1rem;
    color: #dc2626;
    font-size: 1rem;
  }

  .retry-button {
    padding: 0.625rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .stats-content {
    max-width: 1400px;
    margin: 0 auto;
  }

  .global-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .metric-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .metric-icon.channels {
    background: #dbeafe;
    color: #2563eb;
  }

  .metric-icon.messages {
    background: #dcfce7;
    color: #16a34a;
  }

  .metric-icon.users {
    background: #fef3c7;
    color: #d97706;
  }

  .metric-icon.engagement {
    background: #f3e8ff;
    color: #9333ea;
  }

  .metric-content {
    flex: 1;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .metric-label {
    font-size: 0.875rem;
    color: #6b7280;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .metric-detail {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .section h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }

  .sort-controls {
    display: flex;
    gap: 0.5rem;
  }

  .sort-button {
    padding: 0.5rem 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    color: #6b7280;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .sort-button:hover {
    background: white;
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .sort-button.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }

  .sort-arrow {
    font-size: 0.75rem;
  }

  .channel-table {
    overflow-x: auto;
  }

  .table-header,
  .table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr 1fr 2fr;
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .table-header {
    font-weight: 600;
    font-size: 0.875rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: #f9fafb;
    border-radius: 8px;
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .col-channel,
  .col-stat,
  .col-top-poster {
    display: flex;
    align-items: center;
  }

  .channel-id {
    font-family: monospace;
    font-size: 0.875rem;
    color: #111827;
  }

  .top-poster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .poster-avatar-small {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .poster-count {
    color: #9ca3af;
    font-size: 0.75rem;
  }

  .text-muted {
    color: #9ca3af;
  }

  .stats-footer {
    text-align: center;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .last-updated {
    font-size: 0.875rem;
    color: #9ca3af;
  }

  @media (max-width: 1024px) {
    .table-header,
    .table-row {
      grid-template-columns: 1.5fr 1fr 1fr 1fr;
      font-size: 0.875rem;
    }

    .col-top-poster {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .admin-stats-page {
      padding: 1rem;
    }

    .global-metrics {
      grid-template-columns: 1fr;
    }

    .table-header,
    .table-row {
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    .col-stat:nth-child(3),
    .col-stat:nth-child(5) {
      display: none;
    }
  }
</style>
