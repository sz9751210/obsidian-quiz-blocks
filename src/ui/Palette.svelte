<script lang="ts">
	type Item = {
		name: string;
		description: string;
		preview: 'bg' | 'border' | 'text' | 'rgba' | 'hsl' | 'selection';
	};

	const items: Item[] = [
		{ name: '--background-primary', description: 'Primary background', preview: 'bg' },
		{ name: '--background-primary-alt', description: 'Background for surfaces on top of primary background', preview: 'bg' },
		{ name: '--background-secondary', description: 'Secondary background', preview: 'bg' },
		{ name: '--background-secondary-alt', description: 'Background for surfaces on top of secondary background', preview: 'bg' },
		{ name: '--background-modifier-hover', description: 'Hovered elements', preview: 'bg' },
		{ name: '--background-modifier-active-hover', description: 'Active hovered elements', preview: 'bg' },
		{ name: '--background-modifier-border', description: 'Border color', preview: 'border' },
		{ name: '--background-modifier-border-hover', description: 'Border color (hover)', preview: 'border' },
		{ name: '--background-modifier-border-focus', description: 'Border color (focus)', preview: 'border' },
		{ name: '--background-modifier-error-rgb', description: 'Error background, RGB value', preview: 'rgba' },
		{ name: '--background-modifier-error', description: 'Error background', preview: 'bg' },
		{ name: '--background-modifier-error-hover', description: 'Error background (hover)', preview: 'bg' },
		{ name: '--background-modifier-success-rgb', description: 'Success background, RGB value', preview: 'rgba' },
		{ name: '--background-modifier-success', description: 'Success background', preview: 'bg' },
		{ name: '--background-modifier-message', description: 'Messages background', preview: 'bg' },
		{ name: '--background-modifier-form-field', description: 'Form field background', preview: 'bg' },

		{ name: '--interactive-normal', description: 'Background for standard interactive elements', preview: 'bg' },
		{ name: '--interactive-hover', description: 'Background for standard interactive elements (hover)', preview: 'bg' },
		{ name: '--interactive-accent', description: 'Background for accented interactive elements', preview: 'bg' },
		{ name: '--interactive-accent-hsl', description: 'Background for accented interactive elements in HSL', preview: 'hsl' },
		{ name: '--interactive-accent-hover', description: 'Background for accented interactive elements (hover)', preview: 'bg' },

		{ name: '--text-normal', description: 'Normal text', preview: 'text' },
		{ name: '--text-muted', description: 'Muted text', preview: 'text' },
		{ name: '--text-faint', description: 'Faint text', preview: 'text' },
		{ name: '--text-on-accent', description: 'Text on accent background when accent is dark', preview: 'text' },
		{ name: '--text-on-accent-inverted', description: 'Text on accent background when accent is light', preview: 'text' },
		{ name: '--text-success', description: 'Success text', preview: 'text' },
		{ name: '--text-warning', description: 'Warning text', preview: 'text' },
		{ name: '--text-error', description: 'Error text', preview: 'text' },
		{ name: '--text-accent', description: 'Accent text', preview: 'text' },
		{ name: '--text-accent-hover', description: 'Accent text (hover)', preview: 'text' },
		{ name: '--text-selection', description: 'Selected text background', preview: 'selection' },
		{ name: '--text-highlight-bg', description: 'Highlighted text background', preview: 'bg' },

		{ name: '--color-base-00', description: '', preview: 'bg' },
		{ name: '--color-base-05', description: '', preview: 'bg' },
		{ name: '--color-base-10', description: '', preview: 'bg' },
		{ name: '--color-base-20', description: '', preview: 'bg' },
		{ name: '--color-base-25', description: '', preview: 'bg' },
		{ name: '--color-base-30', description: '', preview: 'bg' },
		{ name: '--color-base-35', description: '', preview: 'bg' },
		{ name: '--color-base-40', description: '', preview: 'bg' },
		{ name: '--color-base-50', description: '', preview: 'bg' },
		{ name: '--color-base-60', description: '', preview: 'bg' },
		{ name: '--color-base-70', description: '', preview: 'bg' },
		{ name: '--color-base-100', description: '', preview: 'bg' },

		{ name: '--color-red', description: '', preview: 'bg' },
		{ name: '--color-orange', description: '', preview: 'bg' },
		{ name: '--color-yellow', description: '', preview: 'bg' },
		{ name: '--color-green', description: '', preview: 'bg' },
		{ name: '--color-cyan', description: '', preview: 'bg' },
		{ name: '--color-blue', description: '', preview: 'bg' },
		{ name: '--color-purple', description: '', preview: 'bg' },
		{ name: '--color-pink', description: '', preview: 'bg' },
	];
</script>

<style>
	.grid {
		display: grid;
		grid-template-columns: 220px 1fr 140px;
		gap: 8px;
		align-items: center;
	}
	.swatch {
		height: 36px;
		background: transparent;
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
</style>

<div style="display:grid;gap:12px;padding:16px;background:var(--background-primary);color:inherit;">
	<div style="font-weight:700;font-size:16px;">Theme Variable Preview</div>

	<div class="grid">
		{#each items as item}
			<div class="mono">{item.name}</div>
			<div>{item.description}</div>

			{#if item.preview === 'bg'}
				<div class="swatch" style="background: var({item.name});"></div>
			{:else if item.preview === 'border'}
				<!-- Border vars are painted as borders (not fills), so you can compare normal/hover/focus ring colors directly. -->
				<div class="swatch" style="background: transparent; border: 3px solid var({item.name});"></div>
			{:else if item.preview === 'text'}
				<div class="swatch" style="display:flex;align-items:center;justify-content:center;background:var(--background-primary);color:var({item.name})">
					Aa
				</div>
			{:else if item.preview === 'rgba'}
				<div class="swatch" style="background: rgba(var({item.name}), 0.25);"></div>
			{:else if item.preview === 'hsl'}
				<div class="swatch" style="background: hsl(var({item.name}));"></div>
			{:else if item.preview === 'selection'}
				<div class="swatch" style="background: var({item.name});"></div>
			{/if}
		{/each}
	</div>
</div>
