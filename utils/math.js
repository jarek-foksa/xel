
// @copyright
//   © 2016-2017 Jarosław Foksa

let {max, pow, sqrt, PI} = Math;

// @info
//   Round given number to the fixed number of decimal places.
// @type
//   (number, number) => number
export let round = (number, precision = 0) => {
  let coefficient = pow(10, precision);
  return Math.round(number * coefficient) / coefficient;
};

// @type
//   (number, number, number, number?) => number
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

// @type
//   (number) => number
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

// @info
//   Get distance between two points.
// @type
//   (DOMPoint, DOMPoint) => number
export let getDistanceBetweenPoints = (point1, point2) => {
  let x = point2.x - point1.x;
  x = x * x;

  let y = point2.y - point1.y;
  y = y * y;

  let distance = sqrt(x+y);
  return distance;
};

// @type
//   (DOMRect, DOMPoint) => boolean
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

// @type
//   (number) => number
export let degToRad = (degrees) => {
  let radians = (PI * degrees) / 180;
  return radians;
};
