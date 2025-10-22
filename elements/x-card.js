
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {html, css} from "../utils/template.js";

/**
 * @element x-card
 */
export default class XCardElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      min-width: 20px;
      min-height: 48px;
      box-sizing: border-box;
      margin: 30px 0;
      padding: 16px 20px;
    }
    :host([hidden]) {
      display: none;
    }

    slot {
      border-radius: inherit;
    }
  `;

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XCardElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XCardElement.#shadowTemplate.content, true));
  }
}

customElements.define("x-card", XCardElement);
