
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import Xel from "../classes/xel.js";

import {html, css} from "../utils/template.js";
import {sleep} from "../utils/time.js";

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
      <main id="main">
        <div id="tags">
          <slot></slot>
          <span id="input" part="input" spellcheck="false" tabindex="0"></span>
        </div>
      </main>

      <x-popover id="suggestions-popover" part="suggestions">
        <div id="suggested-tags"></div>
      </x-popover>
    </template>
  `;

  static #shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      min-height: 29px;
      font-size: 12px;
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
    }

    /**
     * Tags
     */

    #tags {
      display: flex;
      flex-wrap: wrap;
    }
    :host([mixed]) #tags {
      opacity: 0.7;
    }

    /**
     * Input
     */

    #input {
      align-items: center;
      justify-content: flex-start;
      height: 25px;
      margin: 2px;
      padding: 0px 3px 0 6px;
      box-sizing: border-box;
      line-height: 25px;
      color: inherit;
      outline: none;
      white-space: pre;
      cursor: text;
      user-select: text;
      -webkit-user-select: none;
      pointer-events: none;
    }
    #input[contenteditable]:focus {
      flex-grow: 1;
      pointer-events: all;
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
  `

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
  #elements = {};
  #lastTabIndex = 0;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this.#shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this.#shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XTagsInputElement.#shadowStyleSheet];
    this.#shadowRoot.append(document.importNode(XTagsInputElement.#shadowTemplate.content, true));

    for (let element of this.#shadowRoot.querySelectorAll("[id]")) {
      this.#elements[element.id] = element;
    }

    this.#elements["input"].addEventListener("focusin", (event) => this.#onInputFocusIn(event));
    this.#elements["input"].addEventListener("focusout", (event) => this.#onInputFocusOut(event));
    this.#shadowRoot.addEventListener("pointerdown", (event) => this.#onShadowRootPointerDown(event));
    this.#shadowRoot.addEventListener("remove", (event) => this.#onRemoveButtonClick(event));
    this.#shadowRoot.addEventListener("keydown", (event) => this.#onKeyDown(event));
    this.#elements["input"].addEventListener("input", (event) => this.#onInputInput(event));
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

  #getInputTextBoundingClientRect() {
    let range = new Range();
    range.selectNodeContents(this.#elements["input"]);

    let rect = range.getBoundingClientRect();

    if (rect.x === 0 && rect.width === 0) {
      rect = this.#elements["input"].getBoundingClientRect();
      rect.width = 20;
    }

    return rect;
  }

  #commitInput() {
    let tagText = this.#elements["input"].textContent;
    this.#elements["input"].textContent = "";

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

        this.#updateSuggestions();
        this.#updatePlaceholderVisibility();

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #onShadowRootPointerDown(event) {
    if (event.target === this.#elements["main"] || event.target === this.#elements["tags"]) {
      event.preventDefault();

      this.#elements["input"].setAttribute("contenteditable", "");
      this.#updateInputSelection();
    }
    else if (event.target === this.#elements["input"]) {
      this.#elements["input"].setAttribute("contenteditable", "");
    }
    else if (event.target.closest("x-popover")) {
      event.preventDefault();

      let tag = event.target.closest("x-tag");

      if (tag) {
        this.#elements["input"].textContent = "";
        this.#elements["suggestions-popover"].close();

        this.append(tag);

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.target.closest("x-tag")) {
      this.#elements["input"].focus();
      this.#commitInput();
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
    this.#elements["input"].spellcheck = this.spellcheck;
  }

  #onDisabledAttributeChange() {
    this.#updateAccessabilityAttributes();
  }

  async #onInputFocusIn() {
    this.#elements["input"].setAttribute("contenteditable", "");
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));

    await sleep(10);

    if (this.#elements["input"].matches(":focus")) {
      this.#updateInputSelection();
      this.#updateSuggestions();
    }
  }

  #onInputFocusOut() {
    this.#commitInput();
    this.#elements["input"].removeAttribute("contenteditable");
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));
    this.#elements["suggestions-popover"].close();
  }

  #onInputInput(event) {
    let value = this.#elements["input"].textContent;

    if (value.includes(this.delimiter)) {
      this.#commitInput();
    }

    this.#updatePlaceholderVisibility();
    this.dispatchEvent(new CustomEvent("input"));
    this.#updateSuggestions(event.inputType);
  }

  #onKeyDown(event) {
    if (event.key === "Enter") {
      if (event.target === this.#elements["input"]) {
        event.preventDefault();
        this.#commitInput();
      }
    }
    else if (event.key === "Backspace") {
      if (event.target === this.#elements["input"]) {
        let value = this.#elements["input"].textContent;

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
          this.#elements["input"].focus();
        }

        focusedTag.remove();
        this.#updatePlaceholderVisibility();

        this.dispatchEvent(new CustomEvent("remove", {detail: focusedTag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.key === "ArrowDown") {
      if (this.#elements["suggestions-popover"].opened) {
        let suggestedTags = [...this.#elements["suggested-tags"].children];

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
            let startOffset = 0;
            let text = nextTag.querySelector("x-label").textContent;

            // Safari 16.4 does not support ShadowRoot.prototype.getSelection
            if (this.#shadowRoot.getSelection) {
              startOffset = this.#shadowRoot.getSelection().getRangeAt(0).startOffset;
            }

            this.#elements["input"].textContent = text;
            this.#updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
    else if (event.key === "ArrowUp") {
      if (this.#elements["suggestions-popover"].opened) {
        let suggestedTags = [...this.#elements["suggested-tags"].children];

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
            let startOffset = 0;
            let text = prevTag.querySelector("x-label").textContent;

            // Safari 16.4 does not support ShadowRoot.prototype.getSelection
            if (this.#shadowRoot.getSelection) {
              startOffset = this.#shadowRoot.getSelection().getRangeAt(0).startOffset;
            }

            this.#elements["input"].textContent = text;
            this.#updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  #update() {
    this.#updatePlaceholderVisibility();
  }

  #updatePlaceholderVisibility() {
    let placeholder = this.querySelector(":scope > x-label");

    if (placeholder) {
      placeholder.hidden = (this.value.length > 0 || this.#elements["input"].textContent.length > 0);
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

  #updateInputSelection(startOffset = 0, endOffset = this.#elements["input"].textContent.length) {
    let range = new Range();

    if (startOffset === 0 && endOffset === this.#elements["input"].textContent.length) {
      range.selectNodeContents(this.#elements["input"]);
    }
    else {
      range.setStart(this.#elements["input"].firstChild, startOffset);
      range.setEnd(this.#elements["input"].firstChild, endOffset);
    }

    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  #updateSuggestions(inputType = "insertText") {
    if (this.suggestions) {
      let text = this.#elements["input"].textContent;

      // Safari 16.4 does not support ShadowRoot.prototype.getSelection
      if (this.#shadowRoot.getSelection) {
        let range = this.#shadowRoot.getSelection().getRangeAt(0);

        if (range.collapsed === false) {
          text = text.substring(0, range.startOffset);
        }
      }

      let suggestedTags = this.getSuggestions(text);

      // Update input
      {
        if (suggestedTags.length > 0 && inputType !== "deleteContentBackward") {
          let inputText = this.#elements["input"].textContent;
          let suggestedText = suggestedTags[0].querySelector("x-label").textContent;
          let textNode = this.#elements["input"].firstChild;

          if (textNode) {
            textNode.textContent = suggestedText;
            this.#updateInputSelection(inputText.length, suggestedText.length);
          }
        }
      }

      // Update popover
      {
        if (suggestedTags.length === 0) {
          this.#elements["suggested-tags"].innerHTML = "";

          if (this.#elements["suggestions-popover"].opened === true) {
            this.#elements["suggestions-popover"].close();
          }
        }
        else {
          let refRect = this.#getInputTextBoundingClientRect();

          this.#elements["suggested-tags"].innerHTML = "";
          this.#elements["suggested-tags"].append(...suggestedTags);

          if (inputType !== "deleteContentBackward" && text.length > 0) {
            suggestedTags[0].toggled = true;
          }

          if (this.#elements["suggestions-popover"].opened === false) {
            this.#elements["suggestions-popover"].open(refRect);
          }
          else {
            this.#elements["suggestions-popover"].close(false);
            this.#elements["suggestions-popover"].open(refRect);
          }

          this.#elements["suggested-tags"].scrollTop = 0;
        }
      }
    }
  }
}

customElements.define("x-tagsinput", XTagsInputElement);
