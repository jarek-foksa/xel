
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 22px;
        height: 22px;
        cursor: default;
        box-sizing: border-box;
        overflow: hidden;
      }

      #main {
        width: 100%;
        height: 100%;
        position: relative;
      }

      #selected-icon {
        display: none;
        position: absolute;
        left: calc(50% - 8px);
        top: calc(50% - 8px);
        width: 16px;
        height: 16px;
        color: white;
      }
      :host([showicon]:hover) #selected-icon {
        display: block;
        opacity: 0.6;
      }
      :host([showicon][selected]) #selected-icon {
        display: block;
        opacity: 1;
      }
      :host([showicon][value="#FFFFFF"]) #selected-icon {
        fill: gray;
      }
    </style>

    <main id="main">
      <x-icon id="selected-icon" name="send"></x-icon>
    </main>
  </template>
`;

export class XSwatchElement extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  // @info
  //   Value associated with this button.
  // @type
  //   string
  // @default
  //   "white"
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "white";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(selected) {
    selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
  }

  // @info
  //   Whether to show selection icon on hover and when the swatch is selected.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get showicon() {
    return this.hasAttribute("showicon");
  }
  set showicon(showicon) {
    showicon ? this.setAttribute("showicon", "") : this.removeAttribute("showicon");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this._update();
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    this["#main"].style.background = this.value;
  }
}

customElements.define("x-swatch", XSwatchElement);
