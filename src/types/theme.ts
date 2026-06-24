/** Light or dark color mode for the widget. "system" follows the OS preference. */
export type TrustwareTheme = "light" | "dark" | "system";

export type TrustwareWidgetMessages = {
  title: string;
  description: string;
};

export const DEFAULT_MESSAGES: TrustwareWidgetMessages = {
  title: "Trustware SDK",
  description: "Seamlessly bridge assets across chains with Trustware.",
};
