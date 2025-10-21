
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {html, css} from "../utils/template.js";

// @element x-tabs
// @event ^change - Toggled tab has changed.
export default class XTabsElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      position: relative;
      display: flex;
      margin: 0 auto;
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
      justify-content: center;
    }
    ::slotted(x-tab) {
      flex: 0;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type string?
  // @default null
  //
  // The value of the currently toggled tab. Null if there is no tab toggled.
  get value() {
    let toggledTab = this.querySelector("x-tab[toggled]");
    return toggledTab ? toggledTab.value : null;
  }
  set value(value) {
    let tabs = [...this.querySelectorAll("x-tab")];
    let toggledTab = (value === null) ? null : tabs.find(tab => tab.value === value);

    for (let tab of tabs) {
      tab.toggled = (tab === toggledTab);
    }
  }

  #shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [XTabsElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTabsElement.#shadowTemplate.content, true));

    this.addEventListener("click", (event) => this.#onClick(event));
    this.addEventListener("keydown", (event) => this.#onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "tablist");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #onClick(event) {
    if (event.buttons > 1) {
      return;
    }

    else if (event.target.closest("x-tab")) {
      let tabs = this.querySelectorAll("x-tab");
      let clickedTab = event.target.closest("x-tab");
      let toggledTab = this.querySelector("x-tab[toggled]");

      if (clickedTab !== toggledTab) {
        if (toggledTab) {
          await toggledTab.animateSelectionIndicator(clickedTab);
        }

        for (let tab of tabs) {
          tab.toggled = (tab === clickedTab);
        }

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
      let tab = event.target;

      event.preventDefault();
      tab.click();
    }

    else if (event.code === "ArrowLeft") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);

      event.preventDefault();

      if (currentTab && tabs.length > 0) {
        let currentTabIndex = tabs.indexOf(currentTab);
        let previousTab = tabs[currentTabIndex - 1] || tabs.at(-1);

        currentTab.tabIndex = -1;
        previousTab.tabIndex = 0;
        previousTab.focus();
      }
    }

    else if (event.code === "ArrowRight") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);

      event.preventDefault();

      if (currentTab && tabs.length > 0) {
        let currentTabIndex = tabs.indexOf(currentTab);
        let nextTab = tabs[currentTabIndex + 1] || tabs[0];

        currentTab.tabIndex = -1;
        nextTab.tabIndex = 0;
        nextTab.focus();
      }
    }
  }
}

customElements.define("x-tabs", XTabsElement);
