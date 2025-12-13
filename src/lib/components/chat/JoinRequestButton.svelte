<script lang="ts">
  import { channelStore, selectedChannel, userMemberStatus } from '$lib/stores/channelStore';
  import { authStore } from '$lib/stores/auth';
  import { toast } from '$lib/stores/toast';

  let isLoading = false;

  $: status = $userMemberStatus;
  $: buttonText = getButtonText(status);
  $: buttonClass = getButtonClass(status);
  $: isDisabled = status !== 'non-member' || isLoading || !$authStore.isAuthenticated;

  function getButtonText(status: string): string {
    switch (status) {
      case 'admin':
        return 'Admin';
      case 'member':
        return 'Member';
      case 'pending':
        return 'Request Pending';
      default:
        return 'Request to Join';
    }
  }

  function getButtonClass(status: string): string {
    switch (status) {
      case 'admin':
        return 'btn-primary';
      case 'member':
        return 'btn-success';
      case 'pending':
        return 'btn-warning';
      default:
        return 'btn-outline btn-primary';
    }
  }

  function getIcon(status: string) {
    switch (status) {
      case 'admin':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>`;
      case 'member':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
        </svg>`;
      case 'pending':
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
        </svg>`;
      default:
        return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
        </svg>`;
    }
  }

  async function handleJoinRequest() {
    if (!$selectedChannel || !$authStore.publicKey || isDisabled) return;

    isLoading = true;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      channelStore.requestJoin($selectedChannel.id, $authStore.publicKey);
      toast.success('Join request sent successfully');

    } catch (error) {
      console.error('Failed to send join request:', error);
      toast.error('Failed to send join request', 5000, {
        label: 'Retry',
        callback: async () => {
          await handleJoinRequest();
        }
      });
    } finally {
      isLoading = false;
    }
  }
</script>

{#if $selectedChannel}
  <button
    class="btn {buttonClass} gap-2"
    on:click={handleJoinRequest}
    disabled={isDisabled}
  >
    {#if isLoading}
      <span class="loading loading-spinner loading-sm"></span>
    {:else}
      {@html getIcon(status)}
    {/if}
    <span>{buttonText}</span>
  </button>
{/if}
