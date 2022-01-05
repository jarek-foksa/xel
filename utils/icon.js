
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {svg} from "./template.js";

let cache = {};

// @type (string) => SVGSVGElement?
export let getIconset = (iconsetURL) => {
  return new Promise(async (resolve) => {
    if (cache[iconsetURL]) {
      if (cache[iconsetURL].iconset) {
        resolve(cache[iconsetURL].iconset);
      }
      else {
        cache[iconsetURL].callbacks.push(resolve);
      }
    }
    else {
      cache[iconsetURL] = {callbacks: [resolve], iconset: null};

      let iconsetSVG = null;

      try {
        iconsetSVG = await (await fetch(iconsetURL)).text();
      }
      catch (error) {
        iconsetSVG = null;
      }

      if (iconsetSVG) {
        cache[iconsetURL].iconset = svg`${iconsetSVG}`;

        for (let callback of cache[iconsetURL].callbacks) {
          callback(cache[iconsetURL].iconset);
        }
      }
      else {
        console.error(`Xel failed to fetch the iconset: ${iconsetURL}`);
      }
    }
  });
};
