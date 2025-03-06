
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {rectContainsPoint} from "../utils/math.js";
import {html, css} from "../utils/template.js";
import {getTimeStamp} from "../utils/time.js";

// @element x-notification
export default class XNotificationElement extends HTMLElement {
  static observedAttributes = ["opened"];

  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: none;
      position: fixed;
      min-width: 15px;
      min-height: 15px;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 12px;
      box-sizing: border-box;
      color: rgba(255, 255, 255, 0.9);
      background: #434343;
      z-index: 9999;
      font-size: 0.75rem;
      user-select: text;
      -webkit-user-select: none;
      transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    }
    :host([opened]),
    :host([animating]) {
      display: block;
    }
    :host(:focus) {
      outline: none;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the notification is currently open.
  get opened() {
    return this.hasAttribute("opened");
  }
  set opened(opened) {
    opened === true ? this.setAttribute("opened", "") : this.removeAttribute("opened");
    this.#time = 0;
  }

  // @property
  // @attribute
  // @type number
  // @default 0
  //
  // Time (in miliseconds) after which this notification should disappear.<br/>
  // Set to 0 to disable the timeout.<br/>
  // Set to -1 to disable the timeout and make the notification permanent.
  get timeout() {
    return this.hasAttribute("timeout") ? parseFloat(this.getAttribute("timeout")) : 0;
  }
  set timeout(timeout) {
    this.setAttribute("timeout", timeout);
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
  #time = 0;
  #intervalID = null;
  #windowPointerDownListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XNotificationElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XNotificationElement.#shadowTemplate.content, true));
  }

  connectedCallback() {
    this.setAttribute("tabindex", "0");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "opened") {
      this.opened ? this.#onOpen() : this.#onClose();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onOpen() {
    // Animate in
    if (this.isConnected) {
      let fromBottom = (0 - this.getBoundingClientRect().height - 10) + "px";
      let toBottom = getComputedStyle(this).bottom;

      let inAnimation = this.animate(
        { bottom: [fromBottom, toBottom]},
        { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      );
    }

    // Automatically close the notification after given timeout
    if (this.timeout > 0) {
      this.#time = 0;

      this.#intervalID = setInterval(() => {
        this.#time += 100;

        if (this.timeout > 0 && this.#time > this.timeout) {
          this.opened = false;
        }
      }, 100);
    }

    // Automatically close the notification on pointer down
    if (this.timeout >= 0) {
      let openTimeStamp = getTimeStamp();

      window.addEventListener("pointerdown", this.#windowPointerDownListener = (event) => {
        let pointerDownTimeStamp = getTimeStamp();
        let bounds = this.getBoundingClientRect();

        if (
          pointerDownTimeStamp - openTimeStamp > 10 &&
          rectContainsPoint(bounds, new DOMPoint(event.clientX, event.clientY)) === false
        ) {
          this.opened = false;
        }
      }, true);
    }
  }

  async #onClose() {
    if (this.#intervalID !== null) {
      clearInterval(this.#intervalID);
      this.#intervalID = null;
    }

    // Animate out
    if (this.isConnected) {
      this.setAttribute("animating", "");
      let fromBottom = getComputedStyle(this).bottom;
      let toBottom = (0 - this.getBoundingClientRect().height - 10) + "px";

      let inAnimation = this.animate(
        { bottom: [fromBottom, toBottom]},
        { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      );

      await inAnimation.finished;
      this.removeAttribute("animating");
    }

    window.removeEventListener("pointerdown", this.#windowPointerDownListener, true);
  }
}

customElements.define("x-notification", XNotificationElement);
