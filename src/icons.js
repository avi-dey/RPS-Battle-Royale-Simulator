import { RADIUS } from "./constants.js";

export const ICON_DRAW_SIZE = RADIUS * 2;

export const DEFAULT_ICON_PATHS = {
  rock: "/assets/icons/rock.svg",
  paper: "/assets/icons/paper.svg",
  scissors: "/assets/icons/scissor.png",
};

/** @returns {Promise<Map<string, HTMLImageElement>>} */
export function loadIcons(paths = DEFAULT_ICON_PATHS) {
  return Promise.all(
    Object.entries(paths).map(
      ([kind, src]) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve([kind, img]);
          img.onerror = () =>
            reject(new Error(`Failed to load icon for ${kind}: ${src}`));
          img.src = src;
        })
    )
  ).then((entries) => new Map(entries));
}
