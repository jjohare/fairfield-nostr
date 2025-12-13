<script lang="ts">
  export let draftPreview: string;
  export let tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'right';
</script>

<div class="tooltip tooltip-{tooltipPosition}" data-tip={draftPreview}>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-4 w-4 text-warning flex-shrink-0"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
</div>
