// tailwind.config.js
// Design tokens du Journal vocal.
// Tailwind v3 — adapter en CSS @theme si le projet est en v4.

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/views/**/*.{erb,html,html.erb}',
    './app/helpers/**/*.rb',
    './app/javascript/**/*.{js,ts}',
    './app/components/**/*.{rb,erb,html,html.erb}',
  ],
  theme: {
    extend: {
      colors: {
        paper:   { DEFAULT: '#FAF7F2', soft: '#F3EFE7' },
        ink: {
          DEFAULT: '#1F1B16',  // body
          soft:    '#4A453E',  // secondary text
          mute:    '#7D7770',  // tertiary / metadata
          faint:   '#A8A29A',  // disabled / hints
        },
        accent: {
          DEFAULT: '#C97B5E',  // terracotta
          soft:    'rgba(201, 123, 94, 0.12)',
          ring:    'rgba(201, 123, 94, 0.28)',
        },
        rule: {
          DEFAULT: 'rgba(31, 27, 22, 0.08)',
          strong:  'rgba(31, 27, 22, 0.14)',
        },
      },

      fontFamily: {
        // Serif chaleureuse — défaut pour body + titres
        serif: ['Newsreader', 'Source Serif 4', 'Georgia', 'ui-serif', 'serif'],
        // Sans humaniste — réservée à l'UI chrome (boutons, metadata, nav)
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Mono — uniquement zone d'export markdown
        mono:  ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },

      fontSize: {
        // Échelle resserrée — pas besoin de 20 paliers
        'xs':   ['11.5px', { lineHeight: '1.45' }],
        'sm':   ['13.5px', { lineHeight: '1.5'  }],
        'base': ['16px',   { lineHeight: '1.65' }],
        'lg':   ['18px',   { lineHeight: '1.7'  }],   // corps de l'éditeur
        'xl':   ['22px',   { lineHeight: '1.4'  }],
        '2xl':  ['28px',   { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '3xl':  ['34px',   { lineHeight: '1.15', letterSpacing: '-0.015em' }], // date du jour
      },

      letterSpacing: {
        tightish: '-0.005em',
        tight2:   '-0.015em',
      },

      maxWidth: {
        // 720px centré : largeur de lecture sur desktop
        content: '720px',
        reading: '640px',
      },

      spacing: {
        // Espacements custom pour le rythme du carnet
        '18': '4.5rem',
      },

      borderRadius: {
        pill: '999px',
      },

      boxShadow: {
        // Ombre douce du bouton micro — chaude, jamais bleue
        mic:        '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 28px rgba(31,27,22,0.08), 0 2px 6px rgba(31,27,22,0.06)',
        'mic-hover':'0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 36px rgba(31,27,22,0.12), 0 3px 8px rgba(31,27,22,0.08)',
        popover:    '0 12px 40px rgba(31,27,22,0.10)',
      },

      keyframes: {
        'mic-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: '0.7' },
          '100%': { transform: 'scale(1.6)', opacity: '0'   },
        },
        'blip': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%':      { opacity: '1',   transform: 'scale(1.1)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)'   },
        },
      },
      animation: {
        'mic-pulse':   'mic-pulse 2.4s ease-out infinite',
        'blip':        'blip 1.1s ease-in-out infinite',
        'fade-in-up':  'fade-in-up 0.35s ease',
      },
    },
  },
  plugins: [],
};
