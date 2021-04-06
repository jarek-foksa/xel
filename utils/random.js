
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

import {round} from "/utils/math.js";

// @info
//   Generate random number.
// @type
//   (number, number, number) => number
export let getRandomNumber = (min = 0, max = 100, precision = 0) => {
  let number = min + (Math.random() * (max-min));
  return round(number, precision);
};
