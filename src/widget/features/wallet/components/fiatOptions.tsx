import type React from "react";

import {
  ApplePayIcon,
  MPesaIcon,
  VenmoIcon,
  ZelleIcon,
} from "./paymentOptionIcons";

export interface FiatOption {
  icon: React.ReactNode;
  id: string;
  name: string;
}

export const fiatOptions: FiatOption[] = [
  {
    id: "applepay",
    name: "Apple Pay",
    icon: <ApplePayIcon />,
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    icon: <MPesaIcon />,
  },
  {
    id: "venmo",
    name: "Venmo",
    icon: <VenmoIcon />,
  },
  {
    id: "zelle",
    name: "Zelle",
    icon: <ZelleIcon />,
  },
];
