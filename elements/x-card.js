
// @info
//   A card is a sheet of material that serves as an entry point to more detailed information.
// @doc
//   https://youtu.be/oujlrIZkyYY?t=16382
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        min-width: 20px;
        min-height: 48px;
        box-sizing: border-box;
        margin: 30px 0;
      }
    </style>
    <slot></slot>
  </template>
`;

export class XCardElement extends HTMLElement {
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
