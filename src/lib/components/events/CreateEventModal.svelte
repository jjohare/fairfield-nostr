<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { createCalendarEvent, type CreateEventParams } from '$lib/nostr/calendar';

  export let channelId: string;
  export let channelName: string = 'this channel';
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let title = '';
  let description = '';
  let startDate = '';
  let startTime = '';
  let endDate = '';
  let endTime = '';
  let location = '';
  let maxAttendees: number | null = null;
  let tags = '';
  let isSubmitting = false;
  let error: string | null = null;

  // Set default dates
  $: if (isOpen && !startDate) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    startDate = tomorrow.toISOString().split('T')[0];
    startTime = '10:00';
    endDate = tomorrow.toISOString().split('T')[0];
    endTime = '11:00';
  }

  async function handleSubmit() {
    if (!title.trim()) {
      error = 'Event title is required';
      return;
    }

    if (!startDate || !startTime) {
      error = 'Start date and time are required';
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const params: CreateEventParams = {
        title: title.trim(),
        description: description.trim(),
        start: new Date(`${startDate}T${startTime}`),
        end: new Date(`${endDate || startDate}T${endTime || startTime}`),
        location: location.trim() || undefined,
        channelId,
        maxAttendees: maxAttendees || undefined,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
      };

      const event = await createCalendarEvent(params);

      if (event) {
        dispatch('created', event);
        closeModal();
      } else {
        error = 'Failed to create event. Please try again.';
      }
    } catch (e) {
      console.error('Error creating event:', e);
      error = e instanceof Error ? e.message : 'An error occurred';
    } finally {
      isSubmitting = false;
    }
  }

  function closeModal() {
    isOpen = false;
    title = '';
    description = '';
    startDate = '';
    startTime = '';
    endDate = '';
    endTime = '';
    location = '';
    maxAttendees = null;
    tags = '';
    error = null;
    dispatch('close');
  }
</script>

<div class="modal" class:modal-open={isOpen}>
  <div class="modal-box max-w-lg">
    <h3 class="font-bold text-xl mb-4">Create Event for {channelName}</h3>

    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      {#if error}
        <div class="alert alert-error text-sm">
          <span>{error}</span>
        </div>
      {/if}

      <!-- Title -->
      <div class="form-control">
        <label class="label" for="event-title">
          <span class="label-text">Event Title *</span>
        </label>
        <input
          id="event-title"
          type="text"
          class="input input-bordered"
          bind:value={title}
          placeholder="e.g., Weekly Meetup"
          required
        />
      </div>

      <!-- Description -->
      <div class="form-control">
        <label class="label" for="event-description">
          <span class="label-text">Description</span>
        </label>
        <textarea
          id="event-description"
          class="textarea textarea-bordered h-24"
          bind:value={description}
          placeholder="What's this event about?"
        />
      </div>

      <!-- Start Date/Time -->
      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label" for="start-date">
            <span class="label-text">Start Date *</span>
          </label>
          <input
            id="start-date"
            type="date"
            class="input input-bordered"
            bind:value={startDate}
            required
          />
        </div>
        <div class="form-control">
          <label class="label" for="start-time">
            <span class="label-text">Start Time *</span>
          </label>
          <input
            id="start-time"
            type="time"
            class="input input-bordered"
            bind:value={startTime}
            required
          />
        </div>
      </div>

      <!-- End Date/Time -->
      <div class="grid grid-cols-2 gap-3">
        <div class="form-control">
          <label class="label" for="end-date">
            <span class="label-text">End Date</span>
          </label>
          <input id="end-date" type="date" class="input input-bordered" bind:value={endDate} />
        </div>
        <div class="form-control">
          <label class="label" for="end-time">
            <span class="label-text">End Time</span>
          </label>
          <input id="end-time" type="time" class="input input-bordered" bind:value={endTime} />
        </div>
      </div>

      <!-- Location -->
      <div class="form-control">
        <label class="label" for="event-location">
          <span class="label-text">Location</span>
        </label>
        <input
          id="event-location"
          type="text"
          class="input input-bordered"
          bind:value={location}
          placeholder="e.g., Online / Meeting Room A"
        />
      </div>

      <!-- Max Attendees -->
      <div class="form-control">
        <label class="label" for="max-attendees">
          <span class="label-text">Max Attendees (optional)</span>
        </label>
        <input
          id="max-attendees"
          type="number"
          class="input input-bordered"
          bind:value={maxAttendees}
          min="1"
          placeholder="Leave empty for unlimited"
        />
      </div>

      <!-- Tags -->
      <div class="form-control">
        <label class="label" for="event-tags">
          <span class="label-text">Tags (comma-separated)</span>
        </label>
        <input
          id="event-tags"
          type="text"
          class="input input-bordered"
          bind:value={tags}
          placeholder="e.g., workshop, social, music"
        />
      </div>

      <!-- Actions -->
      <div class="modal-action">
        <button type="button" class="btn btn-ghost" on:click={closeModal} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
          {#if isSubmitting}
            <span class="loading loading-spinner loading-sm"></span>
            Creating...
          {:else}
            Create Event
          {/if}
        </button>
      </div>
    </form>
  </div>
  <button class="modal-backdrop" on:click={closeModal}>Close</button>
</div>
