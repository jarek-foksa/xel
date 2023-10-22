
// @copyright
//   © 2016-2023 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import {round} from "./math.js";

// @type (number, number, number) => number
//
// Generate random number.
export let getRandomNumber = (min = 0, max = 100, precision = 0) => {
  let number = min + (Math.random() * (max-min));
  return round(number, precision);
};
