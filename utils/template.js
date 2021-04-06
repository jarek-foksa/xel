
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

let templateElement = document.createElement("template");

// @type () => HTMLElement || DocumentFragment
//
// Template string tag used to parse HTML strings.
export let html = (strings, ...expressions) => {
  let parts = [];

  for (let i = 0; i < strings.length; i += 1) {
    parts.push(strings[i]);
    if (expressions[i] !== undefined) parts.push(expressions[i]);
  }

  let innerHTML = parts.join("");
  templateElement.innerHTML = innerHTML;
  let fragment = document.importNode(templateElement.content, true);

  if (fragment.children.length === 1) {
    return fragment.firstElementChild;
  }
  else {
    return fragment;
  }
};

// @type () => CSSStyleSheet
//
// Template string tag used to parse CSS strings.
export let css = (strings, ...expressions) => {
  let parts = [];

  for (let i = 0; i < strings.length; i += 1) {
    parts.push(strings[i]);
    if (expressions[i] !== undefined) parts.push(expressions[i]);
  }

  let cssText = parts.join("");
  let stylesheet = new CSSStyleSheet();
  stylesheet.replaceSync(cssText);
  return stylesheet;
};

// @type () => SVGElement || DocumentFragment
//
// Template string tag used to parse SVG strings.
export let svg = (strings, ...expressions) => {
  let parts = [];

  for (let i = 0; i < strings.length; i += 1) {
    parts.push(strings[i]);
    if (expressions[i] !== undefined) parts.push(expressions[i]);
  }

  let innerHTML = `<svg id="x-stub" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;

  templateElement.innerHTML = innerHTML;

  let fragment = document.importNode(templateElement.content, true);
  let stub = fragment.querySelector("svg#x-stub");

  if (stub.children.length === 1) {
    return stub.firstElementChild;
  }
  else {
    for (let child of [...stub.childNodes]) {
      fragment.appendChild(child);
    }

    stub.remove();
    return fragment;
  }
};
