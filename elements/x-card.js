
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-card
export default class XCardElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      min-width: 20px;
      min-height: 48px;
      box-sizing: border-box;
      margin: 30px 0;
    }
    :host([hidden]) {
      display: none;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XCardElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XCardElement._shadowTemplate.content, true));
  }
}

customElements.define("x-card", XCardElement);
