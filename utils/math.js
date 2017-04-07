
// @copyright
//   © 2016-2017 Jarosław Foksa

"use strict";

{
  let {max, pow, sqrt, PI} = Math;

  // @info
  //   Round given number to the fixed number of decimal places.
  // @type
  //   (number, number) => number
  let round = (number, precision = 0) => {
    let coefficient = pow(10, precision);
    return Math.round(number * coefficient) / coefficient;
  };

  // @type
  //   (number, number, number, number?) => number
  let normalize = (number, min, max = Infinity, precision = null) => {
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
  let getPrecision = (number) => {
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
  let getDistanceBetweenPoints = (point1, point2) => {
    let x = point2.x - point1.x;
    x = x * x;

    let y = point2.y - point1.y;
    y = y * y;

    let distance = sqrt(x+y);
    return distance;
  };

  Xel.utils.math = {round, normalize, getPrecision, getDistanceBetweenPoints};
}
