<script lang="ts">
	import type { VisibilityLayer } from '$lib/types/calendar';
	import {
		getCategoryIcon,
		getCategoryColor,
		getVenueTypeIcon,
		getSpotsRemaining,
		isEventAtCapacity,
		type CalendarDisplayEvent
	} from '$lib/utils/calendar-visibility';

	// Props
	export let event: CalendarDisplayEvent;
	export let visibilityLayer: VisibilityLayer;
	export let onRSVP: ((eventId: string, status: 'accept' | 'decline') => void) | undefined = undefined;
	export let onClick: ((event: CalendarDisplayEvent) => void) | undefined = undefined;

	// State
	let isLoading = false;
	let error: string | null = null;
	let rsvpStatus: 'accept' | 'decline' | null = null;

	// Computed values
	$: categoryIcon = getCategoryIcon(event.category);
	$: categoryColor = getCategoryColor(event.category);
	$: venueIcon = event.venue ? getVenueTypeIcon(event.venue.type) : '📍';
	$: spotsRemaining = getSpotsRemaining(event);
	$: atCapacity = isEventAtCapacity(event);
	$: hasRSVP = onRSVP !== undefined;

	// Format time for display
	function formatTime(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	// Format time range
	function getTimeRange(): string {
		if (!event.end) return formatTime(event.start);
		return `${formatTime(event.start)} - ${formatTime(event.end)}`;
	}

	// Handle RSVP
	async function handleRSVP(status: 'accept' | 'decline') {
		if (!onRSVP) return;

		isLoading = true;
		error = null;

		try {
			await onRSVP(event.id, status);
			rsvpStatus = status;
		} catch (err) {
			error = err instanceof Error ? err.message : 'RSVP failed';
		} finally {
			isLoading = false;
		}
	}

	// Handle card click
	function handleClick() {
		if (onClick && visibilityLayer !== 'hidden') {
			onClick(event);
		}
	}

	// Get venue display text
	function getVenueDisplay(): string {
		if (visibilityLayer === 'type') {
			return venueIcon;
		}
		if (!event.venue) {
			return 'TBA';
		}
		if (event.venue.room) {
			return `${event.venue.room}`;
		}
		if (event.venue.address) {
			return event.venue.address.split(',')[0]; // First line only
		}
		if (event.venue.virtualLink) {
			return 'Online';
		}
		return 'TBA';
	}

	// Get event title based on visibility
	function getEventTitle(): string {
		if (visibilityLayer === 'full') {
			return event.title || event.name || 'Untitled Event';
		}
		if (visibilityLayer === 'type') {
			return 'Event';
		}
		return 'Private Event';
	}

	// Get attendee display
	function getAttendeeDisplay(): string {
		if (!event.attendance) return '0';
		const current = event.attendance.currentCount;
		const max = event.attendance.maxCapacity;

		if (max === undefined) {
			return `${current}`;
		}

		return `${current}/${max}`;
	}
</script>

{#if visibilityLayer === 'hidden'}
	<!-- Render nothing -->
{:else if visibilityLayer === 'busy'}
	<!-- Busy slot - minimal info -->
	<div class="event-card busy" on:click={handleClick} on:keydown={handleClick} role="button" tabindex="0">
		<div class="busy-pattern" />
		<div class="busy-content">
			<div class="time-range">{getTimeRange()}</div>
			<div class="busy-label">Private Event</div>
		</div>
	</div>
{:else if visibilityLayer === 'type'}
	<!-- Type layer - category and basic info -->
	<div
		class="event-card type"
		style="--accent-color: {categoryColor}"
		on:click={handleClick}
		on:keydown={handleClick}
		role="button"
		tabindex="0"
	>
		<div class="card-content">
			<div class="time-range">{getTimeRange()}</div>
			<div class="event-header">
				<span class="category-icon">{categoryIcon}</span>
				<span class="event-title">{getEventTitle()}</span>
			</div>
			<div class="venue-info">
				<span class="venue-icon">{venueIcon}</span>
			</div>
		</div>
	</div>
{:else if visibilityLayer === 'full'}
	<!-- Full details -->
	<div
		class="event-card full"
		style="--accent-color: {categoryColor}"
		on:click={handleClick}
		on:keydown={handleClick}
		role="button"
		tabindex="0"
	>
		<div class="card-content">
			<div class="time-range">{getTimeRange()}</div>

			<div class="event-header">
				<span class="category-icon">{categoryIcon}</span>
				<span class="event-title">{event.title}</span>
			</div>

			<div class="event-details">
				<div class="detail-row">
					<span class="detail-icon">📍</span>
					<span class="detail-text">{getVenueDisplay()}</span>
				</div>

				<div class="detail-row">
					<span class="detail-icon">👥</span>
					<span class="detail-text">{getAttendeeDisplay()}</span>
					{#if atCapacity}
						<span class="capacity-badge">FULL</span>
					{:else if spotsRemaining !== null && spotsRemaining <= 5}
						<span class="spots-badge">{spotsRemaining} left</span>
					{/if}
				</div>
			</div>

			{#if hasRSVP && (!event.status || event.status === 'published')}
				<div class="rsvp-actions">
					{#if error}
						<div class="error-message">{error}</div>
					{/if}

					<div class="rsvp-buttons">
						<button
							class="rsvp-btn accept"
							class:active={rsvpStatus === 'accept'}
							disabled={isLoading || atCapacity}
							on:click|stopPropagation={() => handleRSVP('accept')}
						>
							{isLoading ? '...' : rsvpStatus === 'accept' ? '✓ Accepted' : 'Accept'}
						</button>
						<button
							class="rsvp-btn decline"
							class:active={rsvpStatus === 'decline'}
							disabled={isLoading}
							on:click|stopPropagation={() => handleRSVP('decline')}
						>
							{isLoading ? '...' : rsvpStatus === 'decline' ? '✗ Declined' : 'Decline'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.event-card {
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		transition: all 0.2s ease;
		cursor: pointer;
		background: var(--card-bg, #ffffff);
		border: 1px solid var(--border-color, #e5e7eb);
	}

	.event-card:hover {
		box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		transform: translateY(-1px);
	}

	.event-card:focus {
		outline: 2px solid var(--accent-color, #3b82f6);
		outline-offset: 2px;
	}

	/* Busy state */
	.event-card.busy {
		height: 40px;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		position: relative;
	}

	.busy-pattern {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 8px,
			rgba(156, 163, 175, 0.2) 8px,
			rgba(156, 163, 175, 0.2) 16px
		);
	}

	.busy-content {
		position: relative;
		padding: 8px 12px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 100%;
	}

	.busy-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 500;
	}

	/* Type state */
	.event-card.type {
		height: 48px;
		border: 1px dashed var(--accent-color);
		background: rgba(var(--accent-rgb, 59, 130, 246), 0.05);
		opacity: 0.85;
	}

	.event-card.type .card-content {
		padding: 8px 12px;
		opacity: 0.9;
	}

	/* Full state */
	.event-card.full {
		min-height: 60px;
		border-left: 3px solid var(--accent-color);
	}

	.card-content {
		padding: 12px;
	}

	.time-range {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 600;
		margin-bottom: 4px;
		font-family: 'Courier New', monospace;
	}

	.event-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
	}

	.category-icon {
		font-size: 1.125rem;
		line-height: 1;
	}

	.event-title {
		font-size: 0.875rem;
		font-weight: 600;
		color: #111827;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.event-details {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
	}

	.detail-row {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75rem;
		color: #4b5563;
	}

	.detail-icon {
		font-size: 0.875rem;
		opacity: 0.8;
	}

	.detail-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.capacity-badge,
	.spots-badge {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 9999px;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	.capacity-badge {
		background: #ef4444;
		color: white;
	}

	.spots-badge {
		background: #f59e0b;
		color: white;
	}

	.venue-info {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
	}

	.venue-icon {
		font-size: 1rem;
		opacity: 0.7;
	}

	/* RSVP Actions */
	.rsvp-actions {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid #e5e7eb;
	}

	.error-message {
		font-size: 0.75rem;
		color: #ef4444;
		margin-bottom: 6px;
	}

	.rsvp-buttons {
		display: flex;
		gap: 6px;
	}

	.rsvp-btn {
		flex: 1;
		padding: 4px 8px;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 4px;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.rsvp-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.rsvp-btn.accept {
		background: #10b981;
		color: white;
		border-color: #059669;
	}

	.rsvp-btn.accept:hover:not(:disabled) {
		background: #059669;
	}

	.rsvp-btn.accept.active {
		background: #047857;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.rsvp-btn.decline {
		background: #ef4444;
		color: white;
		border-color: #dc2626;
	}

	.rsvp-btn.decline:hover:not(:disabled) {
		background: #dc2626;
	}

	.rsvp-btn.decline.active {
		background: #b91c1c;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.event-card {
			--card-bg: #1f2937;
			--border-color: #374151;
		}

		.event-title {
			color: #f9fafb;
		}

		.detail-row {
			color: #d1d5db;
		}

		.time-range {
			color: #9ca3af;
		}

		.rsvp-actions {
			border-top-color: #374151;
		}

		.event-card.busy {
			background: #374151;
			border-color: #4b5563;
		}

		.busy-label {
			color: #9ca3af;
		}
	}
</style>
