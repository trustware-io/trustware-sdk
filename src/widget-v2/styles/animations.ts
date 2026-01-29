/**
 * Animation keyframes and definitions for injection via <style> tag
 * These are injected once in the WidgetContainer
 */

/**
 * All keyframe animations used by the widget
 */
export const KEYFRAMES = `
/* Slide in from right (forward navigation) */
@keyframes tw-slide-in-right {
  0% { opacity: 0; transform: translateX(1rem); }
  100% { opacity: 1; transform: translateX(0); }
}

/* Slide in from left (back navigation) */
@keyframes tw-slide-in-left {
  0% { opacity: 0; transform: translateX(-1rem); }
  100% { opacity: 1; transform: translateX(0); }
}

/* Fade in with scale */
@keyframes tw-fade-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Slide up */
@keyframes tw-slide-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale in */
@keyframes tw-scale-in {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

/* Swipe complete background transition */
@keyframes tw-swipe-complete {
  from { background-color: hsl(var(--tw-muted)); }
  to { background-color: hsl(142 76% 36%); }
}

/* Token hint bounce (vertical) */
@keyframes tw-token-hint-bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-8px); }
  50% { transform: translateY(5px); }
  75% { transform: translateY(-3px); }
}

/* Token hint bounce (horizontal) */
@keyframes tw-token-hint-bounce-x {
  0%, 100% { transform: translateX(0) scale(1); }
  20% { transform: translateX(-10px) scale(1); }
  40% { transform: translateX(8px) scale(1); }
  60% { transform: translateX(-5px) scale(1); }
  80% { transform: translateX(3px) scale(1); }
}

/* Spinner rotation */
@keyframes tw-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Slow spinner rotation */
@keyframes tw-spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Confetti fall animation */
@keyframes tw-confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
  100% {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}

/* Pulse animation */
@keyframes tw-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

/**
 * Animation CSS classes that use the keyframes
 * These can be referenced by adding className to elements
 */
export const ANIMATION_CLASSES = `
/* Animation utility classes */
.tw-animate-slide-in-right {
  animation: tw-slide-in-right 150ms ease-out;
}

.tw-animate-slide-in-left {
  animation: tw-slide-in-left 150ms ease-out;
}

.tw-animate-fade-in {
  animation: tw-fade-in 0.3s ease-out;
}

.tw-animate-slide-up {
  animation: tw-slide-up 0.4s ease-out;
}

.tw-animate-scale-in {
  animation: tw-scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tw-animate-swipe-complete {
  animation: tw-swipe-complete 0.3s ease-out forwards;
}

.tw-animate-token-hint-bounce {
  animation: tw-token-hint-bounce 0.7s ease-out;
}

.tw-animate-token-hint-bounce-x {
  animation: tw-token-hint-bounce-x 0.8s ease-out;
}

.tw-animate-spin {
  animation: tw-spin 1s linear infinite;
}

.tw-animate-spin-slow {
  animation: tw-spin-slow 2s linear infinite;
}

.tw-animate-confetti {
  animation: tw-confetti-fall 2s ease-out forwards;
}

.tw-animate-pulse {
  animation: tw-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;

/**
 * Combined keyframes and animation classes for injection
 */
export const ALL_ANIMATION_STYLES = KEYFRAMES + ANIMATION_CLASSES;

/**
 * Animation timing presets (for use with inline style animation property)
 */
export const animationTimings = {
  slideInRight: "tw-slide-in-right 150ms ease-out",
  slideInLeft: "tw-slide-in-left 150ms ease-out",
  fadeIn: "tw-fade-in 0.3s ease-out",
  slideUp: "tw-slide-up 0.4s ease-out",
  scaleIn: "tw-scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  swipeComplete: "tw-swipe-complete 0.3s ease-out forwards",
  tokenHintBounce: "tw-token-hint-bounce 0.7s ease-out",
  tokenHintBounceX: "tw-token-hint-bounce-x 0.8s ease-out",
  spin: "tw-spin 1s linear infinite",
  spinSlow: "tw-spin-slow 2s linear infinite",
  confettiFall: "tw-confetti-fall 2s ease-out forwards",
  pulse: "tw-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
} as const;
