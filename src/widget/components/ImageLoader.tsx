import { useEffect, useMemo, useRef, useState } from "react";

interface ImageLoaderProps {
  src: string;
  alt?: string;
  retry?: number;
  retryDelay?: number;
  lazy?: boolean;
  Fallback?: React.ReactNode;
  // skeleton?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
  imgStyle?: React.CSSProperties;
}

type LoadStatus = "idle" | "loading" | "success" | "error";

function Skeleton({
  background,
  height,
  borderRadius,
}: {
  background?: string;
  height?: string;
  borderRadius?: string;
}) {
  return (
    <div
      style={{
        background: background || "#eee",
        height: height || "50px",
        borderRadius: borderRadius || "100%",
      }}
    />
  );
}

export default function ImageLoader({
  src,
  alt = "",
  retry = 0,
  retryDelay = 1000,
  lazy = true,
  Fallback = null,
  // skeleton = null,
  imgStyle,
  onLoad,
  onError,
}: ImageLoaderProps) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [attempt, setAttempt] = useState<number>(0);
  const [srcIsEmpty, setSrcIsEmpty] = useState<boolean>(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Retry logic effect
  useEffect(() => {
    if (status === "error" && attempt < retry) {
      const timer = setTimeout(() => {
        setAttempt((prev) => prev + 1);
        setStatus("loading");
      }, retryDelay);
      return () => clearTimeout(timer);
    }
  }, [status, attempt, retry, retryDelay]);

  // Load image
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const loadImage = (): void => {
    if (!src) {
      // Handle empty src case immediately <- '', null or undefined ->
      setSrcIsEmpty(true);
      return;
    }

    setStatus("loading");
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setStatus("success");
      onLoad?.();
    };
    img.onerror = () => {
      setStatus("error");
      onError?.();
    };
  };

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!lazy) {
      // Avoid synchronous setState in effect
      setTimeout(() => {
        loadImage();
      }, 0);
      return;
    }
    observerRef.current = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            loadImage();
            observerRef.current?.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [lazy, src, loadImage]);

  const showFallback = useMemo(() => {
    return ((status === "error" && attempt >= retry) || srcIsEmpty) && Fallback;
  }, [status, attempt, retry, srcIsEmpty, Fallback]);

  return (
    <div ref={imgRef} style={{ position: "relative" }}>
      {status === "loading" && <Skeleton />}
      {status === "success" && (
        <img
          src={src}
          alt={alt}
          style={{
            // Css guards to prevent external styles from interfering with image rendering
            all: "revert", // Undo any inherited/global resets (e.g. Tailwind, normalize.css)
            display: "block", // Prevent inline baseline gap
            width: "100%", // Restore intended sizing
            maxWidth: "100%", // Prevent overflow
            height: "auto", // Maintain aspect ratio
            border: "none", // Strip any border resets
            padding: 0, // Strip padding resets
            margin: 0, // Strip margin resets
            objectFit: "cover", // Preserve visual intent
            verticalAlign: "middle", // Guard against inline stripping
            filter: "none", // Prevent inherited filter washes
            opacity: 1, // Prevent inherited opacity stripping
            mixBlendMode: "normal", // Prevent blend mode interference
            colorScheme: "normal", // Prevent dark-mode inversion
            ...imgStyle,
          }}
        />
      )}
      {showFallback && Fallback}
    </div>
  );
}
