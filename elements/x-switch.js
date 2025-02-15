
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

// @element x-switch
// @part indicator
// @part indicator-track
// @part indicator-thumb
// @event toggle - User toggled on or off the switch.
export default class XSwitchElement extends HTMLElement {
  static observedAttributes = ["toggled", "disabled"];

  static #shadowTemplate = html`
    <template>
      <main id="main">
        <div id="indicator" part="indicator">
          <div id="indicator-track" part="indicator-track">
            <div id="indicator-thumb" part="indicator-thumb" style="transition: none;"></div>
          </div>
        </div>

        <div id="description">
          <slot></slot>
        </div>
      </main>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: fit-content;
      margin: 2px 0;
    }
    :host(:focus) {
      outline: none;
    }
    :host([disabled]) {
      opacity: 0.4;
      pointer-events: none;
    }

    #main {
      display: flex;
      align-items: center;
    }

    /**
     * Indicator
     */

    #indicator {
      position: relative;
      width: 34px;
      height: 15px;
      display: flex;
      align-items: center;
    }

    /* Track */

    #indicator-track {
      display: flex;
      align-items: center;
      width: 100%;
      height: 65%;
      background: currentColor;
      border-radius: 999px;
    }

    /* Thumb */

    #indicator-thumb {
      position: absolute;
      left: 0px;
      width: 16px;
      height: 16px;
      background: currentColor;
      border-radius: 999px;
      transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host([toggled]) #indicator-thumb {
      left: calc(100% - 16px);
    }
    :host([mixed]) #indicator-thumb {
      left: calc(50% - 16px / 2);
    }

    /**
     * Description
     */

    #description {
      flex: 1;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
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
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XSwitchElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XSwitchElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    // Do not animate newly connected switch elements
    sleep(100).then(() => this["#indicator-thumb"].style.transition = null);

    this.#updateAccessabilityAttributes();
  }

  disconnectedCallback() {
    this["#indicator-thumb"].style.transition = "none";
  }

  attributeChangedCallback(name) {
    if (name === "toggled") {
      this.#onToggledAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "switch");
    this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this.#lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this.#lastTabIndex > 0) ? this.#lastTabIndex : 0;
      }

      this.#lastTabIndex = 0;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onToggledAttributeChange() {
    this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  #onPointerDown(event) {
    if (event.buttons > 1) {
      event.preventDefault();
      return;
    }

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }
  }

  async #onClick(event) {
    // Update state
    {
      if (this.mixed) {
        this.mixed = false;
      }
      else {
        this.toggled = !this.toggled;
      }

      this.dispatchEvent(new CustomEvent("toggle"));
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      event.preventDefault();
      this.click();
    }
  }
};

customElements.define("x-switch", XSwitchElement);
