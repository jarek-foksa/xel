
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-label
export default class XLabelElement extends HTMLElement {
  static #shadowTemplate = html`<template><slot></slot></template>`;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      line-height: 1.2;
      user-select: none;
      box-sizing: border-box;
    }
    :host([disabled]) {
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }

    slot {
      text-decoration: inherit;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @attribute
  // @type string
  // @default ""
  //
  // Value associated with this label.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XLabelElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XLabelElement.#shadowTemplate.content, true));
  }
}

customElements.define("x-label", XLabelElement);
