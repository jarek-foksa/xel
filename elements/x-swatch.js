
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-swatch
export default class XSwatchElement extends HTMLElement {
  static observedAttributes = ["value"];

  static #shadowTemplate = html`
    <template>
      <div id="preview"></div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 18px;
      height: 18px;
      cursor: default;
      box-sizing: border-box;
      overflow: hidden;
      border-width: 1px;
      border-style: solid;
      background: var(--checkboard-background);
      background-size: 8px 8px;
      background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
    }

    #preview {
      width: 100%;
      height: 100%;
      position: relative;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default "white"
  //
  // Color value following the <a href="https://www.w3.org/TR/css-color-3/#colorunits">CSS syntax</a>.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "white";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XSwatchElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XSwatchElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this.#updatePreview();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "value") {
      this.#updatePreview();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updatePreview() {
    this["#preview"].style.background = this.value;
  }
}

customElements.define("x-swatch", XSwatchElement);
