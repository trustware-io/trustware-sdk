import React, { useState } from "react";

import { ASSETS_BASE_URL } from "src/constants";
import { isPowerOfTwo } from "../utils/powerOfTwo";

/**
 * Hero image shown on both success screens (deposit `Success` page and swap
 * mode's `success` stage). The file lives in devops `pulumi/assets`
 * (`content/assets/sdk/success-hero.webp`) and is served through CloudFront.
 * 800x480, pre-cropped to the band the widget shows, so it renders at 2x on
 * the ~400px-wide widget.
 */
export const SUCCESS_HERO_IMAGE_URL = `${ASSETS_BASE_URL}/assets/sdk/success-hero.webp`;

export interface SuccessHeroProps {
  /** Source-token amount the user sold, in token units. */
  sellAmount: number;
  /** Additional inline styles merged onto the image */
  style?: React.CSSProperties;
}

/**
 * Easter egg banner for success screens. Only shows when the amount sold is
 * a power of two (0.5, 1, 2, 4, 8 …). Renders nothing if the CDN fetch fails
 * so a network hiccup never leaves a broken-image icon on the receipt.
 */
export function SuccessHero({
  sellAmount,
  style,
}: SuccessHeroProps): React.ReactElement | null {
  const [failed, setFailed] = useState(false);
  if (failed || !isPowerOfTwo(sellAmount)) return null;

  return (
    <img
      src={SUCCESS_HERO_IMAGE_URL}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
      style={{
        width: "100%",
        maxHeight: "220px",
        objectFit: "cover",
        objectPosition: "center top",
        borderRadius: "1rem",
        display: "block",
        userSelect: "none",
        animation: "tw-fade-in 0.4s ease-out",
        ...style,
      }}
    />
  );
}
