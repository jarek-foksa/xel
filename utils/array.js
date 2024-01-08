
// @copyright
//   © 2016-2024 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

// @type (Array) => Array
//
// Remove duplicate values from the array.
export let removeDuplicates = (array) => {
  return [...new Set(array)];
};

// @type (Array, Array, boolean) => boolean
//
// Check whether two arrays consist from the same items.
export let compareArrays = (array, otherArray, compareIndexes = false) => {
  if (array.length !== otherArray.length) {
    return false;
  }

  if (compareIndexes) {
    for (let index in array) {
      let item = array[index];

      if (item !== otherArray[index]) {
        return false ;
      }
    }
  }
  else {
    for (let i = 0; i < array.length; i += 1) {
      if (!otherArray.includes(array[i])) {
        return false;
      }
    }

    for (let i = 0; i < otherArray.length; i += 1) {
      if (!array.includes(otherArray[i])) {
        return false;
      }
    }
  }

  return true;
};
