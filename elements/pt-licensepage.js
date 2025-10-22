
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import PTPage from "./pt-page.js";

export default class PTLicensePageElement extends PTPage {
  async connectedCallback() {
    super.connectedCallback();
    await this.#update();
    this._onReady();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    return new Promise(async (resolve) => {
      if (this._shadowRoot.childElementCount === 0) {
        let viewHTML = await (await fetch("/docs/license.html")).text();
        this._shadowRoot.innerHTML = viewHTML;
      }

      resolve();
    });
  }
}

customElements.define("pt-licensepage", PTLicensePageElement);
