import { THEME_STORAGE_KEY } from "./storage";

// Runs before hydration so a dark theme doesn't flash light first. The
// Content-Security-Policy allows it by hash, so keep it a constant string.
export const THEME_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
