<script lang="ts">
  import { getAvatarUrl } from '$lib/utils/identicon';

  // For now, moderators are derived from admin pubkeys
  // In a full implementation, this would be fetched from relay
  export let moderators: Array<{
    pubkey: string;
    displayName: string;
    role: string;
  }> = [];

  // Default moderator (admin)
  const defaultMods = [
    {
      pubkey: '55f6d852c8ecbf022be81be356b62fdeef09c900deaf2bd262dc6759427c2eb2',
      displayName: 'Admin',
      role: 'Administrator',
    },
  ];

  $: displayMods = moderators.length > 0 ? moderators : defaultMods;
</script>

<div class="card bg-base-200 shadow-lg">
  <div class="card-body p-4">
    <h3 class="card-title text-lg text-primary mb-3">Moderating Team</h3>

    <div class="space-y-3">
      {#each displayMods as mod}
        <div class="flex items-center gap-3">
          <div class="avatar">
            <div class="w-10 rounded-full">
              <img
                src={getAvatarUrl(mod.pubkey, 80)}
                alt={mod.displayName}
              />
            </div>
          </div>
          <div class="flex-1">
            <div class="font-medium text-sm">{mod.displayName}</div>
            <div class="text-xs text-base-content/60">{mod.role}</div>
          </div>
          <div class="badge badge-primary badge-sm">{mod.role.charAt(0)}</div>
        </div>
      {/each}
    </div>

    <div class="mt-3 pt-3 border-t border-base-300">
      <p class="text-xs text-base-content/50 text-center">
        Contact a moderator for help
      </p>
    </div>
  </div>
</div>
