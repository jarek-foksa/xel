
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-throbber
export default class XThrobberElement extends HTMLElement {
  static observedAttributes = ["type", "size"];

  static _ringTemplate = html`
    <template>
      <svg data-type="ring" viewBox="0 0 100 100">
        <ellipse ry="40" rx="40" cy="50" cx="50" stroke-width="10"/>
      </svg>
    </template>
  `;

  static _spinTemplate = html`
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

  static _shadowStyleSheet = css`
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

    svg[data-type="ring"] ellipse {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-dasharray: 10, 1000;
      animation: ring-dash-animation 2s cubic-bezier(0.8, 0.25, 0.25, 0.9) infinite,
                 ring-rotate-animation 2s linear infinite;
      transform-origin: center;
    }

    @keyframes ring-rotate-animation {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes ring-dash-animation {
      50% {
        stroke-dasharray: 200;
        stroke-dashoffset: 0;
      }
      100% {
        stroke-dasharray: 245;
        stroke-dashoffset: -260;
      }
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
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _shadowRoot = null;
  _xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XThrobberElement._shadowStyleSheet];
  }

  connectedCallback() {
    this._update();
    this._updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "type") {
      this._update();
    }
    else if (name === "size") {
      this._updateComputedSizeAttriubte();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    let svg = this._shadowRoot.firstElementChild;
    let template = (this.type === "ring") ? XThrobberElement._ringTemplate : XThrobberElement._spinTemplate;

    if (svg === null) {
      this._shadowRoot.append(document.importNode(template.content, true));
    }
    else if (svg.dataset.type !== this.type) {
      svg.replaceWith(document.importNode(template.content, true));
    }

    if (this.hasAttribute("type") === false) {
      this.setAttribute("type", this.type);
    }
  }

  _updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }
}

customElements.define("x-throbber", XThrobberElement);
