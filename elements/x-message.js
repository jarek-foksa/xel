
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import DOMPurify from "../node_modules/dompurify/dist/purify.es.js";
import Xel from "../classes/xel.js";

import {isNumeric, isString} from "../utils/string.js";
import {html, css} from "../utils/template.js";

// @element x-message
export default class XMessageElement extends HTMLElement {
  static observedAttributes = ["name", "args"];

  static #shadowTemplate = html`<template><slot></slot></template>`;

  static #shadowStyleSheet = css`
    slot {
      text-decoration: inherit;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  get name() {
    return this.hasAttribute("name") ? this.getAttribute("name") : "";
  }
  set name(name) {
    this.setAttribute("name", name);
  }

  // @property
  // @attribute
  // @type Object
  // @default {}
  get args() {
    let args = Object.create(null);
    let serializedArgs = this.hasAttribute("args") ? this.getAttribute("args").trim() : "";

    if (serializedArgs !== "") {
      for (let serializedArg of serializedArgs.split(",")) {
        let [key, value] = serializedArg.split(":");
        key = key.trim();
        value = value.trim();

        let number = parseFloat(value);
        let isNumber = (value - number + 1) >= 0;

        args[key] = isNumber ? number : value;
      }
    }

    return args;
  }
  set args(args) {
    let serializedArgs = Object.keys(args).map(key => `${key}: ${args[key]}`).join(", ");

    if (args.length === 0) {
      this.removeAttribute("args");
    }
    else {
      this.setAttribute("args", serializedArgs);
    }
  }

  #shadowRoot = null;
  #localesChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XMessageElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XMessageElement.#shadowTemplate.content, true));
  }

  connectedCallback() {
    Xel.addEventListener("localeschange", this.#localesChangeListener = () => {
      this.#update();
    });
  }

  disconnectedCallback() {
    Xel.removeEventListener("localeschange", this.#localesChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "name") {
      this.#update();
    }
    else if (name === "args") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #update() {
    await Xel.whenLocalesReady;

    let message = Xel.queryMessage(this.name, this.args);

    if (message.format === "html") {
      this.innerHTML = message.content;
    }
    else {
      this.textContent = message.content;
    }
  }
}

customElements.define("x-message", XMessageElement);
