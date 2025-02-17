
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

// @element x-stepper
// @part increment-button - Increment button.
// @part decrement-button - Decrement button.
// @part increment-arrow - SVG arrow image belonging to the increment button.
// @part decrement-arrow - SVG arrow image belonging to the decrement button.
// @event ^increment - Fired every 100ms while user is holding down the increment button.
// @event ^decrement - Fired every 100ms while user is holding down the decrement button.
// @event ^incrementstart - User pressed the increment button.
// @event ^decrementstart - User pressed the decrement button.
// @event ^incrementend - User released the increment button.
// @event ^decrementend - User released the decrement button.
export default class XStepperElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="decrement-button" part="decrement-button" class="button">
        <svg id="decrement-arrow" part="decrement-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path id="decrement-arrow-path"></path>
        </svg>
      </div>

      <div id="increment-button" part="increment-button" class="button">
        <svg id="increment-arrow" part="increment-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path id="increment-arrow-path"></path>
        </svg>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: flex;
      flex-flow: column-reverse;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 100%;
      width: fit-content;
      color: rgba(0, 0, 0, 0.6);
    }
    :host(:hover) {
      cursor: default;
    }
    :host([disabled=""]) {
      opacity: 0.5;
      pointer-events: none;
    }

    .button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      user-select: none;
      -webkit-user-select: none;
      box-sizing: border-box;
      color: inherit;
      border-left: none;
    }
    .button[data-pressed] {
      color: white;
      background: rgba(0, 0, 0, 0.3);
    }
    :host([disabled="increment"]) #increment-button,
    :host([disabled="decrement"]) #decrement-button {
      opacity: 0.3;
      pointer-events: none;
    }

    #increment-arrow {
      width: 11px;
      height: 11px;
      pointer-events: none;
      --path-data: M 24 69 L 50 43 L 76 69 L 69 76 L 50 58 L 31 76 L 24 69 Z;
    }
    #decrement-arrow {
      width: 11px;
      height: 11px;
      pointer-events: none;
      --path-data: M 24 32 L 50 58 L 76 32 L 69 25 L 50 44 L 31 25 L 24 32 Z;
    }

    #increment-arrow-path,
    #decrement-arrow-path {
      fill: currentColor;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type true || false || "increment" || "decrement"
  // @default false
  //
  // Set to <code>true</code> or <code>false</code> to disable both buttons. Set to <code>"increment"</code> or
  // <code>"decrement"</code> to disable only a single button.
  get disabled() {
    if (this.hasAttribute("disabled")) {
      if (this.getAttribute("disabled") === "increment") {
        return "increment";
      }
      else if (this.getAttribute("disabled") === "decrement") {
        return "decrement";
      }
      else {
        return true;
      }
    }
    else {
      return false;
    }
  }
  set disabled(disabled) {
    if (disabled === true) {
      this.setAttribute("disabled", "");
    }
    else if (disabled === false) {
      this.removeAttribute("disabled");
    }
    else {
      this.setAttribute("disabled", disabled);
    }
  }

  #shadowRoot = null;
  #parentInput = null;
  #xelThemeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XStepperElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XStepperElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onPointerDown(event));

    // @bugfix: https://boxy-svg.com/bugs/289
    this.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  connectedCallback() {
    Xel.whenThemeReady.then(() => {
      this.#updatePathData();
    });

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updatePathData());

    if (this.parentElement.localName === "x-numberinput") {
      this.#parentInput = this.parentElement;
      this.#parentInput.setAttribute("hasstepper", "");
    }
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);

    if (this.#parentInput) {
      if (this.#parentInput.querySelector(":scope > x-stepper") === null) {
        this.#parentInput.removeAttribute("hasstepper", "");
      }

      this.#parentInput = null;
    }
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updatePathData() {
    let incrementPathData = getComputedStyle(this["#increment-arrow"]).getPropertyValue("--path-data");
    let decrementPathData = getComputedStyle(this["#decrement-arrow"]).getPropertyValue("--path-data");

    this["#increment-arrow-path"].setAttribute("d", incrementPathData);
    this["#decrement-arrow-path"].setAttribute("d", decrementPathData);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onDisabledAttributeChange() {
    if (this.hasAttribute("disabled")) {
      this.removeAttribute("pressed");
      this["#increment-button"].removeAttribute("data-pressed");
      this["#decrement-button"].removeAttribute("data-pressed");
    }
  }

  #onPointerDown(pointerDownEvent) {
    let button = pointerDownEvent.target.closest(".button");
    let action = null;

    if (button === this["#increment-button"]) {
      action = "increment";
    }
    else if (button === this["#decrement-button"]) {
      action = "decrement";
    }

    if (pointerDownEvent.buttons > 1 || action === null) {
      return;
    }

    this.setPointerCapture(pointerDownEvent.pointerId);

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 100ms.
    {
      let pointerDownTimeStamp = Date.now();
      let pointerUpOrCancelListener;

      button.setAttribute("data-pressed", "");
      this.setAttribute("pressed", action);

      this.addEventListener("pointerup", pointerUpOrCancelListener = async () => {
        this.removeEventListener("pointerup", pointerUpOrCancelListener);
        this.removeEventListener("pointercancel", pointerUpOrCancelListener);

        let pressedTime = Date.now() - pointerDownTimeStamp;
        let minPressedTime = 100;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        button.removeAttribute("data-pressed");
        this.removeAttribute("pressed");
      }, {once: true});

      this.addEventListener("pointercancel", pointerUpOrCancelListener);
    }

    // Dispatch events
    {
      let intervalID = null;
      let pointerDownTimeStamp = Date.now();
      let pointerUpOrCancelListener;
      let {shiftKey} = pointerDownEvent;

      this.dispatchEvent(new CustomEvent(action + "start", {bubbles: true}));
      this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));

      this.addEventListener("pointerup", pointerUpOrCancelListener = () => {
        this.removeEventListener("pointerup", pointerUpOrCancelListener);
        this.removeEventListener("pointercancel", pointerUpOrCancelListener);

        clearInterval(intervalID);
        this.dispatchEvent(new CustomEvent(action + "end", {bubbles: true}));
      });

      this.addEventListener("pointercancel", pointerUpOrCancelListener);

      intervalID = setInterval(() => {
        if (Date.now() - pointerDownTimeStamp > 500) {
          this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));
        }
      }, 100);
    }
  }
}

customElements.define("x-stepper", XStepperElement);
