
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {readFile} from "../utils/file.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-throbber.css" data-vulcanize>
    <main id="main"></main>
  </template>
`;

export class XThrobberElement extends HTMLElement {
  static get observedAttributes() {
    return ["type"];
  }

  // @type
  //   "ring" || "spin"
  // @default
  //   "ring"
  // @attribute
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "ring";
  }
  set type(type) {
    this.setAttribute("type", type);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this._update();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "type") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _update() {
    let artworkSVG = await readFile(`node_modules/xel/images/${this.type}-throbber.svg`);
    this["#main"].innerHTML = artworkSVG;

    if (this.hasAttribute("type") === false) {
      this.setAttribute("type", this.type);
    }
  }
}

customElements.define("x-throbber", XThrobberElement);
