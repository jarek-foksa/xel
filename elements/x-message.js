
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isNumeric, isString, toTitleCase} from "../utils/string.js";
import {html, css} from "../utils/template.js";

// @element x-message
export default class XMessageElement extends HTMLElement {
  static observedAttributes = ["href", "args", "autocapitalize", "ellipsis"];

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
        let [key, ...values] = serializedArg.split(":");
        let value = values.join(":");

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

  // @property
  // @attribute
  // @type boolean
  // @default false
  get autocapitalize() {
    return this.hasAttribute("autocapitalize") ? true : false;
  }
  set autocapitalize(autocapitalize) {
    if (autocapitalize) {
      this.setAttribute("autocapitalize", "");
    }
    else {
      this.removeAttribute("autocapitalize");
    }
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to show an ellipsis at the end of the message text.
  get ellipsis() {
    return this.hasAttribute("ellipsis");
  }
  set ellipsis(ellipsis) {
    ellipsis ? this.setAttribute("ellipsis", "") : this.removeAttribute("ellipsis");
  }

  // @property
  // @type Promise
  get whenReady() {
    return new Promise((resolve) => {
      if (this.#whenReadyCallbacks === null) {
        resolve();
      }
      else {
        this.#whenReadyCallbacks.push(resolve);
      }
    });
  }

  #localesChangeListener = null;
  #themeChangeListener = null;
  #whenReadyCallbacks = [];
  #defaultContent = "";

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    if (this.textContent.length > 0) {
      this.#defaultContent = this.textContent;
    }
  }

  connectedCallback() {
    this.#update();

    Xel.addEventListener("localeschange", this.#localesChangeListener = () => {
      this.#update();
    });

    Xel.addEventListener("themechange", this.#themeChangeListener = () => {
      this.#update();
    });
  }

  disconnectedCallback() {
    Xel.removeEventListener("localeschange", this.#localesChangeListener);
    Xel.removeEventListener("themechange", this.#themeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || this.isConnected === false) {
      return;
    }
    else if (name === "href") {
      this.#update();
    }
    else if (name === "args") {
      this.#update();
    }
    else if (name === "autocapitalize") {
      this.#update();
    }
    else if (name === "ellipsis") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #update() {
    await Xel.whenLocalesReady;

    let message = Xel.queryMessage(this.href, this.args);

    if (message.fallback && this.#defaultContent) {
      this.textContent = this.#defaultContent;
    }
    else {
      if (message.format === "html") {
        this.innerHTML = message.content + (this.ellipsis ? "…" : "");
      }
      else {
        if (this.autocapitalize === true && Xel.autocapitalize === "titlecase") {
          this.textContent = toTitleCase(message.content) + (this.ellipsis ? "…" : "");
        }
        else {
          this.textContent = message.content + (this.ellipsis ? "…" : "");
        }
      }
    }

    if (this.#whenReadyCallbacks !== null) {
      for (let callback of this.#whenReadyCallbacks) {
        callback();
      }

      this.#whenReadyCallbacks = null;
    }
  }
}

customElements.define("x-message", XMessageElement);
