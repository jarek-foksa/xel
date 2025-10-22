
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import {round} from "./math.js";

/**
 * Generate random number.
 *
 * @type {(min?: number, max?: number, precision?: number) => number}
 */
export let getRandomNumber = (min = 0, max = 100, precision = 0) => {
  let number = min + (Math.random() * (max-min));
  return round(number, precision);
};
