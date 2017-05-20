
// @doc
//   https://material.google.com/style/icons.html#icons-system-icons
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {html, svg} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-icon.css" data-vulcanize>
      <svg id="svg" preserveAspectRatio="none" viewBox="0 0 100 100" width="0px" height="0px"></svg>
    </template>
  `;

  class XIconElement extends HTMLElement {
    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }
    }

    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue === newValue) {
        return;
      }
      else if (name === "name") {
        this._update();
      }
      else if (name === "iconset") {
        this._update();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["name", "iconset"];
    }

    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get name() {
      return this.hasAttribute("name") ? this.getAttribute("name") : "";
    }
    set name(name) {
      this.setAttribute("name", name);
    }

    // @type
    //   string
    // @default
    //   "node_modules/xel/images/icons.svg"
    // @attribute
    get iconset() {
      return this.hasAttribute("iconset") ? this.getAttribute("iconset") : `node_modules/xel/images/icons.svg`;
    }
    set iconset(iconset) {
      this.setAttribute("iconset", iconset);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    async _update() {
      if (this.name === "") {
        this["#svg"].innerHTML = "";
      }
      else {
        if (this.iconset.startsWith("http") && new URL(this.iconset).origin !== window.location.origin) {
          let symbol = await this._getSymbol(this.name, this.iconset);

          if (symbol) {
            this["#svg"].innerHTML = `${symbol.outerHTML}<use href="#${this.name}" width="100%" height="100%"></use>`
          }
        }
        else {
          let href = `${this.iconset}#${this.name}`;
          this["#svg"].innerHTML = `<use href="${href}" width="100%" height="100%"></use>`;
        }
      }
    }

    _getSymbol(name, url) {
      return new Promise(async (resolve) => {
        let iconset = null;
        let cache = XIconElement._cache || [];

        if (!XIconElement._cache) {
          XIconElement._cache = cache;
        }

        if (cache[url]) {
          iconset = cache[url];
        }
        else {
          let fetchResponse;

          try {
            fetchResponse = await fetch(url);
          }
          catch (error) {
            fetchResponse = null;
          }

          if (fetchResponse && fetchResponse.ok) {
            try {
              let iconsetSVG = await fetchResponse.text();
              iconset = svg`${iconsetSVG}`;
              cache[url] = iconset;
            }
            catch (error) {
            }
          }
        }

        if (iconset) {
          let symbol = iconset.querySelector(`#${name}`);

          if (symbol) {
            resolve(symbol);
          }
        }
      });
    }
  }

  customElements.define("x-icon", XIconElement);
}
