
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import PTPage from "./pt-page.js";
import Xel from "../classes/xel.js";

import {capitalize} from "../utils/string.js";
import {html, css} from "../utils/template.js";

export default class PTSetupPageElement extends PTPage {
  static _shadowTemplate = html`
    <template>
      <article>
        <h2>Setup</h2>

        <x-card>
          <main>
            <h3><strong>1</strong> Install Xel</h3>

            <p>Run from the console:</p>
            <pt-code>npm install xel</pt-code>
            <p><strong>Note:</strong> Xel NPM package has no dependencies and it does not execute any install scripts.</p>
          </main>
        </x-card>

        <x-card>
          <main>
            <h3><strong>2</strong> Link Xel</h3>

            <p>Add to the  <code>&lt;head&gt;</code>:</p>
            <pt-code>&lt;script src="node_modules/xel/xel.js" type="module"&gt;&lt;/script&gt;</pt-code>
          </main>
        </x-card>

        <x-card>
          <main>
            <h3><strong>3</strong> Set theme</h3>

            <p>Add to the <code>&lt;head&gt;</code> to use
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
              theme:</p>
            <pt-code id="theme-code"></pt-code>

            <p><strong>Note:</strong> You can also link a custom theme CSS file. To make it a subtheme of an existing
            Xel theme you just have to use <code>@import</code> CSS rule.</p>
          </main>
        </x-card>

        <x-card>
          <main>
            <h3><strong>4</strong> Set accent color</h3>

            <p>Add to the <code>&lt;head&gt;</code> to use

            <x-select id="accent-preset-select">
              <x-menu id="accent-preset-menu"></x-menu>
            </x-select>

            accent color:</p>
            <pt-code id="accent-code"></pt-code>
          </main>
        </x-card>

        <x-card>
          <main>
            <h3><strong>5</strong> Set widgets size</h3>

            <p>Add to the <code>&lt;head&gt;</code> to use widgets with
            <x-select id="size-select">
              <x-menu>
                <x-menuitem value="small">
                  <x-label>Small</x-label>
                </x-menuitem>

                <x-menuitem value="medium" toggled>
                  <x-label>Medium</x-label>
                </x-menuitem>

                <x-menuitem value="large">
                  <x-label>Large</x-label>
                </x-menuitem>
              </x-menu>
            </x-select>
            size:</p>
            <pt-code id="size-code"></pt-code>

            <p><strong>Note:</strong> You can also adjust the size of an individual Xel widget by setting the
            <code>"size"</code> attribute on it to either <code>"small"</code>, <code>"medium"</code>, <code>"large"</code>,
            <code>"smaller"</code> or <code>"larger"</code>.</p>

          </main>
        </x-card>

        <x-card id="link-iconset-card">
          <main>
            <h3><strong>6</strong> Set iconset</h3>

            <p>Add to the <code>&lt;head&gt;</code> to use
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
            iconset:</p>
            <pt-code id="iconset-code"></pt-code>

            <p><strong>Note:</strong> You can also link a custom iconset SVG file. Each icon should be defined as a
            <code>&lt;symbol&gt;</code> with a unique ID.</p>
          </main>
        </x-card>
      </article>
    </template>
  `;

