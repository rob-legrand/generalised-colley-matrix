/*jslint browser: true, indent: 3 */

document.addEventListener('DOMContentLoaded', function () {
   'use strict';
   var colley;

   colley = (function () {
      var self, util;

      util = {
         addTeam: function (league, teamName) {
            league = util.createLeague(league);
            if (league.map(function (team) {
                  return team.name;
               }).indexOf(teamName) >= 0) {
               return league;
            }
            league.push({
               name: teamName,
               numMatchesVersus: [],
               actualPointsEarned: 0,
               actualPointsConceded: 0,
               effectivePointsEarned: 0,
               effectivePointsConceded: 0
            });
            league.forEach(function (team) {
               while (team.numMatchesVersus.length < league.length) {
                  team.numMatchesVersus.push(0);
               }
            });
            return league;
         },
         createLeague: function (oldLeague) {
            if (Array.isArray(oldLeague)) {
               return oldLeague.map(function (oldTeam) {
                  return {
                     name: oldTeam.name,
                     numMatchesVersus: oldTeam.numMatchesVersus.slice(),
                     actualPointsEarned: oldTeam.actualPointsEarned,
                     actualPointsConceded: oldTeam.actualPointsConceded,
                     effectivePointsEarned: oldTeam.effectivePointsEarned,
                     effectivePointsConceded: oldTeam.effectivePointsConceded,
                     ratingEarned: oldTeam.ratingEarned,
                     ratingConceded: oldTeam.ratingConceded
                  };
               });
            }
            return [];
         },
         deepFreeze: function deepFreeze(oldThing) {
            if (Array.isArray(oldThing)) {
               return Object.freeze(oldThing.map(function (currentValue) {
                  return deepFreeze(currentValue);
               }));
            }
            if (typeof oldThing === 'object') {
               return Object.freeze(Object.keys(oldThing).reduce(function (newObject, prop) {
                  newObject[prop] = deepFreeze(oldThing[prop]);
                  return newObject;
               }, {}));
            }
            return oldThing;
         }
      };

      self = {
         addMatchResult: function (league, teamName1, points1, teamName2, points2) {
            var teamNames, whichTeam1, whichTeam2;
            points1 = Number(points1);
            points2 = Number(points2);
            if (!isFinite(points1) || !isFinite(points2)) {
               return;
            }
            league = util.addTeam(util.addTeam(league, teamName1), teamName2);
            teamNames = league.map(function (team) {
               return team.name;
            });
            whichTeam1 = teamNames.indexOf(teamName1);
            whichTeam2 = teamNames.indexOf(teamName2);
            league[whichTeam1].numMatchesVersus[whichTeam2] += 1;
            league[whichTeam1].actualPointsEarned += points1;
            league[whichTeam1].actualPointsConceded += points2;
            league[whichTeam2].numMatchesVersus[whichTeam1] += 1;
            league[whichTeam2].actualPointsEarned += points2;
            league[whichTeam2].actualPointsConceded += points1;
            return util.deepFreeze(league);
         },
         createLeague: function (oldLeague) {
            return util.deepFreeze(util.createLeague(oldLeague));
         },
         iterateRatings: function (oldLeague) {
            var averageActualPointsPerMatch, newLeague, numMatches;
            numMatches = oldLeague.reduce(function (numMatchesSoFar, team) {
               return numMatchesSoFar + team.numMatchesVersus.reduce(function (numMatchesSoFar, timesPlayed) {
                  return numMatchesSoFar + timesPlayed;
               }, 0);
            }, 0);
            averageActualPointsPerMatch = oldLeague.reduce(function (numPointsSoFar, team) {
               return numPointsSoFar + team.actualPointsEarned;
            }, 0) / numMatches;
            newLeague = util.createLeague(oldLeague);
            oldLeague.forEach(function (team, whichTeam) {
               var laplaceEquivalentMatches, numMatchesPlayed, opponentsRatingConceded, opponentsRatingEarned, strengthOfScheduleFactor;
               strengthOfScheduleFactor = 1; // default 1; should be nonnegative and maybe no more than 1
               laplaceEquivalentMatches = 2; // default 2; should be positive
               numMatchesPlayed = team.numMatchesVersus.reduce(function (numMatchesSoFar, timesPlayed) {
                  return numMatchesSoFar + timesPlayed;
               }, 0);
               opponentsRatingConceded = team.numMatchesVersus.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
                  return effectivePointsSoFar + timesPlayed * (typeof oldLeague[whichOpponent].ratingConceded === 'number' ? oldLeague[whichOpponent].ratingConceded : averageActualPointsPerMatch);
               }, 0);
               newLeague[whichTeam].effectivePointsEarned = team.actualPointsEarned + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - opponentsRatingConceded);
               newLeague[whichTeam].ratingEarned = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsEarned) / (laplaceEquivalentMatches + numMatchesPlayed);
               opponentsRatingEarned = team.numMatchesVersus.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
                  return effectivePointsSoFar + timesPlayed * (typeof oldLeague[whichOpponent].ratingEarned === 'number' ? oldLeague[whichOpponent].ratingEarned : averageActualPointsPerMatch);
               }, 0);
               newLeague[whichTeam].effectivePointsConceded = team.actualPointsConceded + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - opponentsRatingEarned);
               newLeague[whichTeam].ratingConceded = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsConceded) / (laplaceEquivalentMatches + numMatchesPlayed);
            });
            return newLeague;
         }
      };
      return Object.freeze(self);
   }());

   (function () {
      var colleyLeague, updateColleyLeague;

      updateColleyLeague = function () {
         var standings;
         // FIXME output Colley results in a nicer format (actual table?)
         standings = colleyLeague.map(function (team) {
            return {
               name: team.name,
               rating: team.ratingEarned,
               averagePointsPerMatch: team.actualPointsEarned / team.numMatchesVersus.reduce(function (numMatchesSoFar, timesPlayed) {
                  return numMatchesSoFar + timesPlayed;
               }, 0)
            };
         });
         standings.sort(function (team1, team2) {
            return team2.rating - team1.rating;
         });
         standings.forEach(function (team) {
            document.querySelector('#colley-output').value += team.name + ': ' + team.rating.toFixed(6) + ' ' + team.averagePointsPerMatch.toFixed(6) + '\n';
         });
      };

      document.querySelector('#get-colley-rankings').addEventListener('click', function () {
         var moreTimes;

         colleyLeague = colley.createLeague();

         // FIXME read matches from document.querySelector('#match-results-input').value
         document.querySelector('#match-results-input').value.split('\n').forEach(function (inputLine) {
            inputLine = inputLine.split(',');
            if (inputLine.length >= 2) {
               inputLine[0] = inputLine[0].replace(/\s+/g, ' ').trim().split(' ');
               inputLine[1] = inputLine[1].replace(/\s+/g, ' ').trim().split(' ');
               if (inputLine[0].length >= 2 && inputLine[1].length >= 2) {
                  colleyLeague = colley.addMatchResult(colleyLeague, inputLine[0][0], Number(inputLine[0][1]), inputLine[1][0], Number(inputLine[1][1])); // FIXME better way?
               }
            }
         });

         // FIXME instead, repeat until differences from last one are small enough
         for (moreTimes = 100; moreTimes > 0; moreTimes -= 1) {
            colleyLeague = colley.iterateRatings(colleyLeague);
         }
         updateColleyLeague();
      }, false);

      updateColleyLeague();
   }());
}, false);
