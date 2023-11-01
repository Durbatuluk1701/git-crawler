const Octokit = require("octokit");
const fs = require("fs");

const keyFilePath = "./SECRET_KEY";
const keyValue = fs.readFileSync(keyFilePath);

const DbFilePath = "./DB.json";
const currentDatabase = JSON.parse(fs.readFileSync(DbFilePath));

const SinceFilePath = "./SinceCounter";
let sinceCounter = fs.readFileSync(SinceFilePath).toString();

// SETUP API
const octokit = new Octokit.Octokit({ auth: `${keyValue}` });

const strToAscii = (text) => {
  const ret = [];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) {
      ret.push(text[i]);
    }
  }
  return ret;
};

const procFile = (fileExtension, fileText) => {
  const newStr = strToAscii(fileText);
  // Making sure we have a database setup for all extensions
  if (!currentDatabase[fileExtension]) {
    currentDatabase[fileExtension] = {};
  }
  const fileExtDb = currentDatabase[fileExtension];
  newStr.forEach((char) => {
    const currentVal = fileExtDb[char];
    fileExtDb[char] = currentVal ? currentVal + 1 : 1;
  });
  currentDatabase[fileExtension] = fileExtDb;
};

const getFile = async (entry) => {
  const response = await fetch(
    `https://raw.githubusercontent.com/${entry.owner}/${entry.repo}/${entry.branch}/${entry.filePath}`
  );
  if (response.status !== 200) {
    console.error("ERROR non 200 response for file: ", entry);
    return "";
  }
  const data = await response.text();
  // TODO: Need to check for errors here
  return data;
};

const getRepoFiles = async (repo) => {
  let returnedfiles = [];
  let branchName = "master";
  let response = undefined;
  try {
    response = await octokit.request(
      `GET /repos/{owner}/{repo}/git/trees/master?recursive=1`,
      {
        owner: repo.owner,
        repo: repo.repo,
      }
    );
  } catch (err) {
    try {
      // Try a "main"
      branchName = "main";
      response = await octokit.request(
        `GET /repos/{owner}/{repo}/git/trees/main?recursive=1`,
        {
          owner: repo.owner,
          repo: repo.repo,
        }
      );
    } catch (err) {
      console.error("Neither MAIN nor MASTER branch", repo);
    }
  }
  if (!response || response.status !== 200) {
    console.error("NON 200 Response", repo);
    return undefined;
  }
  response.data.tree.forEach((treeEntry) => {
    if (treeEntry.type === "blob") {
      returnedfiles.push(treeEntry.path);
    }
  });
  return {
    files: returnedfiles,
    owner: repo.owner,
    repo: repo.repo,
    branch: branchName,
  };
};

const processRepo = async (repoEntry) => {
  /**
   * Steps:
   * 1. Get all the files in the repo
   * 2. For each file retrieve its values
   * 3. For each file, store its values in the data base
   *
   */
  const repoFileStruct = await getRepoFiles(repoEntry);
  if (!repoFileStruct) {
    console.error("COULDNT GET THE REPO STRUCTURE!");
    return;
  }
  for (let i = 0; i < repoFileStruct.files.length; i++) {
    const filePath = repoFileStruct.files[i];

    // Generating the extension is actually troublesome
    // We first need to make sure we are not directory nested
    // Then we can get the first dot
    const splitPath = filePath.split("/");
    const lastSplit = splitPath[splitPath.length - 1];
    const firstDotIndex = lastSplit.indexOf(".");
    const fileExtension =
      firstDotIndex === -1 ? " " : lastSplit.slice(firstDotIndex + 1);
    let fileData = await getFile({
      owner: repoFileStruct.owner,
      repo: repoFileStruct.repo,
      branch: repoFileStruct.branch,
      filePath: filePath,
    });
    procFile(fileExtension, fileData, currentDatabase);
  }
};

const getUserRepos = async (userEntry) => {
  let returnedRepos = [];
  const response = await octokit.request(`GET /users/${userEntry.owner}/repos`);
  response.data.forEach((repoStruct) => {
    if (!repoStruct.private) {
      returnedRepos.push(repoStruct.name);
    }
  });
  // TODO: Error handling
  return {
    owner: userEntry.owner,
    repos: returnedRepos,
  };
};

const processUser = async (userEntry) => {
  /**
   * Steps:
   * 1. Get all user repos
   * 2. Process all repos
   * 3. Profit
   */
  const { owner, repos } = await getUserRepos(userEntry);
  for (let i = 0; i < repos.length; i++) {
    processRepo({ owner: owner, repo: repos[i] });
  }
};

// RETURNS
// [listOfOrganizations, ID of last org in list (so we can not dup)]
const getOrgs = async (since) => {
  const response = await octokit.request(`GET /organizations?since=${since}`);
  // todo: error handling
  return response.data.map((val) => {
    return { owner: val.login, id: val.id };
  });
};

const getUsers = async (since) => {
  const response = await octokit.request(`GET /users?since=${since}`);
  // todo: error handling
  return response.data.map((val) => {
    return { owner: val.login, id: val.id };
  });
};

// Function to handle termination signals
const cleanUpDb = async () => {
  console.log(
    `\nReceived termination signal. Writing database to ${DbFilePath} and SinceCounter to ${SinceFilePath}`
  );

  try {
    fs.writeFileSync(DbFilePath, JSON.stringify(currentDatabase, null, 2));
    fs.writeFileSync(SinceFilePath, sinceCounter.toString());

    process.exit(0);
  } catch (err) {
    console.error("Error occurred during cleanup:", err);
    process.exit(1);
  }
};

// Listen signals
process.on("SIGTERM", cleanUpDb);
process.on("SIGINT", cleanUpDb);

const runCrawler = async () => {
  while (true) {
    const nextUserBatch = await getUsers(sinceCounter);
    for (let i = 0; i < nextUserBatch.length; i++) {
      const currentUser = nextUserBatch[i];
      await processUser(currentUser);
      console.log(
        `Processed User: ${currentUser.owner} with ID: ${currentUser.id}\n`
      );
      sinceCounter = nextUserBatch[i].id;
    }
  }
};

runCrawler();
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
