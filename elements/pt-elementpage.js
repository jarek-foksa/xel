
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";

import {css} from "../utils/template.js";

export default class PTElementPageElement extends PTPage {
  static _shadowStyleSheet = css`
    section {
      margin-bottom: 35px;
    }
    section:last-child {
      margin-bottom: 20px;
    }

    section + hr {
      margin: 26px 0;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default ""
  get value() {
    return this.hasAttribute("value") ? this.getAttribute("value") : "";
  }
  set value(value) {
    this.setAttribute("value", value);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async connectedCallback() {
    super.connectedCallback();

    await this.#update();

    // Wait until all blocks are ready
    await Promise.all(
      [...this._shadowRoot.querySelectorAll("pt-apiblock, pt-demoblock")].map(block => block.whenReady)
    );

    this._onReady();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    return new Promise(async (resolve) => {
      if (this._shadowRoot.childElementCount === 0) {
        let viewHTML = "";

        if (this.value !== "") {
          viewHTML = await (await fetch(`/docs/${this.value}.html`)).text();
        }

        this._shadowRoot.innerHTML = viewHTML;
      }

      resolve();
    });
  }
}

customElements.define("pt-elementpage", PTElementPageElement);
