#!/usr/bin/env node

/**
 * @copyright 2016-2025 Jarosław Foksa
 * @license MIT (check LICENSE.md for details)
 */

import Fs from "node:fs/promises";
import Path from "node:path";
import ChildProcess from "node:child_process";
import Process from "node:process";
import Semver from "semver";

import ChangelogParser from "./classes/changelog-parser.js";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");
const [, , ...ARGS] = Process.argv;

let changelog = new ChangelogParser().parse(await Fs.readFile(`${PROJECT_PATH}/CHANGELOG.md`, "utf8"));

// Publish NPM package
if (ARGS.length === 0 || ARGS.includes("npm")) {
  let lastPublishedVersion = await new Promise((resolve) => {
    ChildProcess.exec(`npm show xel version`, (_error, stdout) => {
      let version = stdout.replace("\n", "");
      resolve(Semver.valid(version));
    });
  });

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
  let firebaseManifest = JSON.parse(await Fs.readFile(`${PROJECT_PATH}/firebase.json`, "utf8"));
  firebaseManifest.hosting.public = "builds/hosting";
  await Fs.writeFile(`${PROJECT_PATH}/firebase.json`, JSON.stringify(firebaseManifest, null, 2));

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
  await Fs.writeFile(`${PROJECT_PATH}/firebase.json`, JSON.stringify(firebaseManifest, null, 2));
}
