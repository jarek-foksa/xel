#!/usr/bin/env node

let Fs              = require("fs");
let Fse             = require("fs-extra");
let Path            = require("path");
let Rollup          = require("rollup");
let childProcess    = require("child_process");

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let build = () => {
  return new Promise(async (resolve) => {
    let bundle = await Rollup.rollup({
      input: "./xel.js",
      onwarn: (warning, warn) => {
        if (warning.code !== "CIRCULAR_DEPENDENCY") {
          warn(warning);
        }
      }
    });

    let xelMinJS = (await bundle.generate({format: "iife"})).output[0].code;

    xelMinJS = xelMinJS.replace(
      `XIconElement.DEFAULT_ICONSET = null;`,
      "XIconElement.DEFAULT_ICONSET = svg`" + Fs.readFileSync(`${__dirname}/iconsets/default.svg`, "utf8") + "`;"
    );

    Fs.writeFileSync(`${__dirname}/xel.min.js`, xelMinJS, "utf8");
    resolve();
  });
};

let publishFirebase = () => {
  return new Promise((resolve) => {
    let manifest = JSON.parse(Fs.readFileSync(`${__dirname}/firebase.json`, "utf8"));

    // Remove old files
    {
      if (Fs.existsSync(`${__dirname}/dist`)) {
        Fse.removeSync(`${__dirname}/dist`);
      }
    }

    // Rewrite temporarly firebase.json by changing "public" directory from "./" to "./dist"
    // Also get rid of any redirect
    {
      let adjustedManifest = JSON.parse(JSON.stringify(manifest));
      adjustedManifest.hosting.public = "./dist";
      adjustedManifest.hosting.redirects = [];
      Fs.writeFileSync(`${__dirname}/firebase.json`, JSON.stringify(adjustedManifest, null, 2), "utf8");
    }

    // Copy over files to "./dist/"
    {
      let paths = [
        `index.html`,
        `fallback.html`,
        `xel.min.js`,
        `docs`,
        `iconsets`,
        `themes`,
        `node_modules/prismjs/prism.js`,
        `node_modules/prismjs/themes/prism-coy.css`,
        `node_modules/prismjs/themes/prism-tomorrow.css`
      ];

      for (let path of paths) {
        Fse.copySync(`${__dirname}/${path}`, `${__dirname}/dist/${path}`);
        Fse.copySync(`${__dirname}/${path}`, `${__dirname}/dist/node_modules/xel/${path}`);
      }
    }

    // Rewrite "dist/index.html"
    {
      let indexHTML = Fs.readFileSync(`${__dirname}/dist/index.html`, "utf8")
      indexHTML = indexHTML.replace(`<script type="module" src="xel.js"></script>`, `<script src="xel.min.js"></script>`);
      Fs.writeFileSync(`${__dirname}/dist/index.html`, indexHTML, "utf8");
    }

    // Upload files to the Firebase server
    {
      let firebaseProcess = childProcess.spawn("firebase", ["deploy"], {cwd: __dirname, stdio: "inherit"});

      firebaseProcess.on("exit", (error) => {
        if (error) {
          console.log(error.toString());
        }

        // Restore firebase.json
        Fs.writeFileSync(`${__dirname}/firebase.json`, JSON.stringify(manifest, null, 2), "utf8");

        // Clean up
        Fse.removeSync(`${__dirname}/dist`);

        resolve();
      });
    }
  });
};

let publishNpm = () => {
  return new Promise((resolve) => {
    let command = "npm";
    let args = ["publish"];
    let options = {cwd: __dirname, stdio: "inherit"};
    let npmProcess = childProcess.spawn(command, args, options);

    npmProcess.on("exit", (error) => {
      if (error) {
        console.log(error.toString());
      }

      resolve();
    });
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

(async () => {
  let [ , , arg1, ...otherArgs] = process.argv
  await build();

  if (arg1 === "--publish") {
    if (otherArgs.length === 0) {
      await publishFirebase();
      await publishNpm();
    }
    else {
      if (otherArgs.includes("firebase")) {
        await publishFirebase();
      }
      if (otherArgs.includes("npm")) {
        await publishNpm();
      }
    }
  }
})();
