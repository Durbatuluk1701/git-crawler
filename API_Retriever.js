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

const ErrorFile = "./Errors.txt";
let errorLogging = "";

let allowRunning = true;
let alreadyEscaped = false;

const barHandle = new cliProgress.MultiBar(
  {
    hideCursor: false,
    format: "Progress [{bar}] | {repoName} | ETA: {eta}s | {value}/{total}",
    autopadding: true,
    fps: 5,
  },
  cliProgress.Presets.shades_classic
);

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
  const WINDOW_SIZE = 3;

  const newStr = strToAscii(fileText);
  // Making sure we have a database setup for all extensions
  if (!currentDatabase[fileExtension]) {
    currentDatabase[fileExtension] = {};
  }
  const fileExtDb = currentDatabase[fileExtension];
  for (let i = 0; i < newStr.length; i++) {
    const char = newStr[i];
    const currentSubDb = fileExtDb[char] ?? {};
    /**
     * This is rather complex,
     * We want to have the WINDOW_SIZE previous chars tracked
     * As well as the current char [0]
     */
    for (let j = -WINDOW_SIZE; j <= 0; j++) {
      if (!currentSubDb[j]) {
        currentSubDb[j] = {};
      }
      const trueInd = i + j;
      // We must make sure that i + j > 0, otherwise nothing previous
      if (trueInd > 0) {
        const subChar = newStr[trueInd];
        const curVal = currentSubDb[j][subChar];
        currentSubDb[j][subChar] = curVal ? curVal + 1 : 1;
      }
    }

    fileExtDb[char] = currentSubDb;
  }
  currentDatabase[fileExtension] = fileExtDb;
};

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const getFile = async (entry) => {
  await sleep(25);
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${entry.owner}/${entry.repo}/${
        entry.branch
      }/${urlEncode.encode(entry.filePath)}`
    );
    if (response.status !== 200) {
      errorLogging += `ERROR non 200 response for file: ${JSON.stringify(
        entry
      )}\n`;
      manageUnknownError();
      return "";
    }
    const data = await response.text();
    // TODO: Need to check for errors here
    return data;
  } catch (e) {
    errorLogging += `${e}\n`;
    manageUnknownError();
    return "";
  }
};

let unknownErrorCounter = 0;
const decrementCounter = () => {
  unknownErrorCounter = unknownErrorCounter - 1;
};

const myExit = (code) => {
  // Bell to tell we are done
  console.log("\x07");
  process.exit(code);
};

const manageUnknownError = () => {
  if (unknownErrorCounter > 10) {
    console.error(
      `Catastrophic Failure!!!\nEncountered too many unknown errors too quickly, attempting to save work. \n\nCheck log "${ErrorFile}" for more details`
    );
    writeOutDb();
    myExit(3);
  }
  unknownErrorCounter = unknownErrorCounter + 1;
  // 10 Errors in 20 seconds => catastrophic failure
  setTimeout(decrementCounter, 20000);
};

const getRepoFiles = async (repo) => {
  let returnedfiles = [];
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
    if (e.status === 404 || e.status === 409) {
      errorLogging += `Empty Repository ${repo.owner}/${repo.repo}/${repo.branch}\n`;
      return undefined;
    }
    errorLogging += `Error Encountered: ${JSON.stringify(e)}\n`;
    return undefined;
  }
  if (!response || response.status !== 200) {
    errorLogging += `NON 200 Response: ${JSON.stringify(repo)}\n`;
    manageUnknownError();
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
    branch: repo.branch,
  };
};

const getFileExtension = (fileName) => {
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

const allowedExtensions = [
  "c",
  "cpp",
  "h",
  "hpp",
  "cc",
  "cxx",
  "hh",
  "inl",
  "ipp",
  "java",
  "py",
  "pyc",
  "pyd",
  "pyo",
  "pyw",
  "pyx",
  "pyi",
  "pyz",
  "js",
  "jsx",
  "mjs",
  "html",
  "htm",
  "xhtml",
  "css",
  "scss",
  "less",
  "sass",
  "rb",
  "ru",
  "rhtml",
  "swift",
  "php",
  "php3",
  "php4",
  "php5",
  "php7",
  "phtml",
  "pl",
  "pm",
  "t",
  "pod",
  "cgi",
  "sh",
  "bash",
  "zsh",
  "fish",
  "go",
  "r",
  "R",
  "Rmd",
  "Rnw",
  "Rhistory",
  "Rprofile",
  "kt",
  "kts",
  "ts",
  "scala",
  "sbt",
  "rs",
  "dart",
  "lua",
  "sql",
  "ddl",
  "dml",
  "asm",
  "s",
  "hs",
  "lhs",
  "groovy",
  "m",
  "fs",
  "fsx",
  "fsi",
  "bat",
  "cmd",
  "yaml",
  "yml",
  "json",
  "xml",
  "xsd",
  "xsl",
  "dts",
  "dockerfile",
  "md",
  "markdown",
  "clj",
  "cljs",
  "cljc",
  "edn",
  "ex",
  "exs",
  "erl",
  "coffee",
  "cr",
  "jl",
  "mm",
  "vhd",
  "vhdl",
  "v",
  "ps1",
  "psm1",
  "psd1",
  "rkt",
  "re",
  "ml",
  "mli",
  "zig",
  "kscript",
  "tf",
  "tfvars",
  "tfstate",
  "hx",
  "pp",
  "e",
  "f",
  "for",
  "f90",
  "f95",
  "f03",
  "f08",
  "cls",
  "graphql",
  "gql",
  "vi",
  "ctl",
  "lvclass",
  "pl",
  "pro",
  "makefile",
  "cbl",
  "cob",
  "toml",
  "scm",
  "hack",
  "cfm",
  "cfc",
  "cfs",
  "nim",
  "nimble",
  "gsp",
  "dm",
  "robot",
  "ebnf",
  "rei",
  "idl",
  "sol",
];

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
    return;
  }

  const numFiles = repoFileStruct.files.length;

  const showBar = numFiles > 100;
  let repoBar = undefined;
  if (showBar) {
    repoBar = barHandle.create(numFiles, 0, {
      repoName: `${repoEntry.owner}/${repoEntry.repo}`,
    });
  }

  for (let i = 0; i < numFiles; i++) {
    if (i % 50 === 0 && showBar) {
      repoBar.update(i);
    }

    const filePath = repoFileStruct.files[i];

    const fileExtension = getFileExtension(filePath);

    if (!allowedExtensions.includes(fileExtension)) {
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
  if (showBar) {
    barHandle.remove(repoBar);
  }
};

const getUserRepos = async (userEntry) => {
  let returnedRepos = [];
  const response = await octokit.request(`GET /users/${userEntry.owner}/repos`);
  response.data.forEach((repoStruct) => {
    if (!repoStruct.private && !repoStruct.fork) {
      returnedRepos.push({
        name: repoStruct.name,
        branch: repoStruct.default_branch,
      });
    }
  });
  // TODO: Error handling
  return {
    owner: userEntry.owner,
    repos: returnedRepos,
  };
};

const processUser = async (userEntry, promiseQueue) => {
  /**
   * Steps:
   * 1. Get all user repos
   * 2. Process all repos
   * 3. Profit
   */
  const { owner, repos } = await getUserRepos(userEntry);
  const userPromises = [];

  for (let i = 0; i < repos.length; i++) {
    const { name, branch } = repos[i];
    const repoPromise = processRepo({
      owner: owner,
      repo: name,
      branch: branch,
    });
    promiseQueue[`${userEntry.owner}/${name}`] = repoPromise;
    userPromises.push(repoPromise);
    repoPromise.finally(() => {
      delete promiseQueue[`${userEntry.owner}/${name}`];
    });
  }
  Promise.allSettled(userPromises).finally(() => {
    errorLogging += `Processed User ${owner} with ID: ${userEntry.id}\n`;
    sinceCounter = sinceCounter > userEntry.id ? sinceCounter : userEntry.id;
  });
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
  const response = await octokit.request(
    `GET /users?since=${since}&per_page=100`
  );
  // todo: error handling
  return response.data.map((val) => {
    return { owner: val.login, id: val.id };
  });
};

const fillableQueue = (promiseQueue) => {
  return Object.keys(promiseQueue).length < 15;
};

const writeOutDb = () => {
  fs.writeFileSync(DbFilePath, JSON.stringify(currentDatabase, null, 2));
  fs.writeFileSync(SinceFilePath, sinceCounter.toString());
  fs.writeFileSync(NumProcessedPath, numProcessed.toString());
  fs.writeFileSync(ErrorFile, errorLogging, { flag: "a" });
  // Clear out the running error log
  errorLogging = "";
};

const runCrawler = async () => {
  const promiseQueue = {};

  let speculativeCounter = sinceCounter;
  let nextUserBatch = [];

  while (allowRunning) {
    await sleep(500);
    if (nextUserBatch.length === 0) {
      writeOutDb();
      nextUserBatch = await getUsers(speculativeCounter);
    }
    if (fillableQueue(promiseQueue) && allowRunning) {
      const nextUser = nextUserBatch.shift();
      speculativeCounter =
        speculativeCounter > nextUser.id ? speculativeCounter : nextUser.id;
      processUser(nextUser, promiseQueue);
    }
  }

  barHandle.log("Awaiting Completion of Currently Running Promises\n");
  await Promise.allSettled(Object.values(promiseQueue));
};

const runningPromise = runCrawler();

// Function to handle termination signals

const cleanUpDb = async () => {
  barHandle.log(
    `\nReceived termination signal.
    \tWriting database to ${DbFilePath}
    \tNumProcessed to ${NumProcessedPath}
    \tSinceCounter to ${SinceFilePath}\n`
  );

  try {
    writeOutDb();
    myExit(0);
  } catch (err) {
    console.error("Error occurred during cleanup:", err);
    myExit(1);
  }
};

const startShutdown = async () => {
  if (alreadyEscaped) {
    barHandle.log("Shutdown Forced... Writeback not guaranteed!");
    myExit(2);
  }
  allowRunning = false;
  barHandle.log(
    "Shutdown Starting... Please be Patient as all remaining requests are handled\n"
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
