
// @doc
//   https://material.io/guidelines/components/snackbars-toasts.html#
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {rectContainsPoint} from "../utils/math.js";
import {getTimeStamp} from "../utils/time.js";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-notification.css" data-vulcanize>
    <slot></slot>
  </template>
`;

export class XNotificationElement extends HTMLElement {
  static get observedAttributes() {
    return ["opened"];
  }

  // @type
  //   boolean
  // @default
  //   false
  get opened() {
    return this.hasAttribute("opened");
  }
  set opened(opened) {
    opened === true ? this.setAttribute("opened", "") : this.removeAttribute("opened");
    this._time = 0;
  }

  // @info
  //   Time (in miliseconds) after which this notification should disappear.
  //   Set to 0 to disable the timeout.
  // @type
  //   number
  // @default
  //   0
  get timeout() {
    return this.hasAttribute("timeout") ? parseFloat(this.getAttribute("timeout")) : 0;
  }
  set timeout(timeout) {
    this.setAttribute("timeout", timeout);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._time = 0;

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this.setAttribute("tabindex", "0");
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "opened") {
      this.opened ? this._onOpen() : this._onClose();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onOpen() {
    // Animate in
    {
      let fromBottom = (0 - this.getBoundingClientRect().height - 10) + "px";
      let toBottom = getComputedStyle(this).bottom;

      let inAnimation = this.animate(
        { bottom: [fromBottom, toBottom]},
        { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
      );

      // await inAnimation.finished;
    }

    // Automatically close the notification after given timeout
    {
      this._time = 0;

      this._intervalID = setInterval(() => {
        this._time += 100;

        if (this.timeout > 0 && this._time > this.timeout) {
          this.opened = false;
        }
      }, 100);

      let openTimeStamp = getTimeStamp();

      window.addEventListener("pointerdown", this._windowPointerDownListener = (event) => {
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

  async _onClose() {
    clearInterval(this._intervalID);

    // Animate out
    {
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

    window.removeEventListener("pointerdown", this._windowPointerDownListener, true);
  }
}

customElements.define("x-notification", XNotificationElement);
