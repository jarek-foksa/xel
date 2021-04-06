
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-radio
// @part indicator
// @part indicator-dot
// @event ^toggle - User toggled the radio on or offf
export default class XRadioElement extends HTMLElement {
  static observedAttributes = ["toggled", "disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <main id="main">
        <div id="indicator" part="indicator">
          <div id="indicator-dot" part="indicator-dot"></div>
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
      position: relative;
      width: fit-content;
    }
    :host(:focus) {
      outline: none;
    }
    :host([disabled]) {
      opacity: 0.4;
      pointer-events: none;
    }
    :host([hidden]) {
      display: none;
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
      border: 3px solid black;
      width: 19px;
      height: 19px;
      border-radius: 99px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Dot icon */

    #indicator-dot {
      width: 100%;
      height: 100%;
      background: currentColor;
      border-radius: 99px;
      transform: scale(0);
    }
    :host([mixed][toggled]) #indicator-dot {
      height: 33%;
      border-radius: 0;
    }
    :host([toggled]) #indicator-dot {
      transform: scale(0.5);
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
  // @default ""
  //
  // Value associated with this widget.
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
    this._shadowRoot.adoptedStyleSheets = [XRadioElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XRadioElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
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
    this.setAttribute("role", "radio");
    this.setAttribute("aria-checked", this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (!this.closest("x-radios")) {
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
    this.setAttribute("aria-checked", this.toggled);
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onClick(event) {
    if (!this.closest("x-radios")) {
      if (this.toggled && this.mixed) {
        this.mixed = false;
      }
      else {
        this.mixed = false;
        this.toggled = !this.toggled;
      }

      this.dispatchEvent(new CustomEvent("toggle", {bubbles: true}));
    }
  }

  _onPointerDown(event) {
    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
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

customElements.define("x-radio", XRadioElement);
