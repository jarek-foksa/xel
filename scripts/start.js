#!/usr/bin/env node

/**
 * @copyright 2012-2025 Jarosław Foksa
 */

import Path from "node:path";
import {execCommand} from "../utils/system.node.js";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");

await execCommand(
  "firebase emulators:start --project xel-toolkit --only hosting --log-verbosity=QUIET", PROJECT_PATH, true
);
