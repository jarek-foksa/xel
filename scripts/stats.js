#!/usr/bin/env node

/**
 * @copyright 2012-2025 Jarosław Foksa
 */

import Path from "node:path";
import Fs from "node:fs/promises";
import {glob as Glob} from "glob";

import {round} from "../utils/math.js";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");

let table = {};
let locTotal = 0;
let bytesTotal = 0;
let pathsTotal = [];

for (let ext of ["js", "html", "css", "ftl", "svg", "json", "md"]) {
  let paths = Glob.sync(`${PROJECT_PATH}/**/*.${ext}`, {ignore: ["builds/**", "libs/**", "node_modules/**"]});
  let loc = 0;
  let bytes = 0;

  for (let path of paths) {
    loc += (await Fs.readFile(path, "utf8")).split("\n").length;
    bytes += (await Fs.stat(path)).size;
  }

  locTotal += loc;
  bytesTotal += bytes;
  pathsTotal.push(...paths);

  let kilobytes = round(bytes / 1024, 2);

  table["*." + ext] = {"Files": paths.length, "Lines": loc, "Kilobytes": kilobytes};
}

table["Total"] = {"Files": pathsTotal.length, "Lines": locTotal, "Kilobytes": round(bytesTotal / 1024, 2)};

console.table(table);
