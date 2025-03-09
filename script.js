/*jslint browser */

import {counties} from '../cc/counties.js';

document.addEventListener('DOMContentLoaded', function () {
   'use strict';

   const firstCountySeason = 1878;
   const lastCountySeason = 1899;
   const countySeasons = Array.from(
      {length: lastCountySeason - firstCountySeason + 1},
      (ignore, whichSeason) => whichSeason + firstCountySeason
   );

   document.querySelector('#add-matches').replaceChildren(
      ...countySeasons.map(function (countySeason) {
         const newButton = document.createElement('button');
         newButton.setAttribute('type', 'button');
         newButton.textContent = countySeason;
         return newButton;
      })
   );

   document.querySelector('#from-season').replaceChildren(
      ...countySeasons.map(function (countySeason) {
         const newFromOption = document.createElement('option');
         newFromOption.setAttribute('value', countySeason.toString());
         newFromOption.textContent = countySeason;
         return newFromOption;
      })
   );
   document.querySelector('#from-season :first-child').setAttribute('selected', 'selected');

   document.querySelector('#to-season').replaceChildren(
      ...countySeasons.map(function (countySeason) {
         const newToOption = document.createElement('option');
         newToOption.setAttribute('value', countySeason.toString());
         newToOption.textContent = countySeason;
         return newToOption;
      })
   );
   document.querySelector('#to-season :last-child').setAttribute('selected', 'selected');

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
         deepCopy: (func, oldThing) => func(
            Array.isArray(oldThing)
            ? oldThing.map(
               (currentValue) => util.deepCopy(func, currentValue)
            )
            : typeof oldThing === 'object'
            ? Object.keys(oldThing).reduce(
               function (newObject, prop) {
                  newObject[prop] = util.deepCopy(func, oldThing[prop]);
                  return newObject;
               },
               {}
            )
            : oldThing
         )
      });

      const self = Object.freeze({
         addMatchResult: function (league, teamName1, points1, teamName2, points2) {
            if (!Number.isFinite(points1) || !Number.isFinite(points2)) {
               return;
            }
            league = util.addTeam(
               util.addTeam(
                  league,
                  teamName1
               ),
               teamName2
            );
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
            return util.deepCopy(Object.freeze, league);
         },
         createLeague: (oldLeague) => util.deepCopy(Object.freeze, util.createUnfrozenLeague(oldLeague)),
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
            return util.deepCopy(Object.freeze, newLeague);
         },
         normalizeRatings: function (oldLeague) {
            const newLeague = util.createUnfrozenLeague(oldLeague);
            newLeague.forEach(function (team) {
               team.ratingEarned = team?.ratingEarned ?? 0;
            });
            const averageRatingDeficit = self.getAveragePointsPerMatch(oldLeague) - self.getAverageRatingEarned(oldLeague);
            newLeague.forEach(function (team) {
               team.ratingEarned += averageRatingDeficit;
            });
            return util.deepCopy(Object.freeze, newLeague);
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
         const numMatchesInAdjustment = maxMatchesPlayed / 300;
         const standings = colleyLeague.map(
            (team, whichTeam) => ({
               classLevel: countiesInfo.find((c) => c.countyCode === team.name.toLowerCase())?.classLevel ?? 0,
               name: team.name,
               adjustedRating: (colley.getNumMatches(team) * team.ratingEarned + numMatchesInAdjustment * minRatingEarned) / (colley.getNumMatches(team) + numMatchesInAdjustment),
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
               team.classLevel + ' '
               + team.name + ' '
               + team.adjustedRating.toFixed(6) + ' '
               + team.ratingEarned?.toFixed(6) + ' '
               + team.ratingConceded?.toFixed(6) + ' '
               + team.opponentsRatingEarned.toFixed(6) + ' '
               + team.opponentsRatingConceded.toFixed(6) + ' '
               + team.averagePointsPerMatch.toFixed(6) + ' '
               + team.nextRatingEarned.toFixed(6) + ' '
               + (team.ratingEarned + team.opponentsRatingEarned).toFixed(6) + ' '
               + (team.ratingEarned + 7 * team.opponentsRatingEarned).toFixed(6) + ' '
               + (2 * team.ratingEarned + 7 * team.opponentsRatingEarned).toFixed(6) + ' '
               + (team.ratingEarned * Math.log(team.numMatches)).toFixed(6) + ' '
               + (team.opponentsRatingEarned * Math.log(team.numMatches)).toFixed(6) + ' '
               + ((team.ratingEarned + team.opponentsRatingEarned) * Math.log(team.numMatches)).toFixed(6) + ' '
               + ((team.ratingEarned + 7 * team.opponentsRatingEarned) * Math.log(team.numMatches)).toFixed(6) + ' '
               + ((2 * team.ratingEarned + 7 * team.opponentsRatingEarned) * Math.log(team.numMatches)).toFixed(6) + ' '
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
         barsElement.replaceChildren(...countiesBars.map(function (countyBar, whichPlace) {
            const newDiv = document.createElement('div');
            const county = countiesInfo.find((c) => c.countyCode === countyBar.countyCode);
            if (county !== undefined) {
               newDiv.title = (whichPlace + 1) + '. ' + county.countyName;
               newDiv.classList.add('county-bar');
               const newCountyNameDiv = document.createElement('div');
               newCountyNameDiv.classList.add('county-name');
               newCountyNameDiv.textContent = (whichPlace + 1) + '. ' + county.countyName;
               const newCodeDiv = counties.createCountyElement(county);
               newCodeDiv.textContent = county.countyCode.toUpperCase();
               newCodeDiv.classList.add('county-code');
               newCodeDiv.classList.add('county-colour-name');
               const newClassDiv = document.createElement('div');
               newClassDiv.textContent = county.classLevel ?? '-';
               newDiv.replaceChildren(
                  newCountyNameDiv,
                  counties.createCanvas({
                     colours: county.colours,
                     height: Math.round(40 + countyBar.barLength * 200),
                     isHorizontal: true,
                     isVertical: true,
                     width: 40
                  }),
                  newCodeDiv,
                  newClassDiv
               );
            } else {
               newDiv.textContent = '[' + countyBar.countyCode.toUpperCase() + ']';
            }
            return newDiv;
         }));
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

      const createSeasons = function (firstYear, lastYear, startWeights, weightFunc) {
         const yearDirection = (
            firstYear > lastYear
            ? -1
            : 1
         );
         const numYears = (lastYear - firstYear) * yearDirection + 1;
         const weights = Array.from(
            {length: numYears - startWeights.length}
         ).reduce(
            (oldWeights) => [
               ...oldWeights,
               weightFunc(
                  ...oldWeights.slice(
                     oldWeights.length - weightFunc.length
                  )
               )
            ],
            startWeights
         );
         return weights.map(
            (weight, which) => ({
               year: firstYear + which * yearDirection,
               weight: weight
            })
         );
      };

      const addSeasons = function (seasons) {
         seasons.reduce(
            function (seasonsSoFar, season) {
               (function addTheRest(howManyLeft) {
                  if (howManyLeft > 0) {
                     seasonsSoFar = [...seasonsSoFar, season.year];
                     addTheRest(howManyLeft - 1);
                  }
               }(season.weight));
               return seasonsSoFar;
            },
            []
         ).sort(
            () => Math.random() < 0.5
         ).forEach(function (season) {
            setTimeout(function () {
               getCountyMatches(season);
            }, 0);
         });
      };

      document.querySelector('#add-range').addEventListener('click', function () {
         const fromSeasonSelect = document.querySelector('#from-season');
         const fromSeason = Number(
            fromSeasonSelect.options[
               fromSeasonSelect.selectedIndex
            ].value
         );
         const toSeasonSelect = document.querySelector('#to-season');
         const toSeason = Number(
            toSeasonSelect.options[
               toSeasonSelect.selectedIndex
            ].value
         );
         const seasonWeightsSelect = document.querySelector('#season-weights');
         const seasonWeights = seasonWeightsSelect.options[
            seasonWeightsSelect.selectedIndex
         ].value;
         addSeasons(
            seasonWeights === 'linear'
            ? createSeasons(fromSeason, toSeason, [1], (x) => x + 1)
            : seasonWeights === 'triangular2'
            ? createSeasons(fromSeason, toSeason, [], () => 1)
            : seasonWeights === 'triangular3'
            ? createSeasons(fromSeason, toSeason, [], () => 1)
            : seasonWeights === 'quadratic2'
            ? createSeasons(fromSeason, toSeason, [], () => 1)
            : seasonWeights === 'quadratic4'
            ? createSeasons(fromSeason, toSeason, [], () => 1)
            : seasonWeights === 'fibonacci1'
            ? createSeasons(fromSeason, toSeason, [1, 1], (x, y) => x + y)
            : seasonWeights === 'fibonacci2'
            ? createSeasons(fromSeason, toSeason, [1, 2], (x, y) => x + y)
            : seasonWeights === 'exponential'
            ? createSeasons(fromSeason, toSeason, [1], (x) => 2 * x)
            : createSeasons(fromSeason, toSeason, [], () => 1)
         );
      });

      matchResultsInputElement.addEventListener('dblclick', function () {
         const seasons = [
            ...createSeasons(firstCountySeason, 1890, [1, 1], (x, y) => x + y),
            ...createSeasons(lastCountySeason, 1891, [1, 2], (x, y) => x + y)
         ];
         addSeasons(seasons);
      });

      const getLeagueInput = function () {
         let newColleyLeague;

         const pointValues = (function () {
            const pointValuesSelect = document.querySelector('#point-values');
            const resultPoints = pointValuesSelect.options[
               pointValuesSelect.selectedIndex
            ].value.split(',').map(
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

         newColleyLeague = colley.createLeague();

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
            if (colley.totalRatingsDifference(oldColleyLeague, colleyLeague) > 1e-15 && numIterationsDone < 50000) {
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
