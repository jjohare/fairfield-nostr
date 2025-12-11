/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
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
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				mono: ['Fira Code', 'monospace']
			},
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
	daisyui: {
		themes: [
			{
				light: {
					primary: '#0ea5e9',
					secondary: '#8b5cf6',
					accent: '#10b981',
					neutral: '#1e293b',
					'base-100': '#ffffff',
					'base-200': '#f8fafc',
					'base-300': '#e2e8f0',
					info: '#3abff8',
					success: '#22c55e',
					warning: '#f59e0b',
					error: '#ef4444'
				},
				dark: {
					primary: '#0ea5e9',
					secondary: '#8b5cf6',
					accent: '#10b981',
					neutral: '#64748b',
					'base-100': '#0f172a',
					'base-200': '#1e293b',
					'base-300': '#334155',
					info: '#3abff8',
					success: '#22c55e',
					warning: '#f59e0b',
					error: '#ef4444'
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
