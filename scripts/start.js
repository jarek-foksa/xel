#!/usr/bin/env node

/**
 * @copyright 2012-2025 Jarosław Foksa
 */

import IP from "ip";
import Fs from "node:fs/promises";
import HTTP from "node:http";
import Path from "node:path";
import Process from "node:process";
import {createReadStream} from "node:fs";

import QrCode from "qrcode-generator";
import {stringToBytes} from "../node_modules/qrcode-generator/dist/qrcode_UTF8.mjs";

const [, , ...ARGS] = Process.argv;
const PROJECT_PATH = Path.resolve(import.meta.dirname, "..");
const HOST = ARGS.includes("public") ? IP.address("public", "ipv4") : IP.address("private", "ipv4");
const PORT = 2043;

// @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
const MIME_TYPES = {
  // Images
  "png":   "image/png",
  "jpeg":  "image/jpeg",
  "jpg":   "image/jpeg",
  "webp":  "image/webp",
  "avif":  "image/avif",
  "svg":   "image/svg+xml",
  "svgz":  "image/svg+xml",
  // Fonts
  "woff":  "font/woff",
  "woff2": "font/woff2",
  // Other
  "html":  "text/html",
  "css":   "text/css",
  "js":    "text/javascript",
  "mjs":    "text/javascript",
  "json":  "application/json",
  "ftl":   "text/plain"
};

let server = HTTP.createServer(async (req, res) => {
  let filePath = null;;

  if (req.url === "/") {
    filePath = `${PROJECT_PATH}/index.html`
  }
  else if (req.url.startsWith("/node_modules/@boxy-svg/boxy-svg/")) {
    filePath =  Path.join(PROJECT_PATH, req.url.substring(33));
  }
  else if (req.url.endsWith("/com.chrome.devtools.json") === false) {
    filePath =  Path.join(PROJECT_PATH, req.url);
  }

  if (filePath) {
    if (filePath.includes("/node_modules/xel/")) {
      filePath = filePath.replace("/node_modules/xel/", "/");
    }

    let fileExtension = Path.extname(filePath).substring(1).toLowerCase();
    let fileStat;

    try {
      fileStat = await Fs.stat(filePath);
    }
    catch (_error) {}

    // File exists and it is not a directory
    if (fileStat && !fileStat.isDirectory()) {
      res.writeHead(200, {"Content-Type":  MIME_TYPES[fileExtension] || "application/octet-stream"});
      let stream = createReadStream(filePath);
      stream.pipe(res);
    }
    else {
      if (fileExtension === "") {
        res.writeHead(200, {"Content-Type":  MIME_TYPES["html"]});
        let stream = createReadStream(`${PROJECT_PATH}/index.html`);
        stream.pipe(res);
      }
      else {
        console.error("404 (NOT FOUND):", filePath);
        res.writeHead(404, {"Content-Type": MIME_TYPES.html});
        res.end("<div>404 (NOT FOUND)</div>");
      }
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);

  // Print QR code with server URL
  if (ARGS.includes("public")) {
    QrCode.stringToBytes = stringToBytes;

    let qr = QrCode(0, "L");
    qr.addData(`http://${HOST}:${PORT}`);
    qr.make();

    console.log("\n" + qr.createASCII(1, 1));
  }
});