  static _shadowStyleSheet = css`
    h3 {
      margin-bottom: 0;
    }

    article h3 strong {
      display: inline-block;
      vertical-align: middle;
      width: 35px;
      height: 35px;
      margin: 0 4px 4px 0;
      background: var(--accent-color);
      border-radius: 80px;
      color: white;
      font-size: 22px;
      font-weight: 500;
      line-height: 35px;
      text-align: center;
    }

    article h3 span.optional {
      font-size: 20px;
      vertical-align: middle;
      opacity: 0.7;
    }

    article h4 {
      font-size: 22px;
      margin-top: 0;
    }

    pre {
      display: block;
      white-space: pre;
      overflow: auto;
    }

    th {
      background: var(--background-color);
    }

    hr {
      margin: 24px 0 20px;
    }

    #theme-select,
    #accent-preset-select,
    #size-select,
    #iconset-select {
      display: inline-block;
      vertical-align: middle;
      margin: 0 2px;
    }
  `

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #xelThemeChangeListener;
  #xelAccentColorChangeListener;
  #xelSizeChangeListener;
  #xelIconsetChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._elements["theme-select"].addEventListener("change", () => this.#onThemeSelectChange());
    this._elements["accent-preset-select"].addEventListener("change", () => this.#onAccentPresetSelectChange());
    this._elements["size-select"].addEventListener("change", () => this.#onSizeSelectChange());
    this._elements["iconset-select"].addEventListener("change", () => this.#onIconsetSelectChange());
  }

  connectedCallback() {
    super.connectedCallback();

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#onXelThemeChange());
    Xel.addEventListener("accentcolorchange", this.#xelAccentColorChangeListener = () => this.#onXelAccentColorChange());
    Xel.addEventListener("sizechange", this.#xelSizeChangeListener = () => this.#onXelSizeChange());
    Xel.addEventListener("iconsetchange", this.#xelIconsetChangeListener = () => this.#onXelIconsetChange());

    this.#updateAccentColorMenu();
    this.#update();
    this._onReady();
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
    Xel.removeEventListener("accentcolorchange", this.#xelAccentColorChangeListener);
    Xel.removeEventListener("sizechange", this.#xelSizeChangeListener);
    Xel.removeEventListener("iconsetchange", this.#xelIconsetChangeListener);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onXelThemeChange() {
    this.#updateAccentColorMenu();
    this.#update();
  }

  #onXelAccentColorChange() {
    this.#update();
  }

  #onXelSizeChange() {
    this.#update();
  }

  #onXelIconsetChange() {
    this.#update();
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onThemeSelectChange() {
    Xel.theme = `/themes/${this._elements["theme-select"].value}-portal.css`;
  }

  #onAccentPresetSelectChange() {
    let value = this._elements["accent-preset-select"].value;
    Xel.accentColor = (value === "custom") ? Xel.presetAccentColors[Xel.accentColor] : value;
  }

  #onSizeSelectChange() {
    Xel.size = this._elements["size-select"].value;
  }

  #onIconsetSelectChange() {
    Xel.iconset = `/iconsets/${this._elements["iconset-select"].value}.svg`;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    // Theme
    {
      let name = Xel.theme.substring(Xel.theme.lastIndexOf("/") + 1, Xel.theme.lastIndexOf("-portal"));
      let meta = `<meta name="xel-theme" content="node_modules/xel/themes/${name}.css">`;

      this._elements["theme-select"].value = name;
      this._elements["theme-code"].textContent = meta;
    }

    // Accent color
    {
      // Preset color
      if (Xel.presetAccentColors[Xel.accentColor]) {
        this._elements["accent-preset-select"].value = Xel.accentColor;
        this._elements["accent-code"].textContent = `<meta name="xel-accent-color" content="${Xel.accentColor}">`;
      }
      // Custom color
      else {
        this._elements["accent-preset-select"].value = "custom";
        this._elements["accent-code"].textContent = `<meta name="xel-accent-color" content="${Xel.accentColor}">`;
      }
    }

    // Size
    {
      this._elements["size-select"].value = Xel.size;
      this._elements["size-code"].textContent = `<meta name="xel-size" content="${Xel.size}">`;
    }

    // Iconset
    {
      let name = Xel.iconset.substring(Xel.iconset.lastIndexOf("/") + 1, Xel.iconset.lastIndexOf("."));
      let meta = `<meta name="xel-iconset" content="node_modules/xel/iconsets/${name}.svg">`;

      this._elements["iconset-select"].value = name;
      this._elements["iconset-code"].textContent = meta;
    }
  }

  #updateAccentColorMenu() {
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

    this._elements["accent-preset-menu"].innerHTML = itemsHTML;
    this._elements["accent-preset-select"].value = "blue";
  }
}

customElements.define("pt-setuppage", PTSetupPageElement);
