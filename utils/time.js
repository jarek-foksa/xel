
// @copyright
//   © 2016-2021 Jarosław Foksa
// @license
//   GNU General Public License v3, Xel Commercial License v1 (check LICENSE.md for details)

// @type (number) => Promise
//
// Sleep for given period of time (in miliseconds).
export let sleep = (time) => {
  return new Promise( (resolve, reject) => {
    setTimeout(() => resolve(), time);
  });
};

// @type () => number
//
// Get timestamp in Unix format, e.g. 1348271383119 [http://en.wikipedia.org/wiki/Unix_time]
export let getTimeStamp = () => {
  return Date.now();
};

// @type (Function, number, Object) => Function
// @src [https://github.com/documentcloud/underscore/blob/master/underscore.js#L627]
// @license MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
//
// Returns a function, that, when invoked, will only be triggered at most once during a given window of time.
export let throttle = (func, wait = 500, context) => {
  let args = null;
  let timeout = null;
  let result = null;
  let previous = 0;

  let later = () => {
    previous = new Date();
    timeout = null;
    result = func.apply(context, args);
  };

  let wrapper = (..._args) => {
    let now = new Date();
    let remaining = wait - (now - previous);
    args = _args;

    if (remaining <= 0) {
      clearTimeout(timeout);
      timeout = null;
      previous = now;
      result = func.apply(context, args);
    }

    else if (!timeout) {
      timeout = setTimeout(later, remaining);
    }

    return result;
  };

  return wrapper;
};

// @type (Function, number, Object, boolean) => Function
// @src [https://github.com/documentcloud/underscore/blob/master/underscore.js#L656]
// @license MIT License [https://github.com/documentcloud/underscore/blob/master/LICENSE]
//
// Returns a function, that, as long as it continues to be invoked, will not be triggered. The function will be
// called after it stops being called for N milliseconds. If `immediate` is passed, trigger the function on the
// leading edge, instead of the trailing. Check
// [http://drupalmotion.com/article/debounce-and-throttle-visual-explanation] for a nice explanation of how this is
// different from throttle.
export let debounce = (func, wait, context, immediate = false) => {
  let timeout = null;
  let result = null;

  let wrapper = (...args) => {
    let later = () => {
      timeout = null;

      if (!immediate) {
        result = func.apply(context, args);
      }
    };

    let callNow = (immediate && !timeout);
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) {
      result = func.apply(context, args);
    }

    return result;
  };

  return wrapper;
};
