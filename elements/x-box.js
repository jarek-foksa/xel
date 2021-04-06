
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-box
export default class XBoxElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
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

  _shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XBoxElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XBoxElement._shadowTemplate.content, true));
  }
}

customElements.define("x-box", XBoxElement);
