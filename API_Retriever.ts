const Octokit = require("octokit");
const fs = require("fs");

const keyFilePath = "./SECRET_KEY";
const keyValue = fs.readFileSync(keyFilePath);

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

const procFile = (
  fileExtension: string,
  fileText: string,
  currentDatabase: { [x: string]: any }
) => {
  const newStr = strToAscii(fileText);
  // If no file extension, we used " " to represent extensionless
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

const getFile = async (entry: {
  owner: any;
  repo: any;
  branch: any;
  filePath: any;
}) => {
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

const getRepoFiles = async (repo: { owner: any; repo: any }) => {
  let returnedfiles: string[] = [];
  let branchName = "master";
  let response = await octokit.request(
    `GET /repos/{owner}/{repo}/git/trees/master?recursive=1`,
    {
      owner: repo.owner,
      repo: repo.repo,
    }
  );
  if (response.status === 404) {
    // Try a "main"
    branchName = "main";
    response = await octokit.request(
      `GET /repos/{owner}/{repo}/git/trees/main?recursive=1`,
      {
        owner: repo.owner,
        repo: repo.repo,
      }
    );
  }
  if (response.status !== 200) {
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
    branch: branchName,
  };
};

const processRepo = async (
  repoEntry: { owner: string; repo: string },
  currentDatabase: any
) => {
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
    const firstDotIndex = filePath.indexOf(".");
    const fileExtension =
      firstDotIndex === -1 ? " " : filePath.slice(firstDotIndex + 1);
    let fileData = await getFile({
      owner: repoFileStruct.owner,
      repo: repoFileStruct.repo,
      branch: repoFileStruct.branch,
      filePath: filePath,
    });
    procFile(fileExtension, fileData, currentDatabase);
  }
};

const getOrgRepos = async (org: { owner: string }) => {
  let returnedRepos: string[] = [];
  const response = await octokit.request("GET /orgs/{org}/repos", {
    org: org.owner,
  });
  response.data.forEach((repoStruct: { private: any; name: any }) => {
    if (!repoStruct.private) {
      returnedRepos.push(repoStruct.name);
    }
  });
  // TODO: Error handling
  return {
    owner: org.owner,
    repos: returnedRepos,
  };
};

const processOrg = async (orgEntry: { owner: string }, currentDb: any) => {
  /**
   * Steps:
   * 1. Get all org repos
   * 2. Process all repos
   * 3. Profit
   */
  const { owner, repos } = await getOrgRepos(orgEntry);
  for (let i = 0; i < repos.length; i++) {
    processRepo({ owner: owner, repo: repos[i] }, currentDb);
  }
};

// RETURNS
// [listOfOrganizations, ID of last org in list (so we can not dup)]
const getOrgs = async (since: string) => {
  const response = await octokit.request(`GET /organizations?since=${since}`);
  // todo: error handling
  return [
    response.data.map((val: { login: string }) => {
      return { owner: val.login };
    }),
    response.data[response.data.length - 1].id,
  ];
};

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
