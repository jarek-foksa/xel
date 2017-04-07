
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {generateUniqueID, html} = Xel.utils.element;

  let shadowTemplate = html`
    <template>
      <link rel="stylesheet" href="node_modules/xel/stylesheets/x-label.css" data-vulcanize>
      <slot></slot>
    </template>
  `;

  class XLabelElement extends HTMLElement {
    static get observedAttributes() {
      return ["for"];
    }

    constructor() {
      super();

      this._shadowRoot = this.attachShadow({mode: "closed"});
      this._shadowRoot.append(document.importNode(shadowTemplate.content, true));

      this.addEventListener("click", (event) => this._onClick(event));
    }

    attributeChangedCallback(name) {
      if (name === "for") {
        this._onForAttributeChange();
      }
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    // @info
    //   Values associated with this label.
    // @type
    //   string
    // @default
    //   ""
    // @attribute
    get value() {
      return this.hasAttribute("value") ? this.getAttribute("value") : null;
    }
    set value(value) {
      value === null ? this.removeAttribute("value") : this.setAttribute("value", value);
    }

    // @info
    //   Source of the icon to show.
    // @type
    //   string
    // @attribute
    get for() {
      return this.getAttribute("for");
    }
    set for(value) {
      this.setAttribute("for", value);
    }

    ///////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _onClick(event) {
      if (this.for) {
        let target = this.getRootNode().querySelector("#" + this.for);

        if (target) {
          target.click();
        }
      }
    }

    _onForAttributeChange() {
      let rootNode = this.getRootNode();
      let target = rootNode.querySelector("#" + this.for);

      if  (target) {
        if (!this.id) {
          this.id = generateUniqueID(rootNode, "label-");
        }

        target.setAttribute("aria-labelledby", this.id);
      }
    }
  }

  customElements.define("x-label", XLabelElement);
}
