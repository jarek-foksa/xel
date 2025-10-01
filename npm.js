#!/usr/bin/env node

// @copyright
//   © 2016-2025 Jarosław Foksa
// @license
//   MIT License (check LICENSE.md for details)

import ChildProcess from "node:child_process";
import Fse from "fs-extra";
import {glob as Glob} from "glob";
import Path from "node:path";
import Semver from "semver";

import HTMLMinifier from "html-minifier-terser";
import PostCSS from "postcss";
import PostCSSImport from "postcss-import";
import PostCSSNesting from "postcss-nesting";
import PostCSSMinify from "@csstools/postcss-minify";
import * as JSMinifier from "terser";
import * as JSBundler from "rollup";
import ChangelogParser from "./classes/changelog-parser.js";

const PROJECT_PATH = import.meta.dirname;
const [, , COMMAND, ...ARGS] = process.argv;
const MINIFY = true;

const HELP = `Commands:
  npm run start                 - Start Firebase emulators
  npm run build [npm,hosting]   - Build packages
  npm run publish [npm,hosting] - Publish packages
  npm run help                  - Show this help message
`;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Utils
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @type (string) => string
let bundleScripts = (entryScriptPath) => {
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
        if (warning.code !== "CIRCULAR_DEPENDENCY" && warning.code !== "EVAL") {
          warn(warning);
        }
      }
    });

    let bundleJS = (await bundle.generate({format: "es"})).output[0].code;
    resolve(bundleJS);
  });
};

