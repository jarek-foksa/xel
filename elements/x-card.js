
// @info
//   A card is a sheet of material that serves as an entry point to more detailed information.
// @doc
//   https://youtu.be/oujlrIZkyYY?t=16382
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-card.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  class XCardElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }
  }

  customElements.define("x-card", XCardElement);
}
