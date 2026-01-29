import React, { useEffect, useState } from "react";
import { zIndex } from "../styles/tokens";

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

export interface ConfettiEffectProps {
  /** Whether the confetti animation should be active */
  isActive: boolean;
  /** Duration in ms before confetti pieces are cleared (default: 3000) */
  clearDelay?: number;
  /** Number of confetti pieces to generate (default: 50) */
  pieceCount?: number;
}

const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 50,
  overflow: "hidden",
};

/**
 * Confetti celebration effect component.
 * Renders animated confetti pieces that fall from the top of the screen.
 * This component should be lazy loaded to reduce initial bundle size.
 */
export function ConfettiEffect({
  isActive,
  clearDelay = 3000,
  pieceCount = 50,
}: ConfettiEffectProps): React.ReactElement | null {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  // Generate confetti pieces when activated
  useEffect(() => {
    if (isActive) {
      const colors = [
        "#10b981", // emerald
        "#3b82f6", // blue
        "#f59e0b", // amber
        "#ef4444", // red
        "#8b5cf6", // violet
        "#ec4899", // pink
        "#06b6d4", // cyan
        "#84cc16", // lime
      ];
      const newPieces: ConfettiPiece[] = [];

      for (let i = 0; i < pieceCount; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * 100,
          color: colors[Math.floor(Math.random() * colors.length)],
          delay: Math.random() * 0.5,
          duration: 1.5 + Math.random() * 1.5,
          size: 6 + Math.random() * 8,
          rotation: Math.random() * 360,
        });
      }

      setPieces(newPieces);

      // Clear after animation completes
      const timer = setTimeout(() => {
        setPieces([]);
      }, clearDelay);

      return () => clearTimeout(timer);
    } else {
      setPieces([]);
    }
  }, [isActive, pieceCount, clearDelay]);

  if (!isActive || pieces.length === 0) {
    return null;
  }

  return (
    <div style={containerStyle} aria-hidden="true">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          style={{
            position: "absolute",
            left: `${piece.x}%`,
            top: "-20px",
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            backgroundColor: piece.color,
            borderRadius: piece.id % 2 === 0 ? "50%" : "2px",
            transform: `rotate(${piece.rotation}deg)`,
            animation: `tw-confetti-fall ${piece.duration}s ease-out forwards`,
            animationDelay: `${piece.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default ConfettiEffect;
