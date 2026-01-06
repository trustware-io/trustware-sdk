export type TrustwareWidgetTheme = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  radius: number;
};

export type TrustwareWidgetMessages = {
  title: string;
  description: string;
};

export const DEFAULT_THEME: TrustwareWidgetTheme = {
  primaryColor: "#4F46E5", // Indigo-600
  secondaryColor: "#6366F1", // Indigo-500
  backgroundColor: "#FFFFFF", // White
  textColor: "#111827", // Gray-900
  borderColor: "#E5E7EB", // Gray-200
  radius: 8, // 8px border radius
};

export const DEFAULT_MESSAGES: TrustwareWidgetMessages = {
  title: "Trustware SDK",
  description: "Seamlessly bridge assets across chains with Trustware.",
};
