
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isNumeric, isString} from "../utils/string.js";
import {html, css} from "../utils/template.js";

// @element x-message
export default class XMessageElement extends HTMLElement {
  static observedAttributes = ["href", "args"];

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  get href() {
    return this.hasAttribute("href") ? this.getAttribute("href") : "";
  }
  set href(href) {
    this.setAttribute("href", href);
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

  #localesChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
    else if (name === "href") {
      this.#update();
    }
    else if (name === "args") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #update() {
    await Xel.whenLocalesReady;

    let message = Xel.queryMessage(this.href, this.args);

    if (message.format === "html") {
      this.innerHTML = message.content;
    }
    else {
      this.textContent = message.content;
    }
  }
}

customElements.define("x-message", XMessageElement);
