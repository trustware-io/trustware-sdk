/** @type {import('tailwindcss').Config} */
export default {
  prefix: "tw-",
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--tw-border))",
        input: "hsl(var(--tw-input))",
        ring: "hsl(var(--tw-ring))",
        background: "hsl(var(--tw-background))",
        foreground: "hsl(var(--tw-foreground))",
        primary: {
          DEFAULT: "hsl(var(--tw-primary))",
          foreground: "hsl(var(--tw-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--tw-secondary))",
          foreground: "hsl(var(--tw-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--tw-destructive))",
          foreground: "hsl(var(--tw-destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--tw-muted))",
          foreground: "hsl(var(--tw-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--tw-accent))",
          foreground: "hsl(var(--tw-accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--tw-card))",
          foreground: "hsl(var(--tw-card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--tw-radius)",
        md: "calc(var(--tw-radius) - 2px)",
        sm: "calc(var(--tw-radius) - 4px)",
      },
      keyframes: {
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(1rem)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-1rem)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.9)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "swipe-complete": {
          from: { backgroundColor: "hsl(var(--tw-muted))" },
          to: { backgroundColor: "hsl(142 76% 36%)" },
        },
        "token-hint-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "25%": { transform: "translateY(-8px)" },
          "50%": { transform: "translateY(5px)" },
          "75%": { transform: "translateY(-3px)" },
        },
        "token-hint-bounce-x": {
          "0%, 100%": { transform: "translateX(0) scale(1)" },
          "20%": { transform: "translateX(-10px) scale(1)" },
          "40%": { transform: "translateX(8px) scale(1)" },
          "60%": { transform: "translateX(-5px) scale(1)" },
          "80%": { transform: "translateX(3px) scale(1)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 150ms ease-out",
        "slide-in-left": "slide-in-left 150ms ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "swipe-complete": "swipe-complete 0.3s ease-out forwards",
        "token-hint-bounce": "token-hint-bounce 0.7s ease-out",
        "token-hint-bounce-x": "token-hint-bounce-x 0.8s ease-out",
        "spin-slow": "spin-slow 2s linear infinite",
      },
      boxShadow: {
        soft: "var(--tw-shadow-soft)",
        medium: "var(--tw-shadow-medium)",
        large: "var(--tw-shadow-large)",
      },
    },
  },
  plugins: [],
};
