
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

const IS_WEBKIT =
  // WebKit-based web browsers, e.g. Safari or Gnome Web
  (navigator.userAgent.indexOf("Safari/") > -1 && navigator.userAgent.indexOf("Chrome") === -1) ||
  // WKWebView-based web views, e.g. Capacitor
  /\b(iPad|iPhone)\b/.test(navigator.userAgent);

//
// Pointer events polyfills
//

// Make "click", "dblclick" and "contextmenu" look more like pointer events
// https://github.com/w3c/pointerevents/issues/100#issuecomment-23118584
{
  if (Object.hasOwn(MouseEvent.prototype, "pointerType") === false) {
    Object.defineProperty(MouseEvent.prototype, "pointerType", {
      get() {
        return this.sourceCapabilities.firesTouchEvents ? "touch" : "mouse";
      }
    });
  }
}

if (Element.prototype.setPointerCapture) {
  let setPointerCapture = Element.prototype.setPointerCapture;
  let Xel;

  Element.prototype.setPointerCapture = function(pointerId) {
    setPointerCapture.call(this, pointerId);

    // Element was clicked very fast, we have to exit here as "lostpointercapture" event won't be fired
    if (this.hasPointerCapture(pointerId) === false) {
      return;
    }

    // @bugfix: Make sure that "pointerup" or "pointercancel" event is always fired when element loses the pointer
    // capture (https://boxy-svg.com/bugs/224);
    {
      let pointerUpListener;
      let pointerCancelListener;
      let lostPointerCaptureListener;

      let poinerUpEventFired = false;
      let poinerCancelEventFired = false;

      let removeListeners = () => {
        this.removeEventListener("pointerup", pointerUpListener);
        this.removeEventListener("pointercancel", pointerCancelListener);
        this.removeEventListener("lostpointercapture", lostPointerCaptureListener);
      };

      this.addEventListener("pointerup", pointerUpListener = (event) => {
        if (event.pointerId === pointerId) {
          poinerUpEventFired = true;
          removeListeners();
        }
      });

      this.addEventListener("pointercancel", pointerCancelListener = (event) => {
        if (event.pointerId === pointerId) {
          poinerCancelEventFired = true;
          removeListeners();
        }
      });

      this.addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
        if (event.pointerId === pointerId) {
          removeListeners();

          if (poinerUpEventFired === false && poinerCancelEventFired === false) {
            let pointerCancelEvent = new PointerEvent("pointercancel", {pointerId, isPrimary: event.isPrimary});
            this.dispatchEvent(pointerCancelEvent);
          }
        }
      });
    }

    // @bugfix: WebKit fails to capture the cursor image (https://bugs.webkit.org/show_bug.cgi?id=232339)
    if (IS_WEBKIT && navigator.maxTouchPoints === 0) {
      (async () => {
        Xel = Xel || (await import("./xel.js")).default;

        if (this.hasPointerCapture(pointerId)) {
          if (Xel.themeStyleSheet.cssRules[0].selectorText !== "*, *, *") {
            Xel.themeStyleSheet.insertRule(`*, *, * {}`, 0);
          }

          let cursorRule = Xel.themeStyleSheet.cssRules[0];
          let lostPointerCaptureListener;

          setTimeout(() => {
            if (this.hasPointerCapture(pointerId)) {
              let cursor = getComputedStyle(this).cursor;

              if (cursor !== "default") {
                cursorRule.style.setProperty("cursor", cursor, "important");
              }
            }
          }, 80);

          this.addEventListener("lostpointercapture", lostPointerCaptureListener = (event) => {
            if (event.pointerId === pointerId) {
              this.removeEventListener("lostpointercapture", lostPointerCaptureListener);

              if (Xel.themeStyleSheet.cssRules[0].selectorText === "*, *, *") {
                Xel.themeStyleSheet.deleteRule(0);
              }
            }
          });
        }
      })();
    }
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// "contextmenu" event polyfill for mobile WebKit
//

