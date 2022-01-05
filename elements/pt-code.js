
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

export default class PTCodeElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <link id="prism-theme" rel="stylesheet">
      <code id="code" class="language-html"></code>
    </template>
  `;

  static _shadowStyleSheet = css`
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
    return this._value;
  }
  set value(value) {
    this._value = value;
  }

  _value = "";
  _shadowRoot = null;
  _elements = {};
  _themeChangeListener = null;
  _observer = new MutationObserver(() => this._updateCode());
  _prismStyleSheet = new CSSStyleSheet();

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [PTCodeElement._shadowStyleSheet, this._prismStyleSheet];
    this._shadowRoot.append(document.importNode(PTCodeElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }
  }

  connectedCallback() {
    Xel.addEventListener("themechange", this._themeChangeListener = () => {
      this._updateTheme();
    });

    this._elements["code"].setAttribute("class", "language-" + (this.getAttribute("lang") || "html"));
    this._observer.observe(this, {childList: true, attributes: false, characterData: true, subtree: true});

    this._updateTheme();
    this._updateCode();
  }

  disconnectedCallback() {
    this._observer.disconnect();
    Xel.removeEventListener("themechange", this._themeChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _updateCode() {
    this._elements["code"].textContent = this.textContent;

    if (this._elements["code"].textContent !== "") {
      Prism.highlightElement(this._elements["code"], true);
    }
  }

  async _updateTheme() {
    let prismTheme = Xel.theme.includes("dark") ? "prism-dark" : "prism-coy";
    let cssText = await (await fetch(`/node_modules/prismjs/themes/${prismTheme}.css`)).text();
    this._prismStyleSheet.replaceSync(cssText);
  }
}

customElements.define("pt-code", PTCodeElement);
