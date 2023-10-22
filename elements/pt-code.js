
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

export default class PTCodeElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <link id="prism-theme" rel="stylesheet">
      <code id="code" class="language-html"></code>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
      background: white;
      padding: 14px;
    }

    ::selection {
      background: var(--selection-background-color);
      color: var(--selection-color);
    }

    #code {
      display: block;
      white-space: pre-wrap;
      overflow-x: auto;
      font-size: 13px;
      line-height: 18px;
      outline: none;
      background: none;
      padding: 0;
    }

    #code,
    #code * {
      text-shadow: none !important;
      opacity: 1;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type string
  // @default ""
  get value() {
    return this.#value;
  }
  set value(value) {
    this.#value = value;
  }

  #value = "";
  #shadowRoot = null;
  #themeChangeListener = null;
  #observer = new MutationObserver(() => this.#updateCode());
  #prismStyleSheet = new CSSStyleSheet();

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [PTCodeElement.#shadowStyleSheet, this.#prismStyleSheet];
    this.#shadowRoot.append(document.importNode(PTCodeElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    Xel.addEventListener("themechange", this.#themeChangeListener = () => {
      this.#updateTheme();
    });

    this["#code"].setAttribute("class", "language-" + (this.getAttribute("lang") || "html"));
    this.#observer.observe(this, {childList: true, attributes: false, characterData: true, subtree: true});

    this.#updateTheme();
    this.#updateCode();
  }

  disconnectedCallback() {
    this.#observer.disconnect();
    Xel.removeEventListener("themechange", this.#themeChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateCode() {
    this["#code"].textContent = this.textContent;

    if (this["#code"].textContent !== "") {
      Prism.highlightElement(this["#code"], true);
    }
  }

  async #updateTheme() {
    let prismTheme = Xel.theme.includes("dark") ? "prism-dark" : "prism-coy";
    let cssText = await (await fetch(`/node_modules/prismjs/themes/${prismTheme}.css`)).text();
    this.#prismStyleSheet.replaceSync(cssText);
  }
}

customElements.define("pt-code", PTCodeElement);
