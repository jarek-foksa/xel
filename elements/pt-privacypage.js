
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";

import {css} from "../utils/template.js";

export default class PTPrivacyPageElement extends PTPage {
  static _shadowStyleSheet = css`
    article h3,
    article h4,
    article h5 {
      margin-top: 0;
      position: relative;
    }

    article ul {
      margin-bottom: 0;
    }

    section {
      margin-bottom: 35px;
    }
    section:last-child {
      margin-bottom: 20px;
    }

    section + hr {
      margin: 26px 0;
    }

    x-card > footer {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      width: calc(100% + 2px);
      margin-left: -1px;
      margin-bottom: -1px;
      padding: 12px 20px;
      border-width: 1px;
      border-style: solid;
      line-height: 1.4;
      font-size: 13px;
    }
    x-card > footer > article > p:first-child {
      margin-top: 0;
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
        let viewHTML = await (await fetch("/docs/privacy.html")).text();
        this._shadowRoot.innerHTML = viewHTML;
      }

      resolve();
    });
  }
}

customElements.define("pt-privacypage", PTPrivacyPageElement);
