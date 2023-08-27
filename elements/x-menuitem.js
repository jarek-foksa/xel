
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-menuitem
// @event ^toggle - User toggled on or off the menu item.
// @part checkmark - Checkmark icon shown when the menu item is toggled.
// @part arrow - Arrow icon shown when the menu item contains a submenu.
export default class XMenuItemElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <svg id="checkmark" part="checkmark" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="checkmark-path"></path>
      </svg>

      <slot></slot>

      <svg id="arrow" part="arrow" viewBox="0 0 100 100" hidden>
        <path id="arrow-path"></path>
      </svg>
    </template>
  `;

  static #shadowStyleSheet = css`
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
      -webkit-user-select: none;
      --trigger-effect: blink; /* blink, none */
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
     * Checkmark
     */

    #checkmark {
      display: none;
      transition: transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
      align-self: center;
      width: 18px;
      height: 18px;
      margin: 0 2px 0 -20px;
      color: inherit;
      --path-data: M 44 61 L 29 47 L 21 55 L 46 79 L 79 27 L 70 21 L 44 61 Z;
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

    #checkmark-path {
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
      opacity: 1;
      color: inherit;
      --path-data: M 26 20 L 26 80 L 74 50 Z;
    }
    #arrow[hidden] {
      display: none;
    }

    #arrow path {
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
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  // @property
  // @type Promise
  //
  // Promise that is resolved when any trigger effects (such as blinking) are finished.
  get whenTriggerEnd() {
    return new Promise((resolve) => {
      if (this.#triggering === false) {
        resolve();
      }
      else {
        this.#triggerEndCallbacks.push(resolve);
      }
    });
  }

  #shadowRoot = null;
  #elements = {};
  #lastTabIndex = 0;
  #triggering = false;
  #triggerEndCallbacks = [];
  #wasFocused = false;
  #xelThemeChangeListener = null;
  #observer = new MutationObserver(() => this.#updateArrowIconVisibility());

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XMenuItemElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XMenuItemElement.#shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }
  }

  connectedCallback() {
    this.#updateCheckmarkPathData();
    this.#updateArrowPathData();
    this.#updateArrowIconVisibility();
    this.#updateAccessabilityAttributes();

    this.#observer.observe(this, {childList: true, attributes: false, characterData: false, subtree: false});

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#onThemeChange());
  }

  disconnectedCallback() {
    this.#observer.disconnect();

    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateCheckmarkPathData() {
    let pathData = getComputedStyle(this.#elements["checkmark"]).getPropertyValue("--path-data");
    this.#elements["checkmark-path"].setAttribute("d", pathData);
  }

  #updateArrowPathData() {
    let pathData = getComputedStyle(this.#elements["arrow"]).getPropertyValue("--path-data");
    this.#elements["arrow-path"].setAttribute("d", pathData);
  }

  #updateArrowIconVisibility() {
    if (this.parentElement.localName === "x-menubar") {
      this.#elements["arrow"].setAttribute("hidden", "");
    }
    else {
      let menu = this.querySelector("x-menu");

      if (menu) {
        this.#elements["arrow"].removeAttribute("hidden");
      }
      else {
        this.#elements["arrow"].setAttribute("hidden", "");
      }
    }
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "menuitem");
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

  #onThemeChange() {
    this.#updateCheckmarkPathData();
    this.#updateArrowPathData();
  }

  async #onPointerDown(pointerDownEvent) {
    this.#wasFocused = this.matches(":focus");

    if (pointerDownEvent.buttons > 1) {
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
      let isDown = true;
      let pointerDownTimeStamp = Date.now();
      let pointerUpListener;

      this.addEventListener("pointerup", pointerUpListener = async () => {
        this.removeEventListener("pointerup", pointerUpListener);
        this.removeEventListener("lostpointercapture", pointerUpListener);

        isDown = false;
        let pressedTime = Date.now() - pointerDownTimeStamp;
        let minPressedTime = (pointerDownEvent.pointerType === "touch") ? 600 : 150;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        this.removeAttribute("pressed");
      });

      // @bugfix: https://boxy-svg.com/bugs/224
      this.addEventListener("lostpointercapture", pointerUpListener);

      if (isDown) {
        this.setAttribute("pressed", "");
      }
    }
  }

  async #onClick(event) {
    if (
      event.buttons > 1 ||
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

      if (triggerEffect === "blink") {
        this.#triggering = true;

        if (this.#wasFocused) {
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

        for (let callback of this.#triggerEndCallbacks) {
          callback();
        }

        this.#triggerEndCallbacks = [];
        this.#triggering = false;
      }

      else if (triggerEffect === "none") {
        this.#triggering = true;

        await sleep(50);

        for (let callback of this.#triggerEndCallbacks) {
          callback();
        }

        this.#triggerEndCallbacks = [];
        this.#triggering = false;
      }
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      event.preventDefault();

      if (!this.querySelector("x-menu")) {
        event.stopPropagation();
        this.click();
      }
    }
  }
}

customElements.define("x-menuitem", XMenuItemElement);
