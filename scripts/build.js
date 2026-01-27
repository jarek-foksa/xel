#!/usr/bin/env node

/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Path from "node:path";
import Process from "node:process";

import Fs from "node:fs/promises";
import {writeFileSync} from "node:fs";
import {glob as Glob} from "glob";
import PostCSS from "postcss";
import PostCSSImport from "postcss-import";
import PostCSSNesting from "postcss-nesting";
import PostCSSMinify from "@csstools/postcss-minify";

import TypeScript from "typescript";
import ChangelogParser from "../classes/changelog-parser.js";

import {bundleScripts, minifyScript} from "../utils/build.node.js";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");
const [, , ...ARGS] = Process.argv;
const MINIFY = true;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// npm run build
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let changelog = new ChangelogParser().parse(await Fs.readFile(`${PROJECT_PATH}/CHANGELOG.md`, "utf8"));

// Build NPM package
if (ARGS.length === 0 || ARGS.includes("npm")) {
  // Clean up
  {
    await Fs.rm(`${PROJECT_PATH}/builds/npm`, {recursive: true, force: true});
    await Fs.mkdir(`${PROJECT_PATH}/builds/npm`, {recursive: true});
  }

  // Create the package
  {
    // README.md, LICENSE.md, CHANGELOG.md
    {
      await Fs.cp(`${PROJECT_PATH}/README.md`,    `${PROJECT_PATH}/builds/npm/README.md`);
      await Fs.cp(`${PROJECT_PATH}/LICENSE.md`,   `${PROJECT_PATH}/builds/npm/LICENSE.md`);
      await Fs.cp(`${PROJECT_PATH}/CHANGELOG.md`, `${PROJECT_PATH}/builds/npm/CHANGELOG.md`);
    }

    // xel.js
    // xel.d.ts
    {
      let xelJS = await bundleScripts(`${PROJECT_PATH}/xel.js`);

      await Fs.writeFile(`${PROJECT_PATH}/builds/npm/xel.js`, xelJS);

      let compilerOptions = {
        allowJs: true,
        declaration: true
      };

      let host = TypeScript.createCompilerHost(compilerOptions);

      host.writeFile = (fileName, contents) => {
        if (fileName.endsWith(".d.ts")) {
          writeFileSync(`${PROJECT_PATH}/builds/npm/xel.d.ts`, contents, "utf8");
        }
      };

      let program = TypeScript.createProgram([`${PROJECT_PATH}/builds/npm/xel.js`], compilerOptions, host);
      program.emit();

      if (MINIFY === true) {
        xelJS = await minifyScript(xelJS);
      }

      await Fs.writeFile(`${PROJECT_PATH}/builds/npm/xel.js`, xelJS);
    }

    // package.json
    {
      let path = `${PROJECT_PATH}/package.json`;
      let manifest = JSON.parse(await Fs.readFile(path, "utf8"));
      manifest.version = changelog[0].version;

      delete manifest.devDependencies;
      delete manifest.scripts;

      await Fs.writeFile(`${PROJECT_PATH}/builds/npm/package.json`, JSON.stringify(manifest));
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

      await Fs.mkdir(`${PROJECT_PATH}/builds/npm/themes`);

      for (let themeName of ["base", ...themeNames]) {
        let themeCSS = await Fs.readFile(`${PROJECT_PATH}/themes/${themeName}.css`, "utf8");
        themeCSS = themeCSS.replace("/node_modules/xel/themes/", "themes/");
        themeCSS = themeCSS.substring(themeCSS.indexOf("*/") + 2);

        await Fs.writeFile(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, themeCSS);
      }

      for (let themeName of themeNames) {
        let themeCSS = await Fs.readFile(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, "utf8");

        let minifiedThemeCSS = (
          await PostCSS([PostCSSImport(), PostCSSNesting(), PostCSSMinify()]).process(themeCSS , {
            from: `${PROJECT_PATH}/builds/npm/themes/`
          })
        ).css;

        await Fs.writeFile(`${PROJECT_PATH}/builds/npm/themes/${themeName}.css`, minifiedThemeCSS);
      }
    }

    // Icons
    {
      let paths = Glob.sync(`${PROJECT_PATH}/icons/*.svg`);

      await Fs.mkdir(`${PROJECT_PATH}/builds/npm/icons`);

      for (let path of paths) {
        if (path.endsWith("portal.svg") === false) {
          let relPath = path.substring(PROJECT_PATH.length);
          let iconsSVG = await Fs.readFile(path, "utf8");

          await Fs.writeFile(`${PROJECT_PATH}/builds/npm/${relPath}`, iconsSVG);
        }
      }
    }
  }
}

