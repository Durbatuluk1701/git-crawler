const Octokit = require("octokit");
const fs = require("fs");

const keyFilePath = "./SECRET_KEY";
const keyValue = fs.readFileSync(keyFilePath);

// SETUP API
const octokit = new Octokit.Octokit({ auth: `${keyValue}` });
