#!/usr/bin/env node

// Demo eslint-changes on pull request

const Github = require('github');
const eslint = require('eslint');
const exec = require('child-process-promise').exec;

const cli = new eslint.CLIEngine();

// Runs eslint on the array of file pathes and returns the lint results
const runEslint = files => cli.executeOnFiles(cli.resolveFileGlobPatterns(files));

// Get a promise of an array of the paths of *.js files that changed in the commit/PR
const getChangedFilePaths = () => exec(`git diff --name-only ${process.env.TRAVIS_COMMIT_RANGE} -- '*.js'`)
  .then((result) => {
    const files = result.stdout.split('\n');
    // Remove the extra "" caused by the last newline
    files.pop();
    return files;
  });

// Gets the sha of the commit/pull request
const getCommitTarget = (eventType) => {
  let sha;
  if (eventType === 'push') {
    sha = process.env.TRAVIS_COMMIT;
  } else if (eventType === 'pull_request') {
    const travisCommitRange = process.env.TRAVIS_COMMIT_RANGE;
    const parsed = travisCommitRange.split('...');
    if (parsed.length === 1) {
      sha = travisCommitRange;
    } else {
      sha = parsed[1];
    }
  } else {
    console.error('event type \'%s\' not supported', eventType);
    sha = null;
  }

  return sha;
};

// Add status with lint info to GitHub UI
const setGithubStatus = (eslintReport) => {
  const errors = eslintReport.errorCount;
  const gh = new Github();
  const parsedSlug = process.env.TRAVIS_REPO_SLUG.split('/');
  const sha = getCommitTarget(process.env.TRAVIS_EVENT_TYPE);
  const state = eslintReport.errorCount > 0 ? 'failure' : 'success';
  const warnings = eslintReport.warningCount;

  const description = `errors: ${errors} warnings: ${warnings}`;
  const repo = parsedSlug[1];
  const user = parsedSlug[0];
  const targetUrl = `https://travis-ci.com/${process.env.TRAVIS_REPO_SLUG}/jobs/${process.env.TRAVIS_JOB_ID}`;

  gh.authenticate({
    token: process.env.GITHUB_TOKEN,
    type: 'oauth',
  }, (err) => {
    if (err) console.error('Error authenticating GitHub', err);
  });

  gh.repos.createStatus({
    context: 'ESLint Changes',
    owner: user,
    target_url: targetUrl,
    description,
    repo,
    sha,
    state,
  }, (err) => {
    if (err) console.error('Error creating GitHub status', err);
  });
};

const logEslintResults = (eslintReport) => {
  const formatter = cli.getFormatter();
  console.log(formatter(eslintReport.results));
};

getChangedFilePaths()
  .then((files) => {
    const eslintReport = runEslint(files);
    setGithubStatus(eslintReport);
    logEslintResults(eslintReport);
  })
  .catch(err => console.error('Error: ', err));
