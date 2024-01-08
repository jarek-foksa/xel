
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";
import {css} from "../utils/template.js";

export default class PTFaqPageElement extends PTPage {
  static _shadowStyleSheet = css`
    article h4 {
      margin-top: 0;
    }

    article ul {
      margin-bottom: 0;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async connectedCallback() {
    super.connectedCallback();

    await this.#update();
    this._onReady();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    return new Promise(async (resolve) => {
      if (this._shadowRoot.childElementCount === 0) {
        let viewHTML = await (await fetch("/docs/faq.html")).text();
        this._shadowRoot.innerHTML = viewHTML;
      }

      resolve();
    });
  }
}

customElements.define("pt-faqpage", PTFaqPageElement);
