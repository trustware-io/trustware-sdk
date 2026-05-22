import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ImageLoaderProps {
  src: string;
  alt?: string;
  retry?: number;
  retryDelay?: number;
  lazy?: boolean;
  Fallback?: React.ReactNode;
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
  imgStyle,
  onLoad,
  onError,
}: ImageLoaderProps) {
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [attempt, setAttempt] = useState<number>(0);
  const [srcIsEmpty, setSrcIsEmpty] = useState<boolean>(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onLoadRef.current = onLoad;
    onErrorRef.current = onError;
  }, [onLoad, onError]);

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

  const loadImage = useCallback((): void => {
    if (!src) {
      setSrcIsEmpty(true);
      return;
    }

    setSrcIsEmpty(false);
    setStatus("loading");
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setStatus("success");
      onLoadRef.current?.();
    };
    img.onerror = () => {
      setStatus("error");
      onErrorRef.current?.();
    };
  }, [src]);

  useEffect(() => {
    if (!lazy) {
      const timer = setTimeout(() => loadImage(), 0);
      return () => clearTimeout(timer);
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
      {status === "loading" && (
        <Skeleton
          height={imgStyle?.height as string | undefined}
          borderRadius={imgStyle?.borderRadius as string | undefined}
        />
      )}
      {status === "success" && (
        <img
          src={src}
          alt={alt}
          style={{
            all: "revert",
            display: "block",
            width: "100%",
            maxWidth: "100%",
            height: "auto",
            border: "none",
            padding: 0,
            margin: 0,
            objectFit: "cover",
            verticalAlign: "middle",
            filter: "none",
            opacity: 1,
            mixBlendMode: "normal",
            colorScheme: "normal",
            ...imgStyle,
          }}
        />
      )}
      {/* {showFallback && Fallback} */}
      {showFallback && Fallback}
    </div>
  );
}
