
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";
import {getTimeStamp} from "../utils/time.js";

// @element x-tagsinput
// @event input
// @event change
// @event add
// @event remove
// @event ^textinputmodestart
// @event ^textinputmodeend
// @part input
// @part suggestions
export default class XTagsInputElement extends HTMLElement {
  static observedAttributes = ["spellcheck", "disabled"];

  static #shadowTemplate = html`
    <template>
      <div id="main">
        <slot></slot>
        <input id="input" type="text" part="input" spellcheck="false" tabindex="0"></input>
      </div>

      <x-popover id="suggestions-popover" part="suggestions">
        <div id="suggested-tags"></div>
      </x-popover>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block flex;
      position: relative;
      box-sizing: border-box;
      align-items: center;
      padding: 3px;
      gap: 3px;
      font-size: 0.78125rem;
    }
    :host(:focus) {
      z-index: 10;
    }
    :host([disabled]) {
      pointer-events: none;
      opacity: 0.5;
    }
    :host([hidden]) {
      display: none;
    }

    ::selection {
      color: var(--selection-color);
      background-color: var(--selection-background-color);
    }

    #main {
      width: 100%;
      height: 100%;
      cursor: text;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: inherit;
    }
    :host([mixed]) #main {
      opacity: 0.7;
    }

    /**
     * Input
     */

    #input {
      width: 10px;
      height: 20px;
      margin: 2px;
      padding: 0px 3px 0 5px;
      box-sizing: border-box;
      line-height: 22px;
      color: inherit;
      background: none;
      border: none;
      outline: none;
      font-size: inherit;
      font-family: inherit;
    }

    /**
     * Popover
     */

    #suggestions-popover {
      width: 200px;
      max-height: 200px;
      padding: 4px;
      box-sizing: border-box;
    }

    #suggestions-popover #suggested-tags {
      flex: 1;
      overflow: auto;
    }

    #suggestions-popover x-tag {
      display: block;
      margin: 4px 0 0 0;
    }
    #suggestions-popover x-tag:first-child {
      margin-top: 0;
    }
  `;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  // @property
  // @type Array<string>
  // @default []
  // @readOnly
  get value() {
    let tags = [...this.children].filter(child => child.localName === "x-tag");
    return tags.map(tag => tag.value).filter(value => value !== null);
  }

  // @property
  // @attribute
  // @type string
  // @default ","
  get delimiter() {
    return this.hasAttribute("delimiter") ? this.getAttribute("delimiter") : ",";
  }
  set delimiter(delimiter) {
    this.setAttribute("delimiter", delimiter);
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get spellcheck() {
    return this.hasAttribute("spellcheck");
  }
  set spellcheck(spellcheck) {
    spellcheck ? this.setAttribute("spellcheck", "") : this.removeAttribute("spellcheck");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get mixed() {
    return this.hasAttribute("mixed");
  }
  set mixed(mixed) {
    mixed ? this.setAttribute("mixed", "") : this.removeAttribute("mixed");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(disabled) {
    disabled ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  // @property
  // @attribute
  // @type boolean
  // @default false
  //
  // Whether to show a popover with suggestions.
  get suggestions() {
    return this.hasAttribute("suggestions");
  }
  set suggestions(suggestions) {
    suggestions ? this.setAttribute("suggestions", "") : this.removeAttribute("suggestions");
  }

  // @property
  // @attribute
  // @type "small" || "large" || null
  // @default null
  get size() {
    let size = this.getAttribute("size");
    return (size === "small" || size === "large") ? size : null;
  }
  set size(size) {
    (size === "small" || size === "large") ? this.setAttribute("size", size) : this.removeAttribute("size");
  }

  #shadowRoot = null;
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XTagsInputElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTagsInputElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this["#" + element.id] = element;
    }

    this.addEventListener("pointerdown", (event) => this.#onPointerDown(event));
    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.#shadowRoot.addEventListener("remove", (event) => this.#onRemoveButtonClick(event));
    this.#shadowRoot.addEventListener("keydown", (event) => this.#onKeyDown(event));

    this["#input"].addEventListener("focusin", (event) => this.#onInputFocusIn(event));
    this["#input"].addEventListener("focusout", (event) => this.#onInputFocusOut(event));
    this["#input"].addEventListener("input", (event) => this.#onInputInput(event));
  }

  connectedCallback() {
    this.#updatePlaceholderVisibility();
    this.#updateAccessabilityAttributes();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "spellcheck") {
      this.#onSpellcheckAttributeChange();
    }
    else if (name === "disabled") {
      this.#onDisabledAttributeChange();
    }
  }

  // @method
  // @type () => void
  clear() {
    let tags = [...this.children].filter(child => child.localName === "x-tag");

    if (tags.length > 0) {
      for (let tag of tags) {
        tag.remove();
        this.dispatchEvent(new CustomEvent("remove", {detail: tag}));
      }

      this.#updateSuggestions();
      this.#updatePlaceholderVisibility();

      this.dispatchEvent(new CustomEvent("change"));
    }
  }

  // @method
  // @type (string) => Array<XTagElement>
  //
  // Override this method to provide customized suggestions.
  getSuggestions(text) {
    return [];
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #commitInput() {
    let tagText = this["#input"].value;

    this["#input"].value = "";
    this.#updateInputSize();

    if (tagText.endsWith(this.delimiter)) {
      tagText = tagText.substring(0, tagText.length-1);
    }

    tagText = tagText.trim();

    if (tagText.length > 0) {
      if (this.value.includes(tagText) === false) {
        let tag;

        // Scoped tag
        if (tagText.includes(":")) {
          let [scopeText, mainText] = tagText.split(":").map($0 => $0.trim());

          tag = html`
            <x-tag class="tag" value="${tagText}" removable>
              <x-label slot="scope">${scopeText}</x-label>
              <x-label>${mainText}</x-label>
            </x-tag>
          `;
        }
        // Normal tag
        else {
          tag = html`
            <x-tag class="tag" value="${tagText}" removable>
              <x-label>${tagText}</x-label>
            </x-tag>
          `;
        }

        this.append(tag);

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }

    this["#input"].style.minWidth = "0px";
    this["#input"].style.minWidth = this["#input"].scrollWidth + "px";
  }

  #clearSuggestions() {
    this["#suggested-tags"].innerHTML = "";

    if (this["#suggestions-popover"].opened === true) {
      this["#suggestions-popover"].close();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #lastShadowRootPointerDownTime = 0;

  #onPointerDown(event) {
    if (event.target === this && event.defaultPrevented === false) {
      event.preventDefault();
      this["#input"].focus();
    }
  }

  #onShadowRootPointerDown(event) {
    this.#lastShadowRootPointerDownTime = getTimeStamp();

    if (event.target === this["#input"]) {
      if (this["#input"].value.length > 0) {
        this.#clearSuggestions();
      }
    }
    else if (event.target === this["#main"]) {
      event.preventDefault();
      this["#input"].focus();
      this.#updateSuggestions(false);
    }
    else if (event.target.closest("x-popover")) {
      event.preventDefault();

      let tag = event.target.closest("x-tag");

      if (tag) {
        this.append(tag);

        this["#input"].value = "";
        this.#updateInputSize();
        this.#updateSuggestions(false);

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.target.closest("x-tag")) {
      if (this["#input"].value !== "") {
        this.#commitInput();
        this.#updateSuggestions();
        this.#updatePlaceholderVisibility();
      }
    }
  }

  #onRemoveButtonClick(event) {
    event.stopPropagation();

    let tag = event.target;
    tag.remove();

    this.#updatePlaceholderVisibility();

    this.dispatchEvent(new CustomEvent("remove", {detail: tag}));
    this.dispatchEvent(new CustomEvent("change"));
  }

  #onSpellcheckAttributeChange() {
    this["#input"].spellcheck = this.spellcheck;
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  async #onInputFocusIn() {
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));
  }

  #onInputFocusOut() {
    this.#commitInput();
    this.#updatePlaceholderVisibility();

    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this["#suggestions-popover"].close();
  }

  #onInputInput(event) {
    let value = this["#input"].value;

    if (value.includes(this.delimiter)) {
      this.#commitInput();
      this.#updatePlaceholderVisibility();
      this.#updateInputSize();
      this.#updateSuggestions(false);
    }
    else {
      this.dispatchEvent(new CustomEvent("input"));
      this.#updatePlaceholderVisibility();
      this.#updateInputSize();
      this.#updateSuggestions(event.inputType === "deleteContentBackward" ? false : true);
    }
  }

  #onKeyDown(event) {
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      if (event.target === this["#input"]) {
        event.preventDefault();
        this.#commitInput();
        this.#updateSuggestions(false);
        this.#updatePlaceholderVisibility();
        this.#updateInputSize();
      }
    }
    else if (event.code === "Backspace") {
      if (event.target === this["#input"]) {
        let value = this["#input"].value;

        if (value.length === 0) {
          let tags = [...this.children].filter(child => child.localName === "x-tag");
          let lastTag = tags[tags.length-1] || null;

          if (lastTag) {
            lastTag.remove();

            this.#updateSuggestions();
            this.#updatePlaceholderVisibility();

            this.dispatchEvent(new CustomEvent("remove", {detail: lastTag}));
            this.dispatchEvent(new CustomEvent("change"));
          }
        }
      }
      else if (event.target.localName === "x-tag") {
        event.stopImmediatePropagation();
        event.preventDefault();

        let tags = [...this.children].filter(child => child.localName === "x-tag");
        let focusedTag = event.target;
        let focusedTagIndex = tags.indexOf(focusedTag);
        let nextTag = tags[focusedTagIndex+1] || null;
        let prevTag = tags[focusedTagIndex-1] || null;

        if (nextTag) {
          nextTag.focus();
        }
        else if (prevTag) {
          prevTag.focus();
        }
        else {
          this["#input"].focus();
        }

        focusedTag.remove();
        this.#updatePlaceholderVisibility();

        this.dispatchEvent(new CustomEvent("remove", {detail: focusedTag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.code === "ArrowDown") {
      if (this["#suggestions-popover"].opened) {
        let suggestedTags = [...this["#suggested-tags"].children];

        if (suggestedTags.length > 1) {
          event.preventDefault();
          let nextTag = null;

          // Determine the next tag to select
          {
            let currentTag = suggestedTags.find(tag => tag.toggled);

            if (currentTag) {
              currentTag.toggled = false;

              let currentTagIndex = suggestedTags.indexOf(currentTag);
              nextTag = suggestedTags[currentTagIndex+1] || suggestedTags[0];
            }
            else {
              nextTag = suggestedTags[0];
            }
          }

          // Select the next tag
          {
            nextTag.toggled = true;
            nextTag.scrollIntoViewIfNeeded();
          }

          // Update input
          {
            let text = nextTag.querySelector("x-label").textContent;
            let startOffset = this["#input"].selectionStart;

            this["#input"].value = text;
            this.#updateInputSize();
            this.#updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
    else if (event.code === "ArrowUp") {
      if (this["#suggestions-popover"].opened) {
        let suggestedTags = [...this["#suggested-tags"].children];

        if (suggestedTags.length > 1) {
          event.preventDefault();
          let prevTag = null;

          // Determine the previous tag to select
          {
            let currentTag = suggestedTags.find(tag => tag.toggled);

            if (currentTag) {
              currentTag.toggled = false;

              let currentTagIndex = suggestedTags.indexOf(currentTag);
              prevTag = suggestedTags[currentTagIndex-1] || suggestedTags[suggestedTags.length-1];
            }
            else {
              prevTag = suggestedTags[suggestedTags.length-1];
            }
          }

          // Select the previous tag
          {
            prevTag.toggled = true;
            prevTag.scrollIntoViewIfNeeded();
          }

          // Update input
          {
            let text = prevTag.querySelector("x-label").textContent;
            let startOffset = this["#input"].selectionStart;

            this["#input"].value = text;
            this.#updateInputSize();
            this.#updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
    else if (event.code === "ArrowLeft" || event.code === "ArrowRight") {
      this.#clearSuggestions();
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updatePlaceholderVisibility();
  }

  #updatePlaceholderVisibility() {
    let placeholder = this.querySelector(":scope > x-label");

    if (placeholder) {
      placeholder.hidden = (this.value.length > 0 || this["#input"].value.length > 0);
    }
  }

  #updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this.#lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this.#lastTabIndex > 0) ? this.#lastTabIndex : 0;
      }

      this.#lastTabIndex = 0;
    }
  }

  #updateInputSize() {
    this["#input"].style.minWidth = "0px";
    this["#input"].style.minWidth = this["#input"].scrollWidth + "px";
  }

  #updateInputSelection(startOffset = 0, endOffset = this["#input"].value.length) {
    this["#input"].selectionStart = startOffset;
    this["#input"].selectionEnd = endOffset;
  }

  #updateSuggestions(autocomplete = true) {
    if (this.suggestions) {
      let text = this["#input"].value;

      if (this["#input"].selectionStart !== this["#input"].selectionEnd) {
        text = text.substring(0, this["#input"].selectionStart);
      }

      let suggestedTags = this.getSuggestions(text);

      // Update input
      {
        if (suggestedTags.length > 0 && autocomplete === true) {
          let inputText = this["#input"].value;
          let suggestedText = suggestedTags[0].querySelector("x-label").textContent;

          this["#input"].value = suggestedText;
          this.#updateInputSize();
          this.#updateInputSelection(inputText.length, suggestedText.length);
        }
      }

      // Update popover
      {
        if (suggestedTags.length === 0) {
          this["#suggested-tags"].innerHTML = "";

          if (this["#suggestions-popover"].opened === true) {
            this["#suggestions-popover"].close();
          }
        }
        else {
          let refRect = this["#input"].getBoundingClientRect();

          this["#suggested-tags"].innerHTML = "";
          this["#suggested-tags"].append(...suggestedTags);

          if (autocomplete === true && text.length > 0) {
            suggestedTags[0].toggled = true;
          }

          if (this["#suggestions-popover"].opened === false) {
            this["#suggestions-popover"].open(refRect);
          }
          else {
            this["#suggestions-popover"].close(false);
            this["#suggestions-popover"].open(refRect);
          }

          this["#suggested-tags"].scrollTop = 0;
        }
      }
    }
  }
}

customElements.define("x-tagsinput", XTagsInputElement);
