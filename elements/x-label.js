
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-label
export default class XLabelElement extends HTMLElement {
  static #shadowTemplate = html`<template><slot></slot></template>`;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      cursor: inherit;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      font-size: 0.8125rem;
      font-weight: 400;
      line-height: 1.2;
    }
    :host([disabled]) {
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }
    :host([level="1"]) {
      margin: 12px 0px;
      font-size: 1.625rem;
      font-weight: 600;
    }
    :host([level="2"]) {
      margin: 10px 0px;
      font-size: 1rem;
      font-weight: 700;
    }
    :host([level="3"]) {
      margin: 8px 0px;
      font-size: 0.8125rem;
      font-weight: 700;
    }
    :host([level="4"]) {
      margin: 4px 0px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    slot {
      text-decoration: inherit;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
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

  // @property
  // @attribute
  // @type number?
  // @default null
  get level() {
    return this.hasAttribute("level") ? parseInt(this.getAttribute("level")) : null;
  }
  set level(level) {
    level === null ? this.removeAttribute("level") : this.setAttribute("level", level);
  }

  // @property
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
