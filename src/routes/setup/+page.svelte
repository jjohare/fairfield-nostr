<script lang="ts">
  import Login from '$lib/components/auth/Login.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';

  function handleSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;
    authStore.setKeys(publicKey, privateKey);
    goto(`${base}/chat`);
  }
</script>

<svelte:head>
  <title>Login - Minimoomaa Noir</title>
</svelte:head>

<Login on:success={handleSuccess} />
