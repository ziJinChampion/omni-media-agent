/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* ---- design tokens: deep-space mission control ---- */
        void: '#080A10',
        panel: '#0E121C',
        glass: 'rgba(255,255,255,0.04)',
        elevated: '#161B29',
        'border-subtle': 'rgba(255,255,255,0.07)',
        'text-primary': '#E8ECF4',
        'text-secondary': '#8B94A7',
        'text-muted': '#565F73',
        'accent-violet': '#7C5CFF',
        'accent-cyan': '#22D3EE',
        'accent-violet-glow': 'rgba(124,92,255,0.35)',
        /* status semantic colors (job state machine) */
        'status-pending': '#8B94A7',
        'status-researching': '#38BDF8',
        'status-drafting': '#7C5CFF',
        'status-reviewing': '#C084FC',
        'status-awaiting': '#F59E0B',
        'status-publishing': '#22D3EE',
        'status-published': '#34D399',
        'status-failed': '#F87171',
        'status-alert': '#FB7185',
        /* platform colors */
        'xhs': '#FF2442',
        'douyin-cyan': '#00F2EA',
        'douyin-red': '#FE2C55',
        /* ---- shadcn css-var palette ---- */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "'Noto Sans SC'", 'sans-serif'],
        grotesk: ["'Space Grotesk'", "'Noto Sans SC'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xs: "calc(var(--radius) - 6px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        'glow-violet': '0 0 20px rgba(124,92,255,0.35)',
        'glow-amber': '0 0 24px rgba(245,158,11,0.15)',
        'glow-red': '0 0 24px rgba(248,113,113,0.18)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
        "dot-pulse": {
          "0%,100%": { transform: "scale(1)", opacity: "1" },
          "50%": { transform: "scale(1.45)", opacity: "0.55" },
        },
        "amber-breathe": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(245,158,11,0.35)" },
          "50%": { boxShadow: "0 0 0 5px rgba(245,158,11,0)" },
        },
        "badge-shake": {
          "0%,100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-2px)" },
          "40%": { transform: "translateX(2px)" },
          "60%": { transform: "translateX(-1px)" },
          "80%": { transform: "translateX(1px)" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        "flow-x": {
          "0%": { backgroundPosition: "0% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
        "dot-pulse": "dot-pulse 2s ease-in-out infinite",
        "amber-breathe": "amber-breathe 1.6s ease-in-out infinite",
        "badge-shake": "badge-shake 0.4s ease-in-out",
        "spin-slow": "spin-slow 1.1s linear infinite",
        "flow-x": "flow-x 3s linear infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
