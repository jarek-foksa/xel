
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let shadowTemplate = html`
  <template>
    <style>
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

      #main {
        width: 100%;
        height: 100%;
      }

      svg {
        color: inherit;
        width: 100%;
        height: 100%;
      }
    </style>

    <main id="main"></main>
  </template>
`;

let ringThrobberSVG = `
  <svg viewBox="0 0 100 100">
    <style>
      ellipse {
        fill: none;
        stroke: currentColor;
        stroke-linecap: round;
        stroke-dasharray: 10, 1000;
        animation: dash-animation 2s cubic-bezier(0.8, 0.25, 0.25, 0.9) infinite, rotate-animation 2s linear infinite;
        transform-origin: center;
      }

      @keyframes rotate-animation {
        to {
          transform: rotate(360deg);
        }
      }

      @keyframes dash-animation {
        50% {
          stroke-dasharray: 200;
          stroke-dashoffset: 0;
        }
        100% {
          stroke-dasharray: 245;
          stroke-dashoffset: -260;
        }
      }
    </style>

    <ellipse ry="40" rx="40" cy="50" cx="50" stroke-width="10"/>
  </svg>
`;

let spinThrobberSVG = `
  <svg viewBox="0 0 100 100">
    <style>
      rect {
        x: 46.5px;
        y: 40px;
        width: 7px;
        height: 22px;
        rx: 5px;
        ry: 5px;
        fill: currentColor;
      }
    </style>

    <rect transform="rotate(0 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(30 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.08s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(60 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.17s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(90 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.25s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(120 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.33s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(150 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.42s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(180 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.5s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(210 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.58s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(240 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.66s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(270 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.75s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(300 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.83s" repeatCount="indefinite" />
    </rect>
    <rect transform="rotate(330 50 50) translate(0 -38)">
      <animate attributeName="opacity" from="1" to="0" dur="1s" begin="0.92s" repeatCount="indefinite" />
    </rect>
  </svg>
`;

export class XThrobberElement extends HTMLElement {
  static get observedAttributes() {
    return ["type"];
  }

  // @type
  //   "ring" || "spin"
  // @default
  //   "ring"
  // @attribute
  get type() {
    return this.hasAttribute("type") ? this.getAttribute("type") : "ring";
  }
  set type(type) {
    this.setAttribute("type", type);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "open"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this._update();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "type") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _update() {
    this["#main"].innerHTML = (this.type === "ring") ? ringThrobberSVG : spinThrobberSVG;

    if (this.hasAttribute("type") === false) {
      this.setAttribute("type", this.type);
    }
  }
}

customElements.define("x-throbber", XThrobberElement);
