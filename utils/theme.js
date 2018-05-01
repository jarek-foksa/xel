
// @copyright
//   © 2016-2017 Jarosław Foksa

// @info
//   Retrieve the path to the currently loaded theme, defaulting to "vanilla.theme.css".
// @type
//   (void) => string
export let getThemePath = () => {
  let themeStyleElement = document.querySelector(`link[href*="/themes/"]`);
  let themePath = "node_modules/xel/themes/vanilla.css";

  if (themeStyleElement) {
    themePath = themeStyleElement.getAttribute("href");
  }

  return themePath;
};

// @info
//   Retrieve the base name of the currently loaded theme, defaulting to "vanilla".
// @type
//   (void) => string
export let getThemeName = () => {
  let path  = getThemePath();
  let startIndex = path.lastIndexOf("/") + 1;
  let endIndex = path.length - 4;
  let theme = (endIndex > startIndex ? path.substring(startIndex, endIndex) : "vanilla");
  return theme;
};
