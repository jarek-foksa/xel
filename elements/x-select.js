
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {createElement, html} = Xel.utils.element;
  let {sleep} = Xel.utils.time;

  let debug = false;
  let windowPadding = 7;
  let $itemChild = Symbol();

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-select.css" data-vulcanize>

      <div id="button">
        <div id="arrow-container">
          <svg id="arrow" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path></path>
          </svg>
        </div>
      </div>

      <slot></slot>
    </template>
  `;

  // @event
  //   change {oldValue: string?, newValue: string?}
  class XSelectElement extends HTMLElement {
    constructor() {
      super();

      this._wasFocusedBeforeExpanding = false;
      this._observer = new MutationObserver((args) => this._updateButton());

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      for (let element of this._shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this["#overlay"] = createElement("x-overlay");
      this["#overlay"].style.opacity = "0";
      this["#overlay"].ownerElement = this;
      this["#overlay"].addEventListener("click", (event) => this._onOverlayClick(event));

      this.addEventListener("pointerdown", (event) => this._onPointerDown(event));
      this.addEventListener("click", (event) => this._onClick(event));
      this.addEventListener("keydown", (event) => this._onKeyDown(event));
    }

    connectedCallback() {
      this._observer.observe(this, {childList: true, attributes: true, characterData: true, subtree: true});

      this._updateAccessabiltyAttributes();

      if (debug) {
        this.setAttribute("debug", "");
      }

      sleep(500).then(() => this._updateButton());
    }

    disconnectedCallback() {
      this._observer.disconnect();
    }

    attributeChangedCallback(name) {
      if (name === "disabled") {
        this._onDisabledAttributeChange();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    static get observedAttributes() {
      return ["disabled"];
    }

    // @type
    //   string?
    // @default
    //   null
    get value() {
      let item = this.querySelector(`x-menuitem[selected="true"]`);
      return item ? item.value : null;
    }
    set value(value) {
      for (let item of this.querySelectorAll("x-menuitem")) {
        item.selected = (item.value === value && value !== null);
      }
    }

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

    _onDisabledAttributeChange() {
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      this.setAttribute("aria-disabled", this.disabled);
    }

    _onPointerDown(event) {
      // Don't focus the widget with pointer
      if (!event.target.closest("x-menu") && this.matches(":focus") === false) {
        event.preventDefault();
      }
    }

    _onClick(event) {
      if (event.button !== 0) {
        return;
      }

      if (this._canExpand()) {
        this._expand();
      }
      else if (this._canCollapse()) {
        let clickedItem = event.target.closest("x-menuitem");

        if (clickedItem) {
          let oldValue = this.value;
          let newValue = clickedItem.value;

          for (let item of this.querySelectorAll("x-menuitem")) {
            item.selected = (item === clickedItem);
          }

          if (oldValue !== newValue) {
            this.dispatchEvent(new CustomEvent("change", {bubbles: true, detail: {oldValue, newValue}}));
          }

          this._collapse(clickedItem.whenTriggerEnd);
        }
      }
    }

    _onOverlayClick(event) {
      this._collapse();
    }

    _onKeyDown(event) {
      let menu = this.querySelector(":scope > x-menu");

      if (event.key === "Enter" || event.key === "Space" || event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (this._canExpand()) {
          event.preventDefault();
          this._expand();
        }
      }

      else if (event.key === "Escape") {
        if (this._canCollapse()) {
          event.preventDefault();
          this._collapse();
        }
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _expand() {
      if (this._canExpand() === false) {
        return;
      }

      this._wasFocusedBeforeExpanding = this.matches(":focus");

      this["#overlay"].show(false);

      window.addEventListener("resize", this._resizeListener = () => {
        this._collapse();
      });

      window.addEventListener("blur", this._blurListener = () => {
        if (debug === false) {
          this._collapse()
        }
      });

      let menu = this.querySelector(":scope > x-menu");

      // Ensure there is at most one selected menu item and all other items are unselected
      {
        let selectedItem = null;

        for (let item of menu.querySelectorAll("x-menuitem")) {
          if (item.selected === null) {
            item.selected = false;
          }
          else if (item.selected === true) {
            if (selectedItem === null) {
              selectedItem = item;
            }
            else {
              item.selected = false;
            }
          }
        }
      }

      // Open the menu
      {
        let selectedItem = menu.querySelector(`x-menuitem[selected="true"]`);

        if (selectedItem) {
          let buttonChild = this["#button"].querySelector("x-label") || this["#button"].firstElementChild;
          let itemChild = buttonChild[$itemChild];

          menu.openOverElement(buttonChild, itemChild);
        }
        else {
          let item = menu.querySelector("x-menuitem").firstElementChild;
          menu.openOverElement(this["#button"], item);
        }
      }

      // Increase menu width if it is narrower than the button
      {
        let menuBounds = menu.getBoundingClientRect();
        let buttonBounds = this["#button"].getBoundingClientRect();
        let hostPaddingRight = parseFloat(getComputedStyle(this).paddingRight);

        if (menuBounds.right - hostPaddingRight < buttonBounds.right) {
          menu.style.minWidth = (buttonBounds.right - menuBounds.left + hostPaddingRight) + "px";
        }
      }

      // Reduce menu width if it oveflows the right client bound
      {
        let menuBounds = this.getBoundingClientRect();

        if (menuBounds.right + windowPadding > window.innerWidth) {
          this.style.maxWidth = (window.innerWidth - menuBounds.left - windowPadding) + "px";
        }
      }
    }

    async _collapse(whenTriggerEnd = null) {
      if (this._canCollapse() === false) {
        return;
      }

      let menu = this.querySelector(":scope > x-menu");
      menu.setAttribute("closing", "");
      await whenTriggerEnd;
      this["#overlay"].hide(false);

      if (this._wasFocusedBeforeExpanding) {
        this.focus();
      }
      else {
        let ancestorFocusableElement = closest(this.parentNode, "[tabindex]");

        if (ancestorFocusableElement) {
          ancestorFocusableElement.focus();
        }
      }

      window.removeEventListener("resize", this._resizeListener);
      window.removeEventListener("blur", this._blurListener);

      await menu.close();
      menu.removeAttribute("closing");
    }

    _canExpand() {
      if (this.disabled) {
        return false;
      }
      else {
        let menu = this.querySelector(":scope > x-menu");
        let item = menu.querySelector("x-menuitem");
        return menu !== null && menu.opened === false && menu.hasAttribute("closing") === false && item !== null;
      }
    }

    _canCollapse() {
      if (this.disabled) {
        return false;
      }
      else {
        let menu = this.querySelector(":scope > x-menu");
        let item = menu.querySelector("x-menuitem");
        return menu !== null && menu.opened === true && menu.hasAttribute("closing") === false;
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _updateButton() {
      let selectedItem = this.querySelector(`:scope > x-menu x-menuitem[selected="true"]`);
      let arrowContainer = this["#arrow-container"];

      this["#button"].innerHTML = "";

      if (selectedItem) {
        for (let itemChild of selectedItem.children) {
          let buttonChild = itemChild.cloneNode(true);
          buttonChild[$itemChild] = itemChild;
          buttonChild.removeAttribute("id");
          buttonChild.removeAttribute("style");
          buttonChild.style.marginLeft = getComputedStyle(itemChild).marginLeft;

          if (["x-icon", "x-swatch", "img", "svg"].includes(itemChild.localName)) {
            let {width, height} = getComputedStyle(itemChild);

            buttonChild.style.width = width;
            buttonChild.style.height = height;
            buttonChild.style.minWidth = width;
          }

          this["#button"].append(buttonChild);
        }
      }

      this["#button"].append(arrowContainer);
    }

    _updateAccessabiltyAttributes() {
      this.setAttribute("tabindex", this.disabled ? "-1" : "0");
      this.setAttribute("role", "button");
      this.setAttribute("aria-disabled", this.disabled);

      let menu = this.querySelector(":scope > x-menu");

      if (menu) {
        menu.setAttribute("role", "listbox");

        for (let item of menu.querySelectorAll("x-listitem")) {
          item.setAttribute("role", "option");
        }
      }
    }
  }

  customElements.define("x-select", XSelectElement);
}
