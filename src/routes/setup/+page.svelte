<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		setupStore,
		currentSetupStep,
		setupErrors,
		workingConfig,
		type SetupStep
	} from '$lib/stores/setup';
	import { stringify as stringifyYaml } from 'yaml';

	let yamlInput = '';
	let appName = '';
	let adminPubkey = '';
	let relayUrl = '';
	let dragActive = false;
	let fileInput: HTMLInputElement;

	const steps: { id: SetupStep; label: string; icon: string }[] = [
		{ id: 'welcome', label: 'Welcome', icon: '1' },
		{ id: 'upload-config', label: 'Configuration', icon: '2' },
		{ id: 'app-settings', label: 'App Settings', icon: '3' },
		{ id: 'admin-setup', label: 'Admin Setup', icon: '4' },
		{ id: 'categories-setup', label: 'Categories', icon: '5' },
		{ id: 'review', label: 'Review', icon: '6' }
	];

	function getStepIndex(step: SetupStep): number {
		return steps.findIndex((s) => s.id === step);
	}

	function isStepComplete(step: SetupStep, currentStep: SetupStep): boolean {
		return getStepIndex(step) < getStepIndex(currentStep);
	}

	function isStepCurrent(step: SetupStep, currentStep: SetupStep): boolean {
		return step === currentStep;
	}

	async function handleFileUpload(file: File) {
		const text = await file.text();
		yamlInput = text;
		await uploadYaml();
	}

	async function uploadYaml() {
		if (!yamlInput.trim()) return;
		const result = await setupStore.uploadConfig(yamlInput);
		if (result.success) {
			setupStore.goToStep('review');
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragActive = false;
		const file = e.dataTransfer?.files[0];
		if (file && (file.name.endsWith('.yaml') || file.name.endsWith('.yml'))) {
			handleFileUpload(file);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragActive = true;
	}

	function handleDragLeave() {
		dragActive = false;
	}

	function openFilePicker() {
		fileInput?.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			handleFileUpload(file);
		}
	}

	function skipToManual() {
		setupStore.nextStep();
	}

	function completeSetup() {
		setupStore.completeSetup();
		goto('/');
	}

	function skipSetup() {
		setupStore.skipSetup();
		goto('/');
	}

	function downloadTemplate() {
		const template = `# Instance Configuration Template
# Edit this file and upload to configure your instance

app:
  name: "Your App Name"
  version: "1.0.0"
  defaultSection: "public"

roles:
  - id: "guest"
    name: "Guest"
    level: 0
    description: "Basic authenticated user"
  - id: "member"
    name: "Member"
    level: 1
    description: "Approved member"
  - id: "moderator"
    name: "Moderator"
    level: 2
    description: "Can moderate content"
    capabilities: ["channel.create", "message.delete"]
  - id: "section-admin"
    name: "Section Admin"
    level: 3
    description: "Section administrator"
    capabilities: ["section.manage", "member.approve"]
  - id: "admin"
    name: "Admin"
    level: 4
    description: "Global administrator"
    capabilities: ["admin.global"]

cohorts:
  - id: "admin"
    name: "Administrators"
    description: "System administrators"
  - id: "approved"
    name: "Approved Users"
    description: "Manually approved users"

sections:
  - id: "public"
    name: "Public Area"
    description: "Open to all authenticated users"
    icon: "globe"
    order: 1
    access:
      requiresApproval: false
      defaultRole: "guest"
      autoApprove: true
    features:
      showStats: true
      allowChannelCreation: false
      calendar:
        access: "full"
        canCreate: false
    ui:
      color: "#6366f1"

  - id: "members"
    name: "Members Area"
    description: "Requires approval to join"
    icon: "users"
    order: 2
    access:
      requiresApproval: true
      defaultRole: "member"
      autoApprove: false
    features:
      showStats: true
      allowChannelCreation: true
      calendar:
        access: "full"
        canCreate: true
    ui:
      color: "#8b5cf6"
`;
		const blob = new Blob([template], { type: 'text/yaml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sections-template.yaml';
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportCurrentConfig() {
		const yaml = setupStore.exportConfigYaml();
		const blob = new Blob([yaml], { type: 'text/yaml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'sections.yaml';
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		if (setupStore.isSetupComplete) {
			goto('/');
		}
	});
</script>

<div class="min-h-screen bg-gray-900 text-white">
	<!-- Progress Steps -->
	<div class="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
		<div class="max-w-4xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between">
				{#each steps as step, i}
					<div class="flex items-center">
						<div
							class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                {isStepComplete(step.id, $currentSetupStep)
								? 'bg-green-600 text-white'
								: isStepCurrent(step.id, $currentSetupStep)
									? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
									: 'bg-gray-700 text-gray-400'}"
						>
							{#if isStepComplete(step.id, $currentSetupStep)}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								{step.icon}
							{/if}
						</div>
						<span
							class="ml-2 text-sm hidden sm:block
              {isStepCurrent(step.id, $currentSetupStep)
								? 'text-white font-medium'
								: 'text-gray-500'}"
						>
							{step.label}
						</span>
					</div>
					{#if i < steps.length - 1}
						<div
							class="flex-1 h-0.5 mx-4
              {isStepComplete(steps[i + 1].id, $currentSetupStep) ? 'bg-green-600' : 'bg-gray-700'}"
						></div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="max-w-2xl mx-auto px-4 py-12">
		{#if $currentSetupStep === 'welcome'}
			<div class="text-center">
				<div class="text-6xl mb-6">&#x1F331;</div>
				<h1 class="text-3xl font-bold mb-4">Instance Setup</h1>
				<p class="text-gray-400 mb-8 max-w-md mx-auto">
					Configure your instance with sections, roles, and permissions. You can upload an existing
					configuration or create one step by step.
				</p>

				<div class="space-y-4">
					<button
						on:click={() => setupStore.nextStep()}
						class="w-full max-w-xs mx-auto block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
					>
						Start Setup
					</button>
					<button on:click={skipSetup} class="text-gray-500 hover:text-gray-300 text-sm">
						Use default configuration
					</button>
				</div>
			</div>
		{:else if $currentSetupStep === 'upload-config'}
			<div>
				<h2 class="text-2xl font-bold mb-2">Configuration</h2>
				<p class="text-gray-400 mb-6">
					Upload an existing YAML configuration file or create one manually.
				</p>

				<!-- Upload Zone -->
				<div
					class="border-2 border-dashed rounded-xl p-8 text-center mb-6 transition-colors
            {dragActive
						? 'border-indigo-500 bg-indigo-500/10'
						: 'border-gray-700 hover:border-gray-600'}"
					on:drop={handleDrop}
					on:dragover={handleDragOver}
					on:dragleave={handleDragLeave}
					role="button"
					tabindex="0"
				>
					<div class="text-4xl mb-4">&#x1F4C4;</div>
					<p class="text-gray-300 mb-2">Drop your YAML config file here</p>
					<p class="text-gray-500 text-sm mb-4">or</p>
					<button
						on:click={openFilePicker}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
					>
						Browse files
					</button>
					<input
						bind:this={fileInput}
						type="file"
						accept=".yaml,.yml"
						class="hidden"
						on:change={handleFileChange}
					/>
				</div>

				<!-- Manual Input -->
				<details class="mb-6">
					<summary class="cursor-pointer text-indigo-400 hover:text-indigo-300">
						Paste YAML directly
					</summary>
					<div class="mt-4">
						<textarea
							bind:value={yamlInput}
							placeholder="Paste your YAML configuration here..."
							class="w-full h-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
						<button
							on:click={uploadYaml}
							disabled={!yamlInput.trim()}
							class="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm"
						>
							Parse Configuration
						</button>
					</div>
				</details>

				{#if $setupErrors.length > 0}
					<div class="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
						<p class="font-medium text-red-400 mb-2">Configuration Errors</p>
						<ul class="list-disc list-inside text-red-300 text-sm space-y-1">
							{#each $setupErrors as error}
								<li>{error}</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="flex items-center justify-between pt-4 border-t border-gray-800">
					<button
						on:click={downloadTemplate}
						class="text-gray-400 hover:text-white text-sm flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
							/>
						</svg>
						Download Template
					</button>
					<button
						on:click={skipToManual}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
					>
						Configure Manually
					</button>
				</div>
			</div>
		{:else if $currentSetupStep === 'app-settings'}
			<div>
				<h2 class="text-2xl font-bold mb-2">App Settings</h2>
				<p class="text-gray-400 mb-6">Configure basic application settings.</p>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Application Name</label>
						<input
							bind:value={appName}
							placeholder="My Community"
							class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2">Relay URL</label>
						<input
							bind:value={relayUrl}
							placeholder="wss://relay.example.com"
							class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
					</div>
				</div>

				<div class="flex justify-between mt-8">
					<button
						on:click={() => setupStore.prevStep()}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					>
						Back
					</button>
					<button
						on:click={() => {
							setupStore.setAppSettings({ name: appName || 'My Community' });
							setupStore.nextStep();
						}}
						class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
					>
						Continue
					</button>
				</div>
			</div>
		{:else if $currentSetupStep === 'admin-setup'}
			<div>
				<h2 class="text-2xl font-bold mb-2">Admin Setup</h2>
				<p class="text-gray-400 mb-6">Configure the initial administrator account.</p>

				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-300 mb-2"
							>Admin Public Key (hex)</label
						>
						<input
							bind:value={adminPubkey}
							placeholder="64-character hex public key"
							class="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
						/>
						<p class="text-gray-500 text-sm mt-2">
							This pubkey will have full admin access. You can add more admins later.
						</p>
					</div>
				</div>

				<div class="flex justify-between mt-8">
					<button
						on:click={() => setupStore.prevStep()}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					>
						Back
					</button>
					<button
						on:click={() => setupStore.nextStep()}
						class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
					>
						Continue
					</button>
				</div>
			</div>
		{:else if $currentSetupStep === 'categories-setup'}
			<div>
				<h2 class="text-2xl font-bold mb-2">Categories & Sections</h2>
				<p class="text-gray-400 mb-6">
					Categories contain sections, which contain forums. This is your 3-tier navigation hierarchy.
				</p>

				<div class="space-y-4 mb-6">
					{#if $workingConfig.categories?.length}
						{#each $workingConfig.categories as category}
							<div class="bg-gray-800 rounded-lg p-4">
								<div class="flex items-center gap-3 mb-3">
									<span class="text-2xl">{category.icon}</span>
									<div>
										<p class="font-medium text-lg">{category.name}</p>
										<p class="text-gray-500 text-sm">{category.description}</p>
									</div>
								</div>
								{#if category.sections?.length}
									<div class="ml-8 space-y-2">
										{#each category.sections as section}
											<div class="bg-gray-700 rounded-lg p-3 flex items-center justify-between">
												<div class="flex items-center gap-2">
													<span class="text-lg">{section.icon}</span>
													<div>
														<p class="font-medium">{section.name}</p>
														<p class="text-gray-500 text-xs">{section.description}</p>
													</div>
												</div>
												<span class="text-xs text-gray-400">
													{section.access.requiresApproval ? 'Approval required' : 'Auto-approve'}
												</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					{:else}
						<div class="text-center py-8 text-gray-500">
							<p>No sections configured yet.</p>
							<p class="text-sm mt-2">Default sections will be used.</p>
						</div>
					{/if}
				</div>

				<div class="flex justify-between mt-8">
					<button
						on:click={() => setupStore.prevStep()}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					>
						Back
					</button>
					<button
						on:click={() => setupStore.nextStep()}
						class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
					>
						Continue
					</button>
				</div>
			</div>
		{:else if $currentSetupStep === 'review'}
			<div>
				<h2 class="text-2xl font-bold mb-2">Review Configuration</h2>
				<p class="text-gray-400 mb-6">Review your configuration before completing setup.</p>

				<div class="bg-gray-800 rounded-lg p-4 mb-6">
					<div class="flex justify-between items-center mb-4">
						<h3 class="font-medium">Configuration Preview</h3>
						<button
							on:click={exportCurrentConfig}
							class="text-indigo-400 hover:text-indigo-300 text-sm"
						>
							Export YAML
						</button>
					</div>
					<pre
						class="text-xs text-gray-300 overflow-auto max-h-96 font-mono">{setupStore.exportConfigYaml()}</pre>
				</div>

				<div class="flex justify-between mt-8">
					<button
						on:click={() => setupStore.prevStep()}
						class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
					>
						Back
					</button>
					<button
						on:click={completeSetup}
						class="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
					>
						Complete Setup
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
