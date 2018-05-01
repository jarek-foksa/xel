
// @doc
//   https://material.google.com/style/icons.html#icons-system-icons
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, svg} from "../utils/element.js";
import {readFile} from "../utils/file.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        color: currentColor;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
      }
      :host([disabled]) {
        opacity: 0.5;
      }
      :host([hidden]) {
        display: none;
      }

      #svg {
        width: 100%;
        height: 100%;
        fill: currentColor;
        stroke: none;
        /* @bugfix: pointerOverEvent.relatedTarget leaks shadow DOM of <x-icon> */
        pointer-events: none;
      }
    </style>

    <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
  </template>
`;

let cache = {};

export class XIconElement extends HTMLElement {
  static get observedAttributes() {
    return ["name", "iconset"];
  }

  // @type
  //   string
  // @default
  //   ""
  // @attribute
  get name() {
    return this.hasAttribute("name") ? this.getAttribute("name") : "";
  }
  set name(name) {
    this.setAttribute("name", name);
  }

  // @type
  //   string
  // @default
  //   "node_modules/xel/images/icons.svg"
  // @attribute
  get iconset() {
    if (this.hasAttribute("iconset") === false || this.getAttribute("iconset").trim() === "") {
      return "node_modules/xel/images/icons.svg";
    }
    else {
      return this.getAttribute("iconset");
    }
  }
  set iconset(iconset) {
    this.setAttribute("iconset", iconset);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
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

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "name") {
      this._update();
    }
    else if (name === "iconset") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _update() {
    if (this.name === "") {
      this["#svg"].innerHTML = "";
    }
    else {
      let symbol = await this._getSymbol(this.name, this.iconset);

      if (symbol) {
        this["#svg"].innerHTML = `${symbol.outerHTML}<use href="#${this.name}" width="100%" height="100%"></use>`
      }
      else {
        this["#svg"].innerHTML = "";
      }
    }
  }

  _getSymbol(name, iconsetURL) {
    return new Promise(async (resolve) => {
      let iconset = await this._getIconset(iconsetURL);
      let symbol = null;

      if (iconset) {
        symbol = iconset.querySelector("#" + CSS.escape(name));
      }

      resolve(symbol);
    });
  }

  _getIconset(iconsetURL) {
    return new Promise(async (resolve) => {
      if (cache[iconsetURL]) {
        if (cache[iconsetURL].iconset) {
          resolve(cache[iconsetURL].iconset);
        }
        else {
          cache[iconsetURL].callbacks.push(resolve);
        }
      }
      else {
        cache[iconsetURL] = {callbacks: [resolve], iconset: null};

        let iconsetSVG = null;

        try {
          iconsetSVG = await readFile(iconsetURL);
        }
        catch (error) {
          iconsetSVG = null;
        }

        if (iconsetSVG) {
          cache[iconsetURL].iconset = svg`${iconsetSVG}`;

          for (let callback of cache[iconsetURL].callbacks) {
            callback(cache[iconsetURL].iconset);
          }
        }
      }
    });
  }
}

customElements.define("x-icon", XIconElement);
