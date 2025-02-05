
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import "./pt-aboutpage.js";
import "./pt-setuppage.js";
import "./pt-changelogpage.js";
import "./pt-licensepage.js";
import "./pt-elementpage.js";

import "./pt-apiblock.js";
import "./pt-demoblock.js";
import "./pt-code.js";
import "./pt-settings.js";
import "./pt-sidebar.js";

import {removeDuplicates} from "../utils/array.js";
import {html, css} from "../utils/template.js";
import {sleep, debounce} from "../utils/time.js";

// @event locationchange
export default class PTAppElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <pt-sidebar id="sidebar">
        <div id="branding">
          <x-box>
            <x-icon href="/icons/portal.svg#xel"></x-icon>
            <h1>Xel</h1>
          </x-box>
        </div>

        <hr/>

        <x-nav id="nav">
          <a href="/">
            <x-navitem>
              <x-icon href="#help"></x-icon>
              <x-label><x-message href="#about" autocapitalize></x-message></x-label>
            </x-navitem>
          </a>

          <a href="/setup">
            <x-navitem>
              <x-icon href="#wrench"></x-icon>
              <x-label><x-message href="#setup" autocapitalize></x-message></x-label>
            </x-navitem>
          </a>

          <x-navitem>
            <x-icon href="#tune"></x-icon>
            <x-label><x-message href="#elements" autocapitalize></x-message></x-label>

            <x-nav>
              <a href="/elements/x-accordion">
                <x-navitem>
                  <x-label>x-accordion</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-box">
                <x-navitem>
                  <x-label>x-box</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-button">
                <x-navitem>
                  <x-label>x-button</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-buttons">
                <x-navitem>
                  <x-label>x-buttons</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-card">
                <x-navitem>
                  <x-label>x-card</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-checkbox">
                <x-navitem>
                  <x-label>x-checkbox</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-colorpicker">
                <x-navitem>
                  <x-label>x-colorpicker</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-colorselect">
                <x-navitem>
                  <x-label>x-colorselect</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-contextmenu">
                <x-navitem>
                  <x-label>x-contextmenu</x-label>
                </x-navitem>
              </a>

              <a href="/elements/dialog">
                <x-navitem>
                  <x-label>&nbsp;&nbsp;&nbsp;dialog</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-icon">
                <x-navitem>
                  <x-label>x-icon</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-input">
                <x-navitem>
                  <x-label>x-input</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-label">
                <x-navitem>
                  <x-label>x-label</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-menu">
                <x-navitem>
                  <x-label>x-menu</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-menuitem">
                <x-navitem>
                  <x-label>x-menuitem</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-menubar">
                <x-navitem>
                  <x-label>x-menubar</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-message">
                <x-navitem>
                  <x-label>x-message</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-nav">
                <x-navitem>
                  <x-label>x-nav</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-navitem">
                <x-navitem>
                  <x-label>x-navitem</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-notification">
                <x-navitem>
                  <x-label>x-notification</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-numberinput">
                <x-navitem>
                  <x-label>x-numberinput</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-pager">
                <x-navitem>
                  <x-label>x-pager</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-popover">
                <x-navitem>
                  <x-label>x-popover</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-progressbar">
                <x-navitem>
                  <x-label>x-progressbar</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-radio">
                <x-navitem>
                  <x-label>x-radio</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-radios">
                <x-navitem>
                  <x-label>x-radios</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-select">
                <x-navitem>
                  <x-label>x-select</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-shortcut">
                <x-navitem>
                  <x-label>x-shortcut</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-slider">
                <x-navitem>
                  <x-label>x-slider</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-stepper">
                <x-navitem>
                  <x-label>x-stepper</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-swatch">
                <x-navitem>
                  <x-label>x-swatch</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-switch">
                <x-navitem>
                  <x-label>x-switch</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tab">
                <x-navitem>
                  <x-label>x-tab</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tabs">
                <x-navitem>
                  <x-label>x-tabs</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tag">
                <x-navitem>
                  <x-label>x-tag</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tags">
                <x-navitem>
                  <x-label>x-tags</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tagsinput">
                <x-navitem>
                  <x-label>x-tagsinput</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-texteditor">
                <x-navitem>
                  <x-label>x-texteditor</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-throbber">
                <x-navitem>
                  <x-label>x-throbber</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-titlebar">
                <x-navitem>
                  <x-label>x-titlebar</x-label>
                </x-navitem>
              </a>

              <a href="/elements/x-tooltip">
                <x-navitem>
                  <x-label>x-tooltip</x-label>
                </x-navitem>
              </a>
            </x-nav>
          </x-navitem>

          <a href="/changelog">
            <x-navitem>
              <x-icon href="#calendar"></x-icon>
              <x-label><x-message href="#changelog" autocapitalize></x-message></x-label>
            </x-navitem>
          </a>

          <a href="/license">
            <x-navitem>
              <x-icon href="#paste"></x-icon>
              <x-label><x-message href="#license" autocapitalize></x-message></x-label>
            </x-navitem>
          </a>

          <a href="https://github.com/jarek-foksa/xel/issues" target="_blank">
            <x-navitem>
              <x-icon href="#visibility-visible"></x-icon>
              <x-label><x-message href="#issues" autocapitalize></x-message></x-label>
              <x-icon href="#open"></x-icon>
            </x-navitem>
            </a>

          <a href="https://github.com/jarek-foksa/xel" target="_blank">
            <x-navitem>
              <x-icon href="#code"></x-icon>
              <x-label><x-message href="#source-code" autocapitalize></x-message></x-label>
              <x-icon href="#open"></x-icon>
            </x-navitem>
          </a>
        </x-nav>

        <hr/>

        <pt-settings id="settings"></pt-settings>

        <hr/>

        <div id="copyright">© 2016-2025 <a id="contact-anchor" href="mailto:jarek@xel-toolkit.org">Jarosław Foksa</a></div>
      </pt-sidebar>

      <div id="container">
        <header id="header">
          <div id="header-inner">
            <x-button id="sidebar-button" skin="flat">
              <x-icon href="#menu"></x-icon>
              <dialog id="sidebar-drawer"></dialog>
            </x-button>

            <x-box>
              <x-icon id="logo" href="/icons/portal.svg#xel"></x-icon>
              <h1>Xel</h1>
            </x-box>

            <div id="header-placeholder"></div>
          </div>
        </header>

        <main id="main"></main>
      </div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      position: relative;
      display: flex;
      flex-flow: row;
      width: 100%;
      height: 100%
    }
    :host([hidden]) {
      display: none;
    }

    #container {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 20px;
      min-height: 20px;
      position: relative;
      flex: 1;
      overflow: auto;
    }

    /**
     * Header
     */

    #header {
      background-color: var(--foreground-color);
      border-bottom-width: 1px;
      border-bottom-style: solid;
      border-bottom-color: var(--border-color);
    }

    #header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 30px;
      max-width: 700px;
      box-sizing: border-box;
    }
    :host([layout="collapsed"]) #header-inner {
      margin: 0 auto;
      padding: 0 15px;
    }

    #header #sidebar-button > x-icon {
      width: 22px;
      height: 22px;
    }

    #header #logo {
      width: 38px;
      height: 38px;
      color: var(--accent-color);
    }

    #header h1 {
      margin: 0 0 0 4px;
      font-size: 24px;
      line-height: 1;
    }

    #header-placeholder {
      width: 26px;
    }

    /**
     * Main
     */

    #main > * {
      margin: 0;
      padding: 0 30px;
      max-width: 700px;
    }
    :host([layout="collapsed"]) #main > * {
      margin: 0 auto;
      padding: 0 15px;
    }
    #main > pt-aboutpage {
      margin: 0;
      padding: 0 100px;
      max-width: none;
    }

    /**
     * Sidebar
     */

    #sidebar-drawer {
      left: 0;
      right: auto;
      width: fit-content;
      height: 100%;
      min-width: 0;
      max-width: none;
      overflow: visible;
      background: none;
      border-width: 0px;
      border-radius: 0;
    }

    #sidebar {
      width: 280px;
      background: var(--foreground-color);
      border-right-width: 1px;
      border-right-style: solid;
      border-right-color: var(--border-color);
    }
    #sidebar-drawer #sidebar {
      border: none;
      outline: none;
    }

    #sidebar hr {
      margin: 0;
    }

    /* Branding */

    #branding {
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding: 4px 0;
      background: var(--background-color);
    }

    #branding x-icon {
      width: 50px;
      height: 50px;
      color: var(--accent-color);
    }

    #branding h1 {
      margin: 0 0 0 6px;
      line-height: 1;
    }

    /* Nav */

    #nav {
      padding: 12px;
      overflow: auto;
    }

    #nav > x-navitem::part(button):hover {
      cursor: pointer;
    }

    /* Settings */

    #settings {
      padding: 16px 20px;
      flex: 1;
    }

    /* Copyright */

    #copyright {
      padding: 12px 20px;
      line-height: 1;
      font-size: 11px;
    }

    #copyright a {
      color: inherit;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type URL
  //
  // Last visited location.
  get oldLocation() {
    return this.#oldLocation;
  }

  #shadowRoot = null;
  #currentLocation = null;
  #oldLocation = null;
  #lockInputListeners = null;
  #layout = "normal";

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.hidden = true;

    // Initialize history manager
    {
      history.scrollRestoration = "manual";

      if (history.state === null) {
        history.replaceState({index: history.length-1, scrollTop: 0}, null, location.href);
      }
    }

    // Update layout depending on the current window size
    {
      let mediaQuery = window.matchMedia("(min-width: 880px )");
      let layout = mediaQuery.matches ? "normal" : "collapsed";

      if (this.#layout !== layout) {
        this.#layout = layout;

        if (this.#shadowRoot) {
          this.#updateForLayoutChange();
        }
      }

      mediaQuery.addEventListener("change", (event) => {
        let layout = event.matches ? "normal" : "collapsed";

        if (this.#layout !== layout) {
          this.#layout = layout;

          if (this.#shadowRoot) {
            this.#updateForLayoutChange();
          }
        }
      });
    }
  }

  async connectedCallback() {
    let theme       = Xel.getConfig("pt-settings:theme", "fluent");
    let accentColor = Xel.getConfig("pt-settings:accentColor", "blue");
    let icons       = Xel.getConfig("pt-settings:icons", "fluent");
    let locale      = Xel.getConfig("pt-settings:locale", "en");

    Xel.theme       = `/themes/${theme}.css`;
    Xel.accentColor = accentColor;
    Xel.icons       = [`/icons/${icons}.svg`];

    // Load locales
    {
      let [languageCode, territory] = locale.split("-");

      if (territory === undefined) {
        Xel.locales = [`/locales/${languageCode}.ftl`];
      }
      else {
        Xel.locales = [`/locales/${languageCode}-${territory}.ftl`, `/locales/${languageCode}.ftl`];
      }
    }

    // Prevent the flash of unstyled content
    {
      await Xel.whenThemeReady;
      await Xel.whenIconsReady;
      await Xel.whenLocalesReady;

      this.hidden = false;
    }

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTAppElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTAppElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    window.addEventListener("popstate", (event) => this.#onPopState(event));
    window.addEventListener("beforeunload", (event) => this.#onWindowBeforeUnload(event));

    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.#shadowRoot.addEventListener("click", (event) => this.#onShadowRootClick(event), true);
    this["#main"].addEventListener("wheel", (e) => this.#onMainWheel(e), {passive: true});
    this["#nav"].addEventListener("toggle", (event) => event.preventDefault());

    this.#updateForLayoutChange();
    await this.#updateForLocationChange();
    this.#maybeDispatchLocationChangeEvent("load");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #onLocationChange(event) {
    let {method, fromLocation, toLocation} = event.detail;

    // Handle path change
    {
      let pathChanged = (fromLocation === null) || (fromLocation.pathname !== toLocation.pathname);

      if (method === "load") {
        await this.#updateForLocationChange()
        await sleep(100);
        this.restoreMainScrollOffset();
      }
      else if (method === "push" || method === "replace") {
        if (pathChanged) {
          this.#updateForLocationChange();
          this.resetMainScrollOffset();
        }
      }
      else if (method === "pop") {
        if (pathChanged) {
          await this.#updateForLocationChange()
          this.restoreMainScrollOffset();
        }
      }
    }

    // Handle hash change
    {
      let hashChanged = (fromLocation === null) || (fromLocation.hash !== toLocation.hash);

      if (hashChanged) {
        this.restoreMainScrollOffset();
      }
    }
  }

  #onWindowBeforeUnload(event) {
    this.storeMainScrollOffset();
  }

  #onPopState(event) {
    this.#maybeDispatchLocationChangeEvent("pop");
  }

  #onShadowRootPointerDown(event) {
    let downAnchor = event.target.closest("a");

    if (downAnchor) {
      // Don't focus the anchor with pointer
      event.preventDefault();
    }
  }

  #onShadowRootClick(event) {
    // Clicked anchor
    {
      let clickedAnchor = event.target.closest("a");

      if (clickedAnchor) {
        let url = new URL(clickedAnchor.href);

        if (url.origin === location.origin) {
          event.preventDefault();
          this.navigate(url.href);
        }
      }
    }
  }

  #onMainWheel(event) {
    if (location.hash) {
      history.pushState(
        {index: history.state.index+1, scrollTop: this["#main"].scrollTop}, null, location.href.split("#")[0]
      );

      this.#maybeDispatchLocationChangeEvent("push");
    }

    this.#onMainWheelDebounced();
  }

  #onMainWheelDebounced = debounce(() => {
    if (!location.hash) {
      this.storeMainScrollOffset();
    }
  }, 400);

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type (string, boolean) => void
  navigate(href, replace = false) {
    if (replace === false) {
      this.storeMainScrollOffset();
      history.pushState({index: history.state.index+1, scrollTop: 0}, null, href);
      this.#maybeDispatchLocationChangeEvent("push");
    }
    else if (replace === true) {
      history.replaceState({index: history.state.index, scrollTop: 0}, null, href);
      this.#maybeDispatchLocationChangeEvent("replace");
    }
  }

  storeMainScrollOffset(offset = this["#main"].scrollTop) {
    history.replaceState({index: history.state.index, scrollTop: offset}, null, location.href);
  }

  restoreMainScrollOffset() {
    let offset = 0;

    if (location.hash) {
      let page = this["#main"].firstElementChild;
      let elementID = location.hash.substring(1);
      page.scrollElementIntoView(elementID);
    }
    else {
      this["#main"].scrollTop = history.state.scrollTop;
    }
  }

  resetMainScrollOffset() {
    this["#main"].scrollTop = 0;
  }

  #maybeDispatchLocationChangeEvent(method = "pop") {
    let changed = false;

    if (this.#currentLocation) {
      if (
        location.origin   !== this.#currentLocation.origin   ||
        location.pathname !== this.#currentLocation.pathname ||
        location.search   !== this.#currentLocation.search   ||
        location.hash     !== this.#currentLocation.hash
      ) {
        changed = true;
      }
    }
    else {
      changed = true;
    }

    if (changed) {
      let fromLocation = this.#currentLocation;
      let toLocation = new URL(window.location.href);

      this.#oldLocation = fromLocation;
      this.#currentLocation = toLocation;

      let event = new CustomEvent("locationchange", {
        detail: {method, fromLocation, toLocation, state: history.state}
      });

      this.dispatchEvent(event);
      this.#onLocationChange(event);
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  lockInput() {
    if (!this.#lockInputListeners) {
      let lockInputEventNames = [
        "mousedown", "mouseenter", "mouseleave", "mousemove", "mouseout", "mosueover", "mouseup",
        "pointerover", "pointerenter", "pointerdown", "pointermove", "pointerup", "pointerout", "pointerleave",
        "keydown", "keyup", "keypress",
        "click", "dblclick", "select",
        "compositionstart", "compositionupdate", "compositionend"
      ];

      this.#lockInputListeners = {};
      this.style.pointerEvents = "none";

      for (let eventName of lockInputEventNames) {
        window.addEventListener(eventName, this.#lockInputListeners[eventName] = (event) => {
          event.stopImmediatePropagation();
          event.preventDefault();
        }, true);
      }
    }
  }

  unlockInput() {
    if (this.#lockInputListeners) {
      for (let [eventName, listener] of Object.entries(this.#lockInputListeners)) {
        window.removeEventListener(eventName, listener, true);
      }

      this.#lockInputListeners = null;
      this.style.pointerEvents = null;
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #updateForLocationChange() {
    return new Promise(async (resolve) => {
      let path = location.pathname;
      let title = document.querySelector("title");

      // Toggle navigation item
      {
        for (let item of this["#nav"].querySelectorAll("x-navitem")) {
          let anchor = item.closest("a");

          if (anchor) {
            let url = new URL(anchor);

            if (url.origin === location.origin) {
              item.toggled = (url.pathname === location.pathname)
            }
            else {
              item.toggled = false;
            }
          }
        }
      }

      // Load page
      {
        if (this["#main"].dataset.path !== path) {
          if (path === "/") {
            title.textContent = "Xel";
            this["#main"].innerHTML = "<pt-aboutpage></pt-aboutpage>";
          }
          else if (path === "/setup") {
            title.textContent = "Xel | Setup";
            this["#main"].innerHTML = "<pt-setuppage></pt-setuppage>";
          }
          else if (path === "/changelog") {
            title.textContent = "Xel | Changelog";
            this["#main"].innerHTML = "<pt-changelogpage></pt-changelogpage>";
          }
          else if (path === "/license") {
            title.textContent = "Xel | License";
            this["#main"].innerHTML = "<pt-licensepage></pt-licensepage>";
          }
          else if (path.startsWith("/elements/")) {
            let elementName = path.substring(10);
            title.textContent = "Xel | " + elementName;
            this["#main"].innerHTML = `<pt-elementpage value="${elementName}"></pt-elementpage>`;
          }
          else {
            this["#main"].innerHTML = "";
          }

          this["#main"].dataset.path = path;
        }

        let page = this["#main"].firstElementChild;

        if (page) {
          await page.whenReady;
        }
      }

      resolve();
    });
  }

  #updateForLayoutChange() {
    this.setAttribute("layout", this.#layout);

    // Toggle header visibility
    {
      this["#header"].hidden = (this.#layout === "normal");
    }

    // Move sidebar
    {
      if (this.#layout === "collapsed") {
        this["#sidebar-drawer"].append(this["#sidebar"]);
      }
      else {
        this.#shadowRoot.prepend(this["#sidebar"]);
      }
    }
  }
}

customElements.define("pt-app", PTAppElement);
