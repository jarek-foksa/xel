#!/usr/bin/env node

/**
 * @copyright 2012-2025 Jarosław Foksa
 */

import Path from "node:path";
import Process from "node:process";
import {execCommand} from "../utils/system.node.js";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");
const [, , ...ARGS] = Process.argv;

let command = `./node_modules/.bin/biome lint ${ARGS[0] || ""}`;
await execCommand(command, PROJECT_PATH, true);
