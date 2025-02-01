
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

export default class PTCodeElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <link id="prism-theme" rel="stylesheet">
      <pre id="pre"><code id="code" class="language-html"></code></pre>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      width: 100%;
      display: block;
      box-sizing: border-box;
    }

    #code {
      white-space: pre-wrap;
      overflow-x: auto;
    }
  `;

  static #lightHighlightStylSheet = css`
    .token.comment,
    .token.block-comment,
    .token.prolog,
    .token.doctype,
    .token.cdata {
      color: color(srgb 0.49 0.55 0.6);
    }
    .token.punctuation {
      color: color(srgb 0.37 0.39 0.39);
    }
    .token.property,
    .token.tag,
    .token.boolean,
    .token.number,
    .token.function-name,
    .token.constant,
    .token.symbol,
    .token.deleted {
      color: color(srgb 0.79 0.17 0.17);
    }
    .token.selector,
    .token.attr-name,
    .token.string,
    .token.char,
    .token.function,
    .token.builtin,
    .token.inserted {
      color: color(srgb 0.18 0.61 0.04);
    }
    .token.operator,
    .token.entity,
    .token.url,
    .token.variable {
      color: color(srgb 0.65 0.5 0.35);
      background-color: color(srgb 1 1 1 / 0.5);
    }
    .token.atrule,
    .token.attr-value,
    .token.keyword,
    .token.class-name {
      color: color(srgb 0.1 0.56 0.72);
    }
    .token.regex,
    .token.important {
      color: color(srgb 0.93 0.6 0);
    }
    .language-css .token.string,
    .style .token.string {
      color: color(srgb 0.65 0.5 0.35);
      background-color: color(srgb 1 1 1 / 0.5);
    }
    .token.important {
      font-weight: normal;
    }
    .token.bold {
      font-weight: bold;
    }
    .token.italic {
      font-style: italic;
    }
    .token.namespace {
      opacity: 0.7;
    }
  `;

  static #darkHighlightStyleSheet = css`
    .token.comment,
    .token.prolog,
    .token.doctype,
    .token.cdata {
      color: color(srgb 0.6 0.5 0.4);
    }
    .token.punctuation {
      opacity: 0.7;
    }
    .token.namespace {
      opacity: 0.7;
    }
    .token.property,
    .token.tag,
    .token.boolean,
    .token.number,
    .token.constant,
    .token.symbol {
      color: color(srgb 0.82 0.58 0.62);
    }
    .token.selector,
    .token.attr-name,
    .token.string,
    .token.char,
    .token.builtin,
    .token.inserted {
      color: color(srgb 0.74 0.88 0.32);
    }
    .token.operator,
    .token.entity,
    .token.url,
    .language-css .token.string,
    .style .token.string,
    .token.variable {
      color: color(srgb 0.96 0.72 0.24);
    }
    .token.atrule,
    .token.attr-value,
    .token.keyword {
      color: color(srgb 0.82 0.58 0.62);
    }
    .token.regex,
    .token.important {
      color: color(srgb 0.93 0.6 0);
    }
    .token.important,
    .token.bold {
      font-weight: bold;
    }
    .token.italic {
      font-style: italic;
    }
    .token.deleted {
      color: red;
    }
  `;

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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTCodeElement.#shadowStyleSheet];
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

  #updateTheme() {
    if (Xel.theme.includes("dark")) {
      this.#shadowRoot.adoptedStyleSheets[2] = PTCodeElement.#darkHighlightStyleSheet;
    }
    else {
      this.#shadowRoot.adoptedStyleSheets[2] = PTCodeElement.#lightHighlightStylSheet;
    }
  }
}

customElements.define("pt-code", PTCodeElement);
