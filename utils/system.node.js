
/**
 * @copyright 2012-2025 Jarosław Foksa
 */

import ChildProcess from "node:child_process";
import Path from "node:path";

const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");

/**
 * @type {(command: string, cwd?: string, iteractive?: boolean) => Promise<void>}
 */
export let execCommand = (command, cwd = PROJECT_PATH, interactive = false) => {
  return new Promise((resolve, reject) => {
    if (interactive === false) {
      ChildProcess.exec(command, {encoding: "utf-8", cwd: cwd}, (error, standardOutput, standardError) => {
        if (error) {
          reject();
          return;
        }
        else if (standardError) {
          reject(standardError);
          return;
        }
        else {
          resolve(standardOutput.trim());
        }
      });
    }
    else if (interactive === true) {
      let childProcess = ChildProcess.spawn(command, [], {shell: true, cwd: cwd, stdio: "inherit"});

      childProcess.on("exit", (error) => {
        if (error) {
          console.log("ERROR", error.toString());
          reject();
        }
        else {
          resolve();
        }
      });
    }
  });
};
