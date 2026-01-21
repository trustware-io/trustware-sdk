import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
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
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
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
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
        keyframes: {
          "accordion-down": {
            from: {
              height: "0",
            },
            to: {
              height: "var(--radix-accordion-content-height)",
            },
          },
          "accordion-up": {
            from: {
              height: "var(--radix-accordion-content-height)",
            },
            to: {
              height: "0",
            },
          },
          "fade-in": {
            from: {
              opacity: "0",
              transform: "translateY(10px)",
            },
            to: {
              opacity: "1",
              transform: "translateY(0)",
            },
          },
          "slide-up": {
            from: {
              opacity: "0",
              transform: "translateY(20px)",
            },
            to: {
              opacity: "1",
              transform: "translateY(0)",
            },
          },
          "spin-slow": {
            from: {
              transform: "rotate(0deg)",
            },
            to: {
              transform: "rotate(360deg)",
            },
          },
          "scale-in": {
            from: {
              opacity: "0",
              transform: "scale(0.9)",
            },
            to: {
              opacity: "1",
              transform: "scale(1)",
            },
          },
          "swipe-complete": {
            from: {
              backgroundColor: "hsl(var(--muted))",
            },
            to: {
              backgroundColor: "hsl(142 76% 36%)",
            },
          },
          "token-hint-bounce": {
            "0%, 100%": {
              transform: "translateY(0)",
            },
            "25%": {
              transform: "translateY(-8px)",
            },
            "50%": {
              transform: "translateY(5px)",
            },
            "75%": {
              transform: "translateY(-3px)",
            },
          },
          "token-hint-bounce-x": {
            "0%, 100%": {
              transform: "translateX(0) scale(1)",
            },
            "20%": {
              transform: "translateX(-10px) scale(1)",
            },
            "40%": {
              transform: "translateX(8px) scale(1)",
            },
            "60%": {
              transform: "translateX(-5px) scale(1)",
            },
            "80%": {
              transform: "translateX(3px) scale(1)",
            },
          },
        },
        animation: {
          "accordion-down": "accordion-down 0.2s ease-out",
          "accordion-up": "accordion-up 0.2s ease-out",
          "fade-in": "fade-in 0.3s ease-out",
          "slide-up": "slide-up 0.4s ease-out",
          "spin-slow": "spin-slow 2s linear infinite",
          "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "swipe-complete": "swipe-complete 0.3s ease-out forwards",
          "token-hint-bounce": "token-hint-bounce 0.7s ease-out",
          "token-hint-bounce-x": "token-hint-bounce-x 0.8s ease-out",
        },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        large: "var(--shadow-large)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
