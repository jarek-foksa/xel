#!/usr/bin/env node

import ChildProcess from "child_process";
import Fse from "fs-extra";
import {glob as Glob} from "glob";
import OS from "os";
import Path from "path";
import Semver from "semver";

import HTMLMinifier from "html-minifier-terser";
import CSSMinifier from "clean-css";
import * as JSMinifier from "terser";
import * as JSBundler from "rollup";
import ChangelogParser from "./classes/changelog-parser.js";

import {dirname} from "path";
import {fileURLToPath} from "url";

let projectPath = dirname(fileURLToPath(import.meta.url));

// @bugfix: https://github.com/isaacs/node-glob/issues/480#issuecomment-1152960825
if (OS.platform() === "win32") {
  projectPath = projectPath.split(Path.sep).join("/");
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Portal
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let createPortalPackage = (minify = true, publish = false) => {
  return new Promise(async (resolve) => {
    // Clean up
    {
      Fse.ensureDirSync(`${projectPath}/dist`);

      if (Fse.existsSync(`${projectPath}/dist/portal`)) {
        Fse.removeSync(`${projectPath}/dist/portal`);
      }

      Fse.ensureDirSync(`${projectPath}/dist/portal`);
    }

    // Create the package
    {
      // CHANGELOG.md
      {
        Fse.copySync(`${projectPath}/CHANGELOG.md`, `${projectPath}/dist/portal/CHANGELOG.md`);
      }

      // portal.html, portal-preload.js, favicon.svg
      {
        Fse.copySync(`${projectPath}/portal.html`,       `${projectPath}/dist/portal/portal.html`);
        Fse.copySync(`${projectPath}/portal-preload.js`, `${projectPath}/dist/portal/portal-preload.js`);
        Fse.copySync(`${projectPath}/favicon.svg`,       `${projectPath}/dist/portal/favicon.svg`);
      }

      // portal.js
      {
        let portalJS = await bundleScripts(`${projectPath}/portal.js`);

        if (minify === true) {
          portalJS = await minifyScript(portalJS);
        }

        Fse.writeFileSync(`${projectPath}/dist/portal/portal.js`, portalJS, "utf8");
      }

      // Themes
      {
        for (let srcPath of Glob.sync(`${projectPath}/themes/*.css`)) {
          let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);
          let themeCSS = Fse.readFileSync(srcPath, "utf8");
          let minifiedCSS = new CSSMinifier({level: 1, inline: false}).minify(themeCSS).styles;

          Fse.ensureDirSync(dirname(destPath));
          Fse.writeFileSync(destPath, minifiedCSS, "utf8");
        }
      }

      // Icons
      {
        for (let srcPath of Glob.sync(`${projectPath}/icons/*.svg`)) {
          let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);

          Fse.ensureDirSync(dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Locales
      {
        for (let srcPath of Glob.sync(`${projectPath}/locales/*.ftl`)) {
          let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);

          Fse.ensureDirSync(dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Docs
      {
        for (let srcPath of Glob.sync(`${projectPath}/docs/*.html`)) {
          let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);

          Fse.ensureDirSync(dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }

      // Elements
      {
        for (let srcPath of Glob.sync(`${projectPath}/elements/*.js`)) {
          let fileName = Path.basename(srcPath);

          if (fileName.startsWith("pt-") === false) {
            let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);
            Fse.ensureDirSync(dirname(destPath));
            Fse.copySync(srcPath, destPath);
          }
        }
      }

      // Dependencies
      {
        let srcPaths = [
          `${projectPath}/node_modules/cantarell/cantarell.woff2`,
          `${projectPath}/node_modules/marked/marked.min.js`,
          `${projectPath}/node_modules/prismjs/prism.js`,
          `${projectPath}/node_modules/prismjs/themes/prism-coy.css`,
          `${projectPath}/node_modules/prismjs/themes/prism-dark.css`
        ];

        for (let srcPath of srcPaths) {
          let destPath = `${projectPath}/dist/portal/` + srcPath.substring(projectPath.length);

          Fse.ensureDirSync(dirname(destPath));
          Fse.copySync(srcPath, destPath);
        }
      }
    }

    // Publish the package on Firebase Hosting
    {
      if (publish === true) {
        let changelog = new ChangelogParser().parse(Fse.readFileSync(`${projectPath}/CHANGELOG.md`, "utf8"));

        if (changelog[0].date === "PENDING") {
          throw new Error(`Can't publish with a pending release date. Please update CHANGELOG.md.`);
        }

        // Temporarily change firebase.json
        let firebaseManifest = JSON.parse(Fse.readFileSync(`${projectPath}/firebase.json`, "utf8"));
        firebaseManifest.hosting.public = "dist/portal";
        Fse.writeFileSync(`${projectPath}/firebase.json`, JSON.stringify(firebaseManifest, null, 2), "utf8");

        await new Promise((resolve) => {
          let command = "firebase";
          let args =  ["deploy", "--only", "hosting"];
          let firebaseProcess = ChildProcess.spawn(command, args, {cwd: projectPath, stdio: "inherit"});

          firebaseProcess.on("exit", (error) => {
            if (error) {
              console.log("Error", error.toString());
            }
            else {
              console.log("Published Xel Toolkit portal");
            }

            resolve();
          });
        });

        // Restore firebase.json
        firebaseManifest.hosting.public = ".";
        Fse.writeFileSync(`${projectPath}/firebase.json`, JSON.stringify(firebaseManifest, null, 2), "utf8");
      }
    }

    resolve();
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NPM
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let createNpmPackage = (minify = true, publish = false) => {
  return new Promise(async (resolve) => {
    let changelog = new ChangelogParser().parse(Fse.readFileSync(`${projectPath}/CHANGELOG.md`, "utf8"));

    // Clean up
    {
      Fse.ensureDirSync(`${projectPath}/dist`);

      if (Fse.existsSync(`${projectPath}/dist/npm`)) {
        Fse.removeSync(`${projectPath}/dist/npm`);
      }

      Fse.ensureDirSync(`${projectPath}/dist/npm/`);
    }

    // Create the package
    {
      // README.md, LICENSE.md, CHANGELOG.md
      {
        Fse.copySync(`${projectPath}/README.md`,    `${projectPath}/dist/npm/README.md`);
        Fse.copySync(`${projectPath}/LICENSE.md`,   `${projectPath}/dist/npm/LICENSE.md`);
        Fse.copySync(`${projectPath}/CHANGELOG.md`, `${projectPath}/dist/npm/CHANGELOG.md`);
      }

      // xel.js
      {
        let xelJS = await bundleScripts(`${projectPath}/xel.js`);

        if (minify === true) {
          xelJS = await minifyScript(xelJS);
        }

        Fse.ensureDirSync(`${projectPath}/dist/npm/`);
        Fse.writeFileSync(`${projectPath}/dist/npm/xel.js`, xelJS, "utf8");
      }

      // package.json
      {
        let path = `${projectPath}/package.json`;
        let manifest = JSON.parse(Fse.readFileSync(path, "utf8"));
        manifest.version = changelog[0].version;
        delete manifest.devDependencies;

        Fse.ensureDirSync(`${projectPath}/dist/npm/`);
        Fse.writeFileSync(`${projectPath}/dist/npm/package.json`, JSON.stringify(manifest), "utf8");
      }

      // Themes
      {
        let paths = Glob.sync(`${projectPath}/themes/*.css`);

        for (let path of paths) {
          if (path.endsWith("base.css") === false && path.endsWith("-portal.css") === false) {
            let relPath = path.substring(projectPath.length);
            let themeCSS = Fse.readFileSync(path, "utf8");
            themeCSS = themeCSS.replace("/node_modules/xel/themes/base.css", "./base.css");

            let minifiedCSS = new CSSMinifier({level: 1, inline: "local"}).minify({
              [path]: {styles: themeCSS}
            }).styles;

            Fse.ensureDirSync(`${projectPath}/dist/npm/themes/`);
            Fse.writeFileSync(`${projectPath}/dist/npm/${relPath}`, minifiedCSS, "utf8");
          }
        }
      }

      // Icons
      {
        let paths = Glob.sync(`${projectPath}/icons/*.svg`);

        for (let path of paths) {
          if (path.endsWith("portal.svg") === false) {
            let relPath = path.substring(projectPath.length);
            let iconsSVG = Fse.readFileSync(path, "utf8");

            Fse.ensureDirSync(`${projectPath}/dist/npm/icons/`);
            Fse.writeFileSync(`${projectPath}/dist/npm/${relPath}`, iconsSVG, "utf8");
          }
        }
      }
    }

    // Publish the package on NPM
    {
      // Publish the package
      if (publish === true) {
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
              cwd: `${projectPath}/dist/npm/`,
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
    }

    resolve();
  });
};

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
          if (importee.startsWith(projectPath)) {
            return importee;
          }
          else if (importee.startsWith("/")) {
            return `${projectPath}${importee}`;
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
            let minifiedTemplate = new CSSMinifier({level: 1, inline: false}).minify(template).styles;

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
// Init
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

{
  let [ , , ...args] = process.argv
  let minify  = args.includes("--no-minify") ? false : true;
  let publish = args.includes("--publish")   ? true  : false;

  if (args.includes("all")) {
    createPortalPackage(minify, publish);
    createNpmPackage(minify, publish);
  }
  else if (args.includes("portal")) {
    createPortalPackage(minify, publish);
  }
  else if (args.includes("npm")) {
    createNpmPackage(minify, publish);
  }
  else {
    console.log([
      "Usage:",
      "./package.js all    [--publish] [--no-minify]",
      "./package.js portal [--publish] [--no-minify]",
      "./package.js npm    [--publish] [--no-minify]"
    ].join("\n"));
  }
}
