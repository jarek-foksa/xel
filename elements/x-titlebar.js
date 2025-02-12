
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

// @element x-titlebar
// @part buttons
// @part button
// @part close-button
// @part minimize-button
// @part maximize-button
// @part icon
// @event buttonclick - User clicked a titlebar button.
class XTitlebarElement extends HTMLElement {
  static observedAttributes = ["title"];

  static #shadowTemplate = html`
    <template>
      <slot></slot>

      <x-buttons part="buttons" id="buttons">
        <x-button id="minimize-button" value="minimize" skin="flat" part="button minimize-button" condensed>
          <svg part="icon" viewBox="0 0 100 100"><path></path></svg>
        </x-button>

        <x-button id="maximize-button" value="maximize" skin="flat" part="button maximize-button" condensed>
          <svg part="icon" viewBox="0 0 100 100"><path></path></svg>
        </x-button>

        <x-button id="restore-button" value="restore" skin="flat" part="button restore-button" condensed>
          <svg part="icon" viewBox="0 0 100 100"><path></path></svg>
        </x-button>

        <x-button id="close-button" value="close" skin="flat" part="button close-button" condensed>
          <svg part="icon" viewBox="0 0 100 100"><path></path></svg>
        </x-button>
      </x-buttons>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block flex;
      align-items: center;
      justify-content: space-evenly;
      width: 100%;
      height: 32px;
      gap: 16px;
      position: relative;
      box-sizing: border-box;
      app-region: drag;
    }

    /**
     * Title
     */

    ::slotted(*) {
      user-select: none;
    }

    /**
     * Buttons
     */

    #buttons {
      position: absolute;
    }
    :host([maximized])::part(maximize-button) {
      display: none;
    }
    :host(:not([maximized]))::part(restore-button) {
      display: none;
    }

    #buttons > x-button {
      margin: 0;
      app-region: no-drag;
    }

    #buttons > x-button > svg {
      fill: currentColor;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the window is maximized.
  get maximized() {
    return this.hasAttribute("maximized");
  }
  set maximized(maximized) {
    maximized ? this.setAttribute("maximized", "") : this.removeAttribute("maximized");
  }

  #shadowRoot;
  #xelThemeChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super() ;

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XTitlebarElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTitlebarElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#buttons"].addEventListener("click", (event) => this.#onButtonsClick(event));
  }

  async connectedCallback() {
    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#updateButtonsPathData());

    Xel.whenThemeReady.then(() => {
      this.#updateButtonsPathData();
    });
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onButtonsClick(event) {
    let button = event.target.closest("x-button");

    if (button) {
      this.dispatchEvent(new CustomEvent("buttonclick", {detail: button.value}));
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateButtonsPathData() {
    for (let button of this["#buttons"].children) {
      let pathData = getComputedStyle(button).getPropertyValue("--path-data");
      button.querySelector("path").setAttribute("d", pathData);
    }
  }
}

customElements.define("x-titlebar", XTitlebarElement);
