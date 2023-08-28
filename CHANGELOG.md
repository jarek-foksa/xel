
# CHANGELOG

## 0.22.6 (2023-08-28)

- [Bugfix] Frozen cursor image when clicking elements with pointer capture

## 0.22.5 (2023-08-28)

- [Bugfix] Incorrect cursor image when clicking elements with pointer capture very fast

## 0.22.4 (2023-08-27)

- [Bugfix] Handle `pointercancel` events

## 0.22.3 (2023-08-27)

- [Bugfix] Pointer is not properly released in some edge cases

## 0.22.2 (2023-08-25)

- [Bugfix] "pointerup" event is not fired in some edge cases due to Chromium bug #1166044

## 0.22.1 (2023-08-12)

- [Bugfix] Enter key from the numeric keypad is not detected correctly

## 0.22.0 (2023-08-12)

- Remove global size setting (`<meta name="xel-size">` tag, `Xel.size` getter/setter and corresponding
  `sizechange` event)
- Remove `Element.computedSize`  getter and corresponding attribute
- Remove support for relative size values (`smaller` and `larger`)

## 0.21.3 (2023-07-19)

- [Bugfix] Ring throbber animation is no rendered properly by WebKit

## 0.21.2 (2023-07-12)

- [Bugfix]: Numeric glyphs inside `<x-numberinput>` have inconsistent width

## 0.21.1 (2023-06-25)

- [Bugfix]: `<x-slider>` should not be focusable when disabled

## 0.21.0 (2023-06-23)

- Add `disabled` property to color pickers

## 0.20.9 (2023-06-14)

- [Bugfix] Outlines shown around focused dialogs

## 0.20.8 (2023-06-09)

- [Bugfix] `<x-tagsinput>` leaves a trailing comma

## 0.20.7 (2023-05-25)

- [Bugfix] Keyboard shortcuts are not working when `<x-numberinput>` is focused
- [Bugfix] Incorrect selection on Safari after incrementing or decrementing `<x-numberinput>` value
- [Bugfix] Tooltips should not be shown when a button is expanded

## 0.20.6 (2023-05-19)

- [Bugfix] Opening a dialog causes layout shift on Safari

## 0.20.5 (2023-05-19)

- [Bugfix] Adwaita and Cupertino themes use ugly fonts when on Safari

## 0.20.4 (2023-04-15)

- [Bugfix] `<x-colorselect>` fails to open

## 0.20.3 (2023-04-08)

- [Bugfix] `<x-popover>` misbehaves when placed inside shadowRoot

## 0.20.2 (2023-04-08)

- [Bugfix] `<x-stepper>` stuck after pressing the left and right mouse buttons simultaneously

## 0.20.1 (2023-04-05)

- [Bugfix] Automatically close standalone modal `<x-popover>` when user clicks the backdrop

## 0.20.0 (2023-04-01)

- WebKit-based browsers support

## 0.19.3 (2023-03-30)

- Resolve `<x-popover>` geometry after all "open" event listeners have been fired

## 0.19.2 (2023-03-23)

- Make `<x-numberinput>` use the step precision if it is bigger than the value precision

## 0.19.1 (2023-03-21)

- [Bugfix] Do not animate newly connected switch elements

## 0.19.0 (2023-01-22)

- Add "os" message argument

## 0.18.2 (2022-12-23)

- [Bugfix] Packaging script is not working on Windows

## 0.18.1 (2022-12-20)

- [Bugfix] `<x-numberinput>` does not look and behave consistently with `<x-input>`

## 0.18.0 (2022-12-04)

- Replace `Xel.localesIds` getter with `Xel.locale` which return the resolved locale tag

## 0.17.6 (2022-11-08)

- Add stylings for `::highlight(mark)`

## 0.17.5 (2022-11-01)

- [Bugfix] Button tooltip not shown when the button is attached directly to the shadow root

## 0.17.4 (2022-09-22)

- Update dependencies

## 0.17.3 (2022-08-18)

- [Bugfix] `<x-tooltip>` is now shown when placed inside `<x-input>`

## 0.17.2 (2022-07-16)

- [Bugfix] Opening the context menu multiple times in short intervals causes the app to freeze

## 0.17.1 (2022-07-07)

- [Bugfix] Menus containing `<x-message>` elements are positioned incorrectly

## 0.17.0 (2022-06-14)

- Add `Xel.localesIds` getter
- Add `RELDATETIME` FTL function
- Add `ellipsis` property/attribute to `<x-message>`
- [Bugfix] Invisible unicode characters added to `<x-message>` args

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
