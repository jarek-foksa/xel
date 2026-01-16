#!/usr/bin/env node

/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Path from "node:path";

import * as JSMinifier from "terser";
import * as JSBundler from "rollup";
import HTMLMinifier from "html-minifier-terser";
import PostCSS from "postcss";
import PostCSSNesting from "postcss-nesting";
import PostCSSMinify from "@csstools/postcss-minify";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");

/**
 * @type {(entryScriptPath: string, format?: string) => Promise<string>}
 */
export let bundleScripts = (entryScriptPath) => {
  return new Promise(async (resolve) => {
    let bundle = await JSBundler.rollup({
      input: entryScriptPath,
      plugins: [{
        resolveId(importee, importer) {
          if (importee.startsWith(PROJECT_PATH)) {
            return importee;
          }
          else if (importee.startsWith("/")) {
            return `${PROJECT_PATH}${importee}`;
          }
          else {
            return Path.resolve(Path.dirname(importer), importee);
          }
        }
      }],
      onwarn: (warning, warn) => {
        if (["CIRCULAR_DEPENDENCY", "THIS_IS_UNDEFINED", "EVAL"].includes(warning.code) === false) {
          warn(warning);
        }
      }
    });

    let bundleJS = (await bundle.generate({format: "es"})).output[0].code;
    resolve(bundleJS);
  });
};

/**
 * Takes ES6 code snippet and minifies it using Terser.js
 *
 * @see https://www.npmjs.com/package/terser#api-reference
 * @type {(code: string, verbose?: boolean) => Promise<string>}
 */
export let minifyScript = (code, verbose = false) => {
  return new Promise(async (resolve) => {
    // Minify multiline html`` template strings
    {
      let currentIndex = -1;

      while (true) {
        let startIndex = code.indexOf("html`\n", currentIndex);

        if (startIndex > -1) {
          startIndex += "html`".length;
          let endIndex = code.indexOf("`", startIndex);

          if (endIndex > -1) {
            let template = code.substring(startIndex, endIndex);

            let minifiedTemplate = await HTMLMinifier.minify(template, {
              caseSensitive: true,
              collapseWhitespace: true,
              minifyCSS: false,
              minifyJS: true,
              quoteCharacter: '"',
              removeComments: true
            });

            code = code.substring(0, startIndex) + minifiedTemplate + code.substring(endIndex);
            currentIndex = startIndex + minifiedTemplate.length;
          }
          else {
            break;
          }
        }
        else {
          break;
        }
      }
    }

    // Minify multiline css`` template strings
    {
      let currentIndex = -1;

      while (true) {
        let startIndex = code.indexOf("css`\n", currentIndex);

        if (startIndex > -1) {
          startIndex += "css`".length;
          let endIndex = code.indexOf("`", startIndex);

          if (endIndex > -1) {
            let template = code.substring(startIndex, endIndex);
            let minifiedTemplate = await PostCSS([PostCSSNesting(), PostCSSMinify()]).process(template, {from: undefined}).css;

            code = code.substring(0, startIndex) + minifiedTemplate + code.substring(endIndex);
            currentIndex = startIndex + minifiedTemplate.length;
          }
          else {
            break;
          }
        }
        else {
          break;
        }
      }
    }

    // Minify JS code
    {
      let result = await JSMinifier.minify(code, {
        ecma: 2022,
        module: true,
        compress: {
          keep_infinity: true
        },
        mangle: {
          properties: {
            keep_quoted: true,
            regex: /^_/, // https://github.com/mishoo/UglifyJS2/issues/103
            reserved: ["_shadowRoot", "_shadowTemplate", "_shadowStyleSheet"]
          }
        },
        format: {
          comments: false,
          indent_level: 0
        }
      });

      if (verbose && result.warnings) {
        for (let warning of result.warnings) {
          console.log("WARNING: " + warning);
        }
      }

      if (result.error) {
        throw result.error;
      }

      code = result.code;
    }

    resolve(code);
  });
};
