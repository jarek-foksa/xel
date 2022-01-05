
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
  static observedAttributes = ["spellcheck", "disabled", "size"];

  static _shadowTemplate = html`
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

  static _shadowStyleSheet = css`
    :host {
      display: block;
      position: relative;
      min-height: 29px;
      border: 1px solid #BFBFBF;
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
    :host([error]) ::selection {
      color: white;
      background-color: #d50000;
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

    /**
     * Error message
     */

    :host([error])::before {
      position: absolute;
      left: 0;
      top: 35px;
      white-space: pre;
      content: attr(error);
      font-size: 11px;
      line-height: 1.2;
      pointer-events: none;
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
  get required() {
    return this.hasAttribute("required");
  }
  set required(required) {
    required ? this.setAttribute("required", "") : this.removeAttribute("required");
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
  // @type string?
  // @default null
  get error() {
    return this.getAttribute("error");
  }
  set error(error) {
    error === null ? this.removeAttribute("error") : this.setAttribute("error", error);
  }

  // @property
  // @attribute
  // @type "small" || "medium" || "large" || "smaller" || "larger" || null
  // @default null
  get size() {
    return this.hasAttribute("size") ? this.getAttribute("size") : null;
  }
  set size(size) {
    (size === null) ? this.removeAttribute("size") : this.setAttribute("size", size);
  }

  // @property readOnly
  // @attribute
  // @type "small" || "medium" || "large"
  // @default "medium"
  // @readOnly
  get computedSize() {
    return this.hasAttribute("computedsize") ? this.getAttribute("computedsize") : "medium";
  }

  _shadowRoot = null;
  _elements = {};
  _lastTabIndex = 0;
  _xelSizeChangeListener = null;

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  constructor() {
    super();

    this._shadowRoot = this.attachShadow({mode: "closed", delegatesFocus: true});
    this._shadowRoot.adoptedStyleSheets = [Xel.themeStyleSheet, XTagsInputElement._shadowStyleSheet];
    this._shadowRoot.append(document.importNode(XTagsInputElement._shadowTemplate.content, true));

    for (let element of this._shadowRoot.querySelectorAll("[id]")) {
      this._elements[element.id] = element;
    }

    this.addEventListener("focusout", (event) => this.matches(":focus-within") ? null : this._onBlur(event));
    this._elements["input"].addEventListener("focusin", (event) => this._onInputFocusIn(event));
    this._elements["input"].addEventListener("focusout", (event) => this._onInputFocusOut(event));
    this._shadowRoot.addEventListener("pointerdown", (event) => this._onShadowRootPointerDown(event));
    this._shadowRoot.addEventListener("remove", (event) => this._onRemoveButtonClick(event));
    this._shadowRoot.addEventListener("keydown", (event) => this._onKeyDown(event));
    this._elements["input"].addEventListener("input", (event) => this._onInputInput(event));
  }

  connectedCallback() {
    this._updatePlaceholderVisibility();
    this._updateAccessabilityAttributes();
    this._updateComputedSizeAttriubte();

    Xel.addEventListener("sizechange", this._xelSizeChangeListener = () => this._updateComputedSizeAttriubte());
  }

  disconnectedCallback() {
    Xel.removeEventListener("sizechange", this._xelSizeChangeListener);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }
    else if (name === "spellcheck") {
      this._onSpellcheckAttributeChange();
    }
    else if (name === "disabled") {
      this._onDisabledAttributeChange();
    }
    else if (name === "size") {
      this._onSizeAttributeChange();
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

      this.error = null;

      this._updateSuggestions();
      this._updatePlaceholderVisibility();

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

  _getInputTextBoundingClientRect() {
    let range = new Range();
    range.selectNodeContents(this._elements["input"]);

    let rect = range.getBoundingClientRect();

    if (rect.x === 0 && rect.width === 0) {
      rect = this._elements["input"].getBoundingClientRect();
      rect.width = 20;
    }

    return rect;
  }

  _commitInput() {
    let tagText = this._elements["input"].textContent.trim();
    this._elements["input"].textContent = "";

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

        this._updateSuggestions();
        this._updatePlaceholderVisibility();

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _onShadowRootPointerDown(event) {
    if (event.target === this._elements["main"] || event.target === this._elements["tags"]) {
      event.preventDefault();

      this._elements["input"].setAttribute("contenteditable", "");
      this._updateInputSelection();
    }
    else if (event.target === this._elements["input"]) {
      this._elements["input"].setAttribute("contenteditable", "");
      this._updateSuggestions();
    }
    else if (event.target.closest("x-popover")) {
      event.preventDefault();

      let tag = event.target.closest("x-tag");

      if (tag) {
        this._elements["input"].textContent = "";
        this._elements["suggestions-popover"].close();

        this.append(tag);

        this.dispatchEvent(new CustomEvent("add", {detail: tag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.target.closest("x-tag")) {
      this._elements["input"].focus();
      this._commitInput();
    }
  }

  _onRemoveButtonClick(event) {
    event.stopPropagation();

    let tag = event.target;
    tag.remove();

    this._updatePlaceholderVisibility();
    this.dispatchEvent(new CustomEvent("remove", {detail: tag}));
    this.dispatchEvent(new CustomEvent("change"));
  }

  _onSpellcheckAttributeChange() {
    this._elements["input"].spellcheck = this.spellcheck;
  }

  _onDisabledAttributeChange() {
    this._updateAccessabilityAttributes();
  }

  _onSizeAttributeChange() {
    this._updateComputedSizeAttriubte();
  }

  _onBlur() {
    if (this.required) {
      let tags = [...this.children].filter(child => child.localName === "x-tag");

      if (tags.length === 0) {
        this.error = "This field is required";
      }
    }
  }

  async _onInputFocusIn() {
    this._elements["input"].setAttribute("contenteditable", "");
    this.dispatchEvent(new CustomEvent("textinputmodestart", {bubbles: true, composed: true}));

    await sleep(10);

    if (this._elements["input"].matches(":focus")) {
      this._updateInputSelection();
      this._updateSuggestions();
    }
  }

  _onInputFocusOut() {
    this._commitInput();
    this._elements["input"].removeAttribute("contenteditable");
    this.dispatchEvent(new CustomEvent("textinputmodeend", {bubbles: true, composed: true}));

    if (this.hasAttribute("error")) {
      this._elements["input"].textContent = "";
      this.removeAttribute("error");
    }

    this._elements["suggestions-popover"].close();
  }

  _onInputInput(event) {
    let value = this._elements["input"].textContent;

    if (value.includes(this.delimiter)) {
      this._commitInput();
    }

    this._updatePlaceholderVisibility();

    if (this.hasAttribute("error")) {
      this.removeAttribute("error");
    }

    this.dispatchEvent(new CustomEvent("input"));
    this._updateSuggestions(event.inputType);
  }

  _onKeyDown(event) {
    if (event.key === "Enter") {
      if (event.target === this._elements["input"]) {
        event.preventDefault();
        this._commitInput();
      }
    }
    else if (event.key === "Backspace") {
      if (event.target === this._elements["input"]) {
        let value = this._elements["input"].textContent;

        if (value.length === 0) {
          let tags = [...this.children].filter(child => child.localName === "x-tag");
          let lastTag = tags[tags.length-1] || null;

          if (lastTag) {
            lastTag.remove();

            this._updateSuggestions();
            this._updatePlaceholderVisibility();

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
          this._elements["input"].focus();
        }

        focusedTag.remove();
        this._updatePlaceholderVisibility();

        this.dispatchEvent(new CustomEvent("remove", {detail: focusedTag}));
        this.dispatchEvent(new CustomEvent("change"));
      }
    }
    else if (event.key === "ArrowDown") {
      if (this._elements["suggestions-popover"].opened) {
        let suggestedTags = [...this._elements["suggested-tags"].children];

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
            let startOffset = this._shadowRoot.getSelection().getRangeAt(0).startOffset;
            let text = nextTag.querySelector("x-label").textContent;

            this._elements["input"].textContent = text;
            this._updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
    else if (event.key === "ArrowUp") {
      if (this._elements["suggestions-popover"].opened) {
        let suggestedTags = [...this._elements["suggested-tags"].children];

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
            let startOffset = this._shadowRoot.getSelection().getRangeAt(0).startOffset;
            let text = prevTag.querySelector("x-label").textContent;

            this._elements["input"].textContent = text;
            this._updateInputSelection(startOffset, text.length);
          }
        }
      }
    }
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  _update() {
    this._updatePlaceholderVisibility();
  }

  _updatePlaceholderVisibility() {
    let placeholder = this.querySelector(":scope > x-label");

    if (placeholder) {
      placeholder.hidden = (this.value.length > 0 || this._elements["input"].textContent.length > 0);
    }
  }

  _updateAccessabilityAttributes() {
    this.setAttribute("role", "input");
    this.setAttribute("aria-disabled", this.disabled);

    if (this.disabled) {
      this._lastTabIndex = (this.tabIndex > 0 ? this.tabIndex : 0);
      this.tabIndex = -1;
    }
    else {
      if (this.tabIndex < 0) {
        this.tabIndex = (this._lastTabIndex > 0) ? this._lastTabIndex : 0;
      }

      this._lastTabIndex = 0;
    }
  }

  _updateComputedSizeAttriubte() {
    let defaultSize = Xel.size;
    let customSize = this.size;
    let computedSize = "medium";

    if (customSize === null) {
      computedSize = defaultSize;
    }
    else if (customSize === "smaller") {
      computedSize = (defaultSize === "large") ? "medium" : "small";
    }
    else if (customSize === "larger") {
      computedSize = (defaultSize === "small") ? "medium" : "large";
    }
    else {
      computedSize = customSize;
    }

    if (computedSize === "medium") {
      this.removeAttribute("computedsize");
    }
    else {
      this.setAttribute("computedsize", computedSize);
    }
  }

  _updateInputSelection(startOffset = 0, endOffset = this._elements["input"].textContent.length) {
    let range = new Range();

    if (startOffset === 0 && endOffset === this._elements["input"].textContent.length) {
      range.selectNodeContents(this._elements["input"]);
    }
    else {
      range.setStart(this._elements["input"].firstChild, startOffset);
      range.setEnd(this._elements["input"].firstChild, endOffset);
    }

    let selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  _updateSuggestions(inputType = "insertText") {
    if (this.suggestions) {
      let text = this._elements["input"].textContent;
      let range = this._shadowRoot.getSelection().getRangeAt(0);

      if (range.collapsed === false) {
        text = text.substring(0, range.startOffset);
      }

      let suggestedTags = this.getSuggestions(text);

      // Update input
      {
        if (suggestedTags.length > 0 && inputType !== "deleteContentBackward") {
          let inputText = this._elements["input"].textContent;
          let suggestedText = suggestedTags[0].querySelector("x-label").textContent;
          let textNode = this._elements["input"].firstChild;

          if (textNode) {
            textNode.textContent = suggestedText;
            this._updateInputSelection(inputText.length, suggestedText.length);
          }
        }
      }

      // Update popover
      {
        if (suggestedTags.length === 0) {
          this._elements["suggested-tags"].innerHTML = "";

          if (this._elements["suggestions-popover"].opened === true) {
            this._elements["suggestions-popover"].close();
          }
        }
        else {
          let refRect = this._getInputTextBoundingClientRect();

          this._elements["suggested-tags"].innerHTML = "";
          this._elements["suggested-tags"].append(...suggestedTags);

          if (inputType !== "deleteContentBackward" && text.length > 0) {
            suggestedTags[0].toggled = true;
          }

          if (this._elements["suggestions-popover"].opened === false) {
            this._elements["suggestions-popover"].open(refRect);
          }
          else {
            this._elements["suggestions-popover"].close(false);
            this._elements["suggestions-popover"].open(refRect);
          }

          this._elements["suggested-tags"].scrollTop = 0;
        }
      }
    }
  }
}

customElements.define("x-tagsinput", XTagsInputElement);
