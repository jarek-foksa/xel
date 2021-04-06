
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {createElement, closest, elementFromPoint} from "../utils/element.js";
import {html, css} from "../utils/template.js";

// @element x-contextmenu
export default class XContextMenuElement extends HTMLElement {
  static _shadowTemplate = html`
    <template>
      <slot></slot>
    </template>
  `;

  static _shadowStyleSheet = css`
    :host {
      display: block;
      position: fixed;
      width: 0px;
      height: 0px;
      z-index: 1001;
    }
  `
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether the context menu should open when user right-clicks its parent container.
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  _shadowRoot = null;
  _elements = {};
  _parentElement = null;

  _windowBlurListener = null;
  _parentContextMenuListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed"});
    this._shadowRoot.adoptedStyleSheets = [XContextMenuElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XContextMenuElement._shadowTemplate.content, true));

    this._elements["backdrop"] = createElement("x-backdrop");
    this._elements["backdrop"].style.background =  "rgba(0, 0, 0, 0)";
    this._elements["backdrop"].addEventListener("contextmenu", (event) => this._onBackdropContextMenu(event));
    this._elements["backdrop"].addEventListener("pointerdown", (event) => this._onBackdropPointerDown(event));

    this.addEventListener("blur", (event) => this._onBlur());
    this.addEventListener("keydown", (event) => this._onKeyDown(event), true);
    this.addEventListener("click", (event) => this._onClick(event));
  }

  connectedCallback() {
    this._parentElement = this.parentElement || this.parentNode.host;

    window.addEventListener("blur", this._windowBlurListener = () => {
      this._onBlur();
    });

    this._parentElement.addEventListener("contextmenu", this._parentContextMenuListener = (event) => {
      this._onParentContextMenu(event);
    });
  }

  disconnectedCallback() {
    window.removeEventListener("blur", this._windowBlurListener);
    this._parentElement.removeEventListener("contextmenu", this._parentContextMenuListener);

    this._parentElement = null;
  }

  ///////////////////////////////////'/////////////////////////////////////////////////////////////////////////////

  // @method
  // @type (number, number) => void
  //
  // Open the context menu at given point.
  open(clientX, clientY) {
    let menu = this.querySelector("x-menu");

    if (menu.opened === false) {
      menu.openAtPoint(clientX, clientY);

      this._elements["backdrop"].ownerElement = menu;
      this._elements["backdrop"].show(false);

      menu.focus();
    }
  }

  // @method
  // @type () => void
  //
  // Close the context menu.
  close() {
    return new Promise(async (resolve) => {
      let menu = this.querySelector("x-menu");

      if (menu && menu.opened === true) {
        await menu.close();
        this._elements["backdrop"].hide(false);

        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      resolve();
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onBlur() {
    this.close();
  }

  _onParentContextMenu(event) {
    if (this.disabled === false) {
      event.preventDefault();
      this.open(event.clientX, event.clientY);
    }
  }

  _onBackdropContextMenu(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    this.close().then(() => {
      let target = elementFromPoint(event.clientX, event.clientY, true);
      let clonedEvent = new MouseEvent(event.type, event);
      target.dispatchEvent(clonedEvent);
    });
  }

  _onBackdropPointerDown(event) {
    if (event.buttons === 1) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
    }
  }

  async _onClick(event) {
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
}

customElements.define("x-contextmenu", XContextMenuElement);
