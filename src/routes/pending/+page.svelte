<script lang="ts">
  import { authStore } from '$lib/stores/auth';
</script>

<svelte:head>
  <title>Pending Approval - Minimoomaa Noir</title>
</svelte:head>

<div class="flex items-center justify-center min-h-[calc(100vh-64px)] p-4">
  <div class="card bg-base-200 shadow-xl max-w-md w-full">
    <div class="card-body items-center text-center">
      <div class="text-6xl mb-4">⏳</div>

      <h1 class="card-title text-2xl mb-2">Approval Pending</h1>

      <p class="text-base-content/70 mb-4">
        Your account has been created successfully!
        An administrator will review and approve your access shortly.
      </p>

      <div class="alert alert-info">
        <div class="text-sm text-left">
          <h3 class="font-bold mb-2">What happens next?</h3>
          <ul class="list-disc list-inside space-y-1">
            <li>An admin will review your request</li>
            <li>You'll be notified once approved</li>
            <li>Check back soon or wait for confirmation</li>
          </ul>
        </div>
      </div>

      <div class="card-actions mt-4">
        <button class="btn btn-ghost" on:click={() => authStore.logout()}>
          Logout
        </button>
      </div>
    </div>
  </div>
</div>
