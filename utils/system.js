
/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

let os;
let engine;

/**
 * @type {() => "chromium" | "webkit" | "gecko" | "other"}
 */
export let getBrowserEngine = () => {
  if (engine === undefined) {
    if (navigator.userAgent.indexOf("Firefox/") > -1) {
      engine = "gecko";
    }
    else if (navigator.userAgent.indexOf("Chrome") > -1) {
      engine = "chromium";
    }
    else if (navigator.userAgent.indexOf("Safari/") > -1) {
      engine = "webkit";
    }
    else {
      engine = "other";
    }
  }

  return engine;
};

/**
 * @type {() => "macos" | "windows" | "linux" | "chromeos" | "android" | "ios" | null}
 */
export let getOperatingSystemName = () => {
  if (os === undefined) {
    if (navigator.platform.startsWith("Mac") === true) {
      os = "macos";
    }
    else if (["iPhone", "iPad", "iPod"].indexOf(navigator.platform) !== -1) {
      os = "ios";
    }
    else if (["Win32", "Win64", "Windows", "WinCE"].indexOf(navigator.platform) !== -1) {
      os = "windows";
    }
    else if (/CrOS/.test(navigator.userAgent)) {
      os = "chromeos";
    }
    else if (/Android/.test(navigator.userAgent)) {
      os = "android";
    }
    else if (/Linux/.test(navigator.platform)) {
      os = "linux";
    }
    else {
      os = null;
    }
  }

  return os;
};
