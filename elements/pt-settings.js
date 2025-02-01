
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";

export default class PTSettingsElement extends HTMLElement {
  static #shadowTemplate = html`
    <template>
      <section id="theme-section">
        <h4 id="theme-heading"><x-message href="#theme" autocapitalize></x-message></h4>

        <x-select id="theme-select">
          <x-menu>
            <x-menuitem value="fluent">
              <x-icon href="/icons/portal.svg#fluent"></x-icon>
              <x-label>Fluent</x-label>
            </x-menuitem>

            <x-menuitem value="cupertino">
              <x-icon href="/icons/portal.svg#cupertino"></x-icon>
              <x-label>Cupertino</x-label>
            </x-menuitem>

            <x-menuitem value="adwaita">
              <x-icon href="/icons/portal.svg#adwaita"></x-icon>
              <x-label>Adwaita</x-label>
            </x-menuitem>

            <hr/>

            <x-menuitem value="fluent-dark">
              <x-icon href="/icons/portal.svg#fluent"></x-icon>
              <x-label>Fluent Dark</x-label>
            </x-menuitem>

            <x-menuitem value="cupertino-dark">
              <x-icon href="/icons/portal.svg#cupertino"></x-icon>
              <x-label>Cupertino Dark</x-label>
            </x-menuitem>

            <x-menuitem value="adwaita-dark">
              <x-icon href="/icons/portal.svg#adwaita"></x-icon>
              <x-label>Adwaita Dark</x-label>
            </x-menuitem>
          </x-menu>
        </x-select>
      </section>

      <section id="accent-color-section">
        <h4><x-message href="#accent-color" autocapitalize></x-message></h4>

        <x-box>
          <x-select id="accent-preset-select">
            <x-menu id="accent-preset-menu"></x-menu>
          </x-select>

          <x-colorselect id="accent-color-select"></x-colorselect>
        </x-box>
      </section>

      <section id="icons-section">
        <h4><x-message href="#icons" autocapitalize></x-message></h4>

        <x-select id="icons-select">
          <x-menu>
            <x-menuitem value="fluent">
              <x-icon href="/icons/portal.svg#fluent"></x-icon>
              <x-label>Fluent</x-label>
            </x-menuitem>

            <x-menuitem value="material" toggled>
              <x-icon href="/icons/portal.svg#material"></x-icon>
              <x-label>Material</x-label>
            </x-menuitem>

            <hr/>

            <x-menuitem value="fluent-outlined">
              <x-icon href="/icons/portal.svg#fluent"></x-icon>
              <x-label>Fluent Outlined</x-label>
            </x-menuitem>

            <x-menuitem value="material-outlined">
              <x-icon href="/icons/portal.svg#material"></x-icon>
              <x-label>Material Outlined</x-label>
            </x-menuitem>
          </x-menu>
        </x-select>
      </section>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      padding: 16px 20px;
      box-sizing: border-box;
    }

    h4 {
      margin: 0 0 6px 0;
    }

    /* "Theme" section */

    #theme-select {
      width: 100%;
    }

    /* "Accent color" section */

    #accent-color-section {
      margin-top: 12px;
    }
    #accent-preset-select {
      flex: 1;
    }
    #accent-color-select {
      margin-left: 8px;
    }

    /* "Icons" section */

    #icons-section {
      margin-top: 12px;
    }
    #icons-select {
      width: 100%;
    }
  `;

  #shadowRoot;
  #xelThemeChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed"});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, PTSettingsElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(PTSettingsElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this["#theme-select"].addEventListener("change", (e) => this.#onThemeSelectChange(e));
    this["#accent-preset-select"].addEventListener("change", (e) => this.#onAccentPresetSelectChange(e));
    this["#accent-color-select"].addEventListener("change", (e) => this.#onAccentColorSelectChange(e));
    this["#icons-select"].addEventListener("change", (e) => this.#onIconsSelectChange(e));
  }

  connectedCallback() {
    Xel.addEventListener("themechange", () => this.#onXelThemeChange());
    Xel.addEventListener("accentcolorchange", () => this.#onXelAccentColorChange());
    Xel.addEventListener("iconschange", () => this.#onXelIconsChange());

    this.#update();
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onXelThemeChange() {
    let themeName = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.indexOf(".css"));
    Xel.setConfig("pt-settings:theme", themeName);

    this.#update();
  }

  #onXelAccentColorChange() {
    let color = Xel.accentColor;

    // Custom color
    if (Xel.presetAccentColors[color] === undefined) {
      this["#accent-preset-select"].value = "custom";
      this["#accent-color-select"].value = color;
    }
    // Preset color
    else {
      this["#accent-preset-select"].value = color;
      this["#accent-color-select"].value = Xel.presetAccentColors[color];
    }

    Xel.setConfig("pt-settings:accentColor", color);
    this.#update();
  }

  #onXelIconsChange() {
    Xel.setConfig("pt-settings:icons", this["#icons-select"].value);
    this.#update();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onThemeSelectChange() {
    let value = this["#theme-select"].value;
    Xel.theme = `/themes/${value}.css`;
  }

  #onAccentPresetSelectChange() {
    let value = this["#accent-preset-select"].value;
    Xel.accentColor = (value === "custom") ? Xel.presetAccentColors[Xel.accentColor] : value;
  }

  #onAccentColorSelectChange() {
    Xel.accentColor = this["#accent-color-select"].value;
  }

  #onIconsSelectChange() {
    Xel.icons = ["/icons/" + this["#icons-select"].value + ".svg"];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    // Update theme section
    {
      let themeName = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.indexOf(".css"));

      for (let item of this["#theme-select"].querySelectorAll("x-menuitem")) {
        if (item.getAttribute("value") === themeName) {
          item.setAttribute("toggled", "");
        }
        else {
          item.removeAttribute("toggled");
        }
      }
    }

    // Update accent color section
    {
      let itemsHTML = "";

      for (let [colorName, colorValue] of Object.entries(Xel.presetAccentColors)) {
        itemsHTML += `
          <x-menuitem value="${colorName}">
            <x-swatch value="${colorValue}"></x-swatch>
            <x-label><x-message href="#accent-color-${colorName}" autocapitalize></x-message></x-label>
          </x-menuitem>
        `;
      }

      itemsHTML += `
        <hr/>
        <x-menuitem value="custom">
          <x-icon href="/icons/portal.svg#color-wheel"></x-icon>
          <x-label>Custom</x-label>
        </x-menuitem>
      `;

      this["#accent-preset-menu"].innerHTML = itemsHTML;

      // Preset color
      if (Xel.presetAccentColors[Xel.accentColor]) {
        this["#accent-preset-select"].value = Xel.accentColor;
        this["#accent-color-select"].value = Xel.presetAccentColors[Xel.accentColor];
      }
      // Custom color
      else {
        this["#accent-preset-select"].value = "custom";
        this["#accent-color-select"].value = Xel.accentColor;
      }
    }

    // Update icons section
    {
      let iconsPath = Xel.icons[0];
      let iconsName = iconsPath.substring(iconsPath.lastIndexOf("/") + 1, iconsPath.lastIndexOf("."));
      this["#icons-select"].value = iconsName;
    }
  }
}

customElements.define("pt-settings", PTSettingsElement);
