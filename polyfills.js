
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

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
    if (
      navigator.userAgent.indexOf("Chrome") === -1 &&
      navigator.userAgent.indexOf("Safari/") > -1 &&
      navigator.maxTouchPoints === 0
    ) {
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
