<script lang="ts">
  import type { DayActivity } from '$lib/stores/channelStats';

  export let data: DayActivity[] = [];
  export let days: number = 7;
  export let height: number = 200;

  $: displayData = data.slice(-days);
  $: maxValue = Math.max(...displayData.map(d => d.count), 1);

  let hoveredIndex: number | null = null;
  let tooltipX: number = 0;
  let tooltipY: number = 0;

  function handleMouseMove(event: MouseEvent, index: number, x: number) {
    hoveredIndex = index;
    tooltipX = x;
    tooltipY = event.clientY;
  }

  function handleMouseLeave() {
    hoveredIndex = null;
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDayLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
</script>

<div class="activity-graph">
  {#if displayData.length === 0}
    <div class="empty-state">
      <p>No activity data available</p>
    </div>
  {:else}
    <svg
      width="100%"
      viewBox="0 0 {displayData.length * 60} {height + 40}"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Grid lines -->
      <g class="grid">
        {#each [0, 0.25, 0.5, 0.75, 1] as fraction}
          <line
            x1="0"
            y1={height - fraction * height}
            x2={displayData.length * 60}
            y2={height - fraction * height}
            stroke="#e5e7eb"
            stroke-width="1"
            stroke-dasharray="4 4"
          />
        {/each}
      </g>

      <!-- Bars -->
      <g class="bars">
        {#each displayData as day, i}
          {@const barHeight = (day.count / maxValue) * height}
          {@const x = i * 60 + 15}
          {@const y = height - barHeight}

          <rect
            {x}
            {y}
            width="30"
            height={barHeight}
            class="bar"
            class:hovered={hoveredIndex === i}
            fill={hoveredIndex === i ? '#2563eb' : '#60a5fa'}
            rx="4"
            on:mouseenter={(e) => handleMouseMove(e, i, x + 15)}
            on:mousemove={(e) => handleMouseMove(e, i, x + 15)}
            on:mouseleave={handleMouseLeave}
            role="presentation"
          />

          <!-- Day label -->
          <text
            x={x + 15}
            y={height + 20}
            text-anchor="middle"
            class="label"
            fill="#6b7280"
            font-size="12"
          >
            {formatDayLabel(day.date)}
          </text>
        {/each}
      </g>

      <!-- Y-axis labels -->
      <g class="y-axis">
        {#each [0, 0.25, 0.5, 0.75, 1] as fraction, i}
          <text
            x="-5"
            y={height - fraction * height + 4}
            text-anchor="end"
            class="axis-label"
            fill="#9ca3af"
            font-size="10"
          >
            {Math.round(maxValue * fraction)}
          </text>
        {/each}
      </g>
    </svg>

    <!-- Tooltip -->
    {#if hoveredIndex !== null}
      {@const day = displayData[hoveredIndex]}
      <div
        class="tooltip"
        style="left: {tooltipX}px; top: {tooltipY - 60}px;"
      >
        <div class="tooltip-date">{formatDate(day.date)}</div>
        <div class="tooltip-count">
          {day.count} {day.count === 1 ? 'message' : 'messages'}
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .activity-graph {
    position: relative;
    width: 100%;
    min-height: 240px;
    background: white;
    border-radius: 8px;
    padding: 1rem;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: #9ca3af;
    font-size: 0.875rem;
  }

  .bar {
    cursor: pointer;
    transition: fill 0.2s ease;
  }

  .bar:hover {
    fill: #2563eb;
  }

  .label {
    user-select: none;
  }

  .axis-label {
    user-select: none;
  }

  .tooltip {
    position: fixed;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    pointer-events: none;
    z-index: 1000;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 0.875rem;
  }

  .tooltip-date {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .tooltip-count {
    color: #93c5fd;
  }

  @media (max-width: 640px) {
    .activity-graph {
      padding: 0.5rem;
    }
  }
</style>
