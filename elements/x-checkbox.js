
// @info
//   Checkbox widget.
// @doc
//   http://w3c.github.io/aria-practices/#checkbox
// @copyright
//   © 2016-2017 Jarosław Foksa

import {createElement, closest, html} from "../utils/element.js";

let easing = "cubic-bezier(0.4, 0, 0.2, 1)";
let $oldTabIndex = Symbol();

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        position: relative;
        margin: 0 8px 0 0;
        width: 24px;
        height: 24px;
        box-sizing: border-box;
        border: 2px solid currentColor;
        --checkmark-width: 100%;
        --checkmark-height: 100%;
        --checkmark-opacity: 0;
        --checkmark-d: path(
          "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z M 95 23 L 86 13 L 37 66 L 13.6 41 L 4.5 51 L 37 85 L 95 23 Z"
        );
        --ripple-type: none; /* unbounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.15;
      }
      :host([toggled]) {
        --checkmark-opacity: 1;
      }
      :host([mixed]) {
        --checkmark-opacity: 1;
        --checkmark-d: path("M 0 0 L 100 0 L 100 100 L 0 100 Z M 87 42.6 L 13 42.6 L 13 57.4 L 87 57.4 Z");
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

      /**
       * Icons
       */

      #checkmark {
        position: absolute;
        top: 0;
        left: 0;
        width: var(--checkmark-width);
        height: var(--checkmark-height);
        opacity: var(--checkmark-opacity);
        d: var(--checkmark-d);
        transition-property: opacity;
        transition-timing-function: inherit;
        transition-duration: inherit;
      }

      #checkmark path {
        fill: currentColor;
        d: inherit;
      }

      /**
       * Ripples
       */

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
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        z-index: -1;
        will-change: opacity, transform;
        border-radius: 999px;
        transform: scale(2.6);
      }
    </style>

    <div id="ripples"></div>

    <svg id="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
      <path></path>
    </svg>
  </template>
`;

// @events
//   toggle
export class XCheckboxElement extends HTMLElement {
  static get observedAttributes() {
    return ["toggled", "disabled"];
  }

  // @info
  //   Values associated with this checkbox.
  // @type
  //   string
  // @default
  //   null
  // @attribute
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
  }

  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
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

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this._updateAccessabilityAttributes();
  }

  attributeChangedCallback(name) {
    if (name === "toggled") {
      this._onToggledAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "checkbox");
    this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this[$oldTabIndex] = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this[$oldTabIndex] > 0) ? this[$oldTabIndex] : 0;
      }

      delete this[$oldTabIndex];
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
      let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

      if (rippleType === "unbounded") {
        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        this["#ripples"].append(ripple);

        let transformAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(2.6)"] },
          { duration: 200, easing }
        );

        this.setPointerCapture(event.pointerId);

        this.addEventListener("lostpointercapture", async () => {
          await transformAnimation.finished;

          let opacityAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 200, easing }
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
    if (this["#ripples"].querySelector(".pointer-down-ripple") === null) {
      let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

      if (rippleType === "unbounded") {
        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple");
        this["#ripples"].append(ripple);

        await ripple.animate(
          { transform: ["scale(0)", "scale(2.6)"] },
          { duration: 300, easing }
        ).finished;

        await ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"] },
          { duration: 300, easing }
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
