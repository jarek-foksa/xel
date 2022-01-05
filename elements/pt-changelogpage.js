
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ChangelogParser from "../classes/changelog-parser.js";
import PTPage from "./pt-page.js";

import {css} from "../utils/template.js";

export default class PTChangelogPageElement extends PTPage {
  static _shadowStyleSheet = css`
    article h3 {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
    }

    article h4 {
      margin-top: 4px;
      opacity: 0.6;
      font-size: 14px;
    }

    article ul {
      margin-bottom: 0;
    }

    article ul li > p {
      display: inline;
    }

    article x-tag {
      vertical-align: middle;
      margin-bottom: 2px;
      margin-right: 4px;
      background: #ec407a;
      font-size: 13px;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async connectedCallback() {
    super.connectedCallback();
    await this._update();
    this._onReady();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    return new Promise(async (resolve) => {
      if (this._shadowRoot.childElementCount === 0) {
        let changelogMarkdown = await (await fetch("/CHANGELOG.md")).text();
        let changelog = new ChangelogParser().parse(changelogMarkdown);
        let changelogHTML = "";

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
            let tagsHTML = item.tags.map(tag => `<x-tag size="small" skin="colored">${tag}</x-tag>`).join("");

            itemsHTML += `
              <li>${tagsHTML} ${this._markdownToHTML(item.text)}</li>
            `;
          }

          itemsHTML += `</ul>`;

          changelogHTML += `
            <x-card>
              <main>
                <h3 id="v${release.version}">Version ${release.version}</h3>
                <h4>${displayDate}</h4>
                ${itemsHTML}
              </main>
            </x-card>
          `;
        }

        this._shadowRoot.innerHTML = `
          <article>
            <h2>Changelog</h2>
            ${changelogHTML}
          </article>
        `;
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _markdownToHTML(markdown) {
    // @doc https://marked.js.org/using_advanced#options
    marked.setOptions({
      gfm: true,
      highlight: (code, language, callback) => {
        if (Prism.languages[language]) {
          return Prism.highlight(code, Prism.languages[language], language);
        }
        else {
          return code;
        }
      }
    });

    let output = marked.parse(markdown);
    return output;
  }
}

customElements.define("pt-changelogpage", PTChangelogPageElement);