// @type (string, boolean) => string
// @doc https://www.npmjs.com/package/terser#api-reference
//
// Takes ES6 code snippet and minifies and mangles it using Terser.js
let minifyScript = (code, verbose = false) => {
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

// @type (string) => string?
let getLastPublishedNpmPackageVersion = () => {
  return new Promise((resolve) => {
    ChildProcess.exec(`npm show xel version`, (error, stdout) => {
      let version = stdout.replace("\n", "");
      resolve(Semver.valid(version));
    });
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// npm run build
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (COMMAND === "build") {
  let changelog = new ChangelogParser().parse(Fse.readFileSync(`${PROJECT_PATH}/CHANGELOG.md`, "utf8"));

  // Build NPM package
  if (ARGS.length === 0 || ARGS.includes("npm")) {
    // Clean up
    {
      Fse.ensureDirSync(`${PROJECT_PATH}/builds`);

      if (Fse.existsSync(`${PROJECT_PATH}/builds/npm`)) {
        Fse.removeSync(`${PROJECT_PATH}/builds/npm`);
      }

      Fse.ensureDirSync(`${PROJECT_PATH}/builds/npm/`);
    }

    // Create the package
    {
      // README.md, LICENSE.md, CHANGELOG.md
      {
        Fse.copySync(`${PROJECT_PATH}/README.md`,    `${PROJECT_PATH}/builds/npm/README.md`);
        Fse.copySync(`${PROJECT_PATH}/LICENSE.md`,   `${PROJECT_PATH}/builds/npm/LICENSE.md`);
        Fse.copySync(`${PROJECT_PATH}/CHANGELOG.md`, `${PROJECT_PATH}/builds/npm/CHANGELOG.md`);
      }

      // xel.js
      {
        let xelJS = await bundleScripts(`${PROJECT_PATH}/xel.js`);

        if (MINIFY === true) {
          xelJS = await minifyScript(xelJS);
        }

        Fse.ensureDirSync(`${PROJECT_PATH}/builds/npm/`);
        Fse.writeFileSync(`${PROJECT_PATH}/builds/npm/xel.js`, xelJS, "utf8");
      }

      // package.json
      {
        let path = `${PROJECT_PATH}/package.json`;
        let manifest = JSON.parse(Fse.readFileSync(path, "utf8"));
        manifest.version = changelog[0].version;

        delete manifest.devDependencies;
        delete manifest.scripts;

        Fse.ensureDirSync(`${PROJECT_PATH}/builds/npm/`);
        Fse.writeFileSync(`${PROJECT_PATH}/builds/npm/package.json`, JSON.stringify(manifest), "utf8");
      }

      // Themes
      {
        let themeNames = [
          "fluent",
          "fluent-dark",
          "material",
          "material-dark",
          "cupertino",
          "cupertino-dark",
          "adwaita",
          "adwaita-dark"
        ];

        for (let themeName of ["base", ...themeNames]) {
          let themeCSS = Fse.readFileSync(`${PROJECT_PATH}/themes/${themeName}.css`, "utf8");
          themeCSS = themeCSS.replace("/node_modules/xel/themes/", "themes/");
          themeCSS = themeCSS.substring(themeCSS.indexOf("*/") + 2);

          Fse.ensureDirSync(`${PROJECT_PATH}/builds/npm/themes/`);
          Fse.writeFileSync(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, themeCSS, "utf8");
        }

        for (let themeName of themeNames) {
          let themeCSS = Fse.readFileSync(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, "utf8");

          let minifiedThemeCSS = (
            await PostCSS([PostCSSImport(), PostCSSNesting(), PostCSSMinify()]).process(themeCSS , {
              from: `${PROJECT_PATH}/builds/npm/themes/`
            })
          ).css;

          Fse.writeFileSync(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, minifiedThemeCSS, "utf8");
        }
      }

      // Icons
      {
        let paths = Glob.sync(`${PROJECT_PATH}/icons/*.svg`);

        for (let path of paths) {
          if (path.endsWith("portal.svg") === false) {
            let relPath = path.substring(PROJECT_PATH.length);
            let iconsSVG = Fse.readFileSync(path, "utf8");

            Fse.ensureDirSync(`${PROJECT_PATH}/builds/npm/icons/`);
            Fse.writeFileSync(`${PROJECT_PATH}/builds/npm/${relPath}`, iconsSVG, "utf8");
          }
        }
      }
    }
  }

  // Build hosting package
  if (ARGS.length === 0 || ARGS.includes("hosting")) {
    // Clean up
    {
      Fse.ensureDirSync(`${PROJECT_PATH}/builds`);

      if (Fse.existsSync(`${PROJECT_PATH}/builds/hosting`)) {
        Fse.removeSync(`${PROJECT_PATH}/builds/hosting`);
      }

      Fse.ensureDirSync(`${PROJECT_PATH}/builds/hosting`);
    }

    // Create the package
    {
      // package.json
      {
        let manifest = JSON.parse(Fse.readFileSync(`${PROJECT_PATH}/package.json`, "utf8"));
        manifest.version = changelog[0].version;
        delete manifest.devDependencies;
        delete manifest.scripts;
        Fse.writeFileSync(`${PROJECT_PATH}/builds/hosting/package.json`, JSON.stringify(manifest), "utf8");
      }


      // CHANGELOG.md
      {
        Fse.copySync(`${PROJECT_PATH}/CHANGELOG.md`, `${PROJECT_PATH}/builds/hosting/CHANGELOG.md`);
      }

      // portal.html, favicon.svg
      {
        Fse.copySync(`${PROJECT_PATH}/portal.html`, `${PROJECT_PATH}/builds/hosting/portal.html`);
        Fse.copySync(`${PROJECT_PATH}/favicon.svg`, `${PROJECT_PATH}/builds/hosting/favicon.svg`);
      }

      // portal.js
      {
        let portalJS = await bundleScripts(`${PROJECT_PATH}/portal.js`);

        if (MINIFY === true) {
          portalJS = await minifyScript(portalJS);
        }

        Fse.writeFileSync(`${PROJECT_PATH}/builds/hosting/portal.js`, portalJS, "utf8");
      }

      // Themes
      {
        for (let srcPath of Glob.sync(`${PROJECT_PATH}/themes/*.css`)) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);
          let themeCSS = Fse.readFileSync(srcPath, "utf8");
          let minifiedCSS = await PostCSS([PostCSSNesting(), PostCSSMinify()]).process(themeCSS , {from: undefined}).css;

          Fse.ensureDirSync(Path.dirname(destPath));
          Fse.writeFileSync(destPath, minifiedCSS, "utf8");
        }
      }

      // Icons
      {
        for (let srcPath of Glob.sync(`${PROJECT_PATH}/icons/*.svg`)) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

          Fse.ensureDirSync(Path.dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Locales
      {
        for (let srcPath of Glob.sync(`${PROJECT_PATH}/locales/*.ftl`)) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

          Fse.ensureDirSync(Path.dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Docs
      {
        for (let srcPath of Glob.sync(`${PROJECT_PATH}/docs/*.html`)) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

          Fse.ensureDirSync(Path.dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Elements
      {
        for (let srcPath of Glob.sync(`${PROJECT_PATH}/elements/*.js`)) {
          let fileName = Path.basename(srcPath);

          if (fileName.startsWith("pt-") === false) {
            let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);
            Fse.ensureDirSync(Path.dirname(destPath));
            Fse.copySync(srcPath, destPath);
          }
        }
      }

      // Dependencies
      {
        let srcPaths = [
          `${PROJECT_PATH}/node_modules/marked/marked.min.js`,
          `${PROJECT_PATH}/node_modules/prismjs/prism.js`
        ];

        for (let srcPath of srcPaths) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

          Fse.ensureDirSync(Path.dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }
    }
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// npm run publish:npm
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (COMMAND === "publish") {
  let changelog = new ChangelogParser().parse(Fse.readFileSync(`${PROJECT_PATH}/CHANGELOG.md`, "utf8"));

  // Publish NPM package
  if (ARGS.length === 0 || ARGS.includes("npm")) {
    let lastPublishedVersion = await getLastPublishedNpmPackageVersion();

    if (Semver.lte(changelog[0].version, lastPublishedVersion)) {
      throw new Error(`Can't publish an NPM package with version equal or lower than ${lastPublishedVersion}.`);
    }
    if (changelog[0].date === "PENDING") {
      throw new Error(`Can't publish with a pending release date. Please update CHANGELOG.md.`);
    }

    await new Promise((resolve) => {
      let npmProcess = ChildProcess.spawn(
        "npm", ["publish"],
        {
          cwd: `${PROJECT_PATH}/builds/npm/`,
          stdio: "inherit"
        }
      );

      npmProcess.on("exit", (error) => {
        if (error) {
          console.log(error.toString());
        }

        resolve();
      });
    });
  }

  // Publish hosting package
  if (ARGS.length === 0 || ARGS.includes("hosting")) {
    if (changelog[0].date === "PENDING") {
      throw new Error(`Can't publish with a pending release date. Please update CHANGELOG.md.`);
    }

    // Temporarily change firebase.json
    let firebaseManifest = JSON.parse(Fse.readFileSync(`${PROJECT_PATH}/firebase.json`, "utf8"));
    firebaseManifest.hosting.public = "builds/hosting";
    Fse.writeFileSync(`${PROJECT_PATH}/firebase.json`, JSON.stringify(firebaseManifest, null, 2), "utf8");

    await new Promise((resolve) => {
      let command = "firebase";
      let args =  ["deploy", "--only", "hosting"];
      let firebaseProcess = ChildProcess.spawn(command, args, {cwd: PROJECT_PATH, stdio: "inherit"});

      firebaseProcess.on("exit", (error) => {
        if (error) {
          console.log("Error", error.toString());
        }
        else {
          console.log("Published Xel Toolkit hosting");
        }

        resolve();
      });
    });

    // Restore firebase.json
    firebaseManifest.hosting.public = ".";
    Fse.writeFileSync(`${PROJECT_PATH}/firebase.json`, JSON.stringify(firebaseManifest, null, 2), "utf8");
  }
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// npm run help
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

if (COMMAND === "help") {
  console.log(HELP);
}
