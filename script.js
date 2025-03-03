/*jslint browser */

import {counties} from '../cc/counties.js';

document.addEventListener('DOMContentLoaded', function () {
   'use strict';

   const countiesInfo = counties.createInfo();

   const colley = (function () {

      const util = Object.freeze({
         addTeam: function (league, teamName) {
            league = util.createUnfrozenLeague(league);
            if (league.map((team) => team.name).includes(teamName)) {
               return league;
            }
            const county = countiesInfo.find((c) => c.countyCode === teamName);
            league.push({
               name: teamName,
               classLevel: county?.classLevel,
               numMatchesVersus: [],
               actualPointsEarned: 0,
               actualPointsConceded: 0
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
               classLevel: oldTeam.classLevel,
               numMatchesVersus: [...oldTeam.numMatchesVersus],
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
      });

      const self = Object.freeze({
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
            ? leagueOrTeam.reduce(
               (numPointsSoFar, team) => numPointsSoFar + team.actualPointsEarned,
               0
            ) / self.getNumMatches(leagueOrTeam)
            : leagueOrTeam.actualPointsEarned / self.getNumMatches(leagueOrTeam)
         ),
         getAverageRatingEarned: (league) => league.reduce(
            (totalRatingEarnedSoFar, team) => totalRatingEarnedSoFar + team.ratingEarned,
            0
         ) / league.length,
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
                  Number.isFinite(options?.strengthOfScheduleFactor)
                  && options.strengthOfScheduleFactor > 0
               )
               ? options.strengthOfScheduleFactor
               : 1 // Colley's default was 1; should be nonnegative and maybe no more than 1
            );
            const laplaceEquivalentMatches = (
               (
                  Number.isFinite(options?.laplaceEquivalentMatches)
                  && options.laplaceEquivalentMatches > 0
               )
               ? options.laplaceEquivalentMatches
               : 1 // Colley's default was 2; should be positive
            );
            oldLeague.forEach(function (team, whichTeam) {
               const numMatchesPlayed = self.getNumMatches(team);
               newLeague[whichTeam].effectivePointsEarned = team.actualPointsEarned + strengthOfScheduleFactor * (
                  numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsConceded(oldLeague, whichTeam)
               );
               newLeague[whichTeam].ratingEarned = (
                  laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsEarned
               ) / (
                  laplaceEquivalentMatches + numMatchesPlayed
               );
               newLeague[whichTeam].effectivePointsConceded = team.actualPointsConceded + strengthOfScheduleFactor * (
                  numMatchesPlayed * averageActualPointsPerMatch - self.getOpponentsTotalRatingsEarned(oldLeague, whichTeam)
               );
               newLeague[whichTeam].ratingConceded = (
                  laplaceEquivalentMatches * averageActualPointsPerMatch + newLeague[whichTeam].effectivePointsConceded
               ) / (
                  laplaceEquivalentMatches + numMatchesPlayed
               );
            });
            return util.deepFreeze(newLeague);
         },
         normaliseRatings: function (oldLeague) {
            const newLeague = util.createUnfrozenLeague(oldLeague);
            newLeague.forEach(function (team) {
               team.ratingEarned = team?.ratingEarned ?? 0;
            });
            const averageRatingDeficit = self.getAveragePointsPerMatch(oldLeague) - self.getAverageRatingEarned(oldLeague);
            newLeague.forEach(function (team) {
               team.ratingEarned += averageRatingDeficit;
            });
            return util.deepFreeze(newLeague);
         },
         totalRatingsDifference: (league1, league2) => league1.reduce(
            (diffSoFar, team, whichTeam) => diffSoFar + Math.abs(team.ratingEarned - league2[whichTeam].ratingEarned),
            0
         )
      });

      return self;
   }());

   (function () {
      let colleyLeague;

      const colleyOptions = {
         strengthOfScheduleFactor: 1,
         laplaceEquivalentMatches: 1
      };
      const matchResultsInputElement = document.querySelector('#match-results-input');
      const colleyOutputElement = document.querySelector('#colley-output');
      const barsElement = document.querySelector('#bars');

      const updateColleyLeague = function () {
         const maxMatchesPlayed = Math.max(...colleyLeague.map((team) => colley.getNumMatches(team)));
         const minRatingEarned = Math.min(...colleyLeague.map((team) => team.ratingEarned));
         const standings = colleyLeague.map(
            (team, whichTeam) => ({
               name: team.name,
               adjustedRating: (team.ratingEarned - minRatingEarned) * (1 - (1 - colley.getNumMatches(team) / maxMatchesPlayed) ** 36) + minRatingEarned,
               ratingEarned: team.ratingEarned,
               nextRatingEarned: colley.iterateRatings(colleyLeague, colleyOptions)[whichTeam].ratingEarned,
               ratingConceded: team.ratingConceded,
               opponentsRatingEarned: colley.getOpponentsTotalRatingsEarned(colleyLeague, whichTeam) / colley.getNumMatches(team),
               opponentsRatingConceded: colley.getOpponentsTotalRatingsConceded(colleyLeague, whichTeam) / colley.getNumMatches(team),
               averagePointsPerMatch: colley.getAveragePointsPerMatch(team),
               numMatches: colley.getNumMatches(team)
            })
         ).sort(
            (team1, team2) => team2.adjustedRating - team1.adjustedRating || team1.name.localeCompare(team2.name)
         );
         colleyOutputElement.value = '       AR       RE       RC       ORE      ORC      P/M      NRE\n';
         standings.forEach(function (team) {
            colleyOutputElement.value += (
               team.name + ': '
               + team.adjustedRating.toFixed(6) + ' '
               + team.ratingEarned.toFixed(6) + ' '
               + team.ratingConceded.toFixed(6) + ' '
               + team.opponentsRatingEarned.toFixed(6) + ' '
               + team.opponentsRatingConceded.toFixed(6) + ' '
               + team.averagePointsPerMatch.toFixed(6) + ' '
               + team.nextRatingEarned.toFixed(6) + ' '
               + team.numMatches + '\n'
            );
         });
         colleyOutputElement.value += 'average P/M: ' + colley.getAveragePointsPerMatch(colleyLeague) + '\n';
         colleyOutputElement.value += 'average RE: ' + standings.reduce(
            (sumSoFar, team) => sumSoFar + team.ratingEarned,
            0
         ) / standings.length + '\n';
         const bestRating = Math.max(...standings.map((team) => team.adjustedRating));
         const worstRating = Math.min(...standings.map((team) => team.adjustedRating));
         const countiesBars = standings.map(
            (team) => ({
               countyCode: team.name,
               barLength: (
                  bestRating > worstRating
                  ? (team.adjustedRating - worstRating) / (bestRating - worstRating)
                  : 1
               )
            })
         ).sort(
            (team1, team2) => team2.barLength - team1.barLength || team1.countyCode.localeCompare(team2.countyCode)
         );
         [...barsElement.childNodes].forEach(function (childNode) {
            childNode.remove();
         });
         countiesBars.forEach(function (countyBar, whichPlace) {
            const county = countiesInfo.find((c) => c.countyCode === countyBar.countyCode);
            if (county !== undefined) {
               const newCountyDiv = document.createElement('div');
               newCountyDiv.title = (whichPlace + 1) + '. ' + county.countyName;
               newCountyDiv.classList.add('county-bar');
               const newCountyNameDiv = document.createElement('div');
               newCountyNameDiv.classList.add('county-name');
               newCountyNameDiv.textContent = (whichPlace + 1) + '. ' + county.countyName;
               newCountyDiv.appendChild(newCountyNameDiv);
               newCountyDiv.appendChild(counties.createCanvas({
                  county: county,
                  height: Math.round(40 + countyBar.barLength * 200),
                  isHorizontal: true,
                  isVertical: true,
                  width: 40
               }));
               const newCodeDiv = counties.createCountyElement(county);
               newCodeDiv.textContent = county.countyCode.toUpperCase();
               newCodeDiv.classList.add('county-code');
               newCodeDiv.classList.add('county-colour-name');
               newCountyDiv.appendChild(newCodeDiv);
               barsElement.appendChild(newCountyDiv);
            } else {
               const blankDiv = document.createElement('div');
               blankDiv.textContent = '[' + countyBar.countyCode.toUpperCase() + ']';
               barsElement.appendChild(blankDiv);
            }
         });
      };

      const getCountyMatches = function (year) {
         fetch(
            year + '.txt'
         ).then(
            (response) => response.text()
         ).then(
            function (data) {
               matchResultsInputElement.value = data + '\n' + matchResultsInputElement.value;
            }
         );
      };

      document.querySelector('#clear-matches').addEventListener('click', function () {
         matchResultsInputElement.value = '';
      });

      [...document.querySelectorAll('#add-matches button')].forEach(function (buttonElement) {
         buttonElement.addEventListener('click', function () {
            getCountyMatches(buttonElement.textContent);
         });
      });

      document.querySelector('#clear-matches').addEventListener('click', function () {
         matchResultsInputElement.value = '';
      });

      matchResultsInputElement.addEventListener('dblclick', function () {
         const seasons = [
            {year: 1881, weight: 1},
            {year: 1882, weight: 1},
            {year: 1883, weight: 2},
            {year: 1884, weight: 3},
            {year: 1885, weight: 5},
            {year: 1886, weight: 8},
            {year: 1887, weight: 13},
            {year: 1888, weight: 21},
            {year: 1889, weight: 34},
            {year: 1890, weight: 55},
            {year: 1891, weight: 13},
            {year: 1892, weight: 8},
            {year: 1893, weight: 5},
            {year: 1894, weight: 3},
            {year: 1895, weight: 2},
            {year: 1896, weight: 1}
         ];
         seasons.forEach(function (season) {
            (function getTheRest(howManyLeft) {
               if (howManyLeft > 0) {
                  getCountyMatches(season.year);
                  setTimeout(function () {
                     getTheRest(howManyLeft - 1);
                  }, 0);
               }
            }(season.weight));
         });
      });

      const getLeagueInput = function () {
         const pointValues = (function () {
            const pointValuesSelect = document.querySelector('#point-values');
            const resultPoints = pointValuesSelect.options[pointValuesSelect.selectedIndex].value.split(',').map(
               (resultPoint) => Number(resultPoint)
            );
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

         matchResultsInputElement.value.split('\n').forEach(function (inputLine) {
            const inputTokens = inputLine.replace(/\s+/g, ' ').trim().split(' ');
            if (inputTokens.length >= 3) {
               const matchResult = inputTokens[1].toLowerCase();
               if (pointValues.hasOwnProperty(matchResult)) {
                  newColleyLeague = colley.addMatchResult(
                     newColleyLeague,
                     inputTokens[0],
                     pointValues[matchResult][0],
                     inputTokens[2],
                     pointValues[matchResult][1]
                  );
               } else {
                  matchResultsInputElement.value = 'invalid match result: ' + inputTokens[1] + '\n' + matchResultsInputElement.value;
               }
            }
         });
         return newColleyLeague;
      };

      document.querySelector('#iterate-colley-once').addEventListener('click', function () {
         colleyLeague = colley.iterateRatings(
            (
               colleyLeague?.length > 0
               ? colleyLeague
               : getLeagueInput()
            ),
            colleyOptions
         );
         updateColleyLeague();
      });

      document.querySelector('#get-colley-ratings').addEventListener('click', function () {
         colleyLeague = colley.iterateRatings(getLeagueInput());
         (function keepIterating(numIterationsDone) {
            numIterationsDone += 1;
            const oldColleyLeague = colleyLeague;
            colleyLeague = colley.iterateRatings(colleyLeague, colleyOptions);
            updateColleyLeague();
            if (colley.totalRatingsDifference(oldColleyLeague, colleyLeague) > 1e-15 && numIterationsDone < 10000) {
               colleyOutputElement.value += numIterationsDone + ' iterations so far . . .\n';
               setTimeout(function () {
                  keepIterating(numIterationsDone);
               }, 0);
            } else {
               colleyOutputElement.value += 'Done!  ' + numIterationsDone + ' iterations\n';
            }
            colleyOutputElement.value += colley.totalRatingsDifference(oldColleyLeague, colleyLeague) + ' total ratings difference';
         }(0));
      });

      colleyLeague = colley.createLeague();
      updateColleyLeague();
   }());
});
