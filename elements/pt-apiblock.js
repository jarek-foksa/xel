
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Xel from "../classes/xel.js";

import {parse as parseJsDocComments} from  "../node_modules/comment-parser/es6/index.js";

import {getIcons} from "../utils/icon.js";
import {escapeHTML} from "../utils/string.js";
import {html, css} from "../utils/template.js";

export default class PTApiBlockElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <x-card>
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
      </x-card>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
    }

    x-card {
      padding: 20px;
    }
    x-card:first-child {
      margin-top: 20px;
    }

    x-card > :first-child {
      margin-top: 0;
    }
    x-card > :last-child {
      margin-bottom: 0;
    }
    x-card > :first-child > :first-child {
      margin-top: 0;
    }

    section + section {
      margin-top: 24px;
    }

    table {
      width: 100%;
      margin: 0;
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
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * @property
   * @attribute
   * @type {string}
   * @default false
   */
  get value() {
    return this.getAttribute("value") || "";
  }
  set value(value) {
    value ? this.setAttribute("value", "") : this.removeAttribute("value");
  }

  get shadowRoot() {
    return this.#shadowRoot;
  }

  /**
   * @property
   * @type {Promise<void>}
   */
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

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTApiBlockElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTApiBlockElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
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
      let api = {
        elementName: "",
        className: "",
        properties: [],
        events: [],
        methods: [],
        parts: []
      };

      // Determine the API from JSDoc comments
      {
        let response = await fetch(this.value);
        let jsText = await response.text();

        // Assume everything below `customElements.define()` call to be private API
        {
          let endIndex = jsText.indexOf("customElements.define(");

          if (endIndex !== -1) {
            jsText = jsText.substring(0, endIndex);
          }
        }

        let jsLines = jsText.split(/\r\n|\n/);
        let comments = parseJsDocComments(jsText);

        for (let comment of comments) {
          let nextLineIndex = comment.source.at(-1).number + 1;
          let nextLineText = jsLines[nextLineIndex];
          let elementTag = comment.tags.find(tag => tag.tag === "element");

          // Element
          if (elementTag) {
            if (elementTag.name === "dialog") {
              api.className = "HTMLDialogElement";
            }
            else {
              api.className = nextLineText.substring(
                nextLineText.indexOf("class ") + 6,
                nextLineText.indexOf(" extends")
              );
            }

            for (let tag of comment.tags) {
              if (tag.tag === "element") {
                api.elementName = tag.name;
              }
              else if (tag.tag === "fires") {
                let name = tag.name;
                let bubbles = false;

                if (tag.name.startsWith("^")) {
                  name = name.substring(1);
                  bubbles = true;
                }

                api.events.push({
                  name: name,
                  description: tag.description.substring(2),
                  bubbles: bubbles
                });
              }
              else if (tag.tag === "part") {
                api.parts.push({
                  name: tag.name,
                  description: tag.description.substring(2)
                });
              }
            }
          }

          // Attribute/property
          else if (comment.tags.find(tag => tag.tag === "attribute" || tag.tag === "property")) {
            let propertyName = nextLineText.substring(
              nextLineText.indexOf("get ") + 4,
              nextLineText.indexOf("()")
            );

            let property = {
              propertyName: propertyName,
              attributeName: null,
              type: "",
              description: comment.description,
              default: undefined,
              readOnly: jsText.indexOf(`set ${propertyName}(`) === -1
            };

            for (let tag of comment.tags) {
              if (tag.tag === "attribute") {
                property.attributeName = tag.name || property.propertyName;
              }
              else if (tag.tag === "type") {
                property.type = tag.type;
              }
              else if (tag.tag === "default") {
                if (tag.source[0].source.includes(`"`)) {
                  property.default = `"${tag.name}"`;
                }
                else {
                  property.default = tag.name;
                }
              }
            }

            api.properties.push(property);
          }

          // Method
          else if (comment.tags.find(tag => tag.tag === "method")) {
            let method = {
              name: "",
              type: "",
              description: comment.description
            };

            method.name = nextLineText.substring(
              2,
              nextLineText.lastIndexOf(")") + 1
            );

            for (let tag of comment.tags) {
              if (tag.tag === "type") {
                method.type = tag.type;
              }
            }

            api.methods.push(method);
          }
        }
      }

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

        this["#element-table"].innerHTML = tableHTML;
      }

      // Properties
      {
        if (api.properties.length === 0) {
          this["#properties-section"].hidden = true;
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

          this["#properties-tables"].innerHTML = tablesHTML;
        }
      }

      // Events
      {
        if (api.events.length === 0) {
          this["#events-section"].hidden = true;
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

          this["#events-tables"].innerHTML = tablesHTML;
        }
      }

      // Methods
      {
        if (api.methods.length === 0) {
          this["#methods-section"].hidden = true;
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

          this["#methods-tables"].innerHTML = tablesHTML;
        }
      }

      // Parts
      {
        if (api.parts.length === 0) {
          this["#parts-section"].hidden = true;
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

          this["#parts-tables"].innerHTML = tablesHTML;
        }
      }

      // Icons
      {
        if (api.elementName !== "x-icon") {
          this["#icons-section"].hidden = true;
        }
        else {
          let materialIcons = await getIcons("/node_modules/xel/icons/material.svg");
          let ids = [...materialIcons.querySelectorAll("symbol")].map(symbol => symbol.id);

          let rowsHTML = `
            <tr>
              <th>ID</th>
              <th>Fluent</th>
              <th>Fluent Outlined</th>
              <th>Material</th>
              <th>Material Outlined</th>
            </tr>
          `;

          for (let id of ids) {
            rowsHTML += `
              <tr>
                <td>${id}</td>
                <td><x-icon href="/node_modules/xel/icons/fluent.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/icons/fluent-outlined.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/icons/material.svg#${id}"></x-icon></td>
                <td><x-icon href="/node_modules/xel/icons/material-outlined.svg#${id}"></x-icon></td>
              </tr>
            `;
          }

          this["#icons-table"].innerHTML = rowsHTML;
        }
      }

      resolve();
    });
  }
}

customElements.define("pt-apiblock", PTApiBlockElement);
