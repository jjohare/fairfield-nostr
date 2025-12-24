<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from '../ui/Modal.svelte';
  import { createCalendarEvent } from '$lib/nostr/calendar';
  import type { FairfieldEvent, EventCategory, EventVenueType } from '$lib/types/calendar';
  import type { SectionId, CohortId } from '$lib/config/types';

  export let isOpen = false;
  export let defaultDate: Date | undefined = undefined;
  export let defaultSection: string | undefined = undefined;
  export let onEventCreated: ((event: FairfieldEvent) => void) | undefined = undefined;

  const dispatch = createEventDispatcher();

  let currentStep = 1;
  const totalSteps = 4;

  // Form state
  let formData = {
    title: '',
    description: '',
    category: 'workshop' as EventCategory,
    startDate: defaultDate || new Date(),
    startTime: '09:00',
    endDate: defaultDate || new Date(),
    endTime: '10:00',
    isAllDay: false,
    venueType: 'fairfield' as EventVenueType,
    room: 'main-room',
    address: '',
    virtualLink: '',
    visibleToSections: [defaultSection || 'public-lobby'] as SectionId[],
    detailsSections: [defaultSection || 'public-lobby'] as SectionId[],
    rsvpCohorts: [] as CohortId[],
    maxAttendees: undefined as number | undefined,
    createChatRoom: true
  };

  let validationErrors: Record<string, string> = {};
  let isSubmitting = false;
  let submitError = '';

  // Category options with icons
  const categories: Array<{ id: EventCategory; name: string; icon: string }> = [
    { id: 'workshop', name: 'Workshop', icon: '🛠️' },
    { id: 'seminar', name: 'Seminar', icon: '📚' },
    { id: 'social', name: 'Social', icon: '🎉' },
    { id: 'ceremony', name: 'Ceremony', icon: '🕯️' },
    { id: 'retreat', name: 'Retreat', icon: '🧘' },
    { id: 'work-session', name: 'Work Session', icon: '💼' },
    { id: 'maintenance', name: 'Maintenance', icon: '🔧' },
    { id: 'accommodation', name: 'Accommodation', icon: '🏠' },
    { id: 'club-night', name: 'Club Night', icon: '🎵' },
    { id: 'festival', name: 'Festival', icon: '🎪' },
    { id: 'market', name: 'Market', icon: '🛍️' },
    { id: 'nature', name: 'Nature', icon: '🌿' },
    { id: 'exhibition', name: 'Exhibition', icon: '🎨' },
    { id: 'meetup', name: 'Meetup', icon: '👥' },
    { id: 'webinar', name: 'Webinar', icon: '💻' },
    { id: 'call', name: 'Call', icon: '📞' },
    { id: 'stream', name: 'Stream', icon: '📡' },
    { id: 'planning', name: 'Planning', icon: '📋' }
  ];

  // Rooms for Fairfield venue
  const rooms = [
    { id: 'main-room', name: 'Main Room' },
    { id: 'garden', name: 'Garden' },
    { id: 'kitchen', name: 'Kitchen' },
    { id: 'meditation-space', name: 'Meditation Space' }
  ];

  // Section options (from sections.yaml)
  const sections: Array<{ id: SectionId; name: string }> = [
    { id: 'public-lobby', name: 'Public Lobby' },
    { id: 'community-rooms', name: 'Community Rooms' },
    { id: 'dreamlab', name: 'DreamLab' }
  ];

  // Cohort options
  const cohorts: Array<{ id: CohortId; name: string }> = [
    { id: 'admin', name: 'Administrators' },
    { id: 'approved', name: 'Approved Users' },
    { id: 'business', name: 'Business Partners' },
    { id: 'moomaa-tribe', name: 'Moomaa Tribe' }
  ];

  function validateStep(step: number): boolean {
    validationErrors = {};

    if (step === 1) {
      if (!formData.title.trim()) {
        validationErrors.title = 'Title is required';
      }
      if (!formData.description.trim()) {
        validationErrors.description = 'Description is required';
      }
    }

    if (step === 2) {
      const startDateTime = new Date(`${formData.startDate.toISOString().split('T')[0]}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate.toISOString().split('T')[0]}T${formData.endTime}`);

      if (endDateTime <= startDateTime) {
        validationErrors.endTime = 'End time must be after start time';
      }
    }

    if (step === 3) {
      if (formData.venueType === 'fairfield' && !formData.room) {
        validationErrors.room = 'Please select a room';
      }
      if ((formData.venueType === 'offsite' || formData.venueType === 'external') && !formData.address.trim()) {
        validationErrors.address = 'Address is required';
      }
      if (formData.venueType === 'online' && !formData.virtualLink.trim()) {
        validationErrors.virtualLink = 'Virtual link is required';
      }
    }

    if (step === 4) {
      if (formData.visibleToSections.length === 0) {
        validationErrors.visibleToSections = 'At least one section must be selected';
      }
    }

    return Object.keys(validationErrors).length === 0;
  }

  function nextStep() {
    if (validateStep(currentStep)) {
      currentStep++;
    }
  }

  function previousStep() {
    currentStep--;
  }

  async function handleSubmit() {
    if (!validateStep(currentStep)) {
      return;
    }

    isSubmitting = true;
    submitError = '';

    try {
      // Build start and end timestamps
      const startDateTime = formData.isAllDay
        ? new Date(formData.startDate.toISOString().split('T')[0])
        : new Date(`${formData.startDate.toISOString().split('T')[0]}T${formData.startTime}`);

      const endDateTime = formData.isAllDay
        ? new Date(formData.endDate.toISOString().split('T')[0])
        : new Date(`${formData.endDate.toISOString().split('T')[0]}T${formData.endTime}`);

      // Build location string
      let location = '';
      if (formData.venueType === 'fairfield') {
        const roomName = rooms.find(r => r.id === formData.room)?.name || formData.room;
        location = `Fairfield - ${roomName}`;
      } else if (formData.venueType === 'online') {
        location = `Online: ${formData.virtualLink}`;
      } else {
        location = formData.address;
      }

      // Use first visible section as the channel ID for access control
      const channelId = formData.visibleToSections[0];

      // Create the event
      const event = await createCalendarEvent({
        title: formData.title,
        description: formData.description,
        start: startDateTime,
        end: endDateTime,
        location,
        channelId,
        maxAttendees: formData.maxAttendees,
        tags: [formData.category, formData.venueType],
        createChatRoom: formData.createChatRoom
      });

      if (!event) {
        throw new Error('Failed to create event');
      }

      // Build FairfieldEvent (extended event type)
      const fairfieldEvent: FairfieldEvent = {
        ...event,
        venue: {
          type: formData.venueType,
          room: formData.venueType === 'fairfield' ? formData.room : undefined,
          address: formData.venueType !== 'fairfield' && formData.venueType !== 'online' ? formData.address : undefined,
          virtualLink: formData.venueType === 'online' ? formData.virtualLink : undefined
        },
        category: {
          primary: formData.category,
          tags: event.tags || [],
          isPublicListing: formData.visibleToSections.includes('public-lobby')
        },
        visibility: {
          visibleToSections: formData.visibleToSections,
          visibleToCohorts: formData.rsvpCohorts,
          visibleToRoles: [],
          detailsVisibleToSections: formData.detailsSections,
          detailsVisibleToCohorts: formData.rsvpCohorts,
          isPublicListing: formData.visibleToSections.includes('public-lobby')
        },
        attendance: {
          maxCapacity: formData.maxAttendees,
          currentCount: 0,
          waitlistEnabled: false,
          requiresApproval: false
        },
        status: 'published',
        linkedResources: {
          channelId,
          chatRoomId: event.chatRoomId,
          externalLinks: formData.venueType === 'online' ? [formData.virtualLink] : [],
          documents: []
        },
        meta: {
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
          createdBy: event.createdBy,
          lastModifiedBy: event.createdBy,
          status: 'published'
        }
      };

      // Success callback
      if (onEventCreated) {
        onEventCreated(fairfieldEvent);
      }

      dispatch('eventCreated', fairfieldEvent);

      // Show success toast (you can implement a toast system)
      console.log('Event created successfully:', fairfieldEvent);

      // Close modal and reset
      handleClose();
    } catch (error) {
      console.error('Failed to create event:', error);
      submitError = error instanceof Error ? error.message : 'Failed to create event';
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    isOpen = false;
    currentStep = 1;
    resetForm();
  }

  function resetForm() {
    formData = {
      title: '',
      description: '',
      category: 'workshop',
      startDate: defaultDate || new Date(),
      startTime: '09:00',
      endDate: defaultDate || new Date(),
      endTime: '10:00',
      isAllDay: false,
      venueType: 'fairfield',
      room: 'main-room',
      address: '',
      virtualLink: '',
      visibleToSections: [defaultSection || 'public-lobby'],
      detailsSections: [defaultSection || 'public-lobby'],
      rsvpCohorts: [],
      maxAttendees: undefined,
      createChatRoom: true
    };
    validationErrors = {};
    submitError = '';
  }

  // Watch for prop changes
  $: if (defaultDate) {
    formData.startDate = defaultDate;
    formData.endDate = defaultDate;
  }

  $: if (defaultSection && !formData.visibleToSections.includes(defaultSection as SectionId)) {
    formData.visibleToSections = [defaultSection as SectionId];
  }
</script>

<Modal bind:open={isOpen} title="Create Event" size="lg" closeOnBackdrop={false}>
  <!-- Steps indicator -->
  <div class="mb-6">
    <ul class="steps steps-horizontal w-full">
      <li class="step {currentStep >= 1 ? 'step-primary' : ''}">Basic Info</li>
      <li class="step {currentStep >= 2 ? 'step-primary' : ''}">Date & Time</li>
      <li class="step {currentStep >= 3 ? 'step-primary' : ''}">Location</li>
      <li class="step {currentStep >= 4 ? 'step-primary' : ''}">Visibility</li>
    </ul>
  </div>

  <!-- Step 1: Basic Info -->
  {#if currentStep === 1}
    <div class="space-y-4">
      <div class="form-control">
        <label class="label" for="title">
          <span class="label-text">Event Title <span class="text-error">*</span></span>
        </label>
        <input
          id="title"
          type="text"
          class="input input-bordered {validationErrors.title ? 'input-error' : ''}"
          bind:value={formData.title}
          placeholder="e.g., Morning Meditation Workshop"
          disabled={isSubmitting}
        />
        {#if validationErrors.title}
          <label class="label">
            <span class="label-text-alt text-error">{validationErrors.title}</span>
          </label>
        {/if}
      </div>

      <div class="form-control">
        <label class="label" for="description">
          <span class="label-text">Description <span class="text-error">*</span></span>
        </label>
        <textarea
          id="description"
          class="textarea textarea-bordered h-24 {validationErrors.description ? 'textarea-error' : ''}"
          bind:value={formData.description}
          placeholder="Describe your event..."
          disabled={isSubmitting}
        />
        {#if validationErrors.description}
          <label class="label">
            <span class="label-text-alt text-error">{validationErrors.description}</span>
          </label>
        {/if}
      </div>

      <div class="form-control">
        <label class="label" for="category">
          <span class="label-text">Category</span>
        </label>
        <select
          id="category"
          class="select select-bordered"
          bind:value={formData.category}
          disabled={isSubmitting}
        >
          {#each categories as cat}
            <option value={cat.id}>{cat.icon} {cat.name}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}

  <!-- Step 2: Date & Time -->
  {#if currentStep === 2}
    <div class="space-y-4">
      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox"
            bind:checked={formData.isAllDay}
            disabled={isSubmitting}
          />
          <span class="label-text">All-day event</span>
        </label>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-control">
          <label class="label" for="start-date">
            <span class="label-text">Start Date</span>
          </label>
          <input
            id="start-date"
            type="date"
            class="input input-bordered"
            bind:value={formData.startDate}
            disabled={isSubmitting}
          />
        </div>

        {#if !formData.isAllDay}
          <div class="form-control">
            <label class="label" for="start-time">
              <span class="label-text">Start Time</span>
            </label>
            <input
              id="start-time"
              type="time"
              class="input input-bordered"
              bind:value={formData.startTime}
              disabled={isSubmitting}
            />
          </div>
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="form-control">
          <label class="label" for="end-date">
            <span class="label-text">End Date</span>
          </label>
          <input
            id="end-date"
            type="date"
            class="input input-bordered"
            bind:value={formData.endDate}
            disabled={isSubmitting}
          />
        </div>

        {#if !formData.isAllDay}
          <div class="form-control">
            <label class="label" for="end-time">
              <span class="label-text">End Time</span>
            </label>
            <input
              id="end-time"
              type="time"
              class="input input-bordered {validationErrors.endTime ? 'input-error' : ''}"
              bind:value={formData.endTime}
              disabled={isSubmitting}
            />
            {#if validationErrors.endTime}
              <label class="label">
                <span class="label-text-alt text-error">{validationErrors.endTime}</span>
              </label>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Step 3: Location -->
  {#if currentStep === 3}
    <div class="space-y-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Venue Type</span>
        </label>
        <div class="flex gap-2 flex-wrap">
          <label class="label cursor-pointer border rounded-lg p-3 flex-1 min-w-[120px] {formData.venueType === 'fairfield' ? 'border-primary bg-primary/10' : 'border-base-300'}">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={formData.venueType}
              value="fairfield"
              disabled={isSubmitting}
            />
            <span class="label-text ml-2">Fairfield</span>
          </label>
          <label class="label cursor-pointer border rounded-lg p-3 flex-1 min-w-[120px] {formData.venueType === 'offsite' ? 'border-primary bg-primary/10' : 'border-base-300'}">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={formData.venueType}
              value="offsite"
              disabled={isSubmitting}
            />
            <span class="label-text ml-2">Offsite</span>
          </label>
          <label class="label cursor-pointer border rounded-lg p-3 flex-1 min-w-[120px] {formData.venueType === 'online' ? 'border-primary bg-primary/10' : 'border-base-300'}">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={formData.venueType}
              value="online"
              disabled={isSubmitting}
            />
            <span class="label-text ml-2">Online</span>
          </label>
          <label class="label cursor-pointer border rounded-lg p-3 flex-1 min-w-[120px] {formData.venueType === 'external' ? 'border-primary bg-primary/10' : 'border-base-300'}">
            <input
              type="radio"
              class="radio radio-primary"
              bind:group={formData.venueType}
              value="external"
              disabled={isSubmitting}
            />
            <span class="label-text ml-2">External</span>
          </label>
        </div>
      </div>

      {#if formData.venueType === 'fairfield'}
        <div class="form-control">
          <label class="label" for="room">
            <span class="label-text">Room <span class="text-error">*</span></span>
          </label>
          <select
            id="room"
            class="select select-bordered {validationErrors.room ? 'select-error' : ''}"
            bind:value={formData.room}
            disabled={isSubmitting}
          >
            {#each rooms as room}
              <option value={room.id}>{room.name}</option>
            {/each}
          </select>
          {#if validationErrors.room}
            <label class="label">
              <span class="label-text-alt text-error">{validationErrors.room}</span>
            </label>
          {/if}
        </div>
      {/if}

      {#if formData.venueType === 'offsite' || formData.venueType === 'external'}
        <div class="form-control">
          <label class="label" for="address">
            <span class="label-text">Address <span class="text-error">*</span></span>
          </label>
          <input
            id="address"
            type="text"
            class="input input-bordered {validationErrors.address ? 'input-error' : ''}"
            bind:value={formData.address}
            placeholder="Enter the venue address"
            disabled={isSubmitting}
          />
          {#if validationErrors.address}
            <label class="label">
              <span class="label-text-alt text-error">{validationErrors.address}</span>
            </label>
          {/if}
        </div>
      {/if}

      {#if formData.venueType === 'online'}
        <div class="form-control">
          <label class="label" for="virtual-link">
            <span class="label-text">Virtual Link <span class="text-error">*</span></span>
          </label>
          <input
            id="virtual-link"
            type="url"
            class="input input-bordered {validationErrors.virtualLink ? 'input-error' : ''}"
            bind:value={formData.virtualLink}
            placeholder="https://meet.example.com/event"
            disabled={isSubmitting}
          />
          {#if validationErrors.virtualLink}
            <label class="label">
              <span class="label-text-alt text-error">{validationErrors.virtualLink}</span>
            </label>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Step 4: Visibility -->
  {#if currentStep === 4}
    <div class="space-y-4">
      <div class="form-control">
        <label class="label">
          <span class="label-text">Who can see this event? <span class="text-error">*</span></span>
        </label>
        <div class="space-y-2">
          {#each sections as section}
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-primary"
                bind:group={formData.visibleToSections}
                value={section.id}
                disabled={isSubmitting}
              />
              <span class="label-text">{section.name}</span>
            </label>
          {/each}
        </div>
        {#if validationErrors.visibleToSections}
          <label class="label">
            <span class="label-text-alt text-error">{validationErrors.visibleToSections}</span>
          </label>
        {/if}
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Who can see full details?</span>
        </label>
        <div class="space-y-2">
          {#each sections as section}
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-secondary"
                bind:group={formData.detailsSections}
                value={section.id}
                disabled={isSubmitting}
              />
              <span class="label-text">{section.name}</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-control">
        <label class="label">
          <span class="label-text">Who can RSVP? (Cohorts)</span>
        </label>
        <div class="space-y-2">
          {#each cohorts as cohort}
            <label class="label cursor-pointer justify-start gap-2">
              <input
                type="checkbox"
                class="checkbox checkbox-accent"
                bind:group={formData.rsvpCohorts}
                value={cohort.id}
                disabled={isSubmitting}
              />
              <span class="label-text">{cohort.name}</span>
            </label>
          {/each}
        </div>
      </div>

      <div class="form-control">
        <label class="label" for="max-attendees">
          <span class="label-text">Max Attendees (optional)</span>
        </label>
        <input
          id="max-attendees"
          type="number"
          class="input input-bordered"
          bind:value={formData.maxAttendees}
          placeholder="Leave empty for unlimited"
          min="1"
          disabled={isSubmitting}
        />
      </div>

      <div class="form-control">
        <label class="label cursor-pointer justify-start gap-2">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={formData.createChatRoom}
            disabled={isSubmitting}
          />
          <span class="label-text">Create linked chatroom for this event</span>
        </label>
      </div>
    </div>
  {/if}

  <!-- Error display -->
  {#if submitError}
    <div class="alert alert-error mt-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{submitError}</span>
    </div>
  {/if}

  <!-- Footer actions -->
  <svelte:fragment slot="actions">
    <div class="flex justify-between w-full">
      <div>
        {#if currentStep > 1}
          <button
            class="btn btn-ghost"
            on:click={previousStep}
            disabled={isSubmitting}
          >
            Back
          </button>
        {/if}
      </div>

      <div class="flex gap-2">
        <button
          class="btn btn-ghost"
          on:click={handleClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>

        {#if currentStep < totalSteps}
          <button
            class="btn btn-primary"
            on:click={nextStep}
            disabled={isSubmitting}
          >
            Next
          </button>
        {:else}
          <button
            class="btn btn-primary"
            on:click={handleSubmit}
            disabled={isSubmitting}
          >
            {#if isSubmitting}
              <span class="loading loading-spinner loading-sm"></span>
              Creating...
            {:else}
              Create Event
            {/if}
          </button>
        {/if}
      </div>
    </div>
  </svelte:fragment>
</Modal>
