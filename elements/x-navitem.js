
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-navitem
// @event ^expand - User expanded a collapsed navigation item.
// @event ^collapse - User collapsed an expanded navigation item.
export default class XNavItemElement extends HTMLElement {
  static observedAttributes = ["disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="button" part="button">
        <slot></slot>

        <div id="arrow" part="arrow">
          <svg id="arrow-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path id="arrow-path"></path>
          </svg>
        </div>
      </div>

      <div id="main">
        <slot name="expandable"></slot>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      box-sizing: border-box;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }

    #button {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 15px;
      min-height: 36px;
      box-sizing: border-box;
    }

    #main {
      height: 0;
      display: none;
      overflow: hidden;
    }
    :host([expanded]) #main,
    :host([animating]) #main {
      display: block;
      height: auto;
    }
    :host([expanded]:not([animating])) #main {
      overflow: visible;
    }

    /**
     * Arrow
     */

    #arrow {
      display: none;
      align-items: center;
      justify-content: flex-start;
      pointer-events: none;
      margin-left: auto;
      padding-left: 4px;
      --path-data: M 26 20 L 26 80 L 74 50 Z;
    }
    :host([expandable]) #arrow {
      display: flex;
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
  //
  // Whether this navigation item is toggled.
  get toggled() {
    return this.hasAttribute("toggled");
  }
  set toggled(toggled) {
    toggled ? this.setAttribute("toggled", "") : this.removeAttribute("toggled");
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

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the navigation item is expanded.
  get expanded() {
    return this.hasAttribute("expanded");
  }
  set expanded(expanded) {
    expanded ? this.setAttribute("expanded", "") : this.removeAttribute("expanded");
  }

  // @property readOnly
  // @attribute
  // @type boolean
  // @default false
  // @readOnly
  //
  // Whether the navigation item could be expanded.
  get expandable() {
    return this.hasAttribute("expandable");
  }

  #shadowRoot;
  #xelThemeChangeListener;
  #currentAnimations = [];
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XNavItemElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XNavItemElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("click", (event) => this.#onClick(event));
  }

  connectedCallback() {
    Xel.whenThemeReady.then(() => {
      this.#updateArrowPathData();
    });

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updateArrowPathData());

    // Make the parent anchor element non-focusable (nav item should be focused instead)
    if (this.parentElement && this.parentElement.localName === "a" && this.parentElement.tabIndex !== -1) {
      this.parentElement.tabIndex = -1;
    }

    this.#updateAccessabilityAttributes();
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "disabled") {
      this.#updateAccessabilityAttributes();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @method
  // @type () => Promise
  //
  // Expand the navigation item. Returns a promise which will be resolved when the animation ends.
  expand(animate = true) {
    return new Promise(async (resolve) => {
      if (this.expanded === false) {
        if (animate === false) {
          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = true;
        }
        else if (animate === true) {
          let startBBox = this["#main"].getBoundingClientRect();

          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = true;

          let endBBox = this["#main"].getBoundingClientRect();
          this.setAttribute("animating", "");

          let animations = [
            this["#main"].animate(
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
  // Collapse the navigation item. Returns a promise will be resolved when the animation ends.
  collapse(animate = true) {
    return new Promise(async (resolve) => {
      if (this.expanded === true) {
        if (animate === false) {
          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = false;
        }
        else if (animate === true) {
          let startBBox = this["#main"].getBoundingClientRect();

          this.#clearCurrentAnimations();
          this.removeAttribute("animating");
          this.expanded = false;

          let endBBox = this["#main"].getBoundingClientRect();
          this.setAttribute("animating", "");

          let animations = [
            this["#main"].animate(
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
            this.removeAttribute("animating");
          }
        }
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onClick(event) {
    if (this === event.target.closest("x-navitem") && this.hasAttribute("expandable")) {
      if (event.target.localName !== "x-nav") {
        if (this.expanded) {
          let event = new CustomEvent("collapse", {bubbles: true, cancelable: true});
          this.dispatchEvent(event);

          if (event.defaultPrevented === false) {
            this.collapse();
          }
        }
        else {
          let event = new CustomEvent("expand", {bubbles: true, cancelable: true});
          this.dispatchEvent(event);

          if (event.defaultPrevented === false) {
            this.expand();
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #clearCurrentAnimations() {
    if (this.#currentAnimations.length > 0) {
      this.#currentAnimations.map(animation => animation.finish())
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "button");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this.#lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this.#lastTabIndex > 0) ? this.#lastTabIndex : 0;
      }

      this.#lastTabIndex = 0;
    }
  }

  #updateArrowPathData() {
    let pathData = getComputedStyle(this["#arrow"]).getPropertyValue("--path-data");
    this["#arrow-path"].setAttribute("d", pathData);
  }
}

customElements.define("x-navitem", XNavItemElement);
