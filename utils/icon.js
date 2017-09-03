
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, svg} from "./element.js";
import {replaceAll} from "./string.js";

let materialIconsURL = `https://raw.githubusercontent.com/google/material-design-icons/master/sprites/svg-sprite`;

let materialIconsCategories = [
  "action", "alert", "av", "communication", "content", "device", "editor", "file", "hardware", "image", "maps",
  "navigation", "notification", "places", "social", "toggle"
];

// @info
//   Generate the contents of images/icons.svg file (except for "xel" cetagory")
// @type
//   () => Promise<string>
export let generateMaterialIconsSVG = () => {
  return new Promise(async (resolve) => {
    let sprite = createElement("svg:svg");
    sprite.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    for (let category of materialIconsCategories) {
      let response = await fetch(`${materialIconsURL}/svg-sprite-${category}-symbol.svg`);
      let iconsSVG = await response.text();
      let icons = svg`${iconsSVG}`.querySelector("svg");
      let group = createElement("svg:g");

      group.setAttribute("data-category", category);
      sprite.append(group);

      for (let child of [...icons.children]) {
        if (child.localName === "symbol") {
          let symbol = child;
          symbol.id = symbol.id.substring(3, symbol.id.length - 5);
          symbol.id = replaceAll(symbol.id, "_", "-");

          if (symbol.id === "3d-rotation") {
            symbol.id = "rotate-3d";
          }

          group.append(symbol);
        }
      }
    }

    let outerHTML = sprite.outerHTML;
    let blob = new Blob([outerHTML], { type: "text/plain;charset=utf-8" });
    let url = URL.createObjectURL(blob);
    window.open(url);

    resolve(outerHTML);
  });
};
