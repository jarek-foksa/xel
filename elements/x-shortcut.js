
// @info
//   Element responsible for displaying a platform-agnostic keyboard shortcut.
// @copyright
//   © 2016-2017 Jarosław Foksa

import {html} from "../utils/element.js";

let isAppleDevice = navigator.platform.startsWith("Mac") || ["iPhone", "iPad"].includes(navigator.platform);

// @doc
//   https://www.w3.org/TR/uievents-key/#keys-modifier
let modKeys = [
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Fn",
  "FnLock",
  "Meta",
  "NumLock",
  "ScrollLock",
  "Shift",
  "Symbol",
  "SymbolLock"
];

let shadowTemplate = html`
  <template>
    <style>
      :host {
        display: inline-block;
        box-sizing: border-box;
        font-size: 14px;
        line-height: 1;
      }
    </style>

    <main id="main"></main>
  </template>
`;

export class XShortcutElement extends HTMLElement {
  static get observedAttributes() {
    return ["value"];
  }

  // @type
  //   Array<string>
  // @default
  //   []
  // @attribute
  get value() {
    let value = [];

    if (this.hasAttribute("value")) {
      let parts = this.getAttribute("value").replace("++", "+PLUS").split("+");
      parts = parts.map($0 => $0.trim().replace("PLUS", "+")).filter($0 => $0 !== "");
      value = parts;
    }

    return value;
  }
  set value(value) {
    this.setAttribute("value", value.join("+"));
  }

  // @type
  //   Array<string>
  get modKeys() {
    return this.value.filter(key => modKeys.includes(key));
  }

  // @type
  //   String?
  get normalKey() {
    let key = this.value.find(key => modKeys.includes(key) === false);
    return key === undefined ? null : key;
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

  attributeChangedCallback(name) {
    if (name === "value") {
      this._update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    let displayValue = "";

    let keys = this.value;
    let modKeys = this.modKeys;
    let normalKey = this.normalKey;

    if (isAppleDevice) {
      if (modKeys.includes("Meta")) {
        displayValue += "^";
      }
      if (modKeys.includes("Alt")) {
        displayValue += "⌥";
      }
      if (modKeys.includes("Shift")) {
        displayValue += "⇧";
      }
      if (modKeys.includes("Control")) {
        displayValue += "⌘";
      }
      if (modKeys.includes("Symbol")) {
        displayValue += "☺";
      }

      let mappings = {
        "ArrowUp": "↑",
        "ArrowDown": "↓",
        "ArrowLeft": "←",
        "ArrowRight": "→",
        "Backspace": "⌦"
      };

      if (normalKey !== undefined) {
        displayValue += mappings[normalKey] || normalKey;
      }
    }
    else {
      let parts = [];

      if (modKeys.includes("Control")) {
        parts.push("Ctrl");
      }
      if (modKeys.includes("Alt")) {
        parts.push("Alt");
      }
      if (modKeys.includes("Meta")) {
        parts.push("Meta");
      }
      if (modKeys.includes("Shift")) {
        parts.push("Shift");
      }
      if (modKeys.includes("Symbol")) {
        parts.push("Symbol");
      }

      let mappings = {
        "ArrowUp": "Up",
        "ArrowDown": "Down",
        "ArrowLeft": "Left",
        "ArrowRight": "Right"
      };

      if (normalKey !== null) {
        parts.push(mappings[normalKey] || normalKey);
      }

      displayValue = parts.join("+");
    }

    this["#main"].textContent = displayValue;
  }
}

customElements.define("x-shortcut", XShortcutElement);
