
// @copyright
//   © 2016-2022 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

//
// Pointer events polyfills
//

// Make "click", "dblclick" and "contextmenu" look more like pointer events
// (https://github.com/w3c/pointerevents/issues/100#issuecomment-23118584)
{
  if (MouseEvent.prototype.hasOwnProperty("pointerType") === false) {
    Object.defineProperty(MouseEvent.prototype, "pointerType", {
      get() {
        return this.sourceCapabilities.firesTouchEvents ? "touch" : "mouse";
      }
    });
  }
}

// Make setPointerCapture also capture the cursor image
if (Element.prototype.setPointerCapture) {
  let setPointerCapture = Element.prototype.setPointerCapture;

  Element.prototype.setPointerCapture = function(pointerId) {
    setPointerCapture.call(this, pointerId);

    let cursor = getComputedStyle(this).cursor;
    let cssText = `* {cursor: ${cursor} !important; user-select: none !important; -webkit-user-select: none !important;}`;
    let styleElements = [];

    {
      for (let node = this.parentNode || this.host; node && node !== document; node = node.parentNode || node.host) {
        if (node.nodeType === document.DOCUMENT_FRAGMENT_NODE) {
          let styleElement = document.createElementNS(node.host.namespaceURI, "style");
          styleElement.textContent = cssText;
          node.append(styleElement);
          styleElements.push(styleElement);
        }
        else if (node.nodeType === document.DOCUMENT_NODE) {
          let styleElement = document.createElement("style");
          styleElement.textContent = cssText;
          node.head.append(styleElement);
          styleElements.push(styleElement);
        }
      }
    }

    let finish = () => {
      window.removeEventListener("pointerup", finish, true);
      this.removeEventListener("lostpointercapture", finish);

      for (let styleElement of styleElements) {
        styleElement.remove();
      }
    };

    window.addEventListener("pointerup", finish, true);
    this.addEventListener("lostpointercapture", finish);
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// Web Animations API polyfills
//

{
  // Animation.prototype.finished is supported by Chromium >= 84, but we override it anyway due to a bug in the
  // native implementation that causes flickering because the promise is resolved too late:
  // https://bugs.chromium.org/p/chromium/issues/detail?id=771977
  Object.defineProperty(Animation.prototype, "finished", {
    get() {
      return new Promise((resolve) => {
        this.playState === "finished" ? resolve() : this.addEventListener("finish", () => resolve(), {once: true});
      });
    }
  });
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// window.requestIdleCallback polyfill
//

if (!window.requestIdleCallback) {
  window.requestIdleCallback = (callback, options = {}) => {
    let timeout = options.timeout || 1;
    let startTime = performance.now();

    return setTimeout(() => {
      callback({
        get didTimeout() {
          return options.timeout ? false : (performance.now() - startTime) - 1 > timeout;
        },
        timeRemaining() {
          return Math.max(0, 1 + (performance.now() - startTime));
        }
      });
    }, 1);
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// HTMLHeadingElement polyfills
//

// Add support for "disabled" property on <h1>, <h2>, <h3>, <h4>, <h5>, <h6> elements (non-standard).
Object.defineProperty(HTMLHeadingElement.prototype, "disabled", {
  enumerable: false,
  configurable: false,

  get() {
    return this.hasAttribute("disabled");
  },

  set(value) {
    if (value === true) {
      this.setAttribute("disabled", "");
    }
    else {
      this.removeAttribute("disabled");
    }
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// HTMLParagraphElement polyfills
//

// Add support for "disabled" property on <p> elements (non-standard).
Object.defineProperty(HTMLParagraphElement.prototype, "disabled", {
  enumerable: false,
  configurable: false,

  get() {
    return this.hasAttribute("disabled");
  },

  set(value) {
    if (value === true) {
      this.setAttribute("disabled", "");
    }
    else {
      this.removeAttribute("disabled");
    }
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// Node polyfills (http://dom.spec.whatwg.org, https://github.com/whatwg/dom/issues/161)
//

if (!Node.prototype.append) {
  Node.prototype.append = function(child) {
    this.appendChild(child);
  }
}

if (!Node.prototype.prepend) {
  Node.prototype.prepend = function(child) {
    this.insertBefore(child, this.firstElementChild);
  }
}

if (!Node.prototype.before) {
  Node.prototype.before = function(element) {
    this.parentElement.insertBefore(element, this);
  };
}

if (!Node.prototype.after) {
  Node.prototype.after  = function(element) {
    this.parentElement.insertBefore(element, this.nextElementSibling);
  };
}

if (!Node.prototype.closest) {
  Node.prototype.closest = function(selector) {
    return this.parentNode ? this.parentNode.closest(selector) : null;
  };
}

if (!Node.prototype.replaceWith) {
  Node.prototype.replaceWith = function(element) {
    this.parentNode.replaceChild(element, this);
  };
}
