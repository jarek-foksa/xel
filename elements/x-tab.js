
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-tab
// @part selection-indicator - Horizontal line indicating that the tab is selected.
export default class XTabElement extends HTMLElement {
  static observedAttributes = ["selected", "disabled", "size"];

  static #shadowTemplate = html`
    <template>
      <div id="ripples"></div>
      <div id="selection-indicator" part="selection-indicator"></div>
      <div id="content">
        <slot></slot>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 30px;
      padding: 2px 12px;
      box-sizing: border-box;
      cursor: default;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      font-size: 14px;
      --trigger-effect: none; /* ripple, none */
    }
    :host(:focus) {
      z-index: 10;
      outline: none;
    }

    #content {
      display: inherit;
      flex-flow:inherit;
      align-items: inherit;
      z-index: 100;
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
      overflow: hidden;
      pointer-events: none;
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
      transform: none;
      transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
      will-change: opacity, transform;
      pointer-events: none;
    }

    /**
     * Selection indicator
     */

    #selection-indicator {
      display: none;
      width: 100%;
      height: 0px;
      background: var(--accent-color);
      position: absolute;
      bottom: 0;
      left: 0;
    }
    :host([selected]) #selection-indicator {
      display: block;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
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

  #shadowRoot = null;
  #elements = {};
  #xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTabElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTabElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.addEventListener("click", (event) => this.#onClick(event));
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
    this.#updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
  }

  attributeChangedCallback(name) {
    if (name === "selected") {
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
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "tab");
    this.setAttribute("aria-selected", this.selected);
    this.setAttribute("aria-disabled", this.disabled);
    this.setAttribute("tabindex", this.selected ? "0" : "-1");
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

  async #onPointerDown(pointerDownEvent) {
    // Don't focus the tab with pointer
    if (this.matches(":focus") === false) {
      pointerDownEvent.preventDefault();

      let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

      if (ancestorFocusableElement) {
        ancestorFocusableElement.focus();
      }
    }

    if (pointerDownEvent.buttons > 1) {
      return;
    }

    // Provide "pressed" attribute for theming purposes
    {
      let pointerDownTimeStamp = Date.now();

      this.setAttribute("pressed", "");
      this.setPointerCapture(pointerDownEvent.pointerId);

      this.addEventListener("pointerup", async (event) => {
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
        let bounds = this.#elements["ripples"].getBoundingClientRect();
        let size = max(bounds.width, bounds.height) * 1.5;
        let top  = pointerDownEvent.clientY - bounds.y - size/2;
        let left = pointerDownEvent.clientX - bounds.x - size/2;
        let whenPointerUp = new Promise((r) => this.addEventListener("pointerup", r, {once: true}));

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);
        this.#elements["ripples"].append(ripple);

        this.setPointerCapture(pointerDownEvent.pointerId);

        // Workaround for tabs that that change their color when selected
        ripple.hidden = true;
        await sleep(10);
        ripple.hidden = false;

        let inAnimation = ripple.animate(
          { transform: ["scale(0)", "scale(1)"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await whenPointerUp;
        await inAnimation.finished;

        let fromOpacity = getComputedStyle(ripple).opacity;

        let outAnimation = ripple.animate(
          { opacity: [fromOpacity, "0"]},
          { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
        );

        await outAnimation.finished;

        ripple.remove();
      }
    }
  }

  async #onClick(event) {
    // Ripple
    if (this.#elements["ripples"].querySelector(".pointer-down-ripple") === null) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      if (triggerEffect === "ripple") {
        let bounds = this.#elements["ripples"].getBoundingClientRect();
        let size = max(bounds.width, bounds.height) * 1.5;
        let top  = (bounds.y + bounds.height/2) - bounds.y - size/2;
        let left = (bounds.x + bounds.width/2) - bounds.x - size/2;

        let ripple = createElement("div");
        ripple.setAttribute("part", "ripple");
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
}

customElements.define("x-tab", XTabElement);
