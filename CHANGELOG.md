
# CHANGELOG

## 0.17.2 (2022-07-16)

- [Bugfix] Opening the context menu multiple times in short intervals causes the app to freeze

## 0.17.1 (2022-07-07)

- [Bugfix] Menus containing <x-message> elements are positioned incorrectly

## 0.17.0 (2022-06-14)

- Add `Xel.localesIds` getter
- Add `RELDATETIME` FTL function
- Add `ellipsis` property/attribute to <x-message>
- [Bugfix] Invisible unicode characters added to <x-message> args

## 0.16.4 (2022-05-31)

- [Bugfix] `setCustomValidity()` does not handle empty string argument correctly

## 0.16.3 (2022-05-30)

- Make default validation messages shorter

## 0.16.2 (2022-05-30)

- [Bugfix] Calling `<x-tooltip>.open()` should not throw error when the tooltip is disconnected
- [Bugfix] `<x-texteditor>` tooltip not shown in some edge cases

## 0.16.1 (2022-05-30)

- Make `reportValidity()` return a boolean with validation state

## 0.16.0 (2022-05-30)

- Add `<x-tooltip>` element
- Change `error` property/method on `<x-input>` and `<x-texteditor>` to a read-only boolean. The new
  `setCustomValidity()` method should be used for setting custom error messages from now on
- Rename `validate()` on `<x-input>` and `<x-texteditor>` to `reportValidity()`. The new `beforevalidate` event
  should be used to provide custom validation logic from now on
- Remove `required` and `error` property/method on `<x-numberinput>` and `<x-tagsinput>`

## 0.15.0 (2022-05-23)

- Add `autocapitalize` boolean attribute to `<x-message>`

## 0.14.0 (2022-05-05)

- Add `Xel.queryIcon()` and `Xel.queryMessage()` method
- Make `Xel.iconsetElements` and `Xel.localesBundle` properties private
- Change x-message API from `<x-message name="id">` to `<x-message href="#id">`
- Change x-icon API from `<x-icon name="id" iconset="path">` to `<x-icon href="path#id">`
- [Bugfix] `<x-message>` adds extra whitespace when placed inside preformatted text

## 0.13.2 (2022-05-03)

- [Bugfix] `<x-message>` fails to render compound messages

## 0.13.1 (2022-05-02)

- [Bugfix] `<x-message>` treats numeric arguments as strings

## 0.13.0 (2022-05-01)

- Internationalization and localization support with new `Xel.locales` API and `<x-message>` element
- Rename `<meta name="xel-iconset">` to `<meta name="xel-iconsets">`
- Rename `Xel.iconset` to `Xel.iconsets` and make it return an array

## 0.12.0 (2022-04-09)

- Add Adwaita theme
- Add Adwaita Dark theme
- Remove Vanilla theme

## 0.11.0 (2022-03-13)

- Remove `<x-doctabs>` and `<x-doctab>`

## 0.10.2 (2022-02-20)

- [Bugfix] Click events are not always detected when using macOS 12

## 0.10.1 (2022-01-07)

- Use ES syntax to denote private properties and methods

## 0.10.0 (2022-01-05)

- Switch from GPL/Commercial dual licensing model to MIT license
- Remove the custom issue tracker (use GitHub instead)
- Move all files into a single GitHub repository
- Update documentation

## 0.9.12 (2021-12-19)

- [Bugfix] NPM bundle contains unused files

## 0.9.11 (2021-12-07)

- [Bugfix] Incorrect size of `<x-stepper>` inside condensed `<x-numberinput>`

## 0.9.10 (2021-09-24)

- [Bugfix] Horizontal scrollbars are misaligned in the Fluent theme

## 0.9.9 (2021-09-24)

- [Bugfix] `<x-texteditor>` scrollbars do not inherit default stylings

## 0.9.8 (2021-07-26)

- [Bugfix] Do not close the dialog when user clicks the backdrop area of a popover

## 0.9.7 (2021-05-10)

- Update the commercial license to allow the usage of beta Xel versions for free

## 0.9.6 (2021-05-02)

- [Bugfix] base.css fails to load in some edge cases

## 0.9.5 (2021-04-26)

- [Bugfix] Themes with relative URL fail to load

## 0.9.4 (2021-04-26)

- [Portal] [Bugfix] Issue descriptions containing template strings fail to render

## 0.9.3 (2021-04-08)

- [Portal] [Bugfix] Admin can't close issues

## 0.9.2 (2021-04-08)

- [Portal] [Bugfix] Tags are not rendered correctly in the HTML version of the changelog

## 0.9.1 (2021-04-08)

- [Bugfix] `<x-numberinput>` value is not set properly when changing focus to `<x-stepper>`
- [Portal] Add more `<x-doctabs>` examples
- [Portal] [Bugfix] Syntax highlighting is not working with dark themes
- [Portal] [Bugfix] Redirects are not working when using a local Firebase instance
- [Portal] [Bugfix] Whitespace is missing between changelog tags
- [Portal] [Bugfix] User should not be able to purchase a license while not logged in
- [Portal] [Bugfix] Always fetch the changelog from the public GitHub repository

## 0.9.0 (2021-04-06)

- Project rewrite using the latest Web Platform APIs
- Switch from MIT to GPL/Commercial dual licensing model
