
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {closest} from "../utils/element.js";
import {normalize} from "../utils/math.js";
import {html, css} from "../utils/template.js";

// @element x-pager
// @event toggle
// @part item
// @part toggled-item
export class XPagerElement extends HTMLElement {
  static observedAttributes = ["value", "max", "controls", "href"];

  static #shadowTemplate = html`
    <template>
      <div id="items"></div>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      box-sizing: border-box;
      width: 100%;
      --prev-path-data:  M 74 20 L 74 80 L 26 50 L 74 20 Z;
      --next-path-data:  M 26 20 L 26 80 L 74 50 Z;
      --first-path-data: M 16 20 L 26 20 L 26 80 L 16 80 L 16 20 Z M 84 20 L 84 80 L 36 50 L 84 20 Z;
      --last-path-data:  M 84 20 L 74 20 L 74 80 L 84 80 L 84 20 Z M 16 20 L 16 80 L 64 50 L 16 20 Z;
    }
    :host([hidden]) {
      display: none;
    }
    :host([max="1"]) {
      display: none;
    }

    #items {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    #items a {
      color: inherit;
      text-decoration: none;
    }

    .item {
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 3px;
      height: 30px;
      box-sizing: border-box;
      border-width: 1px;
      border-style: solid;
      outline-offset: 0;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1;
      user-select: none;
      -webkit-user-select: none;
    }
    div.item {
      cursor: default;
    }
    .item[data-disabled] {
      opacity: 0;
    }
    #first-item,
    #last-item,
    #prev-item,
    #next-item {
      padding: 0 4px;
    }
    .nth-item {
      padding: 0 10px;
    }
    .ellipsis-item {
      background: none;
      border: none;
    }
    .item:first-child {
      margin-left: 0;
    }
    .item:last-child {
      margin-right: 0;
    }
    .ellipsis-item {
      flex: 0;
    }

    /**
     * Arrow
     */

    .arrow {
      display: flex;
      width: 16px;
      height: 16px;
    }

    .arrow path {
      fill: currentColor;
    }
  `;

  // @property
  // @attribute
  // @type number
  // @default 1
  //
  // The current page number.
  get value() {
    if (this.hasAttribute("value")) {
      return parseInt(this.getAttribute("value"));
    }
    else {
      return 1;
    }
  }
  set value(value) {
    value = normalize(value, 1, this.max);
    this.setAttribute("value", value);
  }

  // @property
  // @attribute
  // @type number
  // @default 5
  //
  // The total number of pages.
  get max() {
    return this.hasAttribute("max") ? parseFloat(this.getAttribute("max")) : 5;
  }
  set max(max) {
    this.setAttribute("max", max);
  }

  // @property
  // @attribute
  // @type Array<string>
  // @default ["prev", "nth", "next"]
  //
  // Available controls.
  get controls() {
    if (this.hasAttribute("controls")) {
      return this.getAttribute("controls").replace(/\s+/g, " ").split(" ");
    }
    else {
      return ["prev", "next", "nth"];
    }
  }
  set controls(controls) {
    this.setAttribute("controls", controls.join(" "));
  }

  // @property
  // @attribute
  // @type string?
  // @default null
  //
  // If specified, each pager item will be rendered as a link.
  get href() {
    return this.getAttribute("href");
  }
  set href(href) {
    if (href) {
      this.setAttribute("href", href);
    }
    else {
      this.removeAttribute("href");
    }
  }

  #shadowRoot;
  #xelThemeChangeListener;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();
  }

  connectedCallback() {
    if (!this.#shadowRoot) {
      this.setAttribute("role", "navigation");
      this.setAttribute("aria-label", "pagination");

      this.#shadowRoot  = this.attachShadow({mode: "closed"});
      this.#shadowRoot.adoptedStyleSheets = [XPagerElement.#shadowStyleSheet];
      this.#shadowRoot.append(document.importNode(XPagerElement.#shadowTemplate.content, true));

      for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
      this.#shadowRoot.addEventListener("click", (event) => this.#onClick(event));
      this.addEventListener("keydown", (event) => this.#onKeyDown(event));
    }

    Xel.addEventListener("themechange", this.#xelThemeChangeListener = () => this.#onThemeChange());
    Xel.whenThemeReady.then(() => this.#update());
  }

  disconnectedCallback() {
    Xel.removeEventListener("themechange", this.#xelThemeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.#shadowRoot) {
      return;
    }
    else if (name === "value") {
      this.#update();
    }
    else if (name === "max") {
      this.#update();
    }
    else if (name === "controls") {
      this.#update();
    }
    else if (name === "href") {
      this.#update();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onThemeChange() {
    this.#update();
  }

  #onPointerDown(event) {
    if (event.buttons > 1) {
      event.preventDefault();
      return;
    }

    let item = event.target.closest(".item");

    if (!item) {
      return;
    }

    // Don't focus the item with pointer, instead focus the closest ancestor focusable element as soon as
    // the item is released.
    {
      event.preventDefault();

      if (item.matches(":focus") === false) {
        let ancestorFocusableElement = closest(this, "*[tabindex]:not(a)");
        let pointerUpOrCancelListener;

        this.addEventListener("pointerup", pointerUpOrCancelListener = () => {
          this.removeEventListener("pointerup", pointerUpOrCancelListener);
          this.removeEventListener("pointercancel", pointerUpOrCancelListener);

          if (ancestorFocusableElement) {
            ancestorFocusableElement.focus();
          }
          else {
            this.focus();
            this.blur();
          }
        });

        this.addEventListener("pointercancel", pointerUpOrCancelListener);
      }
    }
  }

  #onClick(event) {
    let item = event.target.closest(".item");
    let anchor = event.target.closest("a");

    if (item && item.dataset.value !== undefined) {
      if (anchor) {
        event.preventDefault();
      }

      if (item.part.contains("toggled-item") === false) {
        this.value = parseInt(item.dataset.value);
        this.dispatchEvent(new CustomEvent("toggle"));
      }
    }
  }

  #onKeyDown(event) {
    let focusedItem = this["#items"].querySelector(":focus");

    if (focusedItem) {
      if (event.code === "Enter" || event.code === "NumpadEnter" || event.code === "Space") {
        event.preventDefault();
        event.stopPropagation();

        focusedItem.click();
      }
      else if (event.code === "ArrowRight" || event.code === "ArrowLeft") {
        let selectableItems = [...this["#items"].children].filter((item) => {
          return item.hasAttribute("data-value") && !item.hasAttribute("data-disabled");
        });

        let focusedItemIndex = selectableItems.indexOf(focusedItem);

        if (event.code === "ArrowRight") {
          let nextItem = selectableItems[focusedItemIndex+1];

          if (nextItem) {
            nextItem.focus();
          }
        }
        else if (event.code === "ArrowLeft") {
          let prevItem = selectableItems[focusedItemIndex-1];

          if (prevItem) {
            prevItem.focus();
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #getItemsHTML() {
    let itemsHTML = "";

    // First item
    if (this.controls.includes("first") && this.max > 1) {
      itemsHTML += this.#getNamedItemHTML(1, "first");
    }

    // Previous item
    if (this.controls.includes("prev") && this.max > 1) {
      itemsHTML += this.#getNamedItemHTML(Math.max(1, this.value - 1), "prev");
    }

    // Nth items
    if (this.controls.includes("nth")) {
      if (this.max <= 10) {
        for (let i = 1; i <= this.max; i += 1) {
          if (i === this.value) {
            itemsHTML += this.#getNthItemHTML(i, true);
          }
          else {
            itemsHTML += this.#getNthItemHTML(i, false);
          }
        }
      }
      else {
        if (this.value <= 6) {
          for (let i = 1; i <= 7; i += 1) {
            if (i === this.value) {
              itemsHTML += this.#getNthItemHTML(i, true);
            }
            else {
              itemsHTML += this.#getNthItemHTML(i, false);
            }
          }

          itemsHTML += this.#getEllipsisItemHTML();

          for (let i of [this.max - 1, this.max]) {
            itemsHTML += this.#getNthItemHTML(i, false);
          }
        }
        else if (this.value > this.max - 6) {
          for (let i of [1, 2]) {
            itemsHTML += this.#getNthItemHTML(i, false);
          }

          itemsHTML += this.#getEllipsisItemHTML();

          for (let i = this.max-6; i <= this.max; i += 1) {
            itemsHTML += this.#getNthItemHTML(i, i === this.value);
          }
        }
        else {
          for (let i of [1, 2]) {
            itemsHTML += this.#getNthItemHTML(i, false);
          }

          itemsHTML += this.#getEllipsisItemHTML();

          for (let i = this.value-1; i < this.value + 4; i += 1) {
            itemsHTML += this.#getNthItemHTML(i, i === this.value);
          }

          itemsHTML += this.#getEllipsisItemHTML();

          for (let i of [this.max - 1, this.max]) {
            itemsHTML += this.#getNthItemHTML(i, false);
          }
        }
      }
    }

    // Next item
    if (this.controls.includes("next") && this.max > 1) {
      itemsHTML += this.#getNamedItemHTML(Math.min(this.max, this.value + 1), "next");
    }

    // Last item
    if (this.controls.includes("last") && this.max > 1) {
      itemsHTML += this.#getNamedItemHTML(this.max, "last");
    }

    return itemsHTML;
  }

  #getNamedItemHTML(page = 1, pos = "prev") {
    let partAttr = `part="item"`;
    let valueAttr = `data-value="${page}"`;
    let disabledAttr = (page === this.value) ? "data-disabled" : "";
    let tabindexAttr = (page === this.value) ? `tabindex="-1"` : `tabindex="0"`;

    if (this.href) {
      let href = this.#getHrefWithPageParam(page);
      let linkAttrs = `href="${href}" rel="${pos}"`;

      return `
        <a id="${pos}-item" class="item" ${partAttr} ${valueAttr} ${disabledAttr} ${linkAttrs} ${tabindexAttr}>
          <svg id="${pos}-arrow" class="arrow" viewBox="0 0 100 100">
            <path id="${pos}-path"></path>
          </svg>
        </a>
      `;
    }
    else {
      return `
        <div id="${pos}-item" class="item" ${partAttr} ${valueAttr} ${disabledAttr} ${tabindexAttr}>
          <svg id="${pos}-arrow" class="arrow" viewBox="0 0 100 100">
            <path id="${pos}-path"></path>
          </svg>
        </div>
      `;
    }
  }

  #getNthItemHTML(page = 1, toggled = false) {
    let href = toggled || !this.href ? null : this.#getHrefWithPageParam(page);

    let idAttr = `id="item-${page}"`
    let partAttr = `part="item ${toggled ? " toggled-item" : ""}"`;
    let valueAttr = `data-value="${page}"`;
    let tabindexAttr = toggled ? `tabindex="-1"` : `tabindex="0"`;

    if (href) {
      let linkAttrs = `href="${href}" rel="${page}"`;
      return `<a class="item nth-item" ${idAttr} ${partAttr} ${valueAttr} ${tabindexAttr} ${linkAttrs}>${page}</a>`;
    }
    else {
      return `<div class="item nth-item" ${idAttr} ${partAttr} ${valueAttr} ${tabindexAttr}>${page}</div>`;
    }
  }

  #getEllipsisItemHTML() {
    return `<div class="item ellipsis-item">…</div>`;
  }

  #getHrefWithPageParam(page = 1) {
    let url = new URL(this.href);

    if (page === 1) {
      url.searchParams.delete("page");
    }
    else {
      url.searchParams.set("page", page);
    }

    return url.href;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    let oldFocusedItem = this["#items"].querySelector(":focus");

    // Update items
    {
      this["#items"].innerHTML = this.#getItemsHTML();

      for (let element of this["#items"].querySelectorAll("[id]")) {
        this["#" + element.id] = element;
      }

      if (oldFocusedItem) {
        let item = this["#items"].querySelector(`#${oldFocusedItem.id}:not([data-disabled])`);

        if (item) {
          item.focus();
        }
        else {
          item = this["#items"].querySelector(`[part*="toggled-item"]`);

          if (item) {
            item.focus();
          }
        }
      }
    }

    // Update arrow paths
    {
      let computedStyle = getComputedStyle(this);

      for (let pos of ["prev", "next", "first", "last"]) {
        let path = this["#items"].querySelector(`#${pos}-path`)

        if (path) {
          path.setAttribute("d",  computedStyle.getPropertyValue(`--${pos}-path-data`));
        }
      }
    }
  }
}

customElements.define("x-pager", XPagerElement);
