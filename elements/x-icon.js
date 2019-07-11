
// @doc
//   https://material.google.com/style/icons.html#icons-system-icons
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, svg} from "../utils/element.js";
import {readFile} from "../utils/file.js";

let cache = {};

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
        overflow: hidden;
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
        overflow: inherit;
        /* @bugfix: pointerOverEvent.relatedTarget leaks shadow DOM of <x-icon> */
        pointer-events: none;
      }
    </style>

    <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
  </template>
`;

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
  //   string?
  // @default
  //   null
  // @attribute
  get iconset() {
    if (this.hasAttribute("iconset") === false || this.getAttribute("iconset").trim() === "") {
      return null;
    }
    else {
      return this.getAttribute("iconset");
    }
  }
  set iconset(iconset) {
    if (iconset === null || iconset.trim() === "") {
      this.removeAttribute("iconset");
    }
    else {
      this.setAttribute("iconset", iconset);
    }
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
        this["#svg"].setAttribute("viewBox", symbol.getAttribute("viewBox"));
        this["#svg"].innerHTML = symbol.innerHTML;
      }
      else {
        this["#svg"].innerHTML = "";
      }
    }
  }

  _getSymbol(name, iconsetURL) {
    return new Promise(async (resolve) => {
      let iconset = null;

      // Default iconset
      if (iconsetURL === null) {
        // Development - default iconset must be read from a file
        if (XIconElement.DEFAULT_ICONSET === null) {
          iconset = await this._getIconset("node_modules/xel/iconsets/default.svg");
        }
        // Production - default iconset is embedded into xel.min.js
        else {
          iconset = XIconElement.DEFAULT_ICONSET;
        }
      }
      // Custom iconset
      else {
        iconset = await this._getIconset(iconsetURL);
      }

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

XIconElement.DEFAULT_ICONSET = null;

customElements.define("x-icon", XIconElement);
