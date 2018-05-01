
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: white;
        padding: 14px;
        --selection-background: #B2D7FD;
      }

      ::selection {
        background: var(--selection-background);
      }

      #code {
        display: block;
        white-space: pre-wrap;
        overflow-x: auto;
        font-size: 13px;
        line-height: 18px;
        outline: none;
        background: none;
        padding: 0;
      }
    </style>

    <link id="prism-theme" rel="stylesheet">
    <code id="code" class="language-html"></code>
  </template>
`;

export class XelCodeViewElement extends HTMLElement {
  // @type
  //   string
  // @default
  //   ""
  get value() {
    return this._value;
  }
  set value(value) {
    this._value = value;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    this._value = "";

    this._observer = new MutationObserver(() => this._update());
    this._observer.observe(this, {childList: true, attributes: false, characterData: true, subtree: true});

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this["#prism-theme"].setAttribute("href", "node_modules/prismjs/themes/prism-coy.css");
    this._update();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    this["#code"].textContent = this.textContent;

    if (this["#code"].textContent !== "") {
      Prism.highlightElement(this["#code"], true);
    }
  }
}

customElements.define("xel-codeview", XelCodeViewElement);
