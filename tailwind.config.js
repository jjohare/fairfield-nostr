/**
 * DESIGN SYSTEM - Tailwind Configuration
 *
 * This configuration defines the core design tokens for the application.
 * All custom styles are organized in /src/app.css with clear categorization.
 *
 * @see /src/app.css for component-level design patterns
 * @type {import('tailwindcss').Config}
 */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			/**
			 * COLOR SYSTEM
			 * Extended primary color scale for granular control
			 */
			colors: {
				primary: {
					50: '#f0f9ff',
					100: '#e0f2fe',
					200: '#bae6fd',
					300: '#7dd3fc',
					400: '#38bdf8',
					500: '#0ea5e9',
					600: '#0284c7',
					700: '#0369a1',
					800: '#075985',
					900: '#0c4a6e'
				}
			},
			/**
			 * TYPOGRAPHY
			 * Custom font families with system fallbacks
			 */
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['Fira Code', 'monospace']
			},
			/**
			 * ANIMATIONS
			 * Custom keyframe animations for transitions
			 * Usage: class="animate-fade-in" or class="animate-slide-up"
			 */
			animation: {
				'fade-in': 'fadeIn 0.2s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' }
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				}
			}
		}
	},
	plugins: [require('daisyui')],
	/**
	 * DAISYUI THEME CONFIGURATION
	 *
	 * Button Variants:
	 * - btn-primary: Main actions (save, submit, confirm)
	 * - btn-secondary: Alternative actions
	 * - btn-ghost: Subtle actions (close, cancel)
	 * - btn-error: Destructive actions (delete, remove)
	 * - btn-warning: Warning actions (reveal private key)
	 * - btn-success: Positive actions (approve, accept)
	 * - btn-info: Informational actions
	 *
	 * Button Sizes:
	 * - btn-xs: 1.75rem min-height (compact, inline actions)
	 * - btn-sm: 2rem min-height (default for most UI)
	 * - btn (default): 2.75rem min-height (accessible touch target)
	 * - btn-lg: 3.5rem min-height (prominent CTAs)
	 *
	 * Modal Patterns:
	 * - Always include closeOnEscape and closeOnBackdrop options
	 * - Use X button in top-right for close
	 * - Support keyboard navigation (Tab, Escape)
	 * - Restore focus to trigger element on close
	 */
	daisyui: {
		themes: [
			{
				light: {
					primary: '#0284c7',
					'primary-content': '#ffffff',
					secondary: '#7c3aed',
					accent: '#059669',
					neutral: '#1e293b',
					'neutral-content': '#ffffff',
					'base-100': '#ffffff',
					'base-200': '#f8fafc',
					'base-300': '#e2e8f0',
					'base-content': '#1e293b',
					info: '#0891b2',
					success: '#16a34a',
					warning: '#d97706',
					error: '#dc2626'
				},
				dark: {
					primary: '#38bdf8',
					'primary-content': '#0f172a',
					secondary: '#a78bfa',
					accent: '#34d399',
					neutral: '#64748b',
					'neutral-content': '#f1f5f9',
					'base-100': '#0f172a',
					'base-200': '#1e293b',
					'base-300': '#334155',
					'base-content': '#f1f5f9',
					info: '#22d3ee',
					success: '#4ade80',
					warning: '#fbbf24',
					error: '#f87171'
				}
			}
		],
		darkTheme: 'dark',
		base: true,
		styled: true,
		utils: true,
		logs: false
	}
};
