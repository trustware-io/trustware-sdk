import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon } from 'lucide-react';

const DarkModeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="relative flex items-center w-12 h-6 rounded-full bg-muted/60 border border-border/50 transition-colors hover:bg-muted"
      aria-label="Toggle dark mode"
    >
      {/* Toggle knob */}
      <div
        className={`absolute flex items-center justify-center w-5 h-5 rounded-full bg-card shadow-sm transition-transform duration-200 ${
          isDark ? 'translate-x-6' : 'translate-x-0.5'
        }`}
      >
        <Moon className={`w-3 h-3 transition-colors ${isDark ? 'text-primary' : 'text-muted-foreground/50'}`} />
      </div>
    </button>
  );
};

export default DarkModeToggle;
