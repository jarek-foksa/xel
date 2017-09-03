
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-stepper.css" data-vulcanize>

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
  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
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

    if (pointerDownEvent.button !== 0 || action === null) {
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
