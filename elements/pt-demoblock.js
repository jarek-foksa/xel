
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {isDOMWhitespace, replaceAll} from "../utils/string.js";
import {html, css} from "../utils/template.js";

let counter = 0;

export default class PTDemoBlockElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <main>
        <div id="live-view"></div>
        <pt-code id="code-view"></pt-code>
      </main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
    }

    #code-view {
      margin-top: 25px;
    }
    :host([compact]) #code-view {
      max-height: 350px;
      overflow: scroll;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Compact demo has a scrollable code view with limited max height.
  get compact() {
    return this.hasAttribute("compact");
  }
  set compact(compact) {
    compact ? this.setAttribute("compact", "") : this.removeAttribute("compact");
  }

  // @property
  // @type Promise
  get whenReady() {
    return new Promise((resolve) => {
      if (this._readyCallbacks === null) {
        resolve();
      }
      else {
        this._readyCallbacks.push(resolve);
      }
    });
  }

  _readyCallbacks = [];
  _shadowRoot = null;
  _elements = {};
  _demoStyleSheet = new CSSStyleSheet();

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTDemoBlockElement._shadowStyleSheet, this._demoStyleSheet];
    this._shadowRoot.append(document.importNode(PTDemoBlockElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }
  }

  async connectedCallback() {
    await this._update();

    if (this._readyCallbacks !== null) {
      for (let callback of this._readyCallbacks) callback();
      this._readyCallbacks = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    return new Promise(async (resolve) => {
      let template = this.querySelector("template");

      if (!template) {
        return "";
      }

      let liveViewContent = document.importNode(template.content, true);
      let codeAreaContent = liveViewContent.cloneNode(true);

      // Live view
      {
        let styleElement = liveViewContent.querySelector("style");

        if (styleElement) {
          await this._demoStyleSheet.replaceSync(styleElement.textContent),
          styleElement.remove();
        }

        this._elements["live-view"].append(liveViewContent);

        let scripts = this._elements["live-view"].querySelectorAll("script");

        if (scripts.length > 0) {
          window["shadowRoot" + counter] = this._elements["live-view"];
          window["shadowRoot" + counter].createElement = (arg) => document.createElement(arg);

          for (let script of scripts) {
            let scriptText = "{" + replaceAll(script.textContent, "document", `window.shadowRoot${counter}`) + "}";
            eval(scriptText);
          }

          counter += 1;
        }
      }

      // Code area
      {
        let container = document.createElement("div");

        for (let child of codeAreaContent.childNodes) {
          container.append(child.cloneNode(true));
        }

        // Remove dynamically added attributes
        for (let element of container.querySelectorAll("*")) {
          if (element.localName.startsWith("x-")) {
            for (let {name, value} of [...element.attributes]) {
              if (name === "tabindex" || name === "role" || name.startsWith("aria")) {
                element.removeAttribute(name);
              }
            }
          }
        }

        let textContent = container.innerHTML;

        // Simplify boolean attributes
        textContent = replaceAll(textContent, `=""`, "");
        textContent = replaceAll(textContent, "demo", "document");

        let lines = textContent.split("\n");

        // Remove leading and trailing empty lines
        {
          if (isDOMWhitespace(lines[0])) {
            lines.shift();
          }

          if (isDOMWhitespace(lines[lines.length - 1])) {
            lines.pop();
          }
        }

        // Remove excesive indentation
        {
          let minIndent = Infinity;

          for (let line of lines) {
            if (isDOMWhitespace(line) === false) {
              let indent = 0;

              for (let char of line) {
                if (char === " ") {
                  indent += 1;
                }
                else {
                  break;
                }
              }

              if (indent < minIndent) {
                minIndent = indent;
              }
            }
          }

          lines = lines.map(line => line.substring(minIndent));
        }

        this._elements["code-view"].textContent = lines.join("\n");
      }

      resolve();
    });
  }
}

customElements.define("pt-demoblock", PTDemoBlockElement);
