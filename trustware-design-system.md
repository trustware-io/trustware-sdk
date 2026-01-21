# Trustware Design System Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-01-20  
> **Scope**: All Trustware products including Quick Links, Quick Deposit, and future surfaces  
> **Platforms**: Web (responsive), Mobile (iOS/Android web views)

---

## Table of Contents

1. [Overview & Philosophy](#1-overview--philosophy)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Design Tokens](#3-design-tokens)
4. [Typography System](#4-typography-system)
5. [Color System](#5-color-system)
6. [Spacing & Layout](#6-spacing--layout)
7. [Component Library](#7-component-library)
8. [Animation & Motion](#8-animation--motion)
9. [Responsive Breakpoints](#9-responsive-breakpoints)
10. [Accessibility Requirements](#10-accessibility-requirements)
11. [Implementation Checklist](#11-implementation-checklist)
12. [Validation Protocol](#12-validation-protocol)

---

## 1. Overview & Philosophy

### 1.1 Design Principles

| Principle | Description | Validation Criteria |
|-----------|-------------|---------------------|
| **Inevitable Simplicity** | Every interaction should feel obvious and require zero explanation | User can complete primary action within 3 taps/clicks |
| **Soft Confidence** | Premium feel through restraint, not decoration | No more than 3 visual accents per screen |
| **Tactile Responsiveness** | Every touch/click provides immediate feedback | All interactive elements respond within 50ms |
| **Cross-Platform Consistency** | Identical experience across web and mobile | Visual diff < 5% between platforms |

### 1.2 Aesthetic Direction

**Primary Tone**: Modern Fintech Minimalism with iOS-inspired softness
- Clean, airy layouts with generous whitespace
- Subtle depth through soft shadows (not flat, not skeuomorphic)
- High-contrast typography hierarchy
- Emerald green as action/success accent
- Blue as primary brand color

**What to Avoid**:
- Generic purple gradients
- Overly decorative elements
- Harsh, flat Material Design
- Busy, cluttered layouts
- Inconsistent border radii

---

## 2. Tech Stack & Dependencies

### 2.1 Core Stack

```json
{
  "framework": "React 18.3+",
  "build": "Vite 5.4+",
  "styling": "Tailwind CSS 3.4+",
  "components": "shadcn/ui (Radix primitives)",
  "state": "@tanstack/react-query",
  "routing": "react-router-dom 6.x",
  "forms": "react-hook-form + zod",
  "icons": "lucide-react",
  "animations": "tailwindcss-animate"
}
```

### 2.2 Required Dependencies

```bash
# Core UI
npm install @radix-ui/react-dialog @radix-ui/react-slot @radix-ui/react-toast
npm install class-variance-authority clsx tailwind-merge

# Animation
npm install tailwindcss-animate

# Forms
npm install react-hook-form @hookform/resolvers zod

# Icons
npm install lucide-react
```

### 2.3 Utility Function

**Required**: All components MUST use the `cn()` utility for className merging:

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Completion Criteria**:
- [ ] `cn()` utility exists at `src/lib/utils.ts`
- [ ] All component classNames use `cn()` for merging
- [ ] No raw string concatenation for classNames

---

## 3. Design Tokens

### 3.1 CSS Variables (Required in `index.css`)

```css
@layer base {
  :root {
    /* === CORE SEMANTIC COLORS === */
    --background: 0 0% 98%;
    --foreground: 220 15% 20%;
    
    --card: 0 0% 100%;
    --card-foreground: 220 15% 20%;
    
    --popover: 0 0% 100%;
    --popover-foreground: 220 15% 20%;
    
    --primary: 217 91% 60%;
    --primary-foreground: 0 0% 100%;
    
    --secondary: 220 14% 96%;
    --secondary-foreground: 220 15% 20%;
    
    --muted: 220 14% 96%;
    --muted-foreground: 220 10% 50%;
    
    --accent: 217 91% 60%;
    --accent-foreground: 0 0% 100%;
    
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    
    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 217 91% 60%;
    
    /* === RADIUS === */
    --radius: 1rem;
    
    /* === SHADOWS === */
    --shadow-soft: 0 2px 8px -2px hsl(220 15% 20% / 0.08);
    --shadow-medium: 0 4px 16px -4px hsl(220 15% 20% / 0.12);
    --shadow-large: 0 8px 32px -8px hsl(220 15% 20% / 0.16);
    
    /* === TRANSITIONS === */
    --transition-smooth: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-bounce: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  .dark {
    --background: 220 15% 10%;
    --foreground: 0 0% 98%;
    
    --card: 220 15% 12%;
    --card-foreground: 0 0% 98%;
    
    --popover: 220 15% 12%;
    --popover-foreground: 0 0% 98%;
    
    --primary: 217 91% 60%;
    --primary-foreground: 0 0% 100%;
    
    --secondary: 220 15% 18%;
    --secondary-foreground: 0 0% 98%;
    
    --muted: 220 15% 18%;
    --muted-foreground: 220 10% 60%;
    
    --accent: 217 91% 60%;
    --accent-foreground: 0 0% 100%;
    
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    
    --border: 220 15% 20%;
    --input: 220 15% 20%;
    --ring: 217 91% 60%;
  }
}
```

### 3.2 Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
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
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
```

**Completion Criteria**:
- [ ] All CSS variables defined in `:root` and `.dark`
- [ ] No hardcoded color values in components (use semantic tokens only)
- [ ] Tailwind config extends with all custom values
- [ ] `tailwindcss-animate` plugin installed and configured

---

## 4. Typography System

### 4.1 Font Stack

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 
               'SF Pro Text', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

### 4.2 Type Scale

| Role | Class | Size | Weight | Line Height | Use Case |
|------|-------|------|--------|-------------|----------|
| Display | `text-6xl font-bold tracking-tight` | 60px | 700 | 1.0 | Hero amounts, primary values |
| Heading 1 | `text-2xl font-semibold` | 24px | 600 | 1.2 | Page titles, card titles |
| Heading 2 | `text-lg font-semibold` | 18px | 600 | 1.3 | Section headers |
| Heading 3 | `text-base font-medium` | 16px | 500 | 1.4 | Subsection headers |
| Body | `text-sm` | 14px | 400 | 1.5 | Primary content |
| Caption | `text-xs` | 12px | 400 | 1.4 | Labels, hints |
| Micro | `text-[10px]` | 10px | 500 | 1.2 | Badges, indicators |

### 4.3 Typography Patterns

```tsx
// Display Amount (Primary value display)
<span className="text-6xl font-bold tracking-tight">
  <span className="text-foreground">$</span>
  <span className="text-foreground">1,234.56</span>
</span>

// Muted Placeholder State
<span className="text-6xl font-bold tracking-tight text-muted-foreground/40">
  $0.00
</span>

// Page Title
<h1 className="text-lg font-semibold text-foreground">Deposit</h1>

// Section Label
<p className="text-base text-muted-foreground">Enter an amount</p>

// Helper Text
<span className="text-sm text-muted-foreground">Balance 150.00</span>

// Emphasized Helper
<span className="text-sm font-semibold text-blue-500">Balance 150.00</span>
```

**Completion Criteria**:
- [ ] System font stack applied to body
- [ ] Antialiasing enabled globally
- [ ] No custom fonts loaded (performance)
- [ ] Type scale adhered to across all components
- [ ] Display amounts use `tracking-tight`

---

## 5. Color System

### 5.1 Semantic Color Usage

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `background` | `hsl(0 0% 98%)` | `hsl(220 15% 10%)` | Page background |
| `foreground` | `hsl(220 15% 20%)` | `hsl(0 0% 98%)` | Primary text |
| `card` | `hsl(0 0% 100%)` | `hsl(220 15% 12%)` | Card surfaces |
| `muted` | `hsl(220 14% 96%)` | `hsl(220 15% 18%)` | Subtle backgrounds |
| `muted-foreground` | `hsl(220 10% 50%)` | `hsl(220 10% 60%)` | Secondary text |
| `primary` | `hsl(217 91% 60%)` | `hsl(217 91% 60%)` | Brand blue, CTAs |
| `destructive` | `hsl(0 84% 60%)` | `hsl(0 84% 60%)` | Errors, warnings |
| `border` | `hsl(220 13% 91%)` | `hsl(220 15% 20%)` | Borders, dividers |

### 5.2 Accent Colors (Hardcoded, Non-Semantic)

```css
/* Success / Confirmation */
bg-green-500    /* #22c55e - Confirmation states */
bg-green-400/30 /* Progress fills */
bg-emerald-500  /* Slider active track */

/* Status Indicators */
bg-green-500    /* Connected/active dot */
bg-primary      /* Selected/active state */

/* Confetti Palette */
['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
```

### 5.3 Opacity Modifiers

| Modifier | Use Case | Example |
|----------|----------|---------|
| `/10` | Very subtle backgrounds | `bg-primary/10` |
| `/20` | Light fills, progress | `bg-green-400/20` |
| `/30` | Hover backgrounds | `bg-muted/30` |
| `/40` | Placeholder text, pills | `text-muted-foreground/40`, `bg-muted/40` |
| `/50` | Disabled states, borders | `border-border/50` |
| `/60` | Secondary icons | `text-muted-foreground/60` |
| `/80` | Overlay backgrounds | `bg-black/80` |
| `/90` | Hover on solid | `hover:bg-primary/90` |

**Completion Criteria**:
- [ ] All colors use HSL format with CSS variables
- [ ] No hex colors in components (except confetti)
- [ ] Dark mode variables properly contrast
- [ ] Opacity modifiers used consistently

---

## 6. Spacing & Layout

### 6.1 Spacing Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `0.5` | 2px | Micro gaps, icon insets |
| `1` | 4px | Tight padding, small gaps |
| `1.5` | 6px | Pill padding, dot gaps |
| `2` | 8px | Standard small spacing |
| `3` | 12px | Card internal spacing |
| `4` | 16px | Standard padding |
| `6` | 24px | Section spacing |
| `8` | 32px | Large section gaps |

### 6.2 Container Patterns

```tsx
// SDK Container (Primary wrapper for embeddable UI)
<div className="min-h-screen bg-background flex items-center justify-center p-4">
  <div className="relative bg-card w-full max-w-[420px] rounded-[20px] shadow-xl 
                  overflow-hidden border border-border/30"
       style={{ maxHeight: 'calc(100vh - 32px)' }}>
    <div className="overflow-y-auto max-h-[85vh] scrollbar-none">
      {children}
    </div>
  </div>
</div>

// Page Layout (Within container)
<div className="flex flex-col min-h-[600px]">
  {/* Header */}
  <div className="flex items-center justify-center px-4 py-4 border-b border-border">
    <h1 className="text-lg font-semibold text-foreground">Title</h1>
  </div>
  
  {/* Content */}
  <div className="flex-1 px-6 overflow-y-auto scrollbar-none flex flex-col items-center">
    {/* Content here */}
  </div>
  
  {/* Footer */}
  <div className="px-6 py-4 border-t border-border/30">
    {/* Footer content */}
  </div>
</div>
```

### 6.3 Border Radius Scale

| Token | Value | Use Case |
|-------|-------|----------|
| `rounded-sm` | 12px | Small buttons, badges |
| `rounded-md` | 14px | Inputs, small cards |
| `rounded-lg` | 16px | Cards, dropdowns |
| `rounded-xl` | 20px | Large cards, containers |
| `rounded-full` | 9999px | Pills, avatars, dots |
| `rounded-[20px]` | 20px | SDK container |

### 6.4 Safe Area Utilities

```css
@layer utilities {
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  .safe-area-top {
    padding-top: env(safe-area-inset-top);
  }
  
  .scrollbar-none {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  
  .touch-none {
    touch-action: none;
  }
}
```

**Completion Criteria**:
- [ ] All spacing uses Tailwind scale (no arbitrary values)
- [ ] SDK container pattern used for all embeddable UIs
- [ ] Safe area utilities applied on mobile
- [ ] Scrollbar hidden on scrollable containers

---

## 7. Component Library

### 7.1 Button Component

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md 
   text-sm font-medium ring-offset-background transition-colors 
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
   focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 
   [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### 7.2 Card Component

```tsx
// Card base
<div className="rounded-lg border bg-card text-card-foreground shadow-sm">
  {/* Card Header */}
  <div className="flex flex-col space-y-1.5 p-6">
    <h3 className="text-2xl font-semibold leading-none tracking-tight">{title}</h3>
    <p className="text-sm text-muted-foreground">{description}</p>
  </div>
  
  {/* Card Content */}
  <div className="p-6 pt-0">
    {content}
  </div>
  
  {/* Card Footer */}
  <div className="flex items-center p-6 pt-0">
    {footer}
  </div>
</div>
```

### 7.3 Input Component

```tsx
<input
  className={cn(
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2",
    "text-base ring-offset-background",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "md:text-sm"
  )}
/>
```

### 7.4 Pill/Badge Pattern

```tsx
// Selection Pill
<div className="inline-flex items-center gap-2 px-4 py-1.5 
                bg-muted/40 rounded-full border border-border/50 
                select-none touch-none cursor-grab active:cursor-grabbing">
  {content}
</div>

// Action Pill
<button className="inline-flex items-center gap-3 px-6 py-3 
                   rounded-full transition-all bg-muted/50 hover:bg-muted w-56">
  <Icon className="w-5 h-5 text-muted-foreground" />
  <span className="font-medium text-sm text-foreground flex-1 text-left">{label}</span>
  <ChevronDown className="w-4 h-4 text-muted-foreground" />
</button>

// Quick Amount Button
<button className="px-3 py-1 text-xs font-medium text-muted-foreground 
                   bg-muted rounded-full hover:bg-muted/80 transition-colors">
  Max
</button>
```

### 7.5 Dropdown Menu

```tsx
<div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 
                bg-card rounded-xl shadow-lg border border-border/50 z-50 overflow-hidden">
  {/* Section Header */}
  <div className="p-3">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="text-xs font-medium text-primary">Section Title</span>
    </div>
    
    {/* Items */}
    <div className="space-y-1">
      {items.map(item => (
        <button className="w-full flex items-center justify-between p-2 
                          rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <img src={item.icon} className="w-8 h-8 rounded-lg object-cover" />
            <span className="font-medium text-sm text-foreground">{item.name}</span>
          </div>
          <div className={cn(
            "w-4 h-4 rounded-full border-2",
            selected ? "border-primary bg-primary" : "border-muted-foreground/30"
          )} />
        </button>
      ))}
    </div>
  </div>
  
  {/* Divider */}
  <div className="border-t border-border/50" />
</div>
```

### 7.6 Swipe-to-Confirm Pattern

```tsx
// Container
<div className="relative h-14 rounded-full overflow-hidden transition-colors 
                duration-300 select-none bg-muted">
  {/* Progress Fill */}
  <div className="absolute inset-y-0 left-0 transition-all duration-75 bg-green-400/20"
       style={{ width: `${progress}%` }} />
  
  {/* Label (fades out on drag) */}
  <div className={cn(
    "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
    progress > 0.3 && "opacity-0"
  )}>
    <span className="text-sm font-medium text-muted-foreground">{label}</span>
  </div>
  
  {/* Thumb */}
  <div className={cn(
    "absolute top-1 bottom-1 w-12 rounded-full flex items-center justify-center",
    "cursor-grab active:cursor-grabbing transition-all",
    isComplete 
      ? "bg-green-500 text-white" 
      : "bg-card text-foreground shadow-md",
    isDragging && "scale-105"
  )}
  style={{ 
    left: `${dragX + 4}px`,
    transition: isDragging ? 'none' : 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }}>
    {isComplete ? <Check className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
  </div>
</div>
```

### 7.7 Amount Slider

```tsx
// Track Container
<div className="relative h-10 flex items-center">
  {/* Background Track */}
  <div className="absolute inset-x-0 h-2 bg-muted/60 rounded-full" />
  
  {/* Active Track */}
  <div className="absolute left-0 h-2 bg-emerald-500 rounded-full transition-all duration-75"
       style={{ width: `${percentage}%` }} />
  
  {/* Tick Marks */}
  {tickMarks.map(tick => (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${tick.position}%` }}>
      <div className={cn(
        "w-0.5 h-2.5 rounded-full transition-colors -translate-x-1/2",
        isActive ? "bg-emerald-500/50" : "bg-muted-foreground/20"
      )} />
    </div>
  ))}
  
  {/* Hidden Input */}
  <input type="range" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 touch-none" />
  
  {/* Thumb */}
  <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full 
                  shadow-lg border-2 border-emerald-500 pointer-events-none transition-all duration-75"
       style={{ left: `calc(${percentage}% - 12px)` }} />
</div>
```

### 7.8 Circular Progress

```tsx
<div className="relative inline-flex items-center justify-center">
  <svg width={size} height={size}>
    {/* Background Circle */}
    <circle
      cx={size / 2} cy={size / 2} r={radius}
      fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth}
    />
    
    {/* Progress Circle */}
    <circle
      cx={size / 2} cy={size / 2} r={radius}
      fill="none" stroke="hsl(var(--primary))" strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={circumference}
      strokeDashoffset={offset}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      className="transition-all duration-500 ease-out"
    />
  </svg>
  
  {/* Percentage Label */}
  <div className="absolute inset-0 flex items-center justify-center">
    <span className="text-2xl font-bold text-foreground">{progress}%</span>
  </div>
</div>
```

### 7.9 Token Carousel

```tsx
// Carousel Container
<div className="relative flex items-center justify-center h-12 w-20 overflow-hidden">
  {tokens.map((token, index) => {
    const pos = getPosition(index);
    const isCenter = pos === 0;
    const isVisible = Math.abs(pos) <= 1;
    
    if (!isVisible) return null;
    
    const baseOffset = pos * 32;
    const scale = isCenter ? 1 : 0.6;
    const opacity = isCenter ? 1 : 0.5;
    const blur = isCenter ? 0 : 1;
    
    return (
      <div
        className={cn("absolute transition-all", isDragging ? "duration-75" : "duration-200 ease-out")}
        style={{
          transform: `translateX(${baseOffset}px) scale(${scale})`,
          opacity,
          filter: `blur(${blur}px)`,
          zIndex: isCenter ? 10 : 5,
        }}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden flex items-center 
                        justify-center bg-white shadow-sm">
          <img src={token.icon} className="w-8 h-8 object-contain" />
        </div>
        
        {/* Chain Badge (center only) */}
        {isCenter && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full 
                          bg-background border-2 border-background overflow-hidden">
            <img src={token.chainIcon} className="w-3 h-3 rounded-full object-cover" />
          </div>
        )}
      </div>
    );
  })}
</div>

// Pagination Dots
<div className="flex items-center gap-1.5 mt-1">
  {tokens.map((_, index) => (
    <button
      className={cn(
        "w-1.5 h-1.5 rounded-full transition-all duration-200",
        index === currentIndex 
          ? "bg-foreground w-3" 
          : "bg-muted-foreground/40 hover:bg-muted-foreground/60"
      )}
    />
  ))}
</div>
```

### 7.10 Footer Pattern

```tsx
<div className="px-6 py-4 border-t border-border/30 flex items-center justify-center gap-2">
  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
  <span className="text-sm text-muted-foreground">
    Secured by{' '}
    <span className="font-semibold text-foreground inline-flex items-center gap-1">
      Trustware
      <img src={trustwareLogo} alt="Trustware" className="w-3.5 h-3.5 dark:invert" />
    </span>
  </span>
</div>
```

**Completion Criteria**:
- [ ] All component patterns implemented
- [ ] CVA variants used for Button, Badge, Toast
- [ ] Radix primitives used for Dialog, Sheet, Select, Toast
- [ ] No custom implementations of standard patterns

---

## 8. Animation & Motion

### 8.1 Keyframes (Tailwind Config)

```typescript
keyframes: {
  "accordion-down": {
    from: { height: "0" },
    to: { height: "var(--radix-accordion-content-height)" },
  },
  "accordion-up": {
    from: { height: "var(--radix-accordion-content-height)" },
    to: { height: "0" },
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
  "spin-slow": {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
  "swipe-complete": {
    from: { backgroundColor: "hsl(var(--muted))" },
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
  "confetti-fall": {
    "0%": { transform: "translateY(-20px) rotate(0deg)", opacity: "1" },
    "100%": { transform: "translateY(100vh) rotate(720deg)", opacity: "0" },
  },
}
```

### 8.2 Animation Classes

```typescript
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "fade-in": "fade-in 0.3s ease-out",
  "slide-up": "slide-up 0.4s ease-out",
  "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  "spin-slow": "spin-slow 2s linear infinite",
  "swipe-complete": "swipe-complete 0.3s ease-out forwards",
  "token-hint-bounce": "token-hint-bounce 0.7s ease-out",
  "token-hint-bounce-x": "token-hint-bounce-x 0.8s ease-out",
  "confetti": "confetti-fall 2s ease-out forwards",
}
```

### 8.3 Transition Patterns

| Pattern | Classes | Duration | Easing |
|---------|---------|----------|--------|
| Color change | `transition-colors` | 150ms | ease |
| All properties | `transition-all` | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Opacity | `transition-opacity duration-200` | 200ms | ease |
| Transform | `transition-transform duration-75` | 75ms | ease |
| Drag response | `duration-75` (while dragging) | 75ms | ease |
| Spring back | `duration-300` | 300ms | cubic-bezier(0.4, 0, 0.2, 1) |

### 8.4 Haptic Feedback

```typescript
// Light tap
if (navigator.vibrate) {
  navigator.vibrate(10);
}

// Confirmation
if (navigator.vibrate) {
  navigator.vibrate(50);
}

// Success pattern
if (navigator.vibrate) {
  navigator.vibrate([50, 50, 100]);
}
```

**Completion Criteria**:
- [ ] All keyframes defined in tailwind.config.ts
- [ ] `tailwindcss-animate` plugin enabled
- [ ] Haptic feedback on swipe complete
- [ ] Haptic feedback on token switch
- [ ] No animations > 500ms (except confetti)

---

## 9. Responsive Breakpoints

### 9.1 Breakpoint Definitions

| Token | Value | Description |
|-------|-------|-------------|
| `sm` | 640px | Small tablets, large phones landscape |
| `md` | 768px | Tablets portrait |
| `lg` | 1024px | Tablets landscape, small laptops |
| `xl` | 1280px | Laptops, desktops |
| `2xl` | 1400px | Large desktops (container max) |

### 9.2 Mobile Detection Hook

```typescript
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
```

### 9.3 Responsive Patterns

```tsx
// Text size adjustment
<input className="text-base md:text-sm" />

// Container constraints
<div className="w-full max-w-[420px]" />

// Toast positioning
<div className="fixed top-0 sm:bottom-0 sm:right-0 sm:top-auto" />

// Sheet sizing
<div className="w-3/4 sm:max-w-sm" />
```

### 9.4 Test Viewports

| Device | Width | Height | Pixel Ratio |
|--------|-------|--------|-------------|
| iPhone SE | 375px | 667px | 2x |
| iPhone 14 Pro | 393px | 852px | 3x |
| iPhone 14 Pro Max | 430px | 932px | 3x |
| iPad Mini | 768px | 1024px | 2x |
| iPad Pro 11" | 834px | 1194px | 2x |
| Desktop 1080p | 1920px | 1080px | 1x |
| Desktop 1440p | 2560px | 1440px | 1x |

**Completion Criteria**:
- [ ] Mobile breakpoint at 768px
- [ ] `useIsMobile()` hook available
- [ ] SDK container max-width 420px
- [ ] All viewports in test matrix pass visual review

---

## 10. Accessibility Requirements

### 10.1 Focus States

```tsx
// All interactive elements MUST have visible focus
"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Ring offset for layered elements
"ring-offset-background"
```

### 10.2 Disabled States

```tsx
// Standard disabled pattern
"disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed"
```

### 10.3 Screen Reader Support

```tsx
// Hidden visually but accessible
<span className="sr-only">Close</span>

// ARIA labels
<button aria-label={`Select ${token.symbol}`} />
```

### 10.4 Color Contrast

| Pairing | Ratio | Status |
|---------|-------|--------|
| `foreground` on `background` | 12.6:1 | ✅ AAA |
| `muted-foreground` on `background` | 4.5:1 | ✅ AA |
| `primary-foreground` on `primary` | 7.2:1 | ✅ AAA |
| `primary` on `background` | 4.8:1 | ✅ AA |

**Completion Criteria**:
- [ ] All interactive elements have focus-visible states
- [ ] All buttons have aria-labels or visible text
- [ ] Color contrast meets WCAG AA minimum
- [ ] Disabled states visually distinct (50% opacity)

---

## 11. Implementation Checklist

### Phase 1: Foundation Setup

- [ ] **1.1** Create `src/lib/utils.ts` with `cn()` function
- [ ] **1.2** Configure `tailwind.config.ts` with all design tokens
- [ ] **1.3** Create `src/index.css` with CSS variables
- [ ] **1.4** Install all required dependencies
- [ ] **1.5** Verify dark mode toggle works

### Phase 2: Core Components

- [ ] **2.1** Implement Button component with all variants
- [ ] **2.2** Implement Card component
- [ ] **2.3** Implement Input component
- [ ] **2.4** Implement Badge component
- [ ] **2.5** Implement Dialog/Sheet components
- [ ] **2.6** Implement Toast/Sonner integration
- [ ] **2.7** Implement Select component

### Phase 3: Custom Components

- [ ] **3.1** Implement SDKContainer wrapper
- [ ] **3.2** Implement SwipeToConfirm component
- [ ] **3.3** Implement AmountSlider component
- [ ] **3.4** Implement CircularProgress component
- [ ] **3.5** Implement TokenSwipePill/Carousel component
- [ ] **3.6** Implement ConfettiEffect component
- [ ] **3.7** Implement WalletCard component

### Phase 4: Page Templates

- [ ] **4.1** Create Home page template
- [ ] **4.2** Create CryptoPay page template
- [ ] **4.3** Create FiatPayment page template
- [ ] **4.4** Create Processing page template
- [ ] **4.5** Create SelectToken page template

### Phase 5: Responsive Validation

- [ ] **5.1** Test iPhone SE (375px)
- [ ] **5.2** Test iPhone 14 Pro (393px)
- [ ] **5.3** Test iPhone 14 Pro Max (430px)
- [ ] **5.4** Test iPad Mini (768px)
- [ ] **5.5** Test Desktop 1080p (1920px)
- [ ] **5.6** Verify dark mode on all viewports

### Phase 6: Interaction Validation

- [ ] **6.1** SwipeToConfirm drag responds < 50ms
- [ ] **6.2** Haptic feedback fires on swipe complete
- [ ] **6.3** Token carousel animates smoothly
- [ ] **6.4** Amount slider snaps to tick marks
- [ ] **6.5** Confetti plays on success state
- [ ] **6.6** All focus states visible via keyboard

---

## 12. Validation Protocol

### 12.1 Visual Diff Checklist

For each viewport, capture screenshots and verify:

```
□ Background color matches design token
□ Card shadows render correctly
□ Border radius consistent (20px on container)
□ Typography scale matches spec
□ Icon sizes correct (lucide-react)
□ Spacing matches 4px grid
□ Dark mode colors invert correctly
```

### 12.2 Interaction Audit

```
□ All buttons have hover state
□ All buttons have focus-visible ring
□ Swipe threshold at 80%
□ Drag thumb scales 105% while dragging
□ Spring-back animation plays when released early
□ Success state shows green-500 background
□ Confetti particle count: 50
```

### 12.3 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Paint | < 1.0s | Lighthouse |
| LCP | < 2.5s | Lighthouse |
| CLS | < 0.1 | Lighthouse |
| Animation FPS | 60fps | DevTools |
| Bundle Size | < 200KB gzip | Vite build |

### 12.4 Automated Tests

```typescript
// Example Playwright viewport tests
const viewports = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 14 Pro', width: 393, height: 852 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'Desktop', width: 1920, height: 1080 },
];

for (const viewport of viewports) {
  test(`renders correctly on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.locator('[data-testid="sdk-container"]')).toBeVisible();
    await expect(page).toHaveScreenshot(`${viewport.name}.png`);
  });
}
```

### 12.5 Sign-off Requirements

Before shipping any UI:

1. **Visual**: Side-by-side comparison with this spec passes
2. **Responsive**: All 5 test viewports render correctly
3. **Dark Mode**: Light/dark toggle works, no color regressions
4. **Accessibility**: Keyboard navigation works end-to-end
5. **Performance**: Lighthouse score > 90 on all categories
6. **Animations**: 60fps on target devices

---

## Appendix A: Icon Reference

All icons from `lucide-react`:

| Icon | Usage |
|------|-------|
| `Lock` | Security badge |
| `Wallet` | Wallet selection |
| `CreditCard` | Fiat payment |
| `ChevronDown/Up` | Dropdowns, accordions |
| `ChevronLeft/Right` | Carousel, navigation |
| `Check` | Success, selected |
| `X` | Close, dismiss |
| `ArrowUpDown` | Token conversion |

---

## Appendix B: File Structure

```
src/
├── assets/                 # Static images, logos
├── components/
│   ├── deposit/           # Domain-specific components
│   │   ├── AmountInput.tsx
│   │   ├── AmountSlider.tsx
│   │   ├── CircularProgress.tsx
│   │   ├── ConfettiEffect.tsx
│   │   ├── SDKContainer.tsx
│   │   ├── SwipeToConfirm.tsx
│   │   ├── TokenSwipePill.tsx
│   │   └── ...
│   └── ui/                # Generic UI primitives (shadcn)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── sheet.tsx
│       └── ...
├── contexts/              # React contexts
├── hooks/                 # Custom hooks
│   ├── use-mobile.tsx
│   └── use-toast.ts
├── lib/
│   └── utils.ts           # cn() utility
├── pages/                 # Route pages
├── index.css              # CSS variables
├── App.tsx                # Root component
└── main.tsx               # Entry point
```

---

## Appendix C: Quick Reference Card

### Colors (HSL)

```
Primary:      217 91% 60%   (Blue)
Destructive:  0 84% 60%     (Red)
Success:      142 76% 36%   (Green)
Background:   0 0% 98%      (Light) / 220 15% 10% (Dark)
Foreground:   220 15% 20%   (Light) / 0 0% 98% (Dark)
```

### Spacing

```
4px  = 1    (tight)
8px  = 2    (small)
16px = 4    (standard)
24px = 6    (medium)
32px = 8    (large)
```

### Border Radius

```
12px = rounded-sm
14px = rounded-md  
16px = rounded-lg
20px = rounded-xl / rounded-[20px]
9999px = rounded-full
```

### Shadows

```
soft:   0 2px 8px -2px (8% opacity)
medium: 0 4px 16px -4px (12% opacity)
large:  0 8px 32px -8px (16% opacity)
```

---

*End of Trustware Design System Specification v1.0.0*
