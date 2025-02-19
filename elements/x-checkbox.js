
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, closest} from "../utils/element.js";
import {getBrowserEngine} from "../utils/system.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

// @element x-checkbox
// @part indicator
// @event ^toggle - User toggled on or off the checkbox.
export default class XCheckboxElement extends HTMLElement {
  static observedAttributes = ["toggled", "mixed", "disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="main">
        <div id="indicator" part="indicator">
          <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path id="checkmark-path"></path>
          </svg>
        </div>

        <div id="description">
          <slot></slot>
        </div>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: fit-content;
    }
    :host([disabled]) {
      opacity: 0.4;
      pointer-events: none;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:focus) {
      outline: none;
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
      width: 19px;
      height: 19px;
      box-sizing: border-box;
      border: 2px solid currentColor;
      overflow: hidden;
      --path-data: M 95 23 L 86 13 L 37 66 L 13.6 41 L 4.5 51 L 37 85 L 95 23 Z;
    }
    :host([mixed]) #indicator {
      --path-data: M 87 42.6 L 13 42.6 L 13 57.4 L 87 57.4 L 87 42.6 Z;
    }

    /* Checkmark icon */

    #checkmark {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      overflow: visible;
      transition-property: opacity;
      transition-timing-function: inherit;
      transition-duration: inherit;
    }
    :host([mixed]) #checkmark {
      opacity: 1;
    }
    :host([toggled]) #checkmark {
      opacity: 1;
    }

    #checkmark-path {
      fill: currentColor;
    }

    /**
     * Description
     */

    #description {
      flex: 1;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default null
  //
  // Value associated with this checkbox.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

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

  #xelThemeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XCheckboxElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XCheckboxElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("pointerenter", () => this.#onPointerEnter());
    this.addEventListener("pointerleave", () => this.#onPointerLeave());
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  async connectedCallback() {
    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updateCheckmarkPathData());

    this.#updateAccessabilityAttributes();

    // @bugfix: Small delay is needed in order to make getComputedStyle() work properly on WebKit
    if (getBrowserEngine() === "webkit") {
      await sleep(10);

      if (this.isConnected === false) {
        return;
      }
    }

    Xel.whenThemeReady.then(() => {
      this.#updateCheckmarkPathData();
    });
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "toggled") {
      this.#onToggledAttributeChange();
    }
    else if (name === "mixed") {
      this.#onMixedAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateCheckmarkPathData() {
    let pathData = getComputedStyle(this["#indicator"]).getPropertyValue("--path-data");
    this["#checkmark-path"].setAttribute("d", pathData);
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "checkbox");
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
    this.#updateCheckmarkPathData();
    this.setAttribute("aria-toggled", this.mixed ? "mixed" : this.toggled);
  }

  #onMixedAttributeChange() {
    this.#updateCheckmarkPathData();
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

  async #onClick(event) {
    // Update state
    {
      if (this.mixed) {
        this.mixed = false;
      }
      else {
        this.toggled = !this.toggled;
      }

      this.dispatchEvent(new CustomEvent("toggle", {bubbles: true}));
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      event.preventDefault();
      this.click();
    }
  }
};

customElements.define("x-checkbox", XCheckboxElement);
