
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import PTPage from "./pt-page.js";
import {html, css} from "../utils/template.js";

export default class PTAboutPageElement extends PTPage {
  static _shadowTemplate = html`
    <template>
      <div id="container">
        <h1>Xel</h1>
        <h2><x-message href="#slogan-1"></x-message></h2>
        <h2><x-message href="#slogan-2"></x-message></h2>
        <h2><x-message href="#slogan-3"></x-message></h2>
      </div>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      color: white;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      background: var(--accent-color);
    }

    ::selection {
      background: rgba(255, 255, 255, 0.3);
    }

    #container {
      margin: 0 auto;
      max-width: 500px;
    }

    h1 {
      font-size: 10rem;
      font-weight: 700;
      line-height: 0.75;
      margin: 0 0 40px 0;
      padding: 0;
      color: rgba(255,255,255);
    }

    h2 {
      font-size: 1.7rem;
      font-weight: 400;
      line-height: 1.05;
      color: rgba(255,255,255, 0.8);
      margin: 0 0 20px 0;
      text-transform: none;
    }

    h2 em {
      color: rgba(255,255,255, 0.95);
      font-style: normal;
      font-weight: 900;
    }

    :host([data-theme="/themes/fluent-dark.css"]),
    :host([data-theme="/themes/material-dark.css"]) {
      h1 {
        color: var(--background-color);
      }

      h2, h2 em {
        color: var(--foreground-color);
      }

      ::selection {
        color: var(--background-color);
      }
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  connectedCallback() {
    super.connectedCallback();

    this._onReady();
  }
}

customElements.define("pt-aboutpage", PTAboutPageElement);
