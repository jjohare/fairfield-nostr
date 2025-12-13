<script lang="ts">
  import InfoTooltip from './InfoTooltip.svelte';

  export let showAdvanced = false;

  function toggleAdvanced() {
    showAdvanced = !showAdvanced;
  }
</script>

<div class="advanced-settings-wrapper">
  <!-- Toggle Button -->
  <button
    class="btn btn-ghost btn-sm gap-2 mb-4"
    on:click={toggleAdvanced}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="h-5 w-5 transition-transform {showAdvanced ? 'rotate-90' : ''}"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
    </svg>
    <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
    <InfoTooltip
      text="Advanced options provide additional control and customization. Most users don't need to change these settings."
      position="right"
      inline={true}
    />
  </button>

  <!-- Advanced Settings Content (Hidden by Default) -->
  {#if showAdvanced}
    <div class="advanced-content space-y-4 pl-4 border-l-2 border-base-300">
      <slot />
    </div>
  {/if}
</div>

<style>
  .advanced-settings-wrapper {
    margin: 1rem 0;
  }

  .advanced-content {
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
