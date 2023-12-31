const Octokit = require("octokit");
const urlEncode = require("urlencode");
const fs = require("fs");
const cliProgress = require("cli-progress");

const keyFilePath = "./SECRET_KEY";
const keyValue = fs.readFileSync(keyFilePath);

const DbFilePath = "./DB.json";
const currentDatabase = JSON.parse(fs.readFileSync(DbFilePath));

const NumProcessedPath = "./NumProcessed";
let numProcessed = Number(fs.readFileSync(NumProcessedPath).toString());

const SinceFilePath = "./SinceCounter";
let sinceCounter = Number(fs.readFileSync(SinceFilePath).toString());

let allowRunning = true;
let alreadyEscaped = false;

const updateCounter = (newVal: number) => {
  if (sinceCounter < newVal) {
    sinceCounter = newVal;
  }
};

// SETUP API
const octokit = new Octokit.Octokit({ auth: `${keyValue}` });

const strToAscii = (text: string) => {
  const ret = [];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) {
      ret.push(text[i]);
    }
  }
  return ret;
};

const procFile = (fileExtension: string, fileText: string) => {
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

const sleep = (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getFile = async (entry: {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}) => {
  // await sleep(250);
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${entry.owner}/${entry.repo}/${
        entry.branch
      }/${urlEncode.encode(entry.filePath)}`
    );
    if (response.status !== 200) {
      console.error("ERROR non 200 response for file: ", entry);
      return "";
    }
    const data = await response.text();
    // TODO: Need to check for errors here
    return data;
  } catch (e) {
    console.error(e);
    return "";
  }
};

const getRepoFiles = async (repo: {
  branch: string;
  owner: string;
  repo: string;
}) => {
  let returnedfiles: any[] = [];
  let response = undefined;
  try {
    response = await octokit.request(
      `GET /repos/{owner}/{repo}/git/trees/${repo.branch}?recursive=1`,
      {
        owner: repo.owner,
        repo: repo.repo,
      }
    );
  } catch (e) {
    console.warn("Error Encountered: ", e);
  }
  if (!response || response.status !== 200) {
    console.error("NON 200 Response", repo);
    return undefined;
  }
  response.data.tree.forEach((treeEntry: { type: string; path: string }) => {
    if (treeEntry.type === "blob") {
      returnedfiles.push(treeEntry.path);
    }
  });
  return {
    files: returnedfiles,
    owner: repo.owner,
    repo: repo.repo,
    branch: repo.branch,
  };
};

const getFileExtension = (fileName: string) => {
  // Generating the extension is actually troublesome
  // We first need to make sure we are not directory nested
  // Then we can get the first dot

  // PREVIOUSLY I had tried more complicate, but now I am
  // Just going to use the last dot onwards
  // AND we always want lowercase for minimal duplication in DB
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? " " : fileName.slice(lastDot + 1).toLowerCase();

  // const splitPath = fileName.split("/");
  // const lastSplit = splitPath[splitPath.length - 1];
  // const lastFirstDotIndex = lastSplit.indexOf(".");
  // return lastFirstDotIndex === -1
  //   ? " "
  //   : lastSplit.slice(lastFirstDotIndex + 1);
};

const disAllowedExtensions = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "glif",
  "exe",
  "o",
  "ico",
  "svn-base",
  "log",
  "wav",
  "mov",
  "mp4",
  "m4p",
  "zip",
  "svg",
  "dat",
  "bmp",
  "mp3",
  "ogg",
  "dds",
  "webp",
  "webm",
];

const processRepo = async (repoEntry: {
  owner: string;
  repo: string;
  branch: string;
}) => {
  /**
   * Steps:
   * 1. Get all the files in the repo
   * 2. For each file retrieve its values
   * 3. For each file, store its values in the data base
   *
   */
  const repoBar = new cliProgress.SingleBar(
    {
      clearOnComplete: true,
      hideCursor: false,
      format: "Progress [{bar}] | {repoName} | ETA: {eta}s | {value}/{total}",
      autopadding: true,
    },
    cliProgress.Presets.shades_classic
  );
  const repoFileStruct = await getRepoFiles(repoEntry);
  if (!repoFileStruct) {
    console.error(
      `COULDNT GET THE REPO STRUCTURE for ${repoEntry.owner}/${repoEntry.repo} @ ${repoEntry.branch}`
    );
    return;
  }

  const numFiles = repoFileStruct.files.length;

  repoBar.start(numFiles, 0, { repoName: repoEntry.repo });

  for (let i = 0; i < numFiles; i++) {
    if (i % 10 === 0) {
      repoBar.update(i);
    }

    const filePath = repoFileStruct.files[i];

    const fileExtension = getFileExtension(filePath);

    if (disAllowedExtensions.includes(fileExtension)) {
      // We do not want to include certain file types
      continue;
    }

    let fileData = await getFile({
      owner: repoFileStruct.owner,
      repo: repoFileStruct.repo,
      branch: repoFileStruct.branch,
      filePath: filePath,
    });
    procFile(fileExtension, fileData);
  }
  numProcessed += numFiles;
  repoBar.stop();
};

const getUserRepos = async (userEntry: { owner: string }) => {
  let returnedRepos: { name: string; branch: string }[] = [];
  const response = await octokit.request(`GET /users/${userEntry.owner}/repos`);
  response.data.forEach(
    (repoStruct: {
      private: any;
      fork: any;
      name: string;
      default_branch: string;
    }) => {
      if (!repoStruct.private && !repoStruct.fork) {
        returnedRepos.push({
          name: repoStruct.name,
          branch: repoStruct.default_branch,
        });
      }
    }
  );
  // TODO: Error handling
  return {
    owner: userEntry.owner,
    repos: returnedRepos,
  };
};

const processUser = async (
  userEntry: { owner: string; id: number },
  promiseQueue: { [x: string]: any }
) => {
  /**
   * Steps:
   * 1. Get all user repos
   * 2. Process all repos
   * 3. Profit
   */
  console.log(
    `Starting Processing of User: ${userEntry.owner} with ID: ${userEntry.id}`
  );
  const { owner, repos } = await getUserRepos(userEntry);

  for (let i = 0; i < repos.length; i++) {
    const { name, branch } = repos[i];
    promiseQueue[`${userEntry.owner}/${name}`] = processRepo({
      owner: owner,
      repo: name,
      branch: branch,
    }).finally(() => {
      console.log(
        `Processed User: ${userEntry.owner} with ID: ${userEntry.id}\n`
      );
      updateCounter(userEntry.id);
      delete promiseQueue[`${userEntry.owner}/${name}`];
    });
  }
};

// RETURNS
// [listOfOrganizations, ID of last org in list (so we can not dup)]
const getOrgs = async (since: any) => {
  const response = await octokit.request(`GET /organizations?since=${since}`);
  // todo: error handling
  return response.data.map((val: { login: string; id: any }) => {
    return { owner: val.login, id: val.id };
  });
};

const getUsers = async (since: number) => {
  const response = await octokit.request(`GET /users?since=${since}`);
  // todo: error handling
  return response.data.map((val: { login: string; id: number }) => {
    return { owner: val.login, id: val.id };
  });
};

const fillableQueue = (promiseQueue: any) => {
  return Object.keys(promiseQueue).length > 25;
};

const runCrawler = async () => {
  const promiseQueue: any = {};
  let nextUserBatch = [];
  while (allowRunning) {
    if (nextUserBatch.length === 0) {
      nextUserBatch = await getUsers(sinceCounter);
    }
    if (fillableQueue(promiseQueue) && allowRunning) {
      processUser(nextUserBatch.shift(), promiseQueue);
    }
  }
};

const runningPromise = runCrawler();

const writeOutDb = () => {
  fs.writeFileSync(DbFilePath, JSON.stringify(currentDatabase, null, 2));
  fs.writeFileSync(SinceFilePath, sinceCounter.toString());
  fs.writeFileSync(NumProcessedPath, numProcessed.toString());
};

// Function to handle termination signals
const cleanUpDb = async () => {
  console.log(
    `\nReceived termination signal.
    \tWriting database to ${DbFilePath}
    \tNumProcessed to ${NumProcessedPath}
    \tSinceCounter to ${SinceFilePath}`
  );

  try {
    writeOutDb();
    process.exit(0);
  } catch (err) {
    console.error("Error occurred during cleanup:", err);
    process.exit(1);
  }
};

const startShutdown = async () => {
  if (alreadyEscaped) {
    console.log("Shutdown Forced... Writeback not guaranteed!");
    process.exit(2);
  }
  allowRunning = false;
  console.log(
    "Shutdown Starting... Please be Patient as all remaining requests are handled"
  );

  alreadyEscaped = true;

  await runningPromise;
  await cleanUpDb();
};

// Listen signals
process.on("SIGTERM", startShutdown);
process.on("SIGINT", startShutdown);

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
