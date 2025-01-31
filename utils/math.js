
// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

let {max, pow, sqrt, PI} = Math;

// @type (number, number) => number
//
// Round given number to the fixed number of decimal places.
export let round = (number, precision = 0) => {
  let coefficient = pow(10, precision);
  return Math.round(number * coefficient) / coefficient;
};

// @type (DOMRect, number) => DOMRect
export let roundRect = (rect, precision = 0) => {
  return new DOMRect(
    round(rect.x, precision),
    round(rect.y, precision),
    round(rect.width, precision),
    round(rect.height, precision)
  );
};

// @type (number, number, number, number?) => number
export let normalize = (number, min, max = Infinity, precision = null) => {
  if (precision !== null) {
    number = round(number, precision);
  }

  if (number < min) {
    number = min;
  }
  else if (number > max) {
    number = max;
  }

  return number;
};

// @type (number, number) => number
//
// Round a number to a specified number of significant digits.
export let toPrecision = (n, precision) => {
  n = +n;
  precision = +precision;

  let integerLength = (Math.floor(n) + "").length;

  if (precision > integerLength) {
    return +n.toFixed(precision - integerLength);
  }
  else {
    let p10 = 10 ** (integerLength - precision);
    return Math.round(n / p10) * p10;
  }
};

// @type (number) => number
export let getPrecision = (number) => {
  if (!isFinite(number)) {
    return 0;
  }
  else {
    let e = 1;
    let p = 0;

    while (Math.round(number * e) / e !== number) {
      e *= 10;
      p += 1;
    }

    return p;
  }
};

// @type (DOMPoint, DOMPoint) => number
//
// Get distance between two points.
export let getDistanceBetweenPoints = (point1, point2) => {
  let x = point2.x - point1.x;
  x = x * x;

  let y = point2.y - point1.y;
  y = y * y;

  let distance = sqrt(x+y);
  return distance;
};

// @type (DOMRect, DOMPoint) => boolean
export let rectContainsPoint = (rect, point) => {
  if (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  ) {
    return true;
  }
  else {
    return false;
  }
};

// @type (number) => number
export let degToRad = (degrees) => {
  let radians = (PI * degrees) / 180;
  return radians;
};

// @type (DOMPoint, DOMPoint) => boolean
//
// Check if two points have same coordinates.
export let comparePoints = (point1, point2, precision = null) => {
  if (precision !== null) {
    return round(point1.x, precision) === round(point2.x, precision) &&
           round(point1.y, precision) === round(point2.y, precision);
  }
  else {
    return point1.x === point2.x && point1.y === point2.y;
  }
};

// @type (DOMPoint, DOMPoint, number) => DOMPoint
//
// Rotate the given point clockwise around the center point by given angle in degrees.
export let rotatePoint = (point, centerPoint, angle) => {
  let [x, y] = [point.x, point.y];
  let [cx, cy] = [centerPoint.x, centerPoint.y];

  let angleRad = (Math.PI / 180) * angle;
  let cosRad = Math.cos(angleRad);
  let sinRad = Math.sin(angleRad);

  return new DOMPoint(
    (cosRad * (x - cx)) - (sinRad * (y - cy)) + cx,
    (cosRad * (y - cy)) + (sinRad * (x - cx)) + cy
  );
};
