<script lang="ts">
  import Modal from './Modal.svelte';
  import { onMount } from 'svelte';

  export let open = false;

  let currentSlide = 0;
  const slides = [
    {
      title: 'Welcome to Nostr',
      content: 'Nostr is a simple, open protocol for decentralized social networking. No central authority, no censorship.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />`
    },
    {
      title: 'Your Keys, Your Identity',
      content: 'You control your identity with cryptographic keys. Your public key (npub) is like your username - safe to share. Your private key (nsec) must be kept secret.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />`
    },
    {
      title: 'Relays Connect You',
      content: 'Relays are servers that store and forward messages. Connect to multiple relays for better reach and reliability. Messages are encrypted end-to-end.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />`
    },
    {
      title: 'Get Started',
      content: 'Create your account to get started. You\'ll receive a 12-word recovery phrase - write it down and keep it safe. This is the only way to recover your account.',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />`
    }
  ];

  function nextSlide() {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
    }
  }

  function prevSlide() {
    if (currentSlide > 0) {
      currentSlide--;
    }
  }

  function finish() {
    localStorage.setItem('hasSeenOnboarding', 'true');
    open = false;
  }

  onMount(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      open = true;
    }
  });
</script>

<Modal bind:open size="md" title="" closeOnBackdrop={false} closeOnEscape={false}>
  <div class="flex flex-col items-center text-center py-6">
    <!-- Icon -->
    <div class="bg-primary/10 rounded-full p-6 mb-6">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-16 w-16 text-primary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        {@html slides[currentSlide].icon}
      </svg>
    </div>

    <!-- Title -->
    <h2 class="text-2xl font-bold mb-4">{slides[currentSlide].title}</h2>

    <!-- Content -->
    <p class="text-base-content/80 mb-8 max-w-md leading-relaxed">
      {slides[currentSlide].content}
    </p>

    <!-- Progress Dots -->
    <div class="flex gap-2 mb-8">
      {#each slides as _, i}
        <button
          class="w-2 h-2 rounded-full transition-all {i === currentSlide
            ? 'bg-primary w-8'
            : 'bg-base-content/20'}"
          on:click={() => (currentSlide = i)}
          aria-label="Go to slide {i + 1}"
        />
      {/each}
    </div>

    <!-- Navigation -->
    <div class="flex gap-3 w-full max-w-md">
      {#if currentSlide > 0}
        <button class="btn btn-ghost flex-1" on:click={prevSlide}>
          Back
        </button>
      {/if}

      {#if currentSlide < slides.length - 1}
        <button class="btn btn-primary flex-1" on:click={nextSlide}>
          Next
        </button>
      {:else}
        <button class="btn btn-primary flex-1" on:click={finish}>
          Get Started
        </button>
      {/if}
    </div>

    <!-- Skip -->
    {#if currentSlide < slides.length - 1}
      <button class="btn btn-ghost btn-sm mt-4" on:click={finish}>
        Skip Tutorial
      </button>
    {/if}
  </div>
</Modal>
