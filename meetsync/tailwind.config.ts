import type {Config} from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#f8f9fb',
        surface: '#ffffff',
        'surface-soft': '#f0f4f7',
        'surface-strong': '#e5e9f1',
        ink: '#222935',
        'ink-soft': '#5c6678',
        line: '#d6dceb',
        primary: '#674ead',
        'primary-soft': '#b096fb',
        secondary: '#2e6486',
        'secondary-soft': '#c9e6ff',
        tertiary: '#406845',
        'tertiary-soft': '#ccfacc',
        danger: '#dc2626',
        success: '#2f855a',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        headline: ['var(--font-headline)'],
      },
      boxShadow: {
        panel: '0 24px 48px -28px rgba(103, 78, 173, 0.28)',
        soft: '0 12px 32px rgba(25, 35, 60, 0.08)',
      },
      backgroundImage: {
        'hero-wash':
          'radial-gradient(circle at top right, rgba(176, 150, 251, 0.35), transparent 38%), radial-gradient(circle at 10% 0%, rgba(201, 230, 255, 0.45), transparent 32%)',
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem',
      },
    },
  },
  plugins: [],
};

export default config;

