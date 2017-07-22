
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {createElement, html, closest} = Xel.utils.element;
  let debug = true;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-contextmenu.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  class XContextMenuElement extends HTMLElement {
    constructor() {
      super();

      this._parentElement = null;

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      this["#overlay"] = createElement("x-overlay");
      this["#overlay"].style.background =  "rgba(0, 0, 0, 0)";
      this["#overlay"].addEventListener("contextmenu", (event) => this._onOverlayContextMenu(event));
      this["#overlay"].addEventListener("pointerdown", (event) => this._onOverlayPointerDown(event));

      window.addEventListener("blur", () => this._onBlur());
      this.addEventListener("blur", () => this._onBlur());
      this.addEventListener("keydown", (event) => this._onKeyDown(event), true);
      this.addEventListener("click", (event) => this._onClick(event));
    }

    connectedCallback() {
      this._parentElement = this.parentElement || this.parentNode.host;

      this._parentElement.addEventListener("contextmenu", this._parentContextMenuListener = (event) => {
        this._onParentContextMenu(event);
      });
    }

    disconnectedCallback() {
      this._parentElement.removeEventListener("contextmenu", this._parentContextMenuListener);
      this._parentElement = null;
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @type
    //   boolean
    // @default
    //   false
    // @attribute
    get disabled() {
      return this.hasAttribute("disabled");
    }
    set disabled(disabled) {
      disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onBlur() {
      if (debug === false) {
        this.close();
      }
    }

    _onParentContextMenu(event) {
      if (this.disabled === false) {
        event.preventDefault();
        this.open(event.clientX, event.clientY);
      }
    }

    _onOverlayContextMenu(event) {
      event.preventDefault()
      event.stopImmediatePropagation();

      this.close().then(() => {
        let target = this.parentElement.getRootNode().elementFromPoint(event.clientX, event.clientY);

        if (target && this.parentElement.contains(target)) {
          this.open(event.clientX, event.clientY);
        }
      });
    }

    _onOverlayPointerDown(event) {
      if (event.button === 0) {
        event.preventDefault();
        this.close();
      }
    }

    async _onClick() {
      let item = event.target.closest("x-menuitem");

      if (item && item.disabled === false) {
        let submenu = item.querySelector("x-menu");

        if (submenu) {
          if (submenu.opened) {
            submenu.close();
          }
          else {
            submenu.openNextToElement(item, "horizontal");
          }
        }
        else {
          this.setAttribute("closing", "");

          await item.whenTriggerEnd;
          await this.close()

          this.removeAttribute("closing");
        }
      }
    }

    _onKeyDown(event) {
      if (event.key === "Escape") {
        let menu = this.querySelector("x-menu");

        if (menu.opened) {
          event.preventDefault();
          this.close();
        }
      }

      else if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();

        let menu = this.querySelector("x-menu");
        menu.focusNextMenuItem();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    open(clientX, clientY) {
      let menu = this.querySelector("x-menu");

      if (menu.opened === false) {
        menu.openAtPoint(clientX, clientY);

        this["#overlay"].ownerElement = menu;
        this["#overlay"].show(false);

        menu.focus();
      }
    }

    close() {
      return new Promise(async (resolve) => {
        let menu = this.querySelector("x-menu");
        await menu.close();
        this["#overlay"].hide(false);

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }

        resolve();
      });
    }
  }

  customElements.define("x-contextmenu", XContextMenuElement);
}
