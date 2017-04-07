
// @info
//   Element responsible for displaying a platform-agnostic keyboard shortcut.
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-shortcut.css" data-vulcanize>
      <main id="main"></main>
    </template>
  `;

  let isAppleDevice = navigator.platform.startsWith("Mac") || ["iPhone", "iPad"].includes(navigator.platform);

  class XShortcutElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    attributeChangedCallback(name) {
      if (name === "key" || name === "ctrl" || name === "alt" || name === "shift" || name === "meta") {
        this._update();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["key", "ctrl", "alt", "shift", "meta"];
    }

    get key() {
      return this.getAttribute("key");
    }
    set key(key) {
      key ? this.setAttribute("key", key) : this.removeAttribute("key");
    }

    get ctrl() {
      return this.hasAttribute("ctrl");
    }
    set ctrl(ctrl) {
      ctrl ? this.setAttribute("ctrl", "") : this.removeAttribute("ctrl");
    }

    get alt() {
      return this.hasAttribute("alt");
    }
    set alt(alt) {
      alt ? this.setAttribute("alt", "") : this.removeAttribute("alt");
    }

    get shift() {
      return this.hasAttribute("shift");
    }
    set shift(shift) {
      shift ? this.setAttribute("shift", "") : this.removeAttribute("shift");
    }

    get meta() {
      return this.hasAttribute("meta");
    }
    set meta(meta) {
      meta ? this.setAttribute("meta", "") : this.removeAttribute("meta");
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _update() {
      let string = "";

      if (isAppleDevice) {
        if (this.meta)  string += "^";
        if (this.alt)   string += "⌥";
        if (this.shift) string += "⇧";
        if (this.ctrl)  string += "⌘";

        let mappings = {
          "ArrowUp": "↑",
          "ArrowDown": "↓",
          "ArrowLeft": "←",
          "ArrowRight": "→",
          "Backspace": "⌦"
        };

        if (this.key !== null) {
          string += mappings[this.key] || this.key;
        }
      }
      else {
        let parts = [];

        if (this.ctrl)  parts.push("Ctrl");
        if (this.alt)   parts.push("Alt");
        if (this.meta)  parts.push("Meta");
        if (this.shift) parts.push("Shift");

        let mappings = {
          "ArrowUp": "Up",
          "ArrowDown": "Down",
          "ArrowLeft": "Left",
          "ArrowRight": "Right"
        };

        if (this.key !== null) {
          parts.push(mappings[this.key] || this.key);
        }

        string = parts.join("+");
      }

      this["#main"].textContent = string;
    }
  }

  customElements.define("x-shortcut", XShortcutElement);
}
