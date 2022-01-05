
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";;

import {createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-menuitem
// @event ^toggle - User toggled on or off the menu item.
// @part checkmark - Checkmark icon shown when the menu item is toggled.
// @part arrow - Arrow icon shown when the menu item contains a submenu.
export default class XMenuItemElement extends HTMLElement {
  static observedAttributes = ["disabled", "size"];

  static _shadowTemplate = html`
    <template>
      <div id="ripples"></div>

      <svg id="checkmark" part="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path></path>
      </svg>

      <slot></slot>

      <svg id="arrow" part="arrow" viewBox="0 0 100 100" hidden>
        <path></path>
      </svg>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: flex;
      flex-flow: row;
      align-items: center;
      position: relative;
      padding: 0 12px 0 23px;
      min-height: 28px;
      box-sizing: border-box;
      cursor: default;
      user-select: none;
      --trigger-effect: blink; /* ripple, blink, none */
    }
    :host([hidden]) {
      display: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.6;
    }
    :host(:focus) {
      outline: none;
    }
    :host-context([debug]):host(:focus) {
      outline: 2px solid red;
    }

    /**
     * Ripples
     */

    #ripples {
      position: absolute;
      z-index: 0;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      contain: strict;
      overflow: hidden;
    }

    #ripples .ripple {
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: 200px;
      background: currentColor;
      opacity: 0.1;
      border-radius: 999px;
      transform: none;
      transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: opacity, transform;
      pointer-events: none;
    }

    /**
     * Checkmark
     */

    #checkmark {
      display: none;
      transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
      align-self: center;
      width: 18px;
      height: 18px;
      margin: 0 2px 0 -20px;
      d: path("M 44 61 L 29 47 L 21 55 L 46 79 L 79 27 L 70 21 L 44 61 Z");
      color: inherit;
    }
    :host([togglable]) #checkmark {
      display: flex;
      transform: scale(0);
      transform-origin: 50% 50%;
    }
    :host([toggled]) #checkmark {
      display: flex;
      transform: scale(1);
    }

    #checkmark path {
      d: inherit;
      fill: currentColor;
    }

    /**
     * Arrow
     */

    #arrow {
      display: flex;
      width: 16px;
      height: 16px;
      transform: scale(1.1);
      align-self: center;
      margin-left: 8px;
      d: path("M 26 20 L 26 80 L 74 50 Z");
      opacity: 1;
      color: inherit;
    }
    #arrow[hidden] {
      display: none;
    }

    #arrow path {
      d: inherit;
      fill: currentColor;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string?
  // @default null
  //
  // Value associated with this menu item (usually the command name).
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : null;
  }
  set value(value) {
    if (this.value !== value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }
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
  get togglable() {
    return this.hasAttribute("togglable");
  }
  set togglable(togglable) {
    togglable ? this.setAttribute("togglable", "") : this.removeAttribute("togglable");
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

  // @property
  // @type Promise
  //
  // Promise that is resolved when any trigger effects (such ripples or blinking) are finished.
  get whenTriggerEnd() {
    return new Promise((resolve) => {
      if (this._elements["ripples"].childElementCount === 0 && this._triggering === false) {
        resolve();
      }
      else {
        this._triggerEndCallbacks.push(resolve);
      }
    });
  }

  _shadowRoot = null;
  _elements = {};
  _lastTabIndex = 0;
  _triggering = false;
  _triggerEndCallbacks = [];
  _wasFocused = false;
  _xelSizeChangeListener = null;
  _observer = new MutationObserver(() => this._updateArrowIconVisibility());

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XMenuItemElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XMenuItemElement._shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }
  }

  connectedCallback() {
    this._updateArrowIconVisibility();
    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();

    this._observer.observe(this, {childList: true, attributes: false, characterData: false, subtree: false});
    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    this._observer.disconnect();
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._updateAccessabilityAttributes();
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateArrowIconVisibility() {
    if (this.parentElement.localName === "x-menubar") {
      this._elements["arrow"].setAttribute("hidden", "");
    }
    else {
      let menu = this.querySelector("x-menu");

      if (menu) {
        this._elements["arrow"].removeAttribute("hidden");
      }
      else {
        this._elements["arrow"].setAttribute("hidden", "");
      }
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "menuitem");
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

  async _onPointerDown(pointerDownEvent) {
    this._wasFocused = this.matches(":focus");

    if (pointerDownEvent.buttons !== 1) {
      return false;
    }

    if (this.matches("[closing] x-menuitem")) {
      pointerDownEvent.preventDefault();
      pointerDownEvent.stopPropagation();
      return;
    }

    if (pointerDownEvent.target.closest("x-menuitem") !== this) {
      return;
    }

    this.setPointerCapture(pointerDownEvent.pointerId);

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 150ms.
    {
      let pointerDownTimeStamp = Date.now();
      let isDown = true;

      this.addEventListener("lostpointercapture", async () => {
        isDown = false;
        let pressedTime = Date.now() - pointerDownTimeStamp;
        let minPressedTime = (pointerDownEvent.pointerType === "touch") ? 600 : 150;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        this.removeAttribute("pressed");
      }, {once: true});

      if (isDown) {
        this.setAttribute("pressed", "");
      }
    }

    // Trigger effect
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this._elements["ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this._elements["ripples"].append(ripple);

        this.setPointerCapture(pointerDownEvent.pointerId);

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await whenLostPointerCapture;
        await inAnimation.finished;

        let outAnimation = ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await outAnimation.finished;
        ripple.remove();

        if (this._elements["ripples"].childElementCount === 0) {
          for (let callback of this._triggerEndCallbacks) {
            callback();
          }
        }
      }
    }
  }

  async _onClick(event) {
    if (
      event.button > 0 ||
      event.target.closest("x-menuitem") !== this ||
      event.target.closest("x-menu") !== this.closest("x-menu") ||
      this.matches("[closing] x-menuitem")
    ) {
      return;
    }

    if (this.togglable) {
      let event = new CustomEvent("toggle", {bubbles: true, cancelable: true});
      this.dispatchEvent(event);

      if (event.defaultPrevented === false) {
        this.toggled = !this.toggled;
      }
    }

    // Trigger effect
    if (!this.querySelector(":scope > x-menu")) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        if (this._elements["ripples"].querySelector(".pointer-down-ripple") === null) {
          let rect = this._elements["ripples"].getBoundingClientRect();
          let size = max(rect.width, rect.height) * 1.5;
          let top  = (rect.y + rect.height/2) - rect.y - size/2;
          let left = (rect.x + rect.width/2) - rect.x - size/2;

          let ripple = createElement("div");
          ripple.setAttribute("part", "ripple");
          ripple.setAttribute("class", "ripple click-ripple");
          ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
          this._elements["ripples"].append(ripple);

          let inAnimation = ripple.animate(
            { transform: ["scale3d(0, 0, 0)", "none"]},
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await inAnimation.finished;

          let outAnimation = ripple.animate(
            { opacity: [getComputedStyle(ripple).opacity, "0"] },
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await outAnimation.finished;

          ripple.remove();

          if (this._elements["ripples"].childElementCount === 0) {
            for (let callback of this._triggerEndCallbacks) {
              callback();
            }

            this._triggerEndCallbacks = [];
          }
        }
      }

      else if (triggerEffect === "blink") {
        this._triggering = true;

        if (this._wasFocused) {
          this.parentElement.focus();
          await sleep(150);
          this.focus();
          await sleep(150);
        }
        else {
          this.focus();
          await sleep(150);
          this.parentElement.focus();
          await sleep(150);
        }

        for (let callback of this._triggerEndCallbacks) {
          callback();
        }

        this._triggerEndCallbacks = [];
        this._triggering = false;
      }

      else if (triggerEffect === "none") {
        this._triggering = true;
        await sleep(150);

        for (let callback of this._triggerEndCallbacks) {
          callback();
        }

        this._triggerEndCallbacks = [];
        this._triggering = false;
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();

      if (!this.querySelector("x-menu")) {
        event.stopPropagation();
        this.click();
      }
    }
  }
}

customElements.define("x-menuitem", XMenuItemElement);
