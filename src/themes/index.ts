import { desertDusk } from "./desert-dusk";
import { graphite } from "./graphite";
import { highContrast } from "./high-contrast";
import { lamplight } from "./lamplight";
import { midnight } from "./midnight";
import { newsprint } from "./newsprint";
import { paper } from "./paper";
import { sageGarden } from "./sage-garden";
import type { Theme } from "./theme";

export type { Theme, ThemeColors } from "./theme";

// To add a theme, write its file and list it here. To remove one, delete both.
// The picker shows them in this order.
export const THEMES: readonly Theme[] = [
  paper,
  lamplight,
  newsprint,
  sageGarden,
  desertDusk,
  midnight,
  graphite,
  highContrast,
];

// Used when nothing is saved, following the system's light or dark setting.
export const DEFAULT_LIGHT_THEME = paper.id;
export const DEFAULT_DARK_THEME = lamplight.id;
