
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

const APPLE_DEVICE = navigator.platform.startsWith("Mac") || ["iPhone", "iPad"].includes(navigator.platform);

// @doc https://www.w3.org/TR/uievents-key/#keys-modifier
const MOD_KEYS = [
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

// @element x-shortcut
export default class XShortcutElement extends HTMLElement {
  static observedAttributes = ["value"];

  static #shadowTemplate = html`
    <template>
      <main id="main"></main>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      font-size: 14px;
      line-height: 1;
    }
    :host([hidden]) {
      display: none;
    }

    ::selection {
      color: var(--selection-color);
      background-color: var(--selection-background-color);
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type Array<string>
  // @default []
  //
  // The keyboard shortcut in form of an array of <a href="https://www.w3.org/TR/uievents-key/">DOM key names</a>.
  // The attribute value keys should be separated by a "+" sign.
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

  // @property
  // @type Array<string>
  // @default []
  // @readOnly
  //
  // <a href="https://www.w3.org/TR/uievents-key/#keys-modifier">Modifier key names</a> contained by <code>value</code>.
  get modKeys() {
    return this.value.filter(key => MOD_KEYS.includes(key));
  }

  // @property
  // @type String?
  // @default null
  // @readOnly
  //
  // Non-modifier key name contained by <code>value</code>.
  get normalKey() {
    let key = this.value.find(key => MOD_KEYS.includes(key) === false);
    return key === undefined ? null : key;
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XShortcutElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XShortcutElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }
  }

  attributeChangedCallback(name) {
    if (name === "value") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    let displayValue = "";
    let keys = this.value;
    let modKeys = this.modKeys;
    let normalKey = this.normalKey;

    if (APPLE_DEVICE) {
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
