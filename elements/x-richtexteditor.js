
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

let ProseMirror = null;

// @element x-richtexteditor
export default class XRichTextEditorElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static _shadowTemplate = html`
    <template>
      <main id="main"></main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      min-height: 100px;
      box-sizing: border-box;
      background: white;
      font-size: 12.5px;
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

  _shadowRoot = null;
  _elements = {};

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.adoptedStyleSheets = [XRichTextEditorElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XRichTextEditorElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }
  }

  async connectedCallback() {
    if (ProseMirror === null) {
      ProseMirror = (await import("/prose-mirror.js")).default;
    }
  }
}

customElements.define("x-richtexteditor", XRichTextEditorElement);
