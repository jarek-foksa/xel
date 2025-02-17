
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-throbber
export default class XThrobberElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40">
          <animate attributeName="stroke-dasharray" values="0,1000; 200,1000; 245,1000" begin="0s" dur="2s" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.8 0.25 0.25 0.9; 0.8 0.25 0.25 0.9" repeatCount="indefinite"></animate>
          <animate attributeName="stroke-dashoffset" values="0px;0px;-260px" begin="0s" dur="2s" keyTimes="0; 0.5; 1" repeatCount="indefinite"></animate>
          <animateTransform type="rotate" additive="sum" attributeName="transform" values="0;360" begin="0s" dur="2s" fill="freeze" repeatCount="indefinite" keyTimes="0; 1"></animateTransform>
        </circle>
      </svg>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 30px;
      height: 30px;
      box-sizing: border-box;
    }
    :host([hidden]) {
      display: none;
    }

    svg {
      color: inherit;
      width: 100%;
      height: 100%;
    }

    svg circle {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-width: 10px;
      stroke-dasharray: 10, 1000;
      transform-box: fill-box;
      transform-origin: 50% 50%;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
  #intersectionObserver = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XThrobberElement.#shadowStyleSheet];
    this.#intersectionObserver = new IntersectionObserver(entries => this.#update());
  }

  connectedCallback() {
    this.#update();
    this.#intersectionObserver.observe(this);
  }

  disconnectedCallback() {
    this.#intersectionObserver.unobserve(this);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    if (this.hidden || (this.checkVisibility && this.checkVisibility() === false)) {
      this.#shadowRoot.innerHTML = "";
    }
    else {
      let svg = this.#shadowRoot.firstElementChild;

      if (svg === null) {
        this.#shadowRoot.append(document.importNode(XThrobberElement.#shadowTemplate.content, true));
      }
    }
  }
}

customElements.define("x-throbber", XThrobberElement);
