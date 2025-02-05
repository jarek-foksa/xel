
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";
import {rectContainsPoint} from "../utils/math.js";

// @element x-drawer
// @event toggle
// @event beforetoggle
export default class XDrawerElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: none;
      width: 300px;
      height: 100%;
      left: auto;
      right: auto;
      top: auto;
      bottom: auto;
      padding: 0;
      box-sizing: border-box;
      border-width: 0;
      transition-duration: 200ms;
      transition-timing-function: linear;
    }
    :host([popover]) {
      display: block;
    }
    :host(:popover-open) {
      display: block;
    }
    :host([hidden]) {
      display: none;
    }
    :host(:focus) {
      outline: none;
    }

    :host::backdrop {
      background-color: color(srgb 0 0 0 / 0.25);
      transition-property: all;
      transition-duration: 200ms;
      transition-timing-function: linear;
      transition-behavior: allow-discrete;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Manual drawer does not auto-close when user clicks the backdrop.
  get manual() {
    return this.hasAttribute("manual");
  }
  set manual(manual) {
    manual ? this.setAttribute("manual", "") : this.removeAttribute("manual");
  }

  #shadowRoot = null;
  #position = "left";
  #openAnimation;
  #closeAnimation;
  #windowClickListener;

  // Hide Popover API methods from the public API
  showPopover = undefined;
  hidePopover = undefined;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XDrawerElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XDrawerElement.#shadowTemplate.content, true));

    this.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    this.addEventListener("click", (event) => {
      event.stopPropagation();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  open() {
    return new Promise( async (resolve) => {
      if (this.isConnected === false) {
        resolve();
        return;
      }
      if (this.#openAnimation) {
        await this.#openAnimation.finished;
      }
      if (this.#closeAnimation) {
        await this.#closeAnimation.finished;
      }

      this.setAttribute("popover", "manual");
      this.setAttribute("tabindex", "0");

      let computedStyle = getComputedStyle(this);
      let transitionDuration = parseFloat(computedStyle.getPropertyValue("transition-duration") || "0s") * 1000;
      let transitionTimingFunction = computedStyle.getPropertyValue("transition-timing-function");
      let drawerRect = this.getBoundingClientRect();
      let {left, right, top, bottom} = computedStyle;

      if (right === "0px" && left !== "0px") {
        this.#position = "right";
      }
      else if (top === "0px" && bottom !== "0px") {
        this.#position = "top";
      }
      else if (bottom === "0px" && top !== "0px") {
        this.#position = "bottom";
      }
      else {
        this.#position = "left";
      }

      if (this.#position === "left") {
        this.#openAnimation = this.animate(
          { transform: [`translateX(-${drawerRect.right}px)`, "translateX(0px)"]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "right") {
        this.#openAnimation = this.animate(
          { transform: [`translateX(${drawerRect.width}px)`, "translateX(0px)"]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "top") {
        this.#openAnimation = this.animate(
          { transform: [`translateY(-${drawerRect.bottom}px)`, "translateY(0px)"]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "bottom") {
        this.#openAnimation = this.animate(
          { transform: [`translateY(${drawerRect.height}px)`, "translateY(0px)"]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }

      window.addEventListener("click", this.#windowClickListener = (event) => {
        if (this.#openAnimation.playState === "finished" && this.popover) {
          let popoverRect = this.getBoundingClientRect();

          if (rectContainsPoint(popoverRect, {x: event.clientX, y: event.clientY}) === false) {
            let pointerEvents = getComputedStyle(this, "::backdrop").pointerEvents;

            if (!this.manual) {
              this.close();
            }
          }
        }
      });

      super.showPopover();
      resolve();
    });
  }

  close() {
    return new Promise( async (resolve) => {
      if (this.#openAnimation) {
        await this.#openAnimation.finished;
      }
      if (this.#closeAnimation) {
        await this.#closeAnimation.finished;
      }

      window.removeEventListener("click", this.#windowClickListener);

      let computedStyle = getComputedStyle(this);
      let transitionDuration = parseFloat(computedStyle.getPropertyValue("transition-duration") || "0s") * 1000;
      let transitionTimingFunction = computedStyle.getPropertyValue("transition-timing-function") || "ease";
      let drawerRect = this.getBoundingClientRect();

      if (this.#position === "left") {
        this.#closeAnimation = this.animate(
          { transform: ["translateX(0px)", `translateX(-${drawerRect.right}px)`]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "right") {
        this.#closeAnimation = this.animate(
          { transform: ["translateX(0px)", `translateX(${drawerRect.width}px)`]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "top") {
        this.#closeAnimation = this.animate(
          { transform: [ "translateY(0px)", `translateY(-${drawerRect.bottom + 50}px)`]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }
      else if (this.#position === "bottom") {
        this.#closeAnimation = this.animate(
          { transform: ["translateY(0px)", `translateY(${drawerRect.height}px)`]},
          { duration: transitionDuration, easing: transitionTimingFunction }
        );
      }

      if (this.#closeAnimation) {
        await this.#closeAnimation.finished;
        this.#closeAnimation = null;
      }

      super.hidePopover();
      this.removeAttribute("popover");
      this.removeAttribute("tabindex");
      resolve();
    });
  }

  toggle() {
    if (this.hasAttribute("popover")) {
      this.close();
    }
    else {
      this.open();
    }
  }
}

customElements.define("x-drawer", XDrawerElement);
