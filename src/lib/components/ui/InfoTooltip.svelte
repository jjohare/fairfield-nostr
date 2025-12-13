<script lang="ts">
  export let text: string;
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let maxWidth: string = '300px';
  export let inline: boolean = false;
</script>

<div class="info-tooltip {inline ? 'inline-block' : ''}" data-tip={text}>
  <div class="tooltip tooltip-{position}" data-tip={text}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-4 w-4 text-base-content/60 hover:text-info cursor-help transition-colors"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  </div>
</div>

<style>
  .info-tooltip :global(.tooltip) {
    --tooltip-color: hsl(var(--b1));
    --tooltip-text-color: hsl(var(--bc));
    max-width: v-bind(maxWidth);
    white-space: normal;
    text-align: left;
    font-size: 0.875rem;
    line-height: 1.25rem;
    padding: 0.75rem;
    border: 1px solid hsl(var(--bc) / 0.1);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
  }

  .info-tooltip :global(.tooltip):before {
    max-width: v-bind(maxWidth);
    white-space: normal;
  }
</style>
