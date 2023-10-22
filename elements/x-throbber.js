
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-throbber
export default class XThrobberElement extends HTMLElement {
  static observedAttributes = ["type"];

  static #ringTemplate = html`
    <template>
      <svg data-type="ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40">
          <animate attributeName="stroke-dasharray" values="0,1000; 200,1000; 245,1000" begin="0s" dur="2s" calcMode="spline" keyTimes="0; 0.5; 1" keySplines="0.8 0.25 0.25 0.9; 0.8 0.25 0.25 0.9" repeatCount="indefinite"></animate>
          <animate attributeName="stroke-dashoffset" values="0px;0px;-260px" begin="0s" dur="2s" keyTimes="0; 0.5; 1" repeatCount="indefinite"></animate>
          <animateTransform type="rotate" additive="sum" attributeName="transform" values="0;360" begin="0s" dur="2s" fill="freeze" repeatCount="indefinite" keyTimes="0; 1"></animateTransform>
        </circle>
      </svg>
    </template>
  `;

  static #spinTemplate = html`
    <template>
      <svg data-type="spin" viewBox="0 0 100 100">
        <rect transform="rotate(  0 50 50) translate(0 -38)"></rect>
        <rect transform="rotate( 30 50 50) translate(0 -38)"></rect>
        <rect transform="rotate( 60 50 50) translate(0 -38)"></rect>
        <rect transform="rotate( 90 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(120 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(150 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(180 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(210 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(240 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(270 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(300 50 50) translate(0 -38)"></rect>
        <rect transform="rotate(330 50 50) translate(0 -38)"></rect>
      </svg>
    </template>
  `

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
    :host([type="ring"]) {
      color: #4285f4;
    }
    :host([type="spin"]) {
      color: #404040;
    }

    svg {
      color: inherit;
      width: 100%;
      height: 100%;
    }

    /**
     * Ring
     */

    svg[data-type="ring"] circle {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-width: 10px;
      stroke-dasharray: 10, 1000;
      transform-box: fill-box;
      transform-origin: 50% 50%;
    }

    /**
     * Spin
     */

    svg[data-type="spin"] rect {
      x: 46.5px;
      y: 40px;
      width: 7px;
      height: 22px;
      rx: 5px;
      ry: 5px;
      fill: currentColor;
      animation-name: spin-animation;
      animation-duration: 1s;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
      animation-delay: 0s;
    }
    svg[data-type="spin"] rect:nth-child(1)  { animation-delay: calc(1s *  1/12); }
    svg[data-type="spin"] rect:nth-child(2)  { animation-delay: calc(1s *  2/12); }
    svg[data-type="spin"] rect:nth-child(3)  { animation-delay: calc(1s *  3/12); }
    svg[data-type="spin"] rect:nth-child(4)  { animation-delay: calc(1s *  4/12); }
    svg[data-type="spin"] rect:nth-child(5)  { animation-delay: calc(1s *  5/12); }
    svg[data-type="spin"] rect:nth-child(6)  { animation-delay: calc(1s *  6/12); }
    svg[data-type="spin"] rect:nth-child(7)  { animation-delay: calc(1s *  7/12); }
    svg[data-type="spin"] rect:nth-child(8)  { animation-delay: calc(1s *  8/12); }
    svg[data-type="spin"] rect:nth-child(9)  { animation-delay: calc(1s *  9/12); }
    svg[data-type="spin"] rect:nth-child(10) { animation-delay: calc(1s * 10/12); }
    svg[data-type="spin"] rect:nth-child(11) { animation-delay: calc(1s * 11/12); }
    svg[data-type="spin"] rect:nth-child(12) { animation-delay: calc(1s * 12/12); }

    @keyframes spin-animation {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type "ring" || "spin"
  // @default "ring"
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "ring";
  }
  set type(type) {
    this.setAttribute("type", type);
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XThrobberElement.#shadowStyleSheet];
  }

  connectedCallback() {
    this.#update();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "type") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    let svg = this.#shadowRoot.firstElementChild;
    let template = (this.type === "ring") ? XThrobberElement.#ringTemplate : XThrobberElement.#spinTemplate;

    if (svg === null) {
      this.#shadowRoot.append(document.importNode(template.content, true));
    }
    else if (svg.dataset.type !== this.type) {
      svg.replaceWith(document.importNode(template.content, true));
    }

    if (this.hasAttribute("type") === false) {
      this.setAttribute("type", this.type);
    }
  }
}

customElements.define("x-throbber", XThrobberElement);
