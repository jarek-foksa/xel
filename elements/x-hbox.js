
// @info
//   Same as <div>, but have default stylings suitable for flexbox container.
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-hbox.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  class XHBoxElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));
    }
  }

  customElements.define("x-hbox", XHBoxElement);
}
