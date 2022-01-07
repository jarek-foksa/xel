
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest} from "../utils/element.js";
import {css} from "../utils/template.js";

export default class PTPageElement extends HTMLElement {
  static _shadowStyleSheet = css`
    :host {
      display: block;
      box-sizing: border-box;
    }
  `;

  // @property
  // @type Promise
  get whenReady() {
    return new Promise((resolve) => {
      if (this.#readyCallbacks === null) {
        resolve();
      }
      else {
        this.#readyCallbacks.push(resolve);
      }
    });
  }

  _elements = {};
  _shadowRoot = null;
  #readyCallbacks = [];
  #ownerApp = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});

    if (this.constructor._shadowTemplate) {
      this._shadowRoot.append(document.importNode(this.constructor._shadowTemplate.content, true));
    }

    if (this.constructor._shadowStyleSheet) {
      this._shadowRoot.adoptedStyleSheets = [
        Xel.themeStyleSheet, PTPageElement._shadowStyleSheet, this.constructor._shadowStyleSheet
      ];
    }
    else {
      this._shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTPageElement._shadowStyleSheet];
    }

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this._shadowRoot.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this._shadowRoot.addEventListener("click", (event) => this.#onClick(event), true);
    this.setAttribute("extends", "pt-page");
  }

  connectedCallback() {
    this.#ownerApp = closest(this, "pt-app");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type string
  async scrollElementIntoView(elementID) {
    await this.whenReady;

    let element = this._shadowRoot.querySelector("#" + elementID);

    if (element) {
      element.scrollIntoView();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onReady() {
    if (this.#readyCallbacks !== null) {
      for (let callback of this.#readyCallbacks) {
        callback();
      }

      this.#readyCallbacks = null;
    }
  }

  #onPointerDown(event) {
    let downAnchor = event.target.closest("a");

    if (downAnchor) {
      // Don't focus the anchor with pointer
      event.preventDefault();
    }
  }

  #onClick(event) {
    // Clicked anchor
    {
      let clickedAnchor = event.target.closest("a");

      if (clickedAnchor) {
        let url = new URL(clickedAnchor.href);

        if (url.origin === location.origin) {
          event.preventDefault();
          this.#ownerApp.navigate(url.href);
        }
      }
    }
  }
}
