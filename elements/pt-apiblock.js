
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";
import ApiParser from "../classes/api-parser.js";

import {getIconset} from "../utils/icon.js";
import {escapeHTML} from "../utils/string.js";
import {html, css} from "../utils/template.js";

export default class PTApiBlockElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <article>
        <section id="element-section">
          <h4>Element</h4>
          <table id="element-table"></table>
        </section>

        <section id="properties-section">
          <h4>Properties</h4>
          <div id="properties-tables"></div>
        </section>

        <section id="methods-section">
          <h4>Methods</h4>
          <div id="methods-tables"></div>
        </section>

        <section id="events-section">
          <h4>Events</h4>
          <div id="events-tables"></div>
        </section>

        <section id="parts-section">
          <h4>Parts</h4>
          <div id="parts-tables"></div>
        </section>

        <section id="icons-section">
          <h4>Icons</h4>
          <table id="icons-table"></table>
        </section>
      </article>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
    }

    table {
      width: 100%;
    }
    table + table {
      margin-top: 22px;
    }

    table th,
    table td {
      padding: 4px 9px;
    }
    table th:first-child,
    table td:first-child {
      width: 140px;
    }
    table tr:first-child td:last-child {
      font-weight: 900;
    }

    table x-tag {
      display: table-cell;
    }
    table x-tag[hidden] {
      display: none;
    }

    #icons-table th:not(:first-child),
    #icons-table td:not(:first-child) {
      text-align: center;
      width: 10%;
    }

    #icons-table x-icon {
      margin: 0 auto;
      width: 20px;
      height: 20px;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type string
  // @default false
  get value() {
    return this.getAttribute("value") || "";
  }
  set value(value) {
    value ? this.setAttribute("value", "") : this.removeAttribute("value");
  }

  get shadowRoot() {
    return this.#shadowRoot;
  }

  // @property
  // @type Promise
  get whenReady() {
    return new Promise((resolve) => {
      if (this.#readyCallbacks === null) {
        resolve();
      }
      else {
        this.#readyCallbacks.push(resolve);
      }
    });
  }

  #readyCallbacks = [];
  #shadowRoot = null;
  #elements = {};

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTApiBlockElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTApiBlockElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }
  }

  async connectedCallback() {
    await this.#update();

    if (this.#readyCallbacks !== null) {
      for (let callback of this.#readyCallbacks) callback();
      this.#readyCallbacks = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    return new Promise(async (resolve) => {
      let response = await fetch(this.value);
      let jsText = await response.text();
      let api = new ApiParser().parse(jsText);

      // Element
      {
        let tableHTML = /* syntax: html */ `
          <tr>
            <td>Tag</td>
            <td><code>${api.elementName}</code></td>
          </tr>
          <tr>
            <td>Class</td>
            <td><code>${api.className}</code></td>
          </tr>
          <tr>
            <td>Source</td>
            <td>
              <code><a href="https://github.com/jarek-foksa/xel/tree/master/elements/${api.elementName}.js">
                elements/${api.elementName}.js</a></code>
            </td>
          </tr>
        `;

        this.#elements["element-table"].innerHTML = tableHTML;
      }

      // Properties
      {
        if (api.properties.length === 0) {
          this.#elements["properties-section"].hidden = true;
        }
        else {
          let tablesHTML = "";

          for (let property of api.properties) {
            let typeHTML = "";

            if (Array.isArray(property.type)) {
              typeHTML = property.type.map(val => `<code>${escapeHTML(val)}</code>`).join(" || ")
            }
            else {
              typeHTML = `<code>${escapeHTML(property.type)}</code>`;
            }

            tablesHTML += /* syntax: html */ `
              <table class="property-table">
                <tr>
                  <td>Property</td>
                  <td><code>${property.propertyName}</code></td>
                </tr>
                <tr ${property.attributeName === null ? "hidden" : ""}>
                  <td>Attribute</td>
                  <td><code>${property.attributeName}</code></td>
                </tr>
                <tr>
                  <td>Type</td>
                  <td>${typeHTML}</td>
                </tr>
                <tr ${property.default === undefined ? "hidden" : ""}>
                  <td>Default</td>
                  <td><code>${escapeHTML(property.default)}</code></td>
                </tr>
                <tr>
                  <td>Access</td>
                  <td>
                    <x-tag value="read"><x-label>Read</x-label></x-tag>
                    <x-tag value="write" ${property.readOnly ? "hidden" : ""}><x-label>Write</x-label></x-tag>
                  </td>
                </tr>
                <tr ${property.description === "" ? "hidden" : ""}>
                  <td>Description</td>
                  <td>${property.description}</td>
                </tr>
              </table>
            `;
          }

          this.#elements["properties-tables"].innerHTML = tablesHTML;
        }
      }

      // Events
      {
        if (api.events.length === 0) {
          this.#elements["events-section"].hidden = true;
        }
        else {
          let tablesHTML = "";

          for (let event of api.events) {
            tablesHTML += /* syntax: html */ `
              <table class="event-table">
                <tr>
                  <td>Event</td>
                  <td><code>${event.name}</code></td>
                </tr>
                <tr>
                  <td>Bubbles</td>
                  <td>${event.bubbles ? "Yes" : "No"}</td>
                </tr>
                <tr ${event.description === "" ? "hidden" : ""}>
                  <td>Description</td>
                  <td>${event.description}</td>
                </tr>
              </table>
            `;
          }

          this.#elements["events-tables"].innerHTML = tablesHTML;
        }
      }

      // Methods
      {
        if (api.methods.length === 0) {
          this.#elements["methods-section"].hidden = true;
        }
        else {
          let tablesHTML = "";

          for (let method of api.methods) {
            tablesHTML += /* syntax: html */ `
              <table class="method-table">
                <tr>
                  <td>Method</td>
                  <td><code>${escapeHTML(method.name)}</code></td>
                </tr>
                <tr>
                  <td>Type</td>
                  <td><code>${escapeHTML(method.type)}</code></td>
                </tr>
                <tr ${method.description === "" ? "hidden" : ""}>
                  <td>Description</td>
                  <td>${method.description}</td>
                </tr>
              </table>
            `;
          }

          this.#elements["methods-tables"].innerHTML = tablesHTML;
        }
      }

      // Parts
      {
        if (api.parts.length === 0) {
          this.#elements["parts-section"].hidden = true;
        }
        else {
          let tablesHTML = "";

          for (let part of api.parts) {
            tablesHTML += /* syntax: html */ `
              <table class="part-table">
                <tr>
                  <td>Part</td>
                  <td><code>${part.name}</code></td>
                </tr>
                <tr>
                  <td>Selector</td>
                  <td><code>${api.elementName}::part(${part.name})</code></td>
                </tr>
                <tr ${part.description === "" ? "hidden" : ""}>
                  <td>Description</td>
                  <td>${part.description}</td>
                </tr>
              </table>
            `;
          }

          this.#elements["parts-tables"].innerHTML = tablesHTML;
        }
      }

      // Icons
      {
        if (api.elementName !== "x-icon") {
          this.#elements["icons-section"].hidden = true;
        }
        else {
          let materialIconset = await getIconset("/node_modules/xel/iconsets/material.svg");
          let ids = [...materialIconset.querySelectorAll("symbol")].map(symbol => symbol.id);

          let rowsHTML = `
            <tr>
              <th>Name</th>
              <th>Material</th>
              <th>Material Outlined</th>
              <th>Fluent</th>
              <th>Fluent Outlined</th>
            </tr>
          `;

          for (let id of ids) {
            rowsHTML += `
              <tr>
                <td>${id}</td>
                <td><x-icon href="/node_modules/xel/iconsets/material.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/iconsets/material-outlined.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/iconsets/fluent.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/iconsets/fluent-outlined.svg#${id}"></x-icon></td>
              </tr>
            `;
          }

          this.#elements["icons-table"].innerHTML = rowsHTML;
        }
      }

      resolve();
    });
  }
}

customElements.define("pt-apiblock", PTApiBlockElement);
