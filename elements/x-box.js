
// @info
//   Same as <div>, but have default stylings suitable for flexbox container.
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        box-sizing: border-box;
        display: flex;
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
    </style>

    <slot></slot>
  </template>
`;

export class XBoxElement extends HTMLElement {
  // @info
  //   Whether to use vertical (rather than horizontal) layout.
  // @type
  //   boolean
  // @default
  //   false
  get vertical() {
    return this.hasAttribute("vertical");
  }
  set vertical(vertical) {
    vertical ? this.setAttribute("vertical", "") : this.removeAttribute("vertical");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));
  }
}

customElements.define("x-box", XBoxElement);
