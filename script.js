/*jslint browser: true, indent: 3 */

document.addEventListener('DOMContentLoaded', function () {
   'use strict';
   var colley;

   colley = (function () {
      var self, util;

      util = {
         addTeam: function (league, teamName) {
            league = util.createUnfrozenLeague(league);
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
         createUnfrozenLeague: function (oldLeague) {
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
            return util.deepFreeze(util.createUnfrozenLeague(oldLeague));
         },
         getAveragePointsPerMatch: function (leagueOrTeam) {
            if (Array.isArray(leagueOrTeam)) {
               return leagueOrTeam.reduce(function (numPointsSoFar, team) {
                  return numPointsSoFar + team.actualPointsEarned;
               }, 0) / self.getNumMatches(leagueOrTeam);
            }
            return leagueOrTeam.actualPointsEarned / self.getNumMatches(leagueOrTeam);
         },
         getNumMatches: function (leagueOrTeam) {
            if (Array.isArray(leagueOrTeam)) {
               return leagueOrTeam.reduce(function (numMatchesSoFar, team) {
                  return numMatchesSoFar + self.getNumMatches(team);
               }, 0);
            }
            return leagueOrTeam.numMatchesVersus.reduce(function (numMatchesSoFar, timesPlayed) {
               return numMatchesSoFar + timesPlayed;
            }, 0);
         },
         getOpponentsTotalRatingsConceded: function (league, whichTeam) {
            return league[whichTeam].numMatchesVersus.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
               return effectivePointsSoFar + timesPlayed * (typeof league[whichOpponent].ratingConceded === 'number' ? league[whichOpponent].ratingConceded : self.getAveragePointsPerMatch(league));
            }, 0);
         },
         getOpponentsTotalRatingsEarned: function (league, whichTeam) {
            return league[whichTeam].numMatchesVersus.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
               return effectivePointsSoFar + timesPlayed * (typeof league[whichOpponent].ratingEarned === 'number' ? league[whichOpponent].ratingEarned : self.getAveragePointsPerMatch(league));
            }, 0);
         },
         iterateRatings: function (oldLeague) {
            var averageActualPointsPerMatch, newLeague;
            averageActualPointsPerMatch = self.getAveragePointsPerMatch(oldLeague);
            newLeague = util.createUnfrozenLeague(oldLeague);
            oldLeague.forEach(function (team, whichTeam) {
               var laplaceEquivalentMatches, numMatchesPlayed, strengthOfScheduleFactor;
               strengthOfScheduleFactor = 1; // Colley's default 1; should be nonnegative and maybe no more than 1
               laplaceEquivalentMatches = 1; // Colley's default 2; should be positive
               numMatchesPlayed = self.getNumMatches(team);
               newLeague[whichTeam].effectivePointsEarned = team.actualPointsEarned + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsConceded(oldLeague, whichTeam));
               newLeague[whichTeam].ratingEarned = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsEarned) / (laplaceEquivalentMatches + numMatchesPlayed);
               newLeague[whichTeam].effectivePointsConceded = team.actualPointsConceded + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsEarned(oldLeague, whichTeam));
               newLeague[whichTeam].ratingConceded = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsConceded) / (laplaceEquivalentMatches + numMatchesPlayed);
            });
            return util.deepFreeze(newLeague);
         },
         totalRatingsDifference: function (league1, league2) {
            return league1.reduce(function (diffSoFar, team, whichTeam) {
               return diffSoFar + Math.abs(team.ratingEarned - league2[whichTeam].ratingEarned);
            }, 0);
         }
      };
      return Object.freeze(self);
   }());

   (function () {
      var colleyLeague, getLeagueInput, updateColleyLeague;

      updateColleyLeague = function () {
         var standings;
         standings = colleyLeague.map(function (team, whichTeam) {
            return {
               name: team.name,
               ratingEarned: team.ratingEarned,
               nextRatingEarned: colley.iterateRatings(colleyLeague)[whichTeam].ratingEarned,
               ratingConceded: team.ratingConceded,
               opponentsRatingEarned: colley.getOpponentsTotalRatingsEarned(colleyLeague, whichTeam) / colley.getNumMatches(team),
               opponentsRatingConceded: colley.getOpponentsTotalRatingsConceded(colleyLeague, whichTeam) / colley.getNumMatches(team),
               averagePointsPerMatch: colley.getAveragePointsPerMatch(team)
            };
         });
         standings.sort(function (team1, team2) {
            if (team1.ratingEarned !== team2.ratingEarned) {
               return team2.ratingEarned - team1.ratingEarned;
            }
            return team1.name.localeCompare(team2.name);
         });
         document.querySelector('#colley-output').value = '       RE       RC       ORE      ORC      P/M      NRE\n';
         standings.forEach(function (team) {
            document.querySelector('#colley-output').value += team.name + ': ';
            document.querySelector('#colley-output').value += team.ratingEarned.toFixed(6) + ' ';
            document.querySelector('#colley-output').value += team.ratingConceded.toFixed(6) + ' ';
            document.querySelector('#colley-output').value += team.opponentsRatingEarned.toFixed(6) + ' ';
            document.querySelector('#colley-output').value += team.opponentsRatingConceded.toFixed(6) + ' ';
            document.querySelector('#colley-output').value += team.averagePointsPerMatch.toFixed(6) + ' ';
            document.querySelector('#colley-output').value += team.nextRatingEarned.toFixed(6) + '\n';
         });
      };

      document.querySelector('#clear-matches').addEventListener('click', function () {
         document.querySelector('#match-results-input').value = '';
      }, false);

      Array.from(document.querySelectorAll('#add-matches button')).forEach(function (buttonElement) {
         buttonElement.addEventListener('click', function () {
            var request;

            request = new XMLHttpRequest();
            request.addEventListener('readystatechange', function () {
               if (request.readyState === 4 && request.status === 200) {
                  document.querySelector('#match-results-input').value = request.responseText + '\n' + document.querySelector('#match-results-input').value;
               }
            }, false);

            request.open('get', buttonElement.textContent + '.txt');
            request.send();
         }, false);
      });

      getLeagueInput = function () {
         var newColleyLeague, pointValues;

         pointValues = (function () {
            var pointValuesSelect, resultPoints;
            pointValuesSelect = document.querySelector('#point-values');
            resultPoints = pointValuesSelect.options[pointValuesSelect.selectedIndex].value.split(',').map(function (resultPoint) {
               return Number(resultPoint);
            });
            return {
               w: [resultPoints[0], resultPoints[3]],
               td: [resultPoints[1], resultPoints[2]],
               t: [resultPoints[1], resultPoints[1]],
               d: [resultPoints[2], resultPoints[2]],
               dt: [resultPoints[2], resultPoints[1]],
               l: [resultPoints[3], resultPoints[0]]
            };
         }());

         newColleyLeague = colley.createLeague();

         document.querySelector('#match-results-input').value.split('\n').forEach(function (inputLine) {
            inputLine = inputLine.replace(/\s+/g, ' ').trim().split(' ');
            if (inputLine.length >= 3) {
               inputLine[1] = inputLine[1].toLowerCase();
               if (pointValues.hasOwnProperty(inputLine[1])) {
                  newColleyLeague = colley.addMatchResult(newColleyLeague, inputLine[0], pointValues[inputLine[1]][0], inputLine[2], pointValues[inputLine[1]][1]);
               }
            }
         });
         return newColleyLeague;
      };

      document.querySelector('#iterate-colley-once').addEventListener('click', function () {
         if (colleyLeague.length <= 0) {
            colleyLeague = getLeagueInput();
         }
         colleyLeague = colley.iterateRatings(colleyLeague);
         updateColleyLeague();
      }, false);

      document.querySelector('#get-colley-rankings').addEventListener('click', function () {
         var moreTimes, oldColleyLeague;

         colleyLeague = getLeagueInput();
         colleyLeague = colley.iterateRatings(colleyLeague);
         moreTimes = 0;
         (function keepIterating() {
            moreTimes += 1;
            oldColleyLeague = colleyLeague;
            colleyLeague = colley.iterateRatings(colleyLeague);
            updateColleyLeague();
            if (colley.totalRatingsDifference(oldColleyLeague, colleyLeague) > 1e-15 && moreTimes < 10000) {
               document.querySelector('#colley-output').value += moreTimes + ' iterations so far . . .\n';
               setTimeout(keepIterating, 0);
            } else {
               document.querySelector('#colley-output').value += 'Done!  ' + moreTimes + ' iterations\n';
            }
            document.querySelector('#colley-output').value += colley.totalRatingsDifference(oldColleyLeague, colleyLeague) + ' total ratings difference';
         }());
      }, false);

      colleyLeague = colley.createLeague();
      updateColleyLeague();
   }());
}, false);
