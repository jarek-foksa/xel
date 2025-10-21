
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ChangelogParser from "../classes/changelog-parser.js";
import PTPage from "./pt-page.js";

import {css} from "../utils/template.js";

export default class PTChangelogPageElement extends PTPage {
  static _shadowStyleSheet = css`
    h3 {
      margin: 0;
      line-height: 1;
    }

    h4 {
      margin-top: 4px;
      opacity: 0.6;
      font-size: 0.875rem;
    }

    ul {
      margin-bottom: 0;
    }

    ul li > p {
      display: inline;
    }

    x-tag {
      vertical-align: middle;
      margin-bottom: 2px;
      margin-right: 4px;
      background: #ec407a;
      font-size: 0.8125rem;
      color: white;
      border-width: 0px;
    }
    x-tag:hover,
    x-tag:active {
      background: #ec407a;
      color: white;
    }
  `;

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
        let changelogMarkdown = await (await fetch("/CHANGELOG.md")).text();
        let changelog = new ChangelogParser().parse(changelogMarkdown);
        let changelogHTML = "<h1>Changelog</h1>";

        for (let release of changelog) {
          let itemsHTML = `<ul>`;

          let displayDate;

          if (release.date === "PENDING") {
            displayDate = "Pending";
          }
          else {
            displayDate = new Date(release.date).toLocaleString("en-US", {year: "numeric", month: "long", day: "numeric"});
          }

          for (let item of release.items) {
            let tagsHTML = item.tags.map(tag => `<x-tag size="small">${tag}</x-tag>`).join("");

            itemsHTML += `
              <li>${tagsHTML} ${this.#markdownToHTML(item.text)}</li>
            `;
          }

          itemsHTML += `</ul>`;

          changelogHTML += `
            <x-card>
              <h3 id="v${release.version}">Version ${release.version}</h3>
              <h4>${displayDate}</h4>
              ${itemsHTML}
            </x-card>
          `;
        }

        this._shadowRoot.innerHTML = changelogHTML;
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #markdownToHTML(markdown) {
    // @doc https://marked.js.org/using_advanced#options
    globalThis.marked.setOptions({
      gfm: true,
      highlight: (code, language) => {
        if (globalThis.Prism.languages[language]) {
          return globalThis.Prism.highlight(code, globalThis.Prism.languages[language], language);
        }
        else {
          return code;
        }
      }
    });

    let output = globalThis.marked.parse(markdown);
    return output;
  }
}

customElements.define("pt-changelogpage", PTChangelogPageElement);
