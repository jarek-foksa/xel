
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {sleep} from "../utils/time.js";

let {max} = Math;
let easing = "cubic-bezier(0.4, 0, 0.2, 1)";

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="node_modules/xel/stylesheets/x-accordion.css" data-vulcanize>

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
  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

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

  async connectedCallback() {
    // Replace this lame code with ResizeObserver when it becomes available
    await sleep(100);
    this._updateArrowPosition();
    await sleep(400);
    this._updateArrowPosition();
    await sleep(1000);
    this._updateArrowPosition();
    await sleep(2000);
    this._updateArrowPosition();
    await sleep(4000);
    this._updateArrowPosition();
    await sleep(7000);
    this._updateArrowPosition();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

  _onArrowKeyDown(event) {
    if (event.key === "Enter") {
      this.querySelector("header").click();
    }
  }

  async _onPointerDown(pointerDownEvent) {
    if (pointerDownEvent.button !== 0) {
      return;
    }

    let header = this.querySelector("header");
    let closestFocusableElement = event.target.closest("[tabindex]");

    if (header.contains(event.target) && this.contains(closestFocusableElement) === false) {
      let triggerEffect = getComputedStyle(this).getPropertyValue("--trigger-effect").trim();

      // Ripple
      if (triggerEffect === "ripple") {
        let rect = this["#ripples"].getBoundingClientRect();
        let size = max(rect.width, rect.height) * 1.5;
        let top  = pointerDownEvent.clientY - rect.y - size/2;
        let left = pointerDownEvent.clientX - rect.x - size/2;
        let whenLostPointerCapture = new Promise((r) => this.addEventListener("lostpointercapture", r, {once: true}));

        this.setPointerCapture(pointerDownEvent.pointerId);

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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _updateArrowPosition() {
    let header = this.querySelector(":scope > header");

    if (header) {
      this["#arrow-container"].style.height = header.getBoundingClientRect().height + "px";
    }
    else {
      this["#arrow-container"].style.height = null;
    }
  }
}

customElements.define("x-accordion", XAccordionElement);
