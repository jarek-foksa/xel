
// @copyright
//   © 2012-2022 Jarosław Foksa

let os;

// @type () => "macos" || "windows" || "linux" || "chromeos" || "android" || "ios" || null
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
