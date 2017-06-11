
# Xel ([DEMO](https://xel-toolkit.org))

[![npm downloads](http://img.shields.io/npm/dt/xel.svg)](https://www.npmjs.org/package/xel)
[![npm version](https://img.shields.io/npm/v/xel.svg)](https://www.npmjs.org/package/xel)

Xel is a HTML 5 **widget toolkit** for building native-like **Electron** and **Chrome** apps.

Xel follows the Keep It Simple principle and thus is written using plain JS, HTML and CSS. It does not make use of
any preprocessors or heavy abstraction layers.

**Widgets**:

- Buttons
- Tabs
- Sliders
- Selects
- Checkboxes
- Switches
- Radios
- Menus
- Menubars
- Context menus
- Text inputs
- Number inputs
- Cards
- Dialogs
- Drawers
- Popovers
- Progressbars
- Throbbers
- Swatchs
- Steppers

Visit [xel-toolkit.org](https://xel-toolkit.org) for a complete list of all supported widgets with demos and
documentation.

**Themes**

Thanks to advanced theming capabilities, Xel can imitate native widgets.

The themes currently shipped with Xel are:
- Material - implements Material Design guidelines
- Galaxy - dark theme optimized for desktop apps
- macOS - implements macOS Human Interface Guidelines

**Supported browsers**

The project makes heavy use of bleeding edge Web Platform features such as Custom Elements v1, Shadow DOM v1, SVG 2 and ES2017 and therefore works only on the following browsers:

* Chrome >= 58
* Chromium >= 58
* Opera >= 45
* Atom Electron >= 1.7
* NW.js >= 0.23
* Android WebView >= 58

## Setup

**1. Install Xel**

```
$ npm install xel
```

**2. Link Xel**

Add to the `<head>`:

```html
<link rel="import" href="node_modules/xel/xel.min.html">
```

**3. Link Xel theme**

Add to the `<head>` one of the following:

- Material 

```html
<link rel="stylesheet" href="node_modules/xel/stylesheets/material.theme.css">
```

- Galaxy 

```html
<link rel="stylesheet" href="node_modules/xel/stylesheets/galaxy.theme.css">
```

- macOS

```html
<link rel="stylesheet" href="node_modules/xel/stylesheets/macos.theme.css">
```

## Development

**1. Install Xel and its dev dependencies**

```bash
$ git clone https://github.com/jarek-foksa/xel
$ cd xel
$ npm install
```

**2. Launch the dev server**

```bash
$ ./project.js serve
```

**3. Open http://localhost:5000 in your browser**
