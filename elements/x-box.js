
// @info
//   Same as <div>, but have default stylings suitable for flexbox container.
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-box.css" data-vulcanize>
    <slot></slot>
  </template>
`;

export class XBoxElement extends HTMLElement {
  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));
  }

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
}

customElements.define("x-box", XBoxElement);
