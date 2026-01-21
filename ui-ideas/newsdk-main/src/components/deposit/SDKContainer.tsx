import React from 'react';
import { cn } from '@/lib/utils';
import DarkModeToggle from '@/components/DarkModeToggle';

interface SDKContainerProps {
  children: React.ReactNode;
  className?: string;
  showDarkModeToggle?: boolean;
}

const SDKContainer: React.FC<SDKContainerProps> = ({ children, className, showDarkModeToggle = true }) => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div 
        className={cn(
          "relative bg-card w-full max-w-[420px] rounded-[20px] shadow-xl overflow-hidden",
          "border border-border/30",
          className
        )}
        style={{
          maxHeight: 'calc(100vh - 32px)',
        }}
      >
        {/* Dark Mode Toggle */}
        {showDarkModeToggle && (
          <div className="absolute top-4 right-4 z-50">
            <DarkModeToggle />
          </div>
        )}
        <div className="overflow-y-auto max-h-[85vh] scrollbar-none">
          {children}
        </div>
      </div>
    </div>
  );
};

export default SDKContainer;
