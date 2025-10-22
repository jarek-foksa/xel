
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";

/**
 * @element x-radio
 * @part indicator
 * @part indicator-dot
 * @fires ^toggle - User toggled the radio on or off
 */
export default class XRadioElement extends HTMLElement {
  static observedAttributes = ["toggled", "disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="main">
        <div id="indicator" part="indicator">
          <div id="indicator-dot" part="indicator-dot"></div>
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
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Value associated with this widget.
   *
   * @property
   * @attribute
   * @type {string | null}
   * @default null
   */
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  /**
   * Whether the widget is toggled.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  /**
   * Whether the widget in in "mixed" state.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

  /**
   * Whether the widget is disabled.
   *
   * @property
   * @attribute
   * @type {boolean}
   * @default false
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  /**
   * @property
   * @attribute
   * @type {"small" | "large" | null}
   * @default null
   */
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
    this.#shadowRoot.adoptedStyleSheets = [XRadioElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XRadioElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "toggled") {
      this.#onToggledAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "radio");
    this.setAttribute("aria-checked", this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (!this.closest("x-radios")) {
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
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onToggledAttributeChange() {
    this.setAttribute("aria-checked", this.toggled);
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  #onClick() {
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

  #onPointerDown(event) {
    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      event.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      event.preventDefault();
      this.click();
    }
  }
};

customElements.define("x-radio", XRadioElement);
