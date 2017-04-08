#!/usr/bin/env node

let Fs              = require("fs");
let Fse             = require("fs-extra");
let Path            = require("path");
let Babel           = require("babel-core");
let Csso            = require("csso");
let Glob            = require("glob")
let PushStateServer = require("pushstate-server");
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
//   Generates xel.min.html file which contains minified version of all JS and CSS files (except themes).
let build = () => {
  let xelHTML = readFile(`${__dirname}/xel.html`);
  let parts = xelHTML.split("<script").filter($0 => $0.includes("</script>"));
  parts = parts.map($0 => "<script" + $0.substring(0, $0.lastIndexOf("</script>") + "</script>".length));
  let paths = parts.map($0 => $0.substring($0.indexOf("src=") + 5, $0.lastIndexOf(`"`)));

  let xelMinJS = "";

  for (let path of paths) {
    xelMinJS += readFile(__dirname + "/" + path);
  }

  xelMinJS = vulcanizeScript(xelMinJS);
  xelMinJS = minifyScript(xelMinJS);

  writeFile(`${__dirname}/xel.min.html`, `<script>${xelMinJS}</script>`);
};

// @info
//   Minifiy JS code by removing comments, whitespace and other redundant content.
let minifyScript = (scriptJS) => {
  let phase1 = Babel.transform(scriptJS, {
    presets: ["es2015"],
    plugins: ["transform-custom-element-classes"]
  });

  let phase2 = Babel.transform(phase1.code, {
    presets: ["babili"],
    minified: true,
    comments: false,
    compact: true
  });

  return `(function() {` + phase2.code + `})()`;
};

// @info
//   Replaces any occourance of <link rel="stylesheet" data-vulcanize> element with corresponding <style> element.
let vulcanizeScript = (scriptJS) => {
  let result = "";
  let parts = [""];

  for (let i = 0; i < scriptJS.length; i += 1) {
    let char = scriptJS[i];

    if (char === "<" && scriptJS.substr(i, 6) === "<link ") {
      parts.push(char);
    }
    else if (char === ">" && parts[parts.length - 1].startsWith("<link")) {
      parts[parts.length - 1] += char;
      parts.push("");
    }
    else {
      parts[parts.length - 1] += char;
    }
  }

  parts = parts.filter($0 => $0 !== "");

  for (let part of parts) {
    if (part.startsWith("<link ") && part.includes("data-vulcanize")) {
      let hrefStartIndex = part.indexOf('href="') + 'href="'.length;
      let hrefEndIndex = part.indexOf('"', hrefStartIndex);
      let href = part.substring(hrefStartIndex, hrefEndIndex);
      let styleCSS = readFile(`${__dirname}/${href}`);
      let minifiedCSS = Csso.minify(styleCSS).css;

      result += "<style>" + minifiedCSS + "</style>";
    }
    else {
      result += part;
    }
  }

  return result;
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let publishNpmPackage = () => {
  let command = "npm";
  let args = ["publish"];
  let options = {cwd: __dirname, stdio: "inherit"};
  let npmProcess = childProcess.spawn(command, args, options);

  npmProcess.on("exit", (error) => {
    if (error) {
      console.log(error.toString());
    }
  });
};

let publishFirebaseSite = () => {
  // Generate updated xel.min.html
  {
    build();
  }

  // Remove old files
  {
    removeDir(`${__dirname}/dist/firebase`);
  }

  // Rewrite temporarly firebase.json by changing "public" directory from "./" to "./dist/firebase"
  {
    let manifeset = JSON.parse(readFile(`${__dirname}/firebase.json`));
    manifeset.hosting.public = "./dist/firebase";
    writeFile(`${__dirname}/firebase.json`, JSON.stringify(manifeset, null, 2));
  }

  // Copy over files to "dist/firebase/"
  {
    let paths = [
      `database.rules.json`,
      `index.html`,
      `fallback.html`,
      `node_modules/prismjs/prism.js`,
      `node_modules/prismjs/themes/prism-coy.css`,
      `node_modules/xel/xel.min.html`,
      `node_modules/xel/images`,
      `node_modules/xel/stylesheets/macos.theme.css`,
      `node_modules/xel/stylesheets/material.theme.css`,
      `node_modules/xel/views`
    ];

    for (let path of paths) {
      Fse.copySync(`${__dirname}/${path}`, `${__dirname}/dist/firebase/${path}`);
    }
  }

  // Rewrite "dist/firebase/"
  {
    let indexHTML = readFile(`${__dirname}/dist/firebase/index.html`);
    indexHTML = indexHTML.replace("xel.html", "xel.min.html");
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
        let manifeset = JSON.parse(readFile(`${__dirname}/firebase.json`));
        manifeset.hosting.public = "./";
        writeFile(`${__dirname}/firebase.json`, JSON.stringify(manifeset, null, 2));
      }

      // Clean up
      {
        removeDir(`${__dirname}/dist/firebase`);

        if (isEmptyDir(`${__dirname}/dist`)) {
          removeDir(`${__dirname}/dist`);
        }
      }
    });
  }
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let serve = () => {
  PushStateServer.start({
    port: 5000,
    directory: "./"
  });
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let info = `Usage:
./project.js build            - Generate xel.min.html file
./project.js serve            - Serve Xel demo site on http://localhost:5000
./project.js publish firebase - Update Xel demo site hosted by Firebase
./project.js publish npm      - Update Xel package hosted by NPM`;

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
    publishNpmPackage();
  }
  else if (arg2 === "firebase") {
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
