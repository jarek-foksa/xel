
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import "./pt-aboutpage.js";
import "./pt-setuppage.js";
import "./pt-faqpage.js";
import "./pt-changelogpage.js";
import "./pt-licensepage.js";
import "./pt-privacypage.js";
import "./pt-termspage.js";
import "./pt-elementpage.js";

import "./pt-apiblock.js";
import "./pt-demoblock.js";

import "./pt-code.js";

import {removeDuplicates} from "../utils/array.js";
import {capitalize} from "../utils/string.js";
import {html, css} from "../utils/template.js";
import {sleep, debounce} from "../utils/time.js";

// @event locationchange
export default class PTAppElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <x-button id="expand-sidebar-button" icon="menu" hidden>
        <x-icon name="menu"></x-icon>
      </x-button>

      <sidebar id="sidebar">
        <header id="header">
          <div id="branding">
            <x-icon name="xel" iconset="/iconsets/other.svg"></x-icon>
            <h1>Xel</h1>
          </div>

          <x-button id="collapse-sidebar-button" hidden>
            <x-icon name="chevron-left"></x-icon>
          </x-button>
        </header>

        <hr/>

        <nav id="nav">
          <section>
            <a href="/">
              <x-button skin="nav">
                <x-icon name="help"></x-icon>
                <x-label>About</x-label>
              </x-button>
            </a>

            <a href="/setup">
              <x-button skin="nav">
                <x-icon name="wrench"></x-icon>
                <x-label>Setup</x-label>
              </x-button>
            </a>

            <a href="/faq">
              <x-button skin="nav">
                <x-icon name="comment"></x-icon>
                <x-label>FAQ</x-label>
              </x-button>
            </a>

            <a href="/changelog">
              <x-button skin="nav">
                <x-icon name="calendar"></x-icon>
                <x-label>Changelog</x-label>
              </x-button>
            </a>

            <a href="/license">
              <x-button skin="nav">
                <x-icon name="paste"></x-icon>
                <x-label>License</x-label>
              </x-button>
            </a>

            <a href="https://github.com/jarek-foksa/xel/issues" target="_blank" tabindex="-1">
              <x-button skin="nav">
                <x-icon name="visibility-visible"></x-icon>
                <x-label>Issues</x-label>
                <x-icon name="open"></x-icon>
              </x-button>
              </a>

            <a href="https://github.com/jarek-foksa/xel" target="_blank" tabindex="-1">
              <x-button skin="nav" role="button" aria-disabled="false" tabindex="0">
                <x-icon name="code"></x-icon>
                <x-label>Source Code</x-label>
                <x-icon name="open"></x-icon>
              </x-button>
            </a>
          </section>

          <hr/>

          <section id="theme-section">
            <div id="theme-subsection">
              <h3 id="theme-heading">Theme</h3>

              <x-select id="theme-select">
                <x-menu>
                  <x-menuitem value="vanilla" toggled>
                    <x-label>Vanilla</x-label>
                  </x-menuitem>

                  <x-menuitem value="vanilla-dark">
                    <x-label>Vanilla Dark</x-label>
                  </x-menuitem>

                  <x-menuitem value="cupertino">
                    <x-label>Cupertino</x-label>
                  </x-menuitem>

                  <x-menuitem value="cupertino-dark">
                    <x-label>Cupertino Dark</x-label>
                  </x-menuitem>

                  <x-menuitem value="fluent">
                    <x-label>Fluent</x-label>
                  </x-menuitem>

                  <x-menuitem value="fluent-dark">
                    <x-label>Fluent Dark</x-label>
                  </x-menuitem>
                </x-menu>
              </x-select>
            </div>

            <div id="accent-color-subsection">
              <h3>Accent color</h3>

              <x-box>
                <x-select id="accent-preset-select">
                  <x-menu id="accent-preset-menu"></x-menu>
                </x-select>

                <x-colorselect id="accent-color-select">
                  <x-popover modal>
                    <x-wheelcolorpicker></x-wheelcolorpicker>
                  </x-popover>
                </x-colorselect>
              </x-box>
            </div>

            <div id="size-subsection">
              <h3>Size</h3>

              <x-buttons id="size-buttons" tracking="1">
                <x-button value="small" condensed>
                  <x-label>Small</x-label>
                </x-button>

                <x-button value="medium" condensed toggled>
                  <x-label>Medium</x-label>
                </x-button>

                <x-button value="large" condensed>
                  <x-label>Large</x-label>
                </x-button>
              </x-buttons>
            </div>

            <div id="iconset-subsection">
              <h3>Iconset</h3>

              <x-select id="iconset-select">
                <x-menu>
                  <x-menuitem value="material" toggled>
                    <x-label>Material</x-label>
                  </x-menuitem>

                  <x-menuitem value="material-outlined">
                    <x-label>Material Outlined</x-label>
                  </x-menuitem>

                  <x-menuitem value="fluent">
                    <x-label>Fluent</x-label>
                  </x-menuitem>

                  <x-menuitem value="fluent-outlined">
                    <x-label>Fluent Outlined</x-label>
                  </x-menuitem>
                </x-menu>
              </x-select>
            </div>
          </section>

          <hr/>

          <section>
            <h3>Containers</h3>

            <a href="/elements/x-box">
              <x-button skin="nav">
                <x-label>x-box</x-label>
              </x-button>
            </a>

            <a href="/elements/x-card">
              <x-button skin="nav">
                <x-label>x-card</x-label>
              </x-button>
            </a>

            <a href="/elements/x-accordion">
              <x-button skin="nav">
                <x-label>x-accordion</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Primitives</h3>

            <a href="/elements/x-icon">
              <x-button skin="nav">
                <x-label>x-icon</x-label>
              </x-button>
            </a>

            <a href="/elements/x-label">
              <x-button skin="nav">
                <x-label>x-label</x-label>
              </x-button>
            </a>

            <a href="/elements/x-shortcut">
              <x-button skin="nav">
                <x-label>x-shortcut</x-label>
              </x-button>
            </a>

            <a href="/elements/x-stepper">
              <x-button skin="nav">
                <x-label>x-stepper</x-label>
              </x-button>
            </a>

            <a href="/elements/x-swatch">
              <x-button skin="nav">
                <x-label>x-swatch</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Buttons</h3>

            <a href="/elements/x-button">
              <x-button skin="nav">
                <x-label>x-button</x-label>
              </x-button>
            </a>

            <a href="/elements/x-buttons">
              <x-button skin="nav">
                <x-label>x-buttons</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Tags</h3>

            <a href="/elements/x-tag">
              <x-button skin="nav">
                <x-label>x-tag</x-label>
              </x-button>
            </a>

            <a href="/elements/x-tags">
              <x-button skin="nav">
                <x-label>x-tags</x-label>
              </x-button>
            </a>

            <a href="/elements/x-tagsinput">
              <x-button skin="nav">
                <x-label>x-tagsinput</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Navigation</h3>

            <a href="/elements/x-tab">
              <x-button skin="nav">
                <x-label>x-tab</x-label>
              </x-button>
            </a>

            <a href="/elements/x-tabs">
              <x-button skin="nav">
                <x-label>x-tabs</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Menus</h3>

            <a href="/elements/x-menu">
              <x-button skin="nav">
                <x-label>x-menu</x-label>
              </x-button>
            </a>

            <a href="/elements/x-menuitem">
              <x-button skin="nav">
                <x-label>x-menuitem</x-label>
              </x-button>
            </a>

            <a href="/elements/x-menubar">
              <x-button skin="nav">
                <x-label>x-menubar</x-label>
              </x-button>
            </a>

            <a href="/elements/x-contextmenu">
              <x-button skin="nav">
                <x-label>x-contextmenu</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Popups</h3>

            <a href="/elements/dialog">
              <x-button skin="nav">
                <x-label>dialog</x-label>
              </x-button>
            </a>

            <a href="/elements/x-popover">
              <x-button skin="nav">
                <x-label>x-popover</x-label>
              </x-button>
            </a>

            <a href="/elements/x-notification">
              <x-button skin="nav">
                <x-label>x-notification</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Forms</h3>

            <a href="/elements/x-checkbox">
              <x-button skin="nav">
                <x-label>x-checkbox</x-label>
              </x-button>
            </a>

            <a href="/elements/x-radio">
              <x-button skin="nav">
                <x-label>x-radio</x-label>
              </x-button>
            </a>

            <a href="/elements/x-radios">
              <x-button skin="nav">
                <x-label>x-radios</x-label>
              </x-button>
            </a>

            <a href="/elements/x-switch">
              <x-button skin="nav">
                <x-label>x-switch</x-label>
              </x-button>
            </a>

            <a href="/elements/x-select">
              <x-button skin="nav">
                <x-label>x-select</x-label>
              </x-button>
            </a>

            <a href="/elements/x-colorselect">
              <x-button skin="nav">
                <x-label>x-colorselect</x-label>
              </x-button>
            </a>

            <a href="/elements/x-input">
              <x-button skin="nav">
                <x-label>x-input</x-label>
              </x-button>
            </a>

            <a href="/elements/x-numberinput">
              <x-button skin="nav">
                <x-label>x-numberinput</x-label>
              </x-button>
            </a>

            <a href="/elements/x-texteditor">
              <x-button skin="nav">
                <x-label>x-texteditor</x-label>
              </x-button>
            </a>

            <a href="/elements/x-slider">
              <x-button skin="nav">
                <x-label>x-slider</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Color pickers</h3>

            <a href="/elements/x-rectcolorpicker">
              <x-button skin="nav">
                <x-label>x-rectcolorpicker</x-label>
              </x-button>
            </a>

            <a href="/elements/x-wheelcolorpicker">
              <x-button skin="nav">
                <x-label>x-wheelcolorpicker</x-label>
              </x-button>
            </a>

            <a href="/elements/x-barscolorpicker">
              <x-button skin="nav">
                <x-label>x-barscolorpicker</x-label>
              </x-button>
            </a>
          </section>

          <hr/>

          <section>
            <h3>Indicators</h3>

            <a href="/elements/x-progressbar">
              <x-button skin="nav">
                <x-label>x-progressbar</x-label>
              </x-button>
            </a>

            <a href="/elements/x-throbber">
              <x-button skin="nav">
                <x-label>x-throbber</x-label>
              </x-button>
            </a>
          </section>
        </nav>

        <hr/>

        <footer id="footer">
          <section id="footer-links">
            <a id="contact-anchor" href="mailto:jarek@xel-toolkit.org">Contact</a> •
            <a id="privacy-anchor" href="/privacy">Privacy</a> •
            <a id="terms-anchor" href="/terms">Terms</a>
          </section>

          <p id="copyright">© 2016-2022 Jarosław Foksa</p>
        </footer>
      </sidebar>

      <main id="main"></main>
      <div id="dialogs"></div>
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

    /**
     * Sidebar
     */

    #sidebar {
      width: 270px;
      overflow: auto;
      position: relative;
    }

    #sidebar #branding {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #sidebar #branding x-icon {
      width: 50px;
      height: 50px;
      color: var(--accent-color);
    }

    #sidebar #branding h1 {
      margin-left: 8px;
      line-height: 1;
    }

    #sidebar #header + hr {
      margin-top: -1px;
    }

    #sidebar a {
      text-decoration: none;
    }

    #sidebar #nav {
      margin-bottom: 20px;
      width: 100%;
    }

    #sidebar #nav x-icon[name="open"] {
      margin: 0;
      width: 20px;
      height: 20px;
    }

    #sidebar #nav x-button[skin="nav"] {
      width: calc(100% + 60px);
      margin-left: -30px;
      padding: 8px 30px;
      --ripple-background: white;
      --min-pressed-time: 0ms;
    }

    #collapse-sidebar-button {
      position: absolute;
      top: 16px;
      left: 11px;
      padding: 0px;
      width: 37px;
      height: 37px;
      min-height: 38px;
    }

    #expand-sidebar-button {
      position: absolute;
      top: 16px;
      left: 11px;
      z-index: 10;
      padding: 0;
      width: 37px;
      height: 37px;
      min-height: 37px;
    }

    /* Theme */

    #theme-section {
      padding: 10px 0px;
    }

    #theme-section #theme-heading {
      margin-top: 0;
    }

    #theme-section #theme-select {
      width: 100%;
    }

    /* Accent color */

    #theme-section #accent-color-subsection {
      margin-top: 14px;
    }
    #theme-section #accent-preset-select {
      flex: 1;
    }
    #theme-section #accent-color-select {
      margin-left: 8px;
    }

    /* Size */

    #theme-section #size-subsection {
      margin-top: 14px;
    }
    #theme-section #size-buttons {
      width: 100%;
    }
    #theme-section #size-buttons x-button {
      flex: 1;
    }

    /* Iconset */

    #theme-section #iconset-subsection {
      margin-top: 14px;
    }
    #theme-section #iconset-select {
      width: 100%;
    }

    /* Footer */

    #sidebar #footer {
      padding: 16px 30px 18px;
      line-height: 1;
      font-size: 12.5px;
    }

    /**
     * Main
     */

    #main {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 20px;
      min-height: 20px;
      position: relative;
      flex: 1;
      overflow: auto;
    }

    #main > * {
      margin: 35px auto;
      padding: 0 70px;
      max-width: 790px;
    }
    #main > pt-aboutpage {
      margin: 0;
      padding: 0 100px;
      max-width: none;
    }

    /**
     * Dialogs
     */

    /* Sidebar */

    #sidebar-dialog {
      display: flex;
      width: 270px;
      height: 100%;
      left: 0;
      right: auto;
    }
    #sidebar-dialog:focus {
      outline: none;
    }
    #sidebar-dialog:not([open]) {
      display: none;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type URL
  //
  // Last visited location.
  get oldLocation() {
    return this.#oldLocation;
  }

  #shadowRoot = null;
  #elements = {};
  #authReadyCallbacks = [];
  #currentLocation = null;
  #oldLocation = null;
  #lockInputListeners = null;

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
  }

  async connectedCallback() {
    Xel.theme = "/themes/" + (localStorage.getItem("theme") || "vanilla") + "-portal.css";
    Xel.accentColor = localStorage.getItem("accentColor") || "blue";
    Xel.size = localStorage.getItem("size") || "medium";
    Xel.iconset = "/iconsets/" + (localStorage.getItem("iconset") || "material") + ".svg";

    // Prevent the flash of unstyled content
    {
      await Xel.whenThemeReady;
      await Xel.whenIconsetReady;
      this.hidden = false;
    }

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTAppElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTAppElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    window.addEventListener("popstate", (event) => this.#onPopState(event));
    window.addEventListener("beforeunload", (event) => this.#onWindowBeforeUnload(event));

    Xel.addEventListener("themechange", () => this.#onXelThemeChange());
    Xel.addEventListener("accentcolorchange", () => this.#onXelAccentColorChange());
    Xel.addEventListener("sizechange", () => this.#onXelSizeChange());
    Xel.addEventListener("iconsetchange", () => this.#onXelIconsetChange());

    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.#shadowRoot.addEventListener("click", (event) => this.#onShadowRootClick(event), true);
    this.#elements["expand-sidebar-button"].addEventListener("click", (e) => this.#onExpandSidebarButtonClick(e));
    this.#elements["collapse-sidebar-button"].addEventListener("click", (e) => this.#onCollapseSidebarButtonClick(e));
    this.#elements["theme-select"].addEventListener("change", (e) => this.#onThemeSelectChange(e));
    this.#elements["accent-preset-select"].addEventListener("change", (e) => this.#onAccentPresetSelectChange(e));
    this.#elements["accent-color-select"].addEventListener("change", (e) => this.#onAccentColorSelectChange(e));
    this.#elements["size-buttons"].addEventListener("toggle", (e) => this.#onSizeButtonsToggle(e));
    this.#elements["iconset-select"].addEventListener("change", (e) => this.#onIconsetSelectChange(e));
    this.#elements["main"].addEventListener("wheel", (e) => this.#onMainWheel(e), {passive: true});

    // Sidebar
    {
      let mediaQueryList = window.matchMedia("(min-width: 900px)");
      this.#toggleSidebarMode(mediaQueryList.matches ? "normal" : "overlay");

      mediaQueryList.addListener((event) => {
        this.#toggleSidebarMode(mediaQueryList.matches ? "normal" : "overlay");
      });
    }

    this.#updateSidebarNav();
    this.#updateSidebarThemeSection();

    await this.#updateMain();
    this.#maybeDispatchLocationChangeEvent("load");
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onXelThemeChange() {
    this.#updateSidebarThemeSection();

    let themeName = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.lastIndexOf("-portal"));
    localStorage.setItem("theme", themeName);
  }

  #onXelAccentColorChange() {
    let color = Xel.accentColor;

    // Custom color
    if (Xel.presetAccentColors[color] === undefined) {
      this.#elements["accent-preset-select"].value = "custom";
      this.#elements["accent-color-select"].value = color;
    }
    // Preset color
    else {
      this.#elements["accent-preset-select"].value = color;
      this.#elements["accent-color-select"].value = Xel.presetAccentColors[color];
    }

    localStorage.setItem("accentColor", color);
  }

  #onXelSizeChange() {
    this.#updateSidebarThemeSection();
    localStorage.setItem("size", this.#elements["size-buttons"].value);
  }

  #onXelIconsetChange() {
    this.#updateSidebarThemeSection();
    localStorage.setItem("iconset", this.#elements["iconset-select"].value);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async #onLocationChange(event) {
    let {method, fromLocation, toLocation, state} = event.detail;
    let fromParams = new URLSearchParams(fromLocation ? fromLocation.search : "");
    let toParams = new URLSearchParams(toLocation.search);
    let changedParamNames = removeDuplicates([...fromParams.keys(), ...toParams.keys()]);

    // Handle path change
    {
      let pathChanged = (fromLocation === null) || (fromLocation.pathname !== toLocation.pathname);

      if (method === "load") {
        this.#updateSidebarNav();
        await this.#updateMain()
        await sleep(100);
        this.restoreMainScrollOffset();
      }
      else if (method === "push" || method === "replace") {
        if (pathChanged) {
          this.#updateSidebarNav();
          this.#updateMain();
          this.resetMainScrollOffset();
        }
      }
      else if (method === "pop") {
        if (pathChanged) {
          this.#updateSidebarNav();
          await this.#updateMain()
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

    // Handle "dialog" param change
    {
      let dialogParamChanged = changedParamNames.includes("dialog");

      if (dialogParamChanged) {
        let fromValue = fromParams.get("dialog");
        let toValue = toParams.get("dialog");

        if (toValue === null) {
          let param = fromValue.split("→")[0];
          let fromDialog = this.#elements["dialogs"].querySelector(`:scope > dialog[data-param="${param}"]`);

          if (fromDialog && fromDialog.open) {
            fromDialog.close();
          }
        }
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
        {index: history.state.index+1, scrollTop: this.#elements["main"].scrollTop}, null, location.href.split("#")[0]
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

  #onExpandSidebarButtonClick(event) {
    if (event.buttons <= 1) {
      this.#elements["sidebar-dialog"].showModal();
    }
  }

  #onCollapseSidebarButtonClick(event) {
    if (event.buttons <= 1) {
      this.#elements["sidebar-dialog"].close();
    }
  }

  #onDialogClose(event) {
    let dialog = event.target;
    let url = new URL(location.href);
    let params = new URLSearchParams(location.search);
    let dialogParam = params.get("dialog");
    let dialogName = null;

    if (dialogParam) {
      if (dialogParam.includes("→")) {
        dialogName = dialogParam.split("→")[0];
      }
      else {
        dialogName = dialogParam;
      }
    }

    dialog.remove();
    delete this.#elements[dialog.id];

    if (dialog.dataset.param === dialogName) {
      params.delete("dialog");
      url.search = params.toString();
      this.navigate(url.href);
    }
  }

  #onThemeSelectChange() {
    Xel.theme = "/themes/" + this.#elements["theme-select"].value + "-portal.css";
  }

  #onAccentPresetSelectChange() {
    let value = this.#elements["accent-preset-select"].value;
    Xel.accentColor = (value === "custom") ? Xel.presetAccentColors[Xel.accentColor] : value;
  }

  #onAccentColorSelectChange() {
    Xel.accentColor = this.#elements["accent-color-select"].value;
  }

  #onSizeButtonsToggle() {
    Xel.size = this.#elements["size-buttons"].value;
  }

  #onIconsetSelectChange() {
    Xel.iconset = "/iconsets/" + this.#elements["iconset-select"].value + ".svg";
  }

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

  storeMainScrollOffset(offset = this.#elements["main"].scrollTop) {
    history.replaceState({index: history.state.index, scrollTop: offset}, null, location.href);
  }

  restoreMainScrollOffset() {
    let offset = 0;

    if (location.hash) {
      let page = this.#elements["main"].firstElementChild;
      let elementID = location.hash.substring(1);
      page.scrollElementIntoView(elementID);
    }
    else {
      this.#elements["main"].scrollTop = history.state.scrollTop;
    }
  }

  resetMainScrollOffset() {
    this.#elements["main"].scrollTop = 0;
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

  // @type "normal" || "overlay"
  #toggleSidebarMode(mode) {
    if (mode === "overlay") {
      if (!this.#elements["sidebar-dialog"]) {
        this.#elements["sidebar-dialog"] = html`<dialog id="sidebar-dialog" tabindex="0"></dialog>`;
        this.#elements["sidebar-dialog"].append(this.#elements["sidebar"]);
        this.#elements["dialogs"].append(this.#elements["sidebar-dialog"]);
        this.#elements["expand-sidebar-button"].hidden = false;
        this.#elements["collapse-sidebar-button"].hidden = false;
      }
    }
    else if (mode === "normal") {
      if (this.#elements["sidebar-dialog"]) {
        this.#elements["sidebar-dialog"].remove();
        this.#elements["sidebar-dialog"] = null;
        this.#elements["main"].before(this.#elements["sidebar"]);
        this.#elements["expand-sidebar-button"].hidden = true;
        this.#elements["collapse-sidebar-button"].hidden = true;
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @type (boolean) => Promise
  #closeDialog(immidiate = false) {
    return new Promise( async (resolve) => {
      let dialog = this.#elements["dialogs"].querySelector("dialog:not(#sidebar-dialog)");

      if (dialog && dialog.id) {
        if (immidiate) {
          dialog.close();
        }
        else {
          await dialog.close();
        }

        dialog.remove();
      }

      resolve();
    });
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

  #updateMain() {
    return new Promise(async (resolve) => {
      let path = location.pathname;
      let title = document.querySelector("title");

      if (this.#elements["main"].dataset.path !== path) {
        if (path === "/") {
          title.textContent = "Xel";
          this.#elements["main"].innerHTML = "<pt-aboutpage></pt-aboutpage>";
        }
        else if (path === "/setup") {
          title.textContent = "Xel | Setup";
          this.#elements["main"].innerHTML = "<pt-setuppage></pt-setuppage>";
        }
        else if (path === "/faq") {
          title.textContent = "Xel | FAQ";
          this.#elements["main"].innerHTML = "<pt-faqpage></pt-faqpage>";
        }
        else if (path === "/changelog") {
          title.textContent = "Xel | Changelog";
          this.#elements["main"].innerHTML = "<pt-changelogpage></pt-changelogpage>";
        }
        else if (path === "/license") {
          title.textContent = "Xel | License";
          this.#elements["main"].innerHTML = "<pt-licensepage></pt-licensepage>";
        }
        else if (path === "/privacy") {
          title.textContent = "Xel | Privacy";
          this.#elements["main"].innerHTML = "<pt-privacypage></pt-privacypage>";
        }
        else if (path === "/terms") {
          title.textContent = "Xel | Terms";
          this.#elements["main"].innerHTML = "<pt-termspage></pt-termspage>";
        }
        else if (path.startsWith("/elements/")) {
          let elementName = path.substring(10);
          title.textContent = "Xel | " + elementName;
          this.#elements["main"].innerHTML = `<pt-elementpage value="${elementName}"></pt-elementpage>`;
        }
        else {
          this.#elements["main"].innerHTML = "";
        }

        this.#elements["main"].dataset.path = path;
      }

      let page = this.#elements["main"].firstElementChild;

      if (page) {
        await page.whenReady;
      }

      resolve();
    });
  }

  #updateSidebarNav() {
    for (let section of this.#elements["nav"].querySelectorAll(":scope > section")) {
      if (section.id !== "theme-section") {
        for (let button of section.querySelectorAll("x-button")) {
          let anchor = button.closest("a");

          if (anchor) {
            let url = new URL(anchor);

            if (url.origin === location.origin) {
              if (url.pathname === location.pathname) {
                button.setAttribute("toggled", "");
              }
              else {
                button.removeAttribute("toggled");
              }
            }
            else {
              button.removeAttribute("toggled");
            }
          }
        }
      }
    }
  }

  #updateSidebarThemeSection() {
    // Update theme subsection
    {
      let themeName = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.lastIndexOf("-portal"));

      for (let item of this.#elements["theme-select"].querySelectorAll("x-menuitem")) {
        if (item.getAttribute("value") === themeName) {
          item.setAttribute("toggled", "");
        }
        else {
          item.removeAttribute("toggled");
        }
      }
    }

    // Update accent color subsection
    {
      let itemsHTML = "";

      for (let [colorName, colorValue] of Object.entries(Xel.presetAccentColors)) {
        itemsHTML += `
          <x-menuitem value="${colorName}">
            <x-swatch value="${colorValue}"></x-swatch>
            <x-label>${capitalize(colorName)}</x-label>
          </x-menuitem>
        `;
      }

      itemsHTML += `
        <hr/>
        <x-menuitem value="custom">
          <x-icon name="color-wheel" iconset="/iconsets/other.svg"></x-icon>
          <x-label>Custom</x-label>
        </x-menuitem>
      `;

      this.#elements["accent-preset-menu"].innerHTML = itemsHTML;

      // Preset color
      if (Xel.presetAccentColors[Xel.accentColor]) {
        this.#elements["accent-preset-select"].value = Xel.accentColor;
        this.#elements["accent-color-select"].value = Xel.presetAccentColors[Xel.accentColor];
      }
      // Custom color
      else {
        this.#elements["accent-preset-select"].value = "custom";
        this.#elements["accent-color-select"].value = Xel.accentColor;
      }
    }

    // Update size subsection
    {
      this.#elements["size-buttons"].value = Xel.size;
    }

    // Update iconset subsection
    {
      let iconsetName = Xel.iconset.substring(Xel.iconset.lastIndexOf("/") + 1, Xel.iconset.lastIndexOf("."));
      this.#elements["iconset-select"].value = iconsetName;
    }
  }
}

customElements.define("pt-app", PTAppElement);
