<script lang="ts">
  import { onMount } from 'svelte';
  import { channelStatsStore, type ChannelStats, type HourActivity } from '$lib/stores/channelStats';
  import ActivityGraph from './ActivityGraph.svelte';

  export let channelId: string;
  export let isExpanded: boolean = false;

  let stats: ChannelStats | null = null;
  let isLoading: boolean = false;
  let error: string | null = null;

  $: if (isExpanded && !stats) {
    loadStats();
  }

  async function loadStats() {
    isLoading = true;
    error = null;

    try {
      stats = await channelStatsStore.getStats(channelId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load statistics';
      console.error('Failed to load stats:', err);
    } finally {
      isLoading = false;
    }
  }

  async function refreshStats() {
    isLoading = true;
    error = null;

    try {
      await channelStatsStore.refreshStats(channelId);
      stats = await channelStatsStore.getStats(channelId);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to refresh statistics';
      console.error('Failed to refresh stats:', err);
    } finally {
      isLoading = false;
    }
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  function formatHour(hour: number): string {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  }

  function getHourLabel(hour: number): string {
    if (hour === 0) return '12a';
    if (hour === 12) return '12p';
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  }
</script>

{#if isExpanded}
  <div class="channel-stats">
    {#if isLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading statistics...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p class="error-message">{error}</p>
        <button class="retry-button" on:click={refreshStats}>
          Retry
        </button>
      </div>
    {:else if stats}
      <div class="stats-container">
        <div class="stats-header">
          <h3>Channel Statistics</h3>
          <button class="refresh-button" on:click={refreshStats} title="Refresh statistics">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </button>
        </div>

        <!-- Key Metrics -->
        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon messages">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div class="metric-content">
              <div class="metric-value">{formatNumber(stats.messageCount)}</div>
              <div class="metric-label">Total Messages</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon members">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div class="metric-content">
              <div class="metric-value">{stats.uniquePosters}</div>
              <div class="metric-label">Active Members</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon activity">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div class="metric-content">
              <div class="metric-value">{stats.avgMessagesPerDay.toFixed(1)}</div>
              <div class="metric-label">Messages/Day</div>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon peak">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div class="metric-content">
              <div class="metric-value">{formatHour(stats.peakHour)}</div>
              <div class="metric-label">Peak Hour</div>
            </div>
          </div>
        </div>

        <!-- Activity Graph -->
        <div class="section">
          <h4>Activity Trend (Last 7 Days)</h4>
          <ActivityGraph data={stats.activityByDay} days={7} />
        </div>

        <!-- Top Posters -->
        {#if stats.topPosters.length > 0}
          <div class="section">
            <h4>Top Contributors</h4>
            <div class="top-posters">
              {#each stats.topPosters as poster, i}
                <div class="poster-item">
                  <div class="poster-rank">#{i + 1}</div>
                  <div class="poster-avatar">
                    {#if poster.avatar}
                      <img src={poster.avatar} alt={poster.name || 'User'} />
                    {:else}
                      <div class="avatar-placeholder">
                        {(poster.name || poster.pubkey.slice(0, 2)).charAt(0).toUpperCase()}
                      </div>
                    {/if}
                  </div>
                  <div class="poster-info">
                    <div class="poster-name">
                      {poster.name || `${poster.pubkey.slice(0, 8)}...`}
                    </div>
                    <div class="poster-stats">
                      {poster.messageCount} messages • {poster.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <div class="poster-bar">
                    <div class="poster-bar-fill" style="width: {poster.percentage}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Activity Heatmap -->
        <div class="section">
          <h4>Activity by Hour</h4>
          <div class="heatmap">
            {#each stats.activityByHour as hourData}
              {@const maxHour = Math.max(...stats.activityByHour.map(h => h.count))}
              {@const intensity = maxHour > 0 ? (hourData.count / maxHour) * 100 : 0}

              <div class="heatmap-cell" title="{formatHour(hourData.hour)}: {hourData.count} messages">
                <div class="heatmap-bar" style="height: {intensity}%"></div>
                <div class="heatmap-label">{getHourLabel(hourData.hour)}</div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Member Growth -->
        {#if stats.memberGrowth.length > 0}
          <div class="section">
            <h4>Member Growth (Last 30 Days)</h4>
            <ActivityGraph
              data={stats.memberGrowth.map(m => ({
                date: m.date,
                count: m.memberCount,
                timestamp: m.timestamp
              }))}
              days={30}
            />
          </div>
        {/if}

        <!-- Last Updated -->
        <div class="stats-footer">
          <span class="last-updated">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
          </span>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .channel-stats {
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
    padding: 1.5rem;
  }

  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: #6b7280;
  }

  .spinner {
    width: 40px;
    height: 40px;
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
  }

  .retry-button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .retry-button:hover {
    background: #2563eb;
  }

  .stats-container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .stats-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #111827;
  }

  .refresh-button {
    padding: 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    cursor: pointer;
    color: #6b7280;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .refresh-button:hover {
    background: #f9fafb;
    color: #3b82f6;
    border-color: #3b82f6;
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .metric-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .metric-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .metric-icon.messages {
    background: #dbeafe;
    color: #2563eb;
  }

  .metric-icon.members {
    background: #dcfce7;
    color: #16a34a;
  }

  .metric-icon.activity {
    background: #fef3c7;
    color: #d97706;
  }

  .metric-icon.peak {
    background: #f3e8ff;
    color: #9333ea;
  }

  .metric-content {
    flex: 1;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .metric-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .section {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .section h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .top-posters {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .poster-item {
    display: grid;
    grid-template-columns: 40px 48px 1fr 100px;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .poster-rank {
    font-size: 1.25rem;
    font-weight: 700;
    color: #9ca3af;
    text-align: center;
  }

  .poster-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
  }

  .poster-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 600;
  }

  .poster-info {
    min-width: 0;
  }

  .poster-name {
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .poster-stats {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .poster-bar {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
  }

  .poster-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #2563eb);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .heatmap {
    display: grid;
    grid-template-columns: repeat(24, 1fr);
    gap: 0.25rem;
    padding: 1rem 0;
  }

  .heatmap-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .heatmap-bar {
    width: 100%;
    min-height: 60px;
    background: linear-gradient(to top, #3b82f6, #60a5fa);
    border-radius: 2px;
    transition: all 0.2s;
  }

  .heatmap-cell:hover .heatmap-bar {
    background: linear-gradient(to top, #2563eb, #3b82f6);
  }

  .heatmap-label {
    font-size: 0.625rem;
    color: #9ca3af;
    text-align: center;
  }

  .stats-footer {
    text-align: center;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .last-updated {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  @media (max-width: 768px) {
    .channel-stats {
      padding: 1rem;
    }

    .metrics-grid {
      grid-template-columns: 1fr;
    }

    .poster-item {
      grid-template-columns: 30px 40px 1fr 80px;
      gap: 0.5rem;
    }

    .poster-avatar {
      width: 40px;
      height: 40px;
    }

    .heatmap {
      gap: 0.125rem;
    }

    .heatmap-bar {
      min-height: 40px;
    }

    .heatmap-label {
      font-size: 0.5rem;
    }
  }
</style>
