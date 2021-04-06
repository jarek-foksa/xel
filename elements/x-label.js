
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-label
export default class XLabelElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
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

  _shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XLabelElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XLabelElement._shadowTemplate.content, true));
  }
}

customElements.define("x-label", XLabelElement);
