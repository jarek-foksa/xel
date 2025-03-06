
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

let {max} = Math;

// @element x-tab
// @part selection-indicator - Horizontal line indicating that the tab is toggled.
export default class XTabElement extends HTMLElement {
  static observedAttributes = ["toggled", "disabled"];

  static #shadowTemplate = html`
    <template>
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
      font-size: 0.875rem;
    }
    :host(:focus) {
      z-index: 10;
      outline: none;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }

    #content {
      display: inherit;
      flex-flow:inherit;
      align-items: inherit;
      z-index: 100;
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
    :host([toggled]) #selection-indicator {
      display: block;
    }
  `;

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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTabElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTabElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "toggled") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  animateSelectionIndicator(toTab) {
    return new Promise(async (resolve) => {
      if (getComputedStyle(this["#selection-indicator"]).height !== "0px") {
        let fromBBox = this.getBoundingClientRect();
        let toBBox = toTab.getBoundingClientRect();
        let computedStyle = getComputedStyle(this["#selection-indicator"]);
        let transitionDuration = parseFloat(computedStyle.getPropertyValue("transition-duration") || "0s") * 1000;
        let transitionTimingFunction = computedStyle.getPropertyValue("transition-timing-function") || "linear";

        let animation = this["#selection-indicator"].animate(
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
            duration: transitionDuration,
            easing: transitionTimingFunction,
            iterations: 1,
            delay: 0
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
    this.setAttribute("aria-selected", this.toggled);
    this.setAttribute("aria-disabled", this.disabled);
    this.setAttribute("tabindex", this.toggled ? "0" : "-1");
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

    this.setPointerCapture(pointerDownEvent.pointerId);

    // Provide "pressed" attribute for theming purposes
    {
      let pointerDownTimeStamp = Date.now();
      let pointerUpOrCancelListener;

      this.setAttribute("pressed", "");

      this.addEventListener("pointerup", pointerUpOrCancelListener = async () => {
        this.removeEventListener("pointerup", pointerUpOrCancelListener);
        this.removeEventListener("pointercancel", pointerUpOrCancelListener);

        if (this.toggled === true) {
          let pressedTime = Date.now() - pointerDownTimeStamp;
          let minPressedTime = 100;

          if (pressedTime < minPressedTime) {
            await sleep(minPressedTime - pressedTime);
          }
        }

        this.removeAttribute("pressed");
      });

      this.addEventListener("pointercancel", pointerUpOrCancelListener);
    }
  }
}

customElements.define("x-tab", XTabElement);