// Build hosting package
if (ARGS.length === 0 || ARGS.includes("hosting")) {
  // Clean up
  {
    await Fs.rm(`${PROJECT_PATH}/builds/hosting`, {recursive: true, force: true});
    await Fs.mkdir(`${PROJECT_PATH}/builds/hosting`, {recursive: true});
  }

  // Create the package
  {
    // package.json
    {
      let manifest = JSON.parse(await Fs.readFile(`${PROJECT_PATH}/package.json`, "utf8"));
      manifest.version = changelog[0].version;
      delete manifest.devDependencies;
      delete manifest.scripts;
      await Fs.writeFile(`${PROJECT_PATH}/builds/hosting/package.json`, JSON.stringify(manifest));
    }

    // CHANGELOG.md
    {
      await Fs.cp(`${PROJECT_PATH}/CHANGELOG.md`, `${PROJECT_PATH}/builds/hosting/CHANGELOG.md`);
    }

    // index.html, favicon.svg
    {
      await Fs.cp(`${PROJECT_PATH}/index.html`, `${PROJECT_PATH}/builds/hosting/index.html`);
      await Fs.cp(`${PROJECT_PATH}/favicon.svg`, `${PROJECT_PATH}/builds/hosting/favicon.svg`);
    }

    // index.js
    {
      let indexJS = await bundleScripts(`${PROJECT_PATH}/index.js`);

      if (MINIFY === true) {
        indexJS = await minifyScript(indexJS);
      }

      await Fs.writeFile(`${PROJECT_PATH}/builds/hosting/index.js`, indexJS);
    }

    // Themes
    {

      for (let srcPath of Glob.sync(`${PROJECT_PATH}/themes/*.css`)) {
        let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);
        let themeCSS = await Fs.readFile(srcPath, "utf8");
        let minifiedCSS = await PostCSS([PostCSSNesting(), PostCSSMinify()]).process(themeCSS , {from: undefined}).css;

        await Fs.mkdir(Path.dirname(destPath), {recursive: true});
        await Fs.writeFile(destPath, minifiedCSS);
      }
    }

    // Icons
    {
      for (let srcPath of Glob.sync(`${PROJECT_PATH}/icons/*.svg`)) {
        let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

        await Fs.mkdir(Path.dirname(destPath), {recursive: true});
        await Fs.cp(srcPath, destPath);
      }
    }

    // Locales
    {
      for (let srcPath of Glob.sync(`${PROJECT_PATH}/locales/*.ftl`)) {
        let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

        await Fs.mkdir(Path.dirname(destPath), {recursive: true});
        await Fs.cp(srcPath, destPath);
      }
    }

    // Docs
    {
      for (let srcPath of Glob.sync(`${PROJECT_PATH}/docs/*.html`)) {
        let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

        await Fs.mkdir(Path.dirname(destPath), {recursive: true});
        await Fs.cp(srcPath, destPath);
      }
    }

    // Elements
    {
      for (let srcPath of Glob.sync(`${PROJECT_PATH}/elements/*.js`)) {
        let fileName = Path.basename(srcPath);

        if (fileName.startsWith("pt-") === false) {
          let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);
          await Fs.mkdir(Path.dirname(destPath), {recursive: true});
          await Fs.cp(srcPath, destPath);
        }
      }
    }

    // Dependencies
    {
      let srcPaths = [
        `${PROJECT_PATH}/node_modules/marked/lib/marked.umd.js`,
        `${PROJECT_PATH}/node_modules/prismjs/prism.js`
      ];

      for (let srcPath of srcPaths) {
        let destPath = `${PROJECT_PATH}/builds/hosting/` + srcPath.substring(PROJECT_PATH.length);

        await Fs.mkdir(Path.dirname(destPath), {recursive: true});
        await Fs.cp(srcPath, destPath);
      }
    }
  }
}
