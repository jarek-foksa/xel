
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-checkbox
// @part indicator
// @event toggle
export default class XCheckboxElement extends HTMLElement {
  static observedAttributes = ["toggled", "disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <main id="main">
        <div id="indicator" part="indicator">
          <div id="ripples"></div>

          <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path></path>
          </svg>
        </div>

        <div id="description">
          <slot></slot>
        </div>
      </main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      width: fit-content;
      --trigger-effect: none; /* none, ripple */
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
      d: path("M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z M 95 23 L 86 13 L 37 66 L 13.6 41 L 4.5 51 L 37 85 L 95 23 Z");
    }
    :host([mixed]) #indicator {
      d: path("M 0 0 L 100 0 L 100 100 L 0 100 Z M 87 42.6 L 13 42.6 L 13 57.4 L 87 57.4 Z");
    }

    /* Checkmark icon */

    #checkmark {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      d: inherit;
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

    #checkmark path {
      fill: currentColor;
      d: inherit;
    }

    /* Ripples */

    #ripples {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    #ripples .ripple {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: currentColor;
      opacity: 0.15;
      z-index: -1;
      will-change: opacity, transform;
      border-radius: 999px;
      transform: scale(2.6);
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

  _shadowRoot = null;
  _elements = {};
  _lastTabIndex = 0;
  _xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XCheckboxElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XCheckboxElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());

    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "toggled") {
      this._onToggledAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "checkbox");
    this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this._lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this._lastTabIndex > 0) ? this._lastTabIndex : 0;
      }

      this._lastTabIndex = 0;
    }
  }

  _updateComputedSizeAttriubte() {
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onToggledAttributeChange() {
    this.setAttribute("aria-toggled", this.mixed ? "mixed" : this.toggled);
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onPointerDown(event) {
    if (event.buttons !== 1) {
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

    // Ripple
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        this._elements["ripples"].append(ripple);

        let transformAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(2.6)"] },
          { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        this.setPointerCapture(event.pointerId);

        this.addEventListener("lostpointercapture", async () => {
          await transformAnimation.finished;

          let opacityAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await opacityAnimation.finished;

          ripple.remove();
        }, {once: true});
      }
    }
  }

  async _onClick(event) {
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

    // Ripple
    if (this._elements["ripples"].querySelector(".pointer-down-ripple") === null) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple");
        this._elements["ripples"].append(ripple);

        await ripple.animate(
          { transform: ["scale(0)", "scale(2.6)"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        ).finished;

        await ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        ).finished;

        ripple.remove();
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.click();
    }
  }
};

customElements.define("x-checkbox", XCheckboxElement);
