
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

let templateElement = document.createElement("template");

/**
 * Template string tag used to parse HTML strings.
 *
 * @type {(strings: TemplateStringsArray, ...expressions: Array<string>) => HTMLElement | DocumentFragment}
 */
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

/**
 * Template string tag used to parse CSS strings.
 *
 * @type {(strings: TemplateStringsArray, ...expressions: Array<string>) => CSSStyleSheet}
 */
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

/**
 * Template string tag used to parse SVG strings.
 *
 * @type {(strings: TemplateStringsArray, ...expressions: Array<string>) => SVGElement | DocumentFragment}
 */
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
