
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {getIconset} from "../utils/icon.js";
import {html, css} from "../utils/template.js";

// @element x-icon
export default class XIconElement extends HTMLElement {
  static observedAttributes = ["name", "iconset", "size"];

  static #shadowTemplate = html`
    <template>
      <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      color: currentColor;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 17px;
      height: 17px;
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
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  get name() {
    return this.hasAttribute("name") ? this.getAttribute("name") : "";
  }
  set name(name) {
    this.setAttribute("name", name);
  }

  // @property
  // @attribute
  // @type string?
  // @default null
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

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property
  // @attribute
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  #shadowRoot = null;
  #elements = {};
  #defaultIconsetsChangeListener = null;
  #xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XIconElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XIconElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }
  }

  connectedCallback() {
    Xel.addEventListener("iconsetschange", this.#defaultIconsetsChangeListener = () => {
      this.#update();
    });

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => {
      this.#updateComputedSizeAttriubte();
    });

    this.#updateComputedSizeAttriubte();
  }

  disconnectedCallback() {
    Xel.removeEventListener("iconsetschange", this.#defaultIconsetsChangeListener);
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "name") {
      this.#update();
    }
    else if (name === "iconset") {
      this.#update();
    }
    else if (name === "size") {
      this.#updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #update() {
    if (this.name === "") {
      this.#elements["svg"].innerHTML = "";
    }
    else {
      let symbol = null;

      // Custom iconset
      if (this.iconset) {
        let iconsetElement = await getIconset(this.iconset);

        if (iconsetElement) {
          symbol = iconsetElement.querySelector("#" + CSS.escape(this.name));
        }
      }
      // Default iconset
      else {
        await Xel.whenIconsetsReady;

        for (let iconsetElement of Xel.iconsetElements) {
          let matchedSymbol = iconsetElement.querySelector("#" + CSS.escape(this.name));

          if (matchedSymbol) {
            symbol = matchedSymbol;
            break;
          }
        }
      }

      if (symbol) {
        this.#elements["svg"].setAttribute("viewBox", symbol.getAttribute("viewBox"));
        this.#elements["svg"].innerHTML = symbol.innerHTML;
      }
      else {
        this.#elements["svg"].innerHTML = "";
      }
    }
  }

  #updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }
}

customElements.define("x-icon", XIconElement);
