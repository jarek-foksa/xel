
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: flex;
        flex-flow: row;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: fit-content;
        --button-color: rgba(0, 0, 0, 0.6);
        --button-border-left: none;
        --pressed-button-color: white;
        --pressed-button-background: rgba(0, 0, 0, 0.3);
        --increment-arrow-width: 11px;
        --increment-arrow-height: 11px;
        --increment-arrow-path-d: path("M 24 69 L 50 43 L 76 69 L 69 76 L 50 58 L 31 76 L 24 69 Z" );
        --decrement-arrow-width: 11px;
        --decrement-arrow-height: 11px;
        --decrement-arrow-path-d: path("M 24 32 L 50 58 L 76 32 L 69 25 L 50 44 L 31 25 L 24 32 Z" );
      }
      :host(:hover) {
        cursor: default;
      }

      #increment-button,
      #decrement-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        user-select: none;
        box-sizing: border-box;
        color: var(--button-color);
        border-left: var(--button-border-left);
      }
      #increment-button[data-pressed],
      #decrement-button[data-pressed] {
        color: var(--pressed-button-color);
        background: var(--pressed-button-background);
      }
      :host([disabled="increment"]) #increment-button,
      :host([disabled="decrement"]) #decrement-button,
      :host([disabled=""]) #increment-button,
      :host([disabled=""]) #decrement-button {
        opacity: 0.3;
        pointer-events: none;
      }

      #increment-arrow {
        width: var(--increment-arrow-width);
        height: var(--increment-arrow-height);
        pointer-events: none;
      }
      #decrement-arrow {
        width: var(--decrement-arrow-width);
        height: var(--decrement-arrow-height);
        pointer-events: none;
      }

      #increment-arrow-path {
        d: var(--increment-arrow-path-d);
        fill: currentColor;
      }
      #decrement-arrow-path {
        d: var(--decrement-arrow-path-d);
        fill: currentColor;
      }
    </style>

    <div id="decrement-button" class="button">
      <svg id="decrement-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="decrement-arrow-path"></path>
      </svg>
    </div>

    <div id="increment-button" class="button">
      <svg id="increment-arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path id="increment-arrow-path"></path>
      </svg>
    </div>
  </template>
`;

// @events
//   increment
//   incrementstart
//   incrementend
//   decrement
//   decrementstart
//   decrementend
export class XStepperElement extends HTMLElement {
  static get observedAttributes() {
    return ["disabled"];
  }

  // @type
  //   true || false || "increment" || "decrement"
  // @default
  //   "false"
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this._shadowRoot.addEventListener("pointerdown", (event) => this._onPointerDown(event));
  }

  attributeChangedCallback(name) {
    if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onDisabledAttributeChange() {
    if (this.hasAttribute("disabled")) {
      this["#increment-button"].removeAttribute("data-pressed");
      this["#decrement-button"].removeAttribute("data-pressed");
    }
  }

  async _onPointerDown(pointerDownEvent) {
    let button = pointerDownEvent.target.closest(".button");
    let action = null;

    if (button === this["#increment-button"]) {
      action = "increment";
    }
    else if (button === this["#decrement-button"]) {
      action = "decrement";
    }

    if (pointerDownEvent.buttons !== 1 || action === null) {
      return;
    }

    // Provide "pressed" attribute for theming purposes which acts like :active pseudo-class, but is guaranteed
    // to last at least 100ms.
    {
      let pointerDownTimeStamp = Date.now();

      button.setAttribute("data-pressed", "");
      this.setPointerCapture(pointerDownEvent.pointerId);

      this.addEventListener("lostpointercapture", async (event) => {
        let pressedTime = Date.now() - pointerDownTimeStamp;
        let minPressedTime = 100;

        if (pressedTime < minPressedTime) {
          await sleep(minPressedTime - pressedTime);
        }

        button.removeAttribute("data-pressed");
      }, {once: true});
    }

    // Dispatch events
    {
      let intervalID = null;
      let pointerDownTimeStamp = Date.now();
      let {shiftKey} = pointerDownEvent;

      this.dispatchEvent(new CustomEvent(action + "start", {bubbles: true}));
      this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));

      this.addEventListener("lostpointercapture", async (event) => {
        clearInterval(intervalID);
        this.dispatchEvent(new CustomEvent(action + "end", {bubbles: true}));
      }, {once: true});

      intervalID = setInterval(() => {
        if (Date.now() - pointerDownTimeStamp > 500) {
          this.dispatchEvent(new CustomEvent(action, {bubbles: true, detail: {shiftKey}}));
        }
      }, 100);
    }
  }
}

customElements.define("x-stepper", XStepperElement);
