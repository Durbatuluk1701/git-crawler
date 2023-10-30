const { Octokit } = await import("octokit");
const fs = require("fs");

const keyFilePath = "./SECRET_KEY";
const keyValue = fs.readFileSync(keyFilePath).toString();

// SETUP API
const octokit = new Octokit({ auth: `${keyValue}` });

const procFile = ()

// // GET USERS
// await octokit.request("GET /users");
// // GET USER BY ID
// await octokit.request("GET /user/{id}");

// // GET REPOSITORIES (by creation order)
// await octokit.request("GET /repositories");

// // GET USERS REPOSITORIES
// await octokit.request("GET /users/{username}/repos");

// // GET REPOSITORIES FILE ORG
// await octokit.request(
//   "GET /repos/{owner}/{repo}/git/trees/master?recursive=1",
//   { owner: "ku-sldg", repo: "copland-avm" }
// );
