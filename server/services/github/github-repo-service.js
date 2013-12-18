/*jshint globalstrict:true, trailing:false, unused:true, node:true */
"use strict";

var Q = require('q');
var wrap = require('./github-cache-wrapper');
var createClient = require('./github-client');
var badCredentialsCheck = require('./bad-credentials-check');

function GitHubRepoService(user) {
  this.user = user;
  this.client = createClient.full(user);
}


/**
 * Returns the information about the specified repo
 * @return the promise of information about a repo
 */
 GitHubRepoService.prototype.getRepo = function(repo) {
  var ghrepo = this.client.repo(repo);
  var d = Q.defer();
  ghrepo.info(d.makeNodeResolver());
  return d.promise
    .fail(badCredentialsCheck)
    .fail(function(err) {
      if(err.statusCode == 404) return;
      throw err;
    });
};

function getIssuesWithState(repo, state) {
  var d = Q.defer();

  repo.issues({ state: state }, function(err, body) {
    if(err) return d.reject(err);

    d.resolve(body);
  });

  return d.promise
    .fail(badCredentialsCheck);

}

/**
 * Returns a promise of the issues for a repo
 */
 GitHubRepoService.prototype.getIssues = function(repoName) {
  var repo = this.client.repo(repoName);
  return Q.all([
    getIssuesWithState(repo, 'open'),
    getIssuesWithState(repo, 'closed')
    ]).spread(function(openIssues, closedIssues) {
      return openIssues.concat(closedIssues).sort(function(a, b) {
        return a.number - b.number;
      });
    })
    .fail(badCredentialsCheck);

};


GitHubRepoService.prototype.getStarredRepos = function() {
  var d = Q.defer();

  var ghme = this.client.me();
  ghme.starred(d.makeNodeResolver());

  return d.promise
    .fail(badCredentialsCheck);

};

GitHubRepoService.prototype.getWatchedRepos = function() {
  var d = Q.defer();

  var ghme = this.client.me();
  ghme.watched(d.makeNodeResolver());

  return d.promise
    .fail(badCredentialsCheck);
};

GitHubRepoService.prototype.getRepos = function() {
  var d = Q.defer();

  var ghme = this.client.me();
  ghme.repos(d.makeNodeResolver());

  return d.promise
    .fail(badCredentialsCheck);
};

// module.exports = GitHubRepoService;
module.exports = wrap(GitHubRepoService, function() {
  return [this.user && (this.user.githubToken || this.user.githubUserToken) || ''];
});