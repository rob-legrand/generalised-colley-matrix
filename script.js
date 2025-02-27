/*jslint browser */

document.addEventListener('DOMContentLoaded', function () {
   'use strict';

   const colley = (function () {

      const util = {
         addTeam: function (league, teamName) {
            league = util.createUnfrozenLeague(league);
            if (league.map((team) => team.name).includes(teamName)) {
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
         createUnfrozenLeague: (oldLeague) => (
            Array.isArray(oldLeague)
            ? oldLeague.map((oldTeam) => ({
               name: oldTeam.name,
               numMatchesVersus: Array.from(oldTeam.numMatchesVersus),
               actualPointsEarned: oldTeam.actualPointsEarned,
               actualPointsConceded: oldTeam.actualPointsConceded,
               effectivePointsEarned: oldTeam.effectivePointsEarned,
               effectivePointsConceded: oldTeam.effectivePointsConceded,
               ratingEarned: oldTeam.ratingEarned,
               ratingConceded: oldTeam.ratingConceded
            }))
            : []
         ),
         deepFreeze: function deepFreeze(oldThing) {
            return (
               Array.isArray(oldThing)
               ? Object.freeze(oldThing.map((currentValue) => deepFreeze(currentValue)))
               : typeof oldThing === 'object'
               ? Object.freeze(Object.keys(oldThing).reduce(function (newObject, prop) {
                  newObject[prop] = deepFreeze(oldThing[prop]);
                  return newObject;
               }, {}))
               : oldThing
            );
         }
      };

      const self = {
         addMatchResult: function (league, teamName1, points1, teamName2, points2) {
            if (!Number.isFinite(points1) || !Number.isFinite(points2)) {
               return;
            }
            league = util.addTeam(util.addTeam(league, teamName1), teamName2);
            if (teamName1 !== teamName2) {
               const teamNames = league.map((team) => team.name);
               const whichTeam1 = teamNames.indexOf(teamName1);
               const whichTeam2 = teamNames.indexOf(teamName2);
               league[whichTeam1].numMatchesVersus[whichTeam2] += 1;
               league[whichTeam1].actualPointsEarned += points1;
               league[whichTeam1].actualPointsConceded += points2;
               league[whichTeam2].numMatchesVersus[whichTeam1] += 1;
               league[whichTeam2].actualPointsEarned += points2;
               league[whichTeam2].actualPointsConceded += points1;
            }
            return util.deepFreeze(league);
         },
         createLeague: (oldLeague) => util.deepFreeze(util.createUnfrozenLeague(oldLeague)),
         getAveragePointsPerMatch: (leagueOrTeam) => (
            Array.isArray(leagueOrTeam)
            ? leagueOrTeam.reduce((numPointsSoFar, team) => numPointsSoFar + team.actualPointsEarned, 0) / self.getNumMatches(leagueOrTeam)
            : leagueOrTeam.actualPointsEarned / self.getNumMatches(leagueOrTeam)
         ),
         getNumMatches: (leagueOrTeam) => (
            Array.isArray(leagueOrTeam)
            ? leagueOrTeam.reduce((numMatchesSoFar, team) => numMatchesSoFar + self.getNumMatches(team), 0)
            : leagueOrTeam.numMatchesVersus.reduce((numMatchesSoFar, timesPlayed) => numMatchesSoFar + timesPlayed, 0)
         ),
         getOpponentsTotalRatingsConceded: (league, whichTeam) => league[whichTeam].numMatchesVersus.reduce(
            (effectivePointsSoFar, timesPlayed, whichOpponent) => effectivePointsSoFar + timesPlayed * (
               Number.isFinite(league[whichOpponent].ratingConceded)
               ? league[whichOpponent].ratingConceded
               : self.getAveragePointsPerMatch(league)
            ),
            0
         ),
         getOpponentsTotalRatingsEarned: (league, whichTeam) => league[whichTeam].numMatchesVersus.reduce(
            (effectivePointsSoFar, timesPlayed, whichOpponent) => effectivePointsSoFar + timesPlayed * (
               Number.isFinite(league[whichOpponent].ratingEarned)
               ? league[whichOpponent].ratingEarned
               : self.getAveragePointsPerMatch(league)
            ),
            0
         ),
         iterateRatings: function (oldLeague, options) {
            const averageActualPointsPerMatch = self.getAveragePointsPerMatch(oldLeague);
            const newLeague = util.createUnfrozenLeague(oldLeague);
            const strengthOfScheduleFactor = (
               (
                  typeof options === 'object'
                  && Number.isFinite(options.strengthOfScheduleFactor)
                  && options.strengthOfScheduleFactor > 0
               )
               ? options.strengthOfScheduleFactor
               : 1 // Colley's default 1; should be nonnegative and maybe no more than 1
            );
            const laplaceEquivalentMatches = (
               (
                  typeof options === 'object'
                  && Number.isFinite(options.laplaceEquivalentMatches)
                  && options.laplaceEquivalentMatches > 0
               )
               ? options.laplaceEquivalentMatches
               : 1 // Colley's default 2; should be positive
            );
            oldLeague.forEach(function (team, whichTeam) {
               const numMatchesPlayed = self.getNumMatches(team);
               newLeague[whichTeam].effectivePointsEarned = team.actualPointsEarned + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsConceded(oldLeague, whichTeam));
               newLeague[whichTeam].ratingEarned = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsEarned) / (laplaceEquivalentMatches + numMatchesPlayed);
               newLeague[whichTeam].effectivePointsConceded = team.actualPointsConceded + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsEarned(oldLeague, whichTeam));
               newLeague[whichTeam].ratingConceded = (laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsConceded) / (laplaceEquivalentMatches + numMatchesPlayed);
            });
            return util.deepFreeze(newLeague);
         },
         totalRatingsDifference: (league1, league2) => league1.reduce(
            (diffSoFar, team, whichTeam) => diffSoFar + Math.abs(team.ratingEarned - league2[whichTeam].ratingEarned),
            0
         )
      };
      return Object.freeze(self);
   }());

   (function () {
      let colleyLeague;

      const updateColleyLeague = function () {
         const standings = colleyLeague.map((team, whichTeam) => ({
            name: team.name,
            ratingEarned: team.ratingEarned,
            nextRatingEarned: colley.iterateRatings(colleyLeague, {
               strengthOfScheduleFactor: 1,
               laplaceEquivalentMatches: 1
            })[whichTeam].ratingEarned,
            ratingConceded: team.ratingConceded,
            opponentsRatingEarned: colley.getOpponentsTotalRatingsEarned(colleyLeague, whichTeam) / colley.getNumMatches(team),
            opponentsRatingConceded: colley.getOpponentsTotalRatingsConceded(colleyLeague, whichTeam) / colley.getNumMatches(team),
            averagePointsPerMatch: colley.getAveragePointsPerMatch(team)
         })).sort((team1, team2) => (
            team1.ratingEarned !== team2.ratingEarned
            ? team2.ratingEarned - team1.ratingEarned
            : team1.name.localeCompare(team2.name)
         ));
         const colleyOutputElement = document.querySelector('#colley-output');
         colleyOutputElement.value = '       RE       RC       ORE      ORC      P/M      NRE\n';
         standings.forEach(function (team) {
            colleyOutputElement.value += (
               team.name + ': '
               + team.ratingEarned.toFixed(6) + ' '
               + team.ratingConceded.toFixed(6) + ' '
               + team.opponentsRatingEarned.toFixed(6) + ' '
               + team.opponentsRatingConceded.toFixed(6) + ' '
               + team.averagePointsPerMatch.toFixed(6) + ' '
               + team.nextRatingEarned.toFixed(6) + '\n'
            );
         });
      };

      document.querySelector('#clear-matches').addEventListener('click', function () {
         document.querySelector('#match-results-input').value = '';
      });

      Array.from(document.querySelectorAll('#add-matches button')).forEach(function (buttonElement) {
         buttonElement.addEventListener('click', function () {
            const request = new XMLHttpRequest();
            request.addEventListener('readystatechange', function () {
               if (request.readyState === 4 && request.status === 200) {
                  document.querySelector('#match-results-input').value = request.responseText + '\n' + document.querySelector('#match-results-input').value;
               }
            });

            request.open('get', buttonElement.textContent + '.txt');
            request.send();
         });
      });

      const getLeagueInput = function () {
         const pointValues = (function () {
            const pointValuesSelect = document.querySelector('#point-values');
            const resultPoints = pointValuesSelect.options[pointValuesSelect.selectedIndex].value.split(',').map((resultPoint) => Number(resultPoint));
            return {
               w: [resultPoints[0], resultPoints[3]],
               td: [resultPoints[1], resultPoints[2]],
               t: [resultPoints[1], resultPoints[1]],
               d: [resultPoints[2], resultPoints[2]],
               dt: [resultPoints[2], resultPoints[1]],
               l: [resultPoints[3], resultPoints[0]]
            };
         }());

         let newColleyLeague = colley.createLeague();

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
         colleyLeague = colley.iterateRatings(colleyLeague, {
            strengthOfScheduleFactor: 1,
            laplaceEquivalentMatches: 1
         });
         updateColleyLeague();
      });

      document.querySelector('#get-colley-ratings').addEventListener('click', function () {
         colleyLeague = colley.iterateRatings(getLeagueInput());
         (function keepIterating(numIterationsDone) {
            numIterationsDone += 1;
            const oldColleyLeague = colleyLeague;
            colleyLeague = colley.iterateRatings(colleyLeague, {
               strengthOfScheduleFactor: 1,
               laplaceEquivalentMatches: 1
            });
            updateColleyLeague();
            if (colley.totalRatingsDifference(oldColleyLeague, colleyLeague) > 1e-15 && numIterationsDone < 10000) {
               document.querySelector('#colley-output').value += numIterationsDone + ' iterations so far . . .\n';
               setTimeout(function () {
                  keepIterating(numIterationsDone);
               }, 0);
            } else {
               document.querySelector('#colley-output').value += 'Done!  ' + numIterationsDone + ' iterations\n';
            }
            document.querySelector('#colley-output').value += colley.totalRatingsDifference(oldColleyLeague, colleyLeague) + ' total ratings difference';
         }(0));
      });

      colleyLeague = colley.createLeague();
      updateColleyLeague();
   }());
});
