
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
  static observedAttributes = ["selected", "disabled"];

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
      font-size: 14px;
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
  #elements = {};

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
  }

  connectedCallback() {
    this.#updateAccessabilityAttributes();
  }

  attributeChangedCallback(name) {
    if (name === "selected") {
      this.#updateAccessabilityAttributes();
    }
    else if (name === "disabled") {
      this.#updateAccessabilityAttributes();
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

        if (this.selected === true) {
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
