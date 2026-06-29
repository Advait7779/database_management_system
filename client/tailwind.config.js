/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary palette - Deep navy + vibrant indigo
        navy: {
          900: '#060B18',
          800: '#0D1526',
          700: '#111C33',
          600: '#162040',
          500: '#1B2751',
        },
        // Accent colors
        indigo: {
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
        },
        violet: {
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        cyan: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
        emerald: {
          400: '#34D399',
          500: '#10B981',
        },
        amber: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
        rose: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        // Glass surfaces
        glass: {
          white: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.10)',
          hover: 'rgba(255,255,255,0.08)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-gradient': 'radial-gradient(at 40% 20%, hsla(240,100%,70%,0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.2) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(260,100%,70%,0.2) 0px, transparent 50%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'indigo-gradient': 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
        'cyan-gradient': 'linear-gradient(135deg, #06B6D4 0%, #6366F1 100%)',
        'emerald-gradient': 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
        'amber-gradient': 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
        'rose-gradient': 'linear-gradient(135deg, #F43F5E 0%, #8B5CF6 100%)',
        'violet-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
      },
      boxShadow: {
        'glass': '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glass-lg': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glow-indigo': '0 0 20px rgba(99,102,241,0.4)',
        'glow-violet': '0 0 20px rgba(139,92,246,0.4)',
        'glow-cyan': '0 0 20px rgba(6,182,212,0.4)',
        'glow-emerald': '0 0 20px rgba(16,185,129,0.4)',
        'card': '0 2px 8px rgba(0,0,0,0.3)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-slow': 'bounce 3s ease-in-out infinite',
        'counter': 'counter 1s ease-out forwards',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(99,102,241,0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(99,102,241,0.6)' },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
