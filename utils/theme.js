
// @copyright
//   © 2016-2017 Jarosław Foksa

// @info
//   Retrieve the url/path to the currently loaded theme, defaulting to
//   'vanilla.theme.css'
// @type
//   (void) => string
export let themePath = () => {
  const themeCss   = document.querySelector('link[href*=".theme.css"]');
  const themePath  = (themeCss
                          ? themeCss.getAttribute('href')
                          : 'node_modules/xel/stylesheets/vanilla.theme.css');
  return themePath;
};

// @info
//   Retrieve the base name of the currently loaded theme, defaulting to
//   'vanilla'
// @type
//   (void) => string
export let themeName = () => {
  const path  = themePath();
  const start = path.lastIndexOf('/') + 1;
  const end   = path.length - 10;
  const theme = (end > start
                  ? path.substring( start, end )
                  : 'vanilla');

  return theme;
};
