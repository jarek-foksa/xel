
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {closest, createElement} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-tabs
// @event ^change - Selected tab has changed.
export default class XTabsElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
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
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type string?
  // @default null
  //
  // The value of the currently selected tab. Null if there is no tab selected.
  get value() {
    let selectedTab = this.querySelector("x-tab[selected]");
    return selectedTab ? selectedTab.value : null;
  }
  set value(value) {
    let tabs = [...this.querySelectorAll("x-tab")];
    let selectedTab = (value === null) ? null : tabs.find(tab => tab.value === value);

    for (let tab of tabs) {
      tab.selected = (tab === selectedTab);
    }
  }

  _shadowRoot = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XTabsElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XTabsElement._shadowTemplate.content, true));

    this.addEventListener("click", (event) => this._onClick(event));
    this.addEventListener("keydown", (event) => this._onKeyDown(event));
  }

  connectedCallback() {
    this.setAttribute("role", "tablist");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async _onClick(event) {
    if (event.button !== 0) {
      return;
    }

    else if (event.target.closest("x-tab")) {
      let tabs = this.querySelectorAll("x-tab");
      let clickedTab = event.target.closest("x-tab");
      let selectedTab = this.querySelector("x-tab[selected]");

      if (clickedTab !== selectedTab) {
        if (selectedTab) {
          await selectedTab.animateSelectionIndicator(clickedTab);
        }

        for (let tab of tabs) {
          tab.selected = (tab === clickedTab);
        }

        this.dispatchEvent(new CustomEvent("change", {bubbles: true}));
      }
    }
  }

  _onKeyDown(event) {
    if (event.code === "Enter" || event.code === "Space") {
      let tab = event.target;
      let label = tab.querySelector("x-label");

      event.preventDefault();
      tab.click();
    }

    else if (event.code === "ArrowLeft") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
      let clickedTab = event.target;

      event.preventDefault();

      if (currentTab && tabs.length > 0) {
        let currentTabIndex = tabs.indexOf(currentTab);
        let previousTab = tabs[currentTabIndex - 1] || tabs[tabs.length - 1];

        currentTab.tabIndex = -1;
        previousTab.tabIndex = 0;
        previousTab.focus();
      }
    }

    else if (event.code === "ArrowRight") {
      let tabs = [...this.querySelectorAll("x-tab:not([disabled])")];
      let currentTab = this.querySelector(`x-tab[tabindex="0"]`);
      let clickedTab = event.target;

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
