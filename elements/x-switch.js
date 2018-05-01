
// @info
//   Switch widget.
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html, createElement, closest} from "../utils/element.js";

let easing = "cubic-bezier(0.4, 0, 0.2, 1)";
let $oldTabIndex = Symbol()

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 30px;
        height: 18px;
        margin: 0 8px 0 0;
        box-sizing: border-box;
        display: flex;
        --focus-ring-color: currentColor;
        --focus-ring-opacity: 0.2;
        --focus-ring-width: 10px;
        --focus-ring-transition-duration: 0.15s;
        --ripple-type: none; /* unbounded, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.2;
        --thumb-color: currentColor;
        --thumb-size: 20px;
        --thumb-border-radius: 999px;
        --track-height: 65%;
        --track-color: currentColor;
        --track-opacity: 0.5;
        --track-border-radius: 999px;
      }
      :host([disabled]) {
        opacity: 0.5;
        pointer-events: none;
      }
      :host(:focus) {
        outline: none;
      }

      #main {
        width: 100%;
        height: 100%;
        position: relative;
      }

      /**
       * Track
       */

      #track {
        width: 100%;
        height: var(--track-height);
        background: var(--track-color);
        opacity: var(--track-opacity);
        border-radius: var(--track-border-radius);
      }

      /**
       * Thumb
       */

      #thumb {
        position: absolute;
        left: 0px;
        width: var(--thumb-size);
        height: var(--thumb-size);
        background: var(--thumb-color);
        border-radius: var(--thumb-border-radius);
        transition: left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host([toggled]) #thumb {
        left: calc(100% - var(--thumb-size));
      }
      :host([mixed]) #thumb {
        left: calc(50% - var(--thumb-size) / 2);
      }

      /**
       * Focus ring
       */

      #focus-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        width: var(--thumb-size);
        height: var(--thumb-size);
        transform: translate(-50%, -50%);
        background: transparent;
        border: 0px solid var(--focus-ring-color);
        border-radius: 999px;
        opacity: var(--focus-ring-opacity);
        transition: border-width var(--focus-ring-transition-duration) cubic-bezier(0.4, 0, 0.2, 1);
      }
      :host(:focus) #thumb #focus-ring {
        border-width: var(--focus-ring-width);
      }

      /**
       * Ripples
       */

      #ripples .ripple {
        position: absolute;
        top: 50%;
        left: 50%;
        width: calc(var(--thumb-size) + 22px);
        height: calc(var(--thumb-size) + 22px);
        transform: translate(-50%, -50%);
        background: var(--ripple-background);
        border-radius: 999px;
        opacity: var(--ripple-opacity);
      }
    </style>

    <x-box id="main">
      <div id="track"></div>

      <div id="thumb">
        <div id="focus-ring"></div>
        <div id="ripples"></div>
      </div>
    </x-box>
  </template>
`;

// @events
//   toggle
export class XSwitchElement extends HTMLElement {
  static get observedAttributes() {
    return ["toggled", "disabled"];
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

    this._shadowRoot = this.attachShadow({mode: "closed"});
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
    this.setAttribute("role", "switch");
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
    this.setAttribute("aria-checked", this.mixed ? "mixed" : this.toggled);
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
        ripple.setAttribute("class", "ripple");
        this["#ripples"].append(ripple);

        let transformAnimation = ripple.animate(
          { transform: ["translate(-50%, -50%) scale(0)", "translate(-50%, -50%) scale(1)"] },
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

      this.dispatchEvent(new CustomEvent("toggle"));
    }

    // Ripple
    if (event.isTrusted === false) {
      let rippleType = getComputedStyle(this).getPropertyValue("--ripple-type").trim();

      if (rippleType === "unbounded") {
        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple");
        this["#ripples"].append(ripple);

        await ripple.animate(
          { transform: ["translate(-50%, -50%) scale(0)", "translate(-50%, -50%) scale(1)"] },
          { duration: 200, easing }
        ).finished;

        await ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"] },
          { duration: 200, easing }
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

customElements.define("x-switch", XSwitchElement);
