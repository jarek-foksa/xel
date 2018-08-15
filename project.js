#!/usr/bin/env node

let Fs              = require("fs");
let Fse             = require("fs-extra");
let Path            = require("path");
let Rollup          = require("rollup");
let childProcess    = require("child_process");

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let readFile = (filePath) => {
  return Fs.readFileSync(filePath, "utf8");
};

let writeFile = (filePath, fileContent) => {
  createDir(Path.dirname(filePath));
  Fs.writeFileSync(filePath, fileContent, "utf8");
};

let fileExists = (filePath) => {
  return Fs.existsSync(filePath);
};

let createDir = (dirPath) => {
  Fse.ensureDirSync(dirPath);
};

let removeDir = (dirPath) => {
  if (fileExists(dirPath)) {
    Fse.removeSync(dirPath);
  }
};

let isEmptyDir = (dirPath) => {
  let paths = Fs.readdirSync(dirPath).filter(path => path !== ".DS_Store");
  return paths.length === 0;
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// @info
//   Generates xel.min.js file which contains minified version of all JS and CSS files (except themes).
let build = () => {
  return new Promise(async (resolve) => {
    let bundle = await Rollup.rollup({input: "./xel.js"});
    let result = await bundle.generate({format: "iife"});

    let xelMinJS = result.code;
    writeFile(`${__dirname}/xel.min.js`, xelMinJS);

    resolve();
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let publishNpmPackage = () => {
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

let publishFirebaseSite = () => {
  return new Promise((resolve) => {
    let manifest = JSON.parse(readFile(`${__dirname}/firebase.json`));

    // Remove old files
    {
      removeDir(`${__dirname}/dist/firebase`);
    }

    // Rewrite temporarly firebase.json by changing "public" directory from "./" to "./dist/firebase"
    // Also get rid of any redirect
    {
      let adjustedManifest = JSON.parse(JSON.stringify(manifest));
      adjustedManifest.hosting.public = "./dist/firebase";
      adjustedManifest.hosting.redirects = [];
      writeFile(`${__dirname}/firebase.json`, JSON.stringify(adjustedManifest, null, 2));
    }

    // Copy over files to "dist/firebase/"
    {
      let paths = [
        `index.html`,
        `fallback.html`,
        `xel.min.js`,
        `docs`,
        `images`,
        `themes/macos.css`,
        `themes/material.css`,
        `themes/vanilla.css`,
        `node_modules/prismjs/prism.js`,
        `node_modules/prismjs/themes/prism-coy.css`,
        `node_modules/prismjs/themes/prism-tomorrow.css`
      ];

      for (let path of paths) {
        Fse.copySync(`${__dirname}/${path}`, `${__dirname}/dist/firebase/${path}`);
        Fse.copySync(`${__dirname}/${path}`, `${__dirname}/dist/firebase/node_modules/xel/${path}`);
      }
    }

    // Rewrite "dist/firebase/index.html"
    {
      let indexHTML = readFile(`${__dirname}/dist/firebase/index.html`);
      indexHTML = indexHTML.replace(`<script type="module" src="xel.js"></script>`, `<script src="xel.min.js"></script>`);
      writeFile(`${__dirname}/dist/firebase/index.html`, indexHTML);
    }

    // Upload files to the Firebase server
    {
      let command = "./node_modules/firebase-tools/bin/firebase";
      let args = ["deploy"];
      let options = {cwd: __dirname, stdio: "inherit"};
      let firebaseProcess = childProcess.spawn(command, args, options);

      firebaseProcess.on("exit", (error) => {
        if (error) {
          console.log(error.toString());
        }

        // Restore firebase.json
        {
          writeFile(`${__dirname}/firebase.json`, JSON.stringify(manifest, null, 2));
        }

        // Clean up
        {
          removeDir(`${__dirname}/dist/firebase`);

          if (isEmptyDir(`${__dirname}/dist`)) {
            removeDir(`${__dirname}/dist`);
          }
        }

        resolve();
      });
    }
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let serve = () => {
  let command = "./node_modules/firebase-tools/bin/firebase";
  let args = ["serve"];
  let options = {cwd: __dirname, stdio: "inherit"};
  let firebaseProcess = childProcess.spawn(command, args, options);

  firebaseProcess.on("exit", (error) => {
    if (error) {
      console.log("Error", error.toString());
    }
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let main = async () => {
  let info = `Usage:
  ./project.js build            - Generate xel.min.js file
  ./project.js serve            - Serve Xel demo site on http://localhost:5000
  ./project.js publish firebase - Update Xel demo site hosted by Firebase
  ./project.js publish npm      - Update Xel package hosted by NPM
  ./project.js publish all      - Update Xel demo site hosted by Firebase and packaged hosted by NPM.`;

  let arg1 = process.argv[2];
  let arg2 = process.argv[3];

  if (arg1 === undefined) {
    console.log(info);
  }
  else if (arg1 === "build") {
    build();
  }
  else if (arg1 === "serve") {
    serve();
  }
  else if (arg1 === "publish") {
    if (arg2 === undefined) {
      console.log("\n" + info);
    }
    else if (arg2 === "npm") {
      await build();
      publishNpmPackage();
    }
    else if (arg2 === "firebase") {
      await build();
      publishFirebaseSite();
    }
    else if (arg2 === "all") {
      await build();
      publishNpmPackage();
      publishFirebaseSite();
    }
    else {
      console.log("Invalid argument: ", arg2);
      console.log("\n" + info);
    }
  }
  else {
    console.log("Invalid argument: ", arg1);
    console.log("\n" + info);
  }
};

main();
