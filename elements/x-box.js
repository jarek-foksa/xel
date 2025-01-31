
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-box
export default class XBoxElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      justify-content: flex-start;
    }
    :host([vertical]) {
      flex-flow: column;
      align-items: flex-start;
      justify-content: center;
    }
    :host([hidden]) {
      display: none;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to use vertical (rather than horizontal) layout.
  get vertical() {
    return this.hasAttribute("vertical");
  }
  set vertical(vertical) {
    vertical ? this.setAttribute("vertical", "") : this.removeAttribute("vertical");
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XBoxElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XBoxElement.#shadowTemplate.content, true));
  }
}

customElements.define("x-box", XBoxElement);
