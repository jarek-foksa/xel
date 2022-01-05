
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";
import {html, css} from "../utils/template.js";

export default class PTAboutPageElement extends PTPage {
  static _shadowTemplate = html`
    <template>
      <main>
        <h1><span>X</span>el</h1>
        <h2><em>HTML 5</em> widget toolkit.</h2>
        <h2><em>Native-like</em> look and feel.</h2>
        <h2>For <em>Web</em>, <em>Electron</em> and <em>Hybrid</em> apps.</h2>
      </main>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      color: white;
      width: 100%;
      height: 100vh;
      display: flex;
      align-items: center;
    }

    ::selection {
      background: rgba(255, 255, 255, 0.3);
    }

    main {
      margin: 0 auto;
    }

    h1 {
      font-size: 170px;
      font-weight: 700;
      line-height: 1.5;
      margin: 0 0 50px 0;
      padding: 0;
      line-height: 1;
    }

    h1 span {
      font-size: 320px;
      line-height: 1;
    }

    h2 {
      font-size: 27px;
      font-weight: 400;
      line-height: 1.05;
      color: rgba(255,255,255, 0.8);
      margin: 0 0 20px 0;
      text-transform: none;
    }

    h2 em {
      color: rgba(255,255,255, 0.95);
      font-style: normal;
      font-weight: 700;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  connectedCallback() {
    super.connectedCallback();

    this._onReady();
  }
}

customElements.define("pt-aboutpage", PTAboutPageElement);
