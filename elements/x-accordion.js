
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: block;
        width: 100%;
        box-sizing: border-box;
        --arrow-width: 24px;
        --arrow-height: 24px;
        --arrow-color: currentColor;
        --arrow-align: flex-end;
        --arrow-d: path("M 29.0 31.4 L 50 52.3 L 70.9 31.4 L 78.5 40.0 L 50 68.5 L 21.2 40.3 L 29.0 31.4 Z");
        --arrow-transform: rotate(0deg);
        --focused-arrow-background: transparent;
        --focused-arrow-outline: none;
        --trigger-effect: none; /* ripple, none */
        --ripple-background: currentColor;
        --ripple-opacity: 0.05;
      }
      :host([expanded]) {
        --arrow-transform: rotate(-180deg);
      }
      :host([animating]) {
        overflow: hidden;
      }

      #main {
        position: relative;
        width: 100%;
        height: 100%;
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
        pointer-events: none;
        border-radius: inherit;
      }

      #ripples .ripple {
        position: absolute;
        top: 0;
        left: 0;
        width: 200px;
        height: 200px;
        background: var(--ripple-background);
        opacity: var(--ripple-opacity);
        border-radius: 999px;
        transform: none;
        transition: all 800ms cubic-bezier(0.4, 0, 0.2, 1);
        will-change: opacity, transform;
        pointer-events: none;
      }

      /**
       * Arrow
       */

      #arrow-container {
        position: absolute;
        top: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: var(--arrow-align);
        pointer-events: none;
      }

      #arrow {
        margin: 0 14px 0 0;
        display: flex;
        width: var(--arrow-width);
        height: var(--arrow-height);
        min-width: var(--arrow-width);
        color: var(--arrow-color);
        d: var(--arrow-d);
        transform: var(--arrow-transform);
        transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #arrow:focus {
        background: var(--focused-arrow-background);
        outline: var(--focused-arrow-outline);
      }

      #arrow path {
        fill: currentColor;
        d: inherit;
}
    </style>

    <main id="main">
      <div id="ripples"></div>

      <div id="arrow-container">
        <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none" tabindex="1">
          <path></path>
        </svg>
      </div>

      <slot></slot>
    </main>
  </template>
`;

export class XAccordionElement extends HTMLElement {
  static get observedAttributes() {
    return ["expanded"];
  }

  get expanded() {
    return this.hasAttribute("expanded");
  }
  set expanded(expanded) {
    expanded ? this.setAttribute("expanded", "") : this.removeAttribute("expanded");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this._resizeObserver = new ResizeObserver(() => this._updateArrowPosition());

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
    this["#arrow"].addEventListener("keydown", (event) => this._onArrowKeyDown(event));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "expanded") {
      this._updateArrowPosition();
    }
  }

  connectedCallback() {
    this._resizeObserver.observe(this);
  }

  disconnectedCallback() {
    this._resizeObserver.unobserve(this);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateArrowPosition() {
    let header = this.querySelector(":scope > header");

    if (header) {
      this["#arrow-container"].style.height = header.getBoundingClientRect().height + "px";
    }
    else {
      this["#arrow-container"].style.height = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onArrowKeyDown(event) {
    if (event.key === "Enter") {
      this.querySelector("header").click();
    }
  }

  async _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.buttons !== 1) {
      return;
    }

    let header = this.querySelector("header");
    let closestFocusableElement = pointerDownEvent.target.closest("[tabindex]");

    if (header.contains(pointerDownEvent.target) && this.contains(closestFocusableElement) === false) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      // Ripple
      if (triggerEffect === "ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;

        let whenLostPointerCapture = new Promise((r) => {
          pointerDownEvent.target.addEventListener("lostpointercapture", r, {once: true})
        });

        pointerDownEvent.target.setPointerCapture(pointerDownEvent.pointerId);

        let ripple = html`<div></div>`;
        ripple.setAttribute("class", "ripple pointer-down-ripple");
        ripple.setAttribute("style", `width: ${size}px; height: ${size}px; top: ${top}px; left: ${left}px;`);

        this["#ripples"].append(ripple);
        this["#ripples"].style.contain = "strict";

        let inAnimation = ripple.animate(
          { transform: ["scale3d(0, 0, 0)", "none"]},
          { duration: 300, easing }
        );

        await whenLostPointerCapture;
        await inAnimation.finished;

        let outAnimation = ripple.animate(
          { opacity: [getComputedStyle(ripple).opacity, "0"]},
          { duration: 300, easing }
        );

        await outAnimation.finished;
        ripple.remove();
      }
    }
  }

  async _onClick(event) {
    let header = this.querySelector("header");
    let closestFocusableElement = event.target.closest("[tabindex]");

    if (header.contains(event.target) && this.contains(closestFocusableElement) === false) {
      // Collapse
      if (this.expanded) {
        let startBBox = this.getBoundingClientRect();

        if (this._animation) {
          this._animation.finish();
        }

        this.expanded = false;
        this.removeAttribute("animating");
        let endBBox = this.getBoundingClientRect();
        this.setAttribute("animating", "");

        let animation = this.animate(
          {
            height: [startBBox.height + "px", endBBox.height + "px"],
          },
          {
            duration: 300,
            easing
          }
        );

        this._animation = animation;
        await animation.finished;

        if (this._animation === animation) {
          this.removeAttribute("animating");
        }
      }

      // Expand
      else {
        let startBBox = this.getBoundingClientRect();

        if (this._animation) {
          this._animation.finish();
        }

        this.expanded = true;
        this.removeAttribute("animating");
        let endBBox = this.getBoundingClientRect();
        this.setAttribute("animating", "");

        let animation = this.animate(
          {
            height: [startBBox.height + "px", endBBox.height + "px"],
          },
          {
            duration: 300,
            easing
          }
        );

        this._animation = animation;
        await animation.finished;

        if (this._animation === animation) {
          this.removeAttribute("animating");
        }
      }
    }
  }
}

customElements.define("x-accordion", XAccordionElement);
