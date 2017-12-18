
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";
import {isDOMWhitespace, replaceAll} from "../utils/string.js";
import {themePath} from "../utils/theme.js";

let counter = 0;

let shadowTemplate = html`
  <template>
    <link rel="stylesheet" href="${themePath()}">
    <link rel="stylesheet" href="node_modules/xel/stylesheets/xel-demo.css" data-vulcanize>

    <main>
      <div id="live-view"></div>
      <xel-codeview id="code-view"></xel-codeview>
    </main>
  </template>
`;

export class XelDemoElement extends HTMLElement {
  static get observedAttributes() {
    return ["name"];
  }

  // @info
  //   Compact demo has a scrollable code view with limited max height.
  // @type
  //   boolean
  // @default
  //   false
  // @attribute
  get compact() {
    return this.hasAttribute("compact");
  }
  set compact(compact) {
    compact ? this.setAttribute("compact", "") : this.removeAttribute("compact");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  connectedCallback() {
    this["#code-view"].textContent = this._getDemoHTML();
  }

  attributeChangedCallback(name) {
    if (name === "name") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _getDemoHTML() {
    let container = document.createElement("div");
    let template = this.querySelector("template");

    if (!template) {
      return "";
    }

    let content = document.importNode(template.content, true);

    {
      let liveViewContent = content.cloneNode(true);
      window["shadowRoot" + counter] = this["#live-view"];
      let script = liveViewContent.querySelector("script");

      if (script) {
        let textContent = replaceAll(script.textContent, "document", `window.shadowRoot${counter}`);
        textContent = "{" + textContent + "}";
        script.textContent = textContent;
      }

      counter += 1;

      this["#live-view"].append(liveViewContent);
    }

    for (let child of content.childNodes) {
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

    let innerHTML = lines.join("\n");
    return innerHTML;
  }
}

customElements.define("xel-demo", XelDemoElement);
