
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {createElement, closest} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-doctab
// @event close
// @part selection-indicator
// @part close-button
export default class XDocTabElement extends HTMLElement {
  static observedAttributes = ["selected", "disabled", "size"];

  static #shadowTemplate = html`
    <template>
      <div id="ripples"></div>
      <div id="selection-indicator" part="selection-indicator"></div>

      <slot></slot>

      <svg id="close-button" part="close-button" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="close-button-path"></path>
      </svg>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 100%;
      height: 100%;
      min-width: 1px;
      max-width: 220px;
      padding: 0 18px;
      flex: 1 0 0;
      transition-property: max-width, padding, order;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0.0, 0.2, 1);
      cursor: default;
      user-select: none;
      touch-action: pan-y;
      box-sizing: border-box;
      will-change: max-width;
      z-index: 0;
      -webkit-app-region: no-drag;
      --trigger-effect: none; /* ripple, none */
    }
    :host(:focus) {
      outline: none;
    }
    :host([closing]) {
      pointer-events: none;
    }
    :host([selected]) {
      z-index: 1;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }

    /**
     * Close button
     */

    #close-button {
      display: flex;
      align-items: center;
      justify-content: center;
      position: static;
      left: 0;
      right: initial;
      width: 18px;
      height: 18px;
      margin: 0 0 0 auto;
      opacity: 0.8;
      padding: 1px;
      d: path("M 74 31 L 69 26 L 50 45 L 31 26 L 26 31 L 45 50 L 26 69 L 31 74 L 50 55 L 69 74 L 74 69 L 55 50 Z");
    }
    :host([edited]) #close-button {
      d: path("M 68 50 C 68 60 60 68 50 68 C 40 68 32 60 32 50 C 32 40 40 32 50 32 C 60 32 68 40 68 50 Z");
    }
    #close-button:hover {
      background: rgba(0, 0, 0, 0.08);
      opacity: 1;
    }

    #close-button-path {
      pointer-events: none;
      d: inherit;
      fill: currentColor;
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
      overflow: hidden;
      z-index: -1;
      contain: strict;
    }

    #ripples .ripple {
      position: absolute;
      top: 0;
      left: 0;
      width: 200px;
      height: 200px;
      background: currentColor;
      opacity: 0.2;
      border-radius: 999px;
      will-change: opacity, transform;
      pointer-events: none;
    }

    /**
     * Selection indicator
     */

    #selection-indicator {
      display: none;
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 0;
      pointer-events: none;
    }
    :host([selected]) #selection-indicator {
      display: block;
    }
    :host([animatingindicator]) #selection-indicator {
      display: block;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  //
  // Value associated with this tab.
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get selected() {
    return this.hasAttribute("selected");
  }
  set selected(selected) {
    selected ? this.setAttribute("selected", "") : this.removeAttribute("selected");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get edited() {
    return this.hasAttribute("edited");
  }
  set edited(edited) {
    edited ? this.setAttribute("edited", "") : this.removeAttribute("edited");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled === true ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
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

  // @property readOnly
  // @type XDocTabsElement
  // @readOnly
  get ownerTabs() {
    return this.closest("x-doctabs");
  }

  #shadowRoot = null;
  #elements = {};
  #xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XDocTabElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XDocTabElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.addEventListener("pointerdown", (e) => this.#onPointerDown(e));
    this.addEventListener("click", (e) => this.#onClick(e));
    this.#elements["close-button"].addEventListener("pointerdown", (e) => this.#onCloseButtonPointerDown(e));
    this.#elements["close-button"].addEventListener("click", (e) => this.#onCloseButtonClick(e));
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
    this.#updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "selected") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "size") {
      this.#updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  animateSelectionIndicator(toTab) {
    return new Promise(async (resolve) => {
      if (this.#elements["selection-indicator"].style.height !== "0px") {
        let fromBBox = this.getBoundingClientRect();
        let toBBox = toTab.getBoundingClientRect();

        this.setAttribute("animatingindicator", "");

        let animation = this.#elements["selection-indicator"].animate(
          [
            {
              left: 0 + "px",
              width: fromBBox.width + "px",
            },
            {
              left: (toBBox.left - fromBBox.left) + "px",
              width: toBBox.width + "px",
            }
          ],
          {
            duration: 100,
            iterations: 1,
            delay: 0,
            easing: "cubic-bezier(0.4, 0.0, 0.2, 1)"
          }
        );

        await animation.finished;
        this.removeAttribute("animatingindicator");
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
    this.setAttribute("role", "tab");
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("aria-disabled", this.disabled);
  }

  #updateComputedSizeAttriubte() {
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

  #onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      pointerDownEvent.preventDefault();
      return;
    }

    // Don't focus the widget with pointer, instead focus the closest ancestor focusable element
    if (this.matches(":focus") === false) {
      pointerDownEvent.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    // Provide "pressed" attribute for theming purposes
    {
      let pointerDownTimeStamp = Date.now();

      this.setAttribute("pressed", "");
      this.setPointerCapture(pointerDownEvent.pointerId);

      this.addEventListener("lostpointercapture", async (event) => {
        if (this.selected === true) {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }
        }

        this.removeAttribute("pressed");
      }, {once: true});
    }

    // Ripple
    {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this.#elements["ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this.#elements["ripples"].append(ripple);

        let inAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(1)"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        // Pointer capture is set on the owner tabs rather than this tab intentionally. Owner tabs might be
        // already capturing the pointer and hijacking it would disrupt the currently performed tab move
        // operation.
        this.ownerTabs.setPointerCapture(pointerDownEvent.pointerId);

        this.ownerTabs.addEventListener("lostpointercapture", async () => {
          await inAnimation.finished;

          let fromOpacity = getComputedStyle(ripple).opacity;

          let outAnimation = ripple.animate(
            { opacity: [fromOpacity, "0"]},
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );

          await outAnimation.finished;

          ripple.remove();
        }, {once: true});
      }
    }
  }

  async #onClick(event) {
    if (event.button !== 0) {
      return;
    }

    // Ripple
    if (this.#elements["ripples"].querySelector(".pointer-down-ripple") === null) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let rect = this.#elements["ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = (rect.y + rect.height/2) - rect.y - size/2;
        let left = (rect.x + rect.width/2) - rect.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("class", "ripple click-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this.#elements["ripples"].append(ripple);

        let inAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(1)"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await inAnimation.finished;

        let fromOpacity = getComputedStyle(ripple).opacity;

        let outAnimation = ripple.animate(
          { opacity: [fromOpacity, "0"] },
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await outAnimation.finished;

        ripple.remove();
      }
    }
  }

  #onCloseButtonPointerDown(event) {
    if (event.buttons !== 1) {
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

    event.stopPropagation();
  }

  #onCloseButtonClick(event) {
    if (event.button !== 0) {
      return;
    }

    event.stopPropagation();

    let customEvent = new CustomEvent("close", {bubbles: true, cancelable: true, detail: this});
    this.dispatchEvent(customEvent);

    if (customEvent.defaultPrevented === false) {
      this.ownerTabs.closeTab(this);
    }
  }
};

customElements.define("x-doctab", XDocTabElement);
