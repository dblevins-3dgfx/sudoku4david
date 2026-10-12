// A theme is one palette for the whole desk. Every theme sets every color, so
// adding one is a matter of filling in this shape and listing it in index.ts.

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  board: string;
  "board-line": string;
  "board-line-soft": string;
  "cell-peer": string;
  "cell-same": string;
  "cell-selected": string;
  "cell-conflict": string;
  "cell-given": string;
  "cell-user": string;
  "cell-bad": string;
  "cell-note": string;
  "cell-note-hit": string;
  "cell-note-hit-ink": string;
};

export type Theme = {
  // Lowercase letters and hyphens. It is what gets saved, so don't rename it.
  id: string;
  name: string;
  // Dark themes also get the `dark` class, which the UI's dark: styles use.
  scheme: "light" | "dark";
  colors: ThemeColors;
  // The body's background-image: soft light behind the desk, or "none".
  backdrop: string;
};
