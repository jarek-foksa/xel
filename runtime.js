
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

window.Xel = {utils: {}};

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
{
  let setPointerCapture = Element.prototype.setPointerCapture;

  Element.prototype.setPointerCapture = function(pointerId) {
    setPointerCapture.call(this, pointerId);

    let cursor = getComputedStyle(this).cursor;

    let styleElement = document.createElement("style");
    styleElement.textContent = `body, * { cursor: ${cursor} !important; user-select: none !important; }`;
    document.head.append(styleElement);

    let pointerUpListener, lostPointerCaptureListener;

    let finish = () => {
      this.removeEventListener("pointerup", finish);
      this.removeEventListener("lostpointercapture", finish);
      styleElement.remove();
    };

    this.addEventListener("pointerup", finish);
    this.addEventListener("lostpointercapture", finish);
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// Web Animations API polyfills
//

{
  let Animation = document.createElement("div").animate({}).constructor;
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

if (!Node.prototype.replace) {
  Node.prototype.replace = function(element) {
    this.parentNode.replaceChild(element, this);
  };
}

if (!Node.prototype.closest) {
  Node.prototype.closest = function(selector) {
    return this.parentNode ? this.parentNode.closest(selector) : null;
  };
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// DOMPoint polyfill (http://dev.w3.org/fxtf/geometry/#DOMPoint)
//

{
  try {
    new SVGPoint();
  }
  catch (error) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    let SVGPoint = new Proxy(window.SVGPoint, {
      construct(target, args) {
        let point = svg.createSVGPoint();
        let [x, y] = args;

        if (x) { point.x = x; }
        if (y) { point.y = y; }

        return point;
      }
    });

    window.SVGPoint = SVGPoint;
  }

  if (!SVGPoint.fromPoint) {
    SVGPoint.fromPoint = function(otherPoint) {
      return otherPoint ? new SVGPoint(otherPoint.x, otherPoint.y) : new SVGPoint();
    };
  }

  if (!SVGPoint.prototype.toString) {
    SVGPoint.prototype.toString = function() {
      return "point(" + this.x + ", " + this.y + ")";
    };
  }

  if (!window.DOMPoint) {
    window.DOMPoint = SVGPoint;
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// DOMRect polyfill (http://dev.w3.org/fxtf/geometry/#DOMRect)
//

{
  // Make SVGRect behave like DOMRect

  try {
    new SVGRect();
  }
  catch (error) {
    let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

    let SVGRect = new Proxy(window.SVGRect, {
      construct(target, args) {
        let rect = svg.createSVGRect();
        let [x, y, width, height] = args;

        if (x) { rect.x = x; }
        if (y) { rect.y = y; }
        if (width) { rect.width = width; }
        if (height) { rect.height = height; }

        return rect;
      }
    });

    window.SVGRect = SVGRect;
  }

  if (!SVGRect.fromRect) {
    SVGRect.fromRect = function(otherRect) {
      return otherRect ? new SVGRect(otherRect.x, otherRect.y, otherRect.width, otherRect.height) : new SVGRect();
    };
  }

  if (SVGRect.prototype.hasOwnProperty("top") === false) {
    Object.defineProperty(SVGRect.prototype, "top", {
      enumerable: true,
      get() {
        return Math.min(this.y, this.y + this.height);
      }
    });
  }

  if (SVGRect.prototype.hasOwnProperty("right") === false) {
    Object.defineProperty(SVGRect.prototype, "right", {
      enumerable: true,
      get() {
        return Math.max(this.x, this.x + this.width);
      }
    })
  }

  if (SVGRect.prototype.hasOwnProperty("bottom") === false) {
    Object.defineProperty(SVGRect.prototype, "bottom", {
      enumerable: true,
      get() {
        return Math.max(this.y, this.y + this.height);
      }
    });
  }

  if (SVGRect.prototype.hasOwnProperty("left") === false) {
    Object.defineProperty(SVGRect.prototype, "left", {
      enumerable: true,
      get() {
        return Math.min(this.x, this.x + this.width);
      }
    });
  }

  // Make ClientRect behave like DOMRect

  if (ClientRect.prototype.hasOwnProperty("x") === false) {
    Object.defineProperty(ClientRect.prototype, "x", {
      get() {
        return this.left;
      },
      set(value) {
        this.left = value;
      }
    });
  }
  if (ClientRect.prototype.hasOwnProperty("y") === false) {
    Object.defineProperty(ClientRect.prototype, "y", {
      get() {
        return this.top;
      },
      set(value) {
        this.top = value;
      }
    });
  }

  // Expose DOMRect

  if (!window.DOMRect) {
    window.DOMRect = SVGRect;
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//
// DOMMatrix polyfill (http://dev.w3.org/fxtf/geometry/#DOMMatrix)
//

{
  let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  let SVGMatrix = new Proxy(window.SVGMatrix, {
    construct(target, args) {
      let matrix = svg.createSVGMatrix();

      if (args[0] !== undefined) {
        if (Array.isArray(args[0]) && args[0].length === 6) {
          let [a, b, c, d, e, f] = args[0];
          matrix.a = a;
          matrix.b = b;
          matrix.c = c;
          matrix.d = d;
          matrix.e = e;
          matrix.f = f;
        }
        else {
          throw new TypeError("Invalid argument passed to SVGMatrix constructor.");
        }
      }

      return matrix;
    }
  });

  window.SVGMatrix = SVGMatrix;

  SVGMatrix.fromMatrix = (matrix) => {
    let {a, b, c, d, e, f} = matrix;
    return new SVGMatrix([a, b, c, d, e, f]);
  };

  SVGMatrix.prototype.transformPoint = function(point) {
    let transformedPoint = new SVGPoint();

    transformedPoint.x = this.a * point.x + this.c * point.y + this.e;
    transformedPoint.y = this.b * point.x + this.d * point.y + this.f;

    return transformedPoint;
  };

  SVGMatrix.prototype.determinant = function() {
    let det = (this.a * this.d) - (this.b * this.c);
    return det;
  };

  SVGMatrix.prototype.isIdentity = function() {
    if (this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 && this.e === 0 && this.f === 0) {
      return true;
    }
    else {
      return false;
    }
  };

  SVGMatrix.prototype.multiplySelf = function(matrix) {
    let a = (this.a * matrix.a) + (this.c * matrix.b);
    let b = (this.b * matrix.a) + (this.d * matrix.b);
    let c = (this.a * matrix.c) + (this.c * matrix.d);
    let d = (this.b * matrix.c) + (this.d * matrix.d);
    let e = (this.a * matrix.e) + (this.c * matrix.f) + this.e;
    let f = (this.b * matrix.e) + (this.d * matrix.f) + this.f;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;

    return this;
  };

  SVGMatrix.prototype.preMultiplySelf = function(matrix) {
    let a = (matrix.a * this.a) + (matrix.c * this.b);
    let b = (matrix.b * this.a) + (matrix.d * this.b);
    let c = (matrix.a * this.c) + (matrix.c * this.d);
    let d = (matrix.b * this.c) + (matrix.d * this.d);
    let e = (matrix.a * this.e) + (matrix.c * this.f) + matrix.e;
    let f = (matrix.b * this.e) + (matrix.d * this.f) + matrix.f;

    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;

    return this;
  };

  SVGMatrix.prototype.translateSelf = function(tx, ty) {
    let translateTransform = {a: 1, b: 0, c: 0, d: 1, e: tx, f: ty};
    this.multiplySelf(translateTransform);
    return this;
  };

  SVGMatrix.prototype._translateOriginSelf = function(x, y) {
    this.e = this.e + (x * this.a) + (y * this.c);
    this.f = this.f + (x * this.b) + (y * this.d);
    return this;
  };

  SVGMatrix.prototype._translateOrigin = function(x, y) {
    let transform = new SVGMatrix();
    transform.a = this.a;
    transform.b = this.b;
    transform.c = this.c;
    transform.d = this.d;
    transform.e = this.e + (x * this.a) + (y * this.c);
    transform.f = this.f + (x * this.b) + (y * this.d);
    return transform;
  };

  SVGMatrix.prototype.scaleSelf = function(scale, originX, originY) {
    if (originX === undefined) { originX = 0; }
    if (originY === undefined) { originY = 0; }

    let scaleTransform = {a: scale, b: 0, c: 0, d: scale, e: 0, f: 0};

    this._translateOriginSelf(originX, originY);
    this.multiplySelf(scaleTransform);
    this._translateOriginSelf(-originX, -originY);

    return this;
  };

  SVGMatrix.prototype.scaleNonUniformSelf = function(scaleX, scaleY, originX, originY) {
    if (scaleY === undefined) { scaleY = 1; }
    if (originX === undefined) { originX = 0; }
    if (originY === undefined) { originY = 0; }

    let scaleTransform = {a: scaleX, b: 0, c: 0, d: scaleY, e: 0, f: 0};

    this._translateOriginSelf(originX, originY);
    this.multiplySelf(scaleTransform);
    this._translateOriginSelf(-originX, -originY);

    return this;
  };

  SVGMatrix.prototype.rotate = function(angle, originX, originY) {
    if (originX === undefined) { originX = 0; }
    if (originY === undefined) { originY = 0; }

    let angleRad = (Math.PI * angle) / 180;
    let cosAngle = Math.cos(angleRad);
    let sinAngle = Math.sin(angleRad);
    let rotTransform = {a: cosAngle, b: sinAngle, c: -sinAngle, d: cosAngle, e: 0, f: 0};

    let rotateTransform = this._translateOrigin(originX, originY);
    rotateTransform.multiplySelf(rotTransform);
    rotateTransform._translateOriginSelf(-originX, -originY);

    return rotateTransform;
  };

  SVGMatrix.prototype.rotateSelf = function(angle, originX, originY) {
    if (originX === undefined) { originX = 0; }
    if (originY === undefined) { originY = 0; }

    let angleRad = (Math.PI * angle) / 180;
    let cosAngle = Math.cos(angleRad);
    let sinAngle = Math.sin(angleRad);
    let rotTransform = {a: cosAngle, b: sinAngle, c: -sinAngle, d: cosAngle, e: 0, f: 0};

    this._translateOriginSelf(originX, originY);
    this.multiplySelf(rotTransform);
    this._translateOriginSelf(-originX, -originY);

    return this;
  };

  SVGMatrix.prototype.skewXSelf = function(angle) {
    let angleRad = (Math.PI * angle) / 180;
    let skewTransform = {a: 1, b: 0, c: Math.tan(angleRad), d: 1, e: 0, f: 0};
    this.multiplySelf(skewTransform);
    return this;
  };

  SVGMatrix.prototype.skewYSelf = function(angle) {
    let angleRad = (Math.PI * angle) / 180;
    let skewTransform = {a: 1, b: Math.tan(angleRad), c: 0, d: 1, e: 0, f: 0};
    this.multiplySelf(skewTransform);
    return this;
  };

  SVGMatrix.prototype.invertSelf = function(sy) {
    let det = this.determinant();

    if (det !== 0) {
      let a =  this.d / det;
      let b = -this.b / det;
      let c = -this.c / det;
      let d =  this.a / det;
      let e = (this.c * this.f - this.d * this.e) / det;
      let f = (this.b * this.e - this.a * this.f) / det;

      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
    }

    return this;
  };

  SVGMatrix.prototype.toString = function() {
    return "matrix(" + this.a + ", " + this.b + ", " + this.c + ", " + this.d + ", " + this.e + ", " + this.f + ")";
  };

  if (SVGMatrix.prototype.hasOwnProperty("is2D") === false) {
    Object.defineProperty(SVGMatrix.prototype, "is2D", {
      enumerable: true,
      get() { return true; }
    });
  }

  if (!window.DOMMatrix) {
    window.DOMMatrix = SVGMatrix;
  }
}
