
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {getIcons} from "../utils/icon.js";
import {html, css} from "../utils/template.js";

// @element x-icon
export default class XIconElement extends HTMLElement {
  static observedAttributes = ["href"];

  static #shadowTemplate = html`
    <template>
      <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
      <slot></slot>
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
  get href() {
    return this.hasAttribute("href") ? this.getAttribute("href") : "";
  }
  set href(href) {
    this.setAttribute("href", href);
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
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot = null;
  #defaultIconsChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XIconElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XIconElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
  }

  connectedCallback() {
    Xel.addEventListener("iconschange", this.#defaultIconsChangeListener = () => {
      this.#update();
    });
  }

  disconnectedCallback() {
    Xel.removeEventListener("iconschange", this.#defaultIconsChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "href") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onPointerEnter() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip && tooltip.disabled === false) {
      tooltip.open(this);
    }
  }

  #onPointerLeave() {
    let tooltip = this.querySelector(":scope > x-tooltip");

    if (tooltip) {
      tooltip.close();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #update() {
    let symbol = null;
    let href = this.href.trim();

    if (href !== "") {
      let path = null;
      let id = null;

      if (href.includes("#")) {
        let parts = href.split("#");

        if (parts[0] !== "") {
          path = parts[0];
        }
        if (parts[1] !== "") {
          id = parts[1];
        }
      }

      if (id !== null) {
        // Default icons
        if (path === null) {
          await Xel.whenIconsReady;
          symbol = Xel.queryIcon("#" + CSS.escape(id));
        }
        // Custom icons
        else {
          let iconsElement = await getIcons(path);

          if (iconsElement) {
            symbol = iconsElement.querySelector("#" + CSS.escape(id));
          }
        }
      }
    }

    if (symbol) {
      this["#svg"].setAttribute("viewBox", symbol.getAttribute("viewBox"));
      this["#svg"].innerHTML = symbol.innerHTML;
    }
    else {
      this["#svg"].innerHTML = "";
    }
  }
}

customElements.define("x-icon", XIconElement);
