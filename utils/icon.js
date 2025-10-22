
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {svg} from "./template.js";

let cache = {};

/**
 * @type {(iconsURL: string) => SVGSVGElement | null}
 */
export let getIcons = (iconsURL) => {
  return new Promise(async (resolve) => {
    if (cache[iconsURL]) {
      if (cache[iconsURL].icons) {
        resolve(cache[iconsURL].icons);
      }
      else {
        cache[iconsURL].callbacks.push(resolve);
      }
    }
    else {
      cache[iconsURL] = {callbacks: [resolve], icons: null};

      let iconsSVG = null;

      try {
        iconsSVG = await (await fetch(iconsURL)).text();
      }
      catch (_error) {
        iconsSVG = null;
      }

      if (iconsSVG) {
        cache[iconsURL].icons = svg`${iconsSVG}`;

        for (let callback of cache[iconsURL].callbacks) {
          callback(cache[iconsURL].icons);
        }
      }
      else {
        console.error(`Xel failed to fetch the icons: ${iconsURL}`);
      }
    }
  });
};