if (IS_WEBKIT && ["iPhone", "iPad"].includes(navigator.platform)) {
  const LONG_PRESS_DELAY = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 10;
  const POLYFILLED = Symbol();

  let {addEventListener, removeEventListener} = Element.prototype;
  let polyfilledElements = new WeakMap();

  let clearTimer = (data) => {
    if (data.timer) {
      clearTimeout(data.timer);
      data.timer = null;
    }
  }

  let watchElement = (element) => {
    let data = {
      listeners: new Set(),
      timer: null,
      startX: 0,
      startY: 0,
      dispatchTime: 0
    };

    addEventListener.call(element, "touchstart", data.touchStartListener = (touchEvent) => {
      clearTimer(data);

      if (touchEvent.touches.length === 1) {
        let target = touchEvent.target;
        let touch = touchEvent.touches[0];

        data.startX = touch.clientX;
        data.startY = touch.clientY;

        data.timer = setTimeout(() => {
          data.timer = null;
          data.dispatchTime = Date.now();

          let contextMenuEvent = new MouseEvent("contextmenu", {
            clientX: touch.clientX,
            clientY: touch.clientY,
            screenX: touch.screenX,
            screenY: touch.screenY,
            button: 2,
            buttons: 2,
            bubbles: true,
            cancelable: true,
            view: window
          });

          contextMenuEvent[POLYFILLED] = true;
          target.dispatchEvent(contextMenuEvent);
        }, LONG_PRESS_DELAY);
      }
    }, { passive: true });

    addEventListener.call(element, "touchmove", data.touchMoveListener = (touchEvent) => {
      if (data.timer) {
        let touch = touchEvent.touches[0];
        let dx = touch.clientX - data.startX;
        let dy = touch.clientY - data.startY;

        if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimer(data);
        }
      }
    }, { passive: true });

    addEventListener.call(element, "touchend", data.touchEndListener = () => {
      clearTimer(data);
    }, { passive: true });

    addEventListener.call(element, "touchcancel", data.touchCancelListener = () => {
      clearTimer(data);
    }, { passive: true });

    addEventListener.call(element, "contextmenu", data.contextMenuListener = (event) => {
      // Do not dispatch native "contextmenu" event if polyfilled "contextmenu" event was dispatched
      if (!event[POLYFILLED] && (Date.now() - data.dispatchTime < 500)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    addEventListener.call(element, "click", data.clickListener = (event) => {
      // Do not dispatch "click" event if "contextmenu" event was dispatched
      if (Date.now() - data.dispatchTime < 500) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    return data;
  };

  let unwatchElement = (element, data) => {
    clearTimer(data);

    removeEventListener.call(element, "touchstart", data.touchStartListener);
    removeEventListener.call(element, "touchmove", data.touchMoveListener);
    removeEventListener.call(element, "touchend", data.touchEndListener);
    removeEventListener.call(element, "touchcancel", data.touchCancelListener);
    removeEventListener.call(element, "contextmenu", data.contextMenuListener, true);
    removeEventListener.call(element, "click", data.clickListener, true);
  };

  Element.prototype.addEventListener = function(type, listener, options) {
    if (type === "contextmenu") {
      let data = polyfilledElements.get(this);

      if (!data) {
        data = watchElement(this);
        polyfilledElements.set(this, data);
      }

      if (listener) {
        data.listeners.add(listener);
      }
    }

    return addEventListener.call(this, type, listener, options);
  };

  Element.prototype.removeEventListener = function(type, listener, options) {
    if (type === "contextmenu") {
      let data = polyfilledElements.get(this);

      if (data && listener) {
        data.listeners.delete(listener);

        if (data.listeners.size === 0) {
          unwatchElement(this, data);
          polyfilledElements.delete(this);
        }
      }
    }

    return removeEventListener.call(this, type, listener, options);
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
// Element polyfills
//

// @src https://github.com/nuxodin/lazyfill/blob/main/polyfills/Element/prototype/scrollIntoViewIfNeeded.js
if (!Element.prototype.scrollIntoViewIfNeeded ) {
  Element.prototype.scrollIntoViewIfNeeded = function (centerIfNeeded = true) {
    let element = this;

    new IntersectionObserver( function([entry]) {
      let ratio = entry.intersectionRatio;

      if (ratio < 1) {
        let place = ratio <= 0 && centerIfNeeded ? 'center' : 'nearest';
        element.scrollIntoView({block: place, inline: place} );
      }
      this.disconnect();
    }).observe(this);
  };
}

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
