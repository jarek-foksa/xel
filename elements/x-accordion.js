
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-accordion
// @part arrow - Arrow icon indicating whether the accordion is expanded or collapsed.
// @event expand - User expanded the accordion by clicking the arrow icon.
// @event collapse - User collapsed the accordion by clicking the arrow icon.
export default class XAccordionElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <div id="main">
        <div id="arrow" part="arrow" tabindex="1">
          <svg id="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path id="arrow-path"></path>
          </svg>
        </div>

        <slot></slot>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      margin: 10px 0;
      box-sizing: border-box;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
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
     * Arrow
     */

    #arrow {
      position: absolute;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      pointer-events: none;
      transform: translateY(-50%);
      --path-data: M 26 20 L 26 80 L 74 50 Z;
    }
    :host([animating]) #arrow {
      outline: none !important;
    }

    #arrow-svg {
      display: flex;
      width: 16px;
      height: 16px;
      transform: rotate(0deg);
      color: currentColor;
    }
    #arrow-svg:focus {
      background: transparent;
      outline: none;
    }
    :host([expanded]) #arrow-svg {
      transform: rotate(90deg);
    }

    #arrow-path {
      fill: currentColor;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the accordion is expanded.
  get expanded() {
    return this.hasAttribute("expanded");
  }
  set expanded(expanded) {
    expanded ? this.setAttribute("expanded", "") : this.removeAttribute("expanded");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the accordion is disabled.
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
  #headerElement = null;
  #headerResizeObserver = null;
  #childListMutationObserver = null;
  #currentAnimations = [];

  #xelThemeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XAccordionElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XAccordionElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("click", (event) => this.#onClick(event));
    this["#arrow"].addEventListener("keydown", (event) => this.#onArrowKeyDown(event));
  }

  async connectedCallback() {
    await Xel.whenThemeReady;

    this.#headerResizeObserver = new ResizeObserver(() => this.#onHeaderResize());
    this.#childListMutationObserver = new MutationObserver((args) => this.#onChildListChange(args));
    this.#childListMutationObserver.observe(this, {childList: true});

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updateArrowPathData());

    this.#updateArrowPathData();
    this.#updateArrowPosition();

    this.#onChildListChange();
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);

    if (this.#headerElement) {
      this.#headerResizeObserver.unobserve(this.#headerElement);
      this.#headerElement = null;
    }

    this.#headerResizeObserver.disconnect();
    this.#childListMutationObserver.disconnect();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => Promise
  //
  // Expand the accordion. Returns a promise which will be resolved when the accordion finishes animating.
  expand(animate = true) {
    return new Promise(async (resolve) => {
      if (this.expanded === false) {
        if (animate === false) {
          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = true;
        }
        else if (animate === true) {
          let startBBox = this.getBoundingClientRect();

          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = true;

          let endBBox = this.getBoundingClientRect();
          this.setAttribute("animating", "");

          let animations = [
            this.animate(
              { height: [`${startBBox.height}px`, `${endBBox.height}px`]},
              { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
            ),
            this["#arrow-svg"].animate(
              { transform: ["rotate(0deg)", "rotate(90deg)"] },
              { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
            )
          ];

          this.#currentAnimations = animations;
          await Promise.all(animations.map(animation => animation.finished));

          if (this.#currentAnimations === animations) {
            this.#currentAnimations = [];
            this.removeAttribute("animating");
          }
        }
      }

      resolve();
    });
  }

  // @method
  // @type () => Promise
  //
  // Collapse the accordion. Returns a promise which will be resolved when the accordion finishes animating.
  collapse(animate = true) {
    return new Promise(async (resolve) => {
      if (this.expanded === true) {
        if (animate === false) {
          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = false;
        }
        else if (animate === true) {
          let startBBox = this.getBoundingClientRect();

          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = false;

          let endBBox = this.getBoundingClientRect();
          this.setAttribute("animating", "");

          let animations = [
            this.animate(
              { height: [`${startBBox.height}px`, `${endBBox.height}px`]},
              { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
            ),
            this["#arrow-svg"].animate(
              { transform: ["rotate(90deg)", "rotate(0deg)"] },
              { duration: 200, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
            )
          ];

          this.#currentAnimations = animations;
          await Promise.all(animations.map(animation => animation.finished));

          if (this.#currentAnimations === animations) {
            this.#currentAnimations = [];
            this.removeAttribute("animating");
          }
        }
      }

      resolve();
    });
  }

  #clearCurrentAnimations() {
    if (this.#currentAnimations.length > 0) {
      this.#currentAnimations.map(animation => animation.finish())
      this.#currentAnimations = [];
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateArrowPosition() {
    let header = this.querySelector(":scope > header");

    if (header) {
      this["#arrow"].style.top = (header.getBoundingClientRect().height / 2) + "px";
    }
    else {
      this["#arrow"].style.height = null;
    }
  }

  #updateArrowPathData() {
    let pathData = getComputedStyle(this["#arrow"]).getPropertyValue("--path-data");
    this["#arrow-path"].setAttribute("d", pathData);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onChildListChange() {
    let headerElement = this.querySelector(":scope > header");

    if (headerElement !== this.#headerElement) {
      if (headerElement === null) {
        this.#headerResizeObserver.unobserve(this.#headerElement);
        this.#headerElement = null;
      }
      else {
        this.#headerElement = headerElement;
        this.#headerResizeObserver.observe(this.#headerElement);
      }
    }
  }

  #onHeaderResize() {
    this.#updateArrowPosition();
  }

  #onArrowKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      this.querySelector("header").click();
    }
  }

  #onClick(event) {
    let header = this.querySelector("header");
    let closestFocusableElement = event.target.closest("[tabindex]");

    if (header.contains(event.target) && this.contains(closestFocusableElement) === false) {
      if (this.expanded) {
        this.collapse();
        this.dispatchEvent(new CustomEvent("collapse"));
      }
      else {
        this.expand();
        this.dispatchEvent(new CustomEvent("expand"));
      }
    }
  }
}

customElements.define("x-accordion", XAccordionElement);
