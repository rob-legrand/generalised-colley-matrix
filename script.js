/*jslint devel: true, indent: 3 */
// https://jsbin.com/bupebepebi/edit?js,console

(function () {
   'use strict';
   var addMatchResult, createTeamData, iterateRatings, teamData;

   createTeamData = function (oldObj) {
      var newObj;
      if (typeof oldObj === 'number') {
         newObj = [];
         while (newObj.length < oldObj) {
            newObj.push(undefined);
         }
         return newObj.map(function () {
            return {
               opponents: newObj.map(function () {
                  return 0;
               }),
               actualPointsEarned: 0,
               actualPointsConceded: 0,
               effectivePointsEarned: 0,
               effectivePointsConceded: 0
            };
         });
      }
      return oldObj.map(function (oldTeam) {
         return {
            opponents: oldTeam.opponents.slice(),
            actualPointsEarned: oldTeam.actualPointsEarned,
            actualPointsConceded: oldTeam.actualPointsConceded,
            effectivePointsEarned: oldTeam.effectivePointsEarned,
            effectivePointsConceded: oldTeam.effectivePointsConceded,
            ratingEarned: oldTeam.ratingEarned,
            ratingConceded: oldTeam.ratingConceded
         };
      });
   };

   addMatchResult = function (oldTeamData, team1, team1points, team2, team2points) {
      var newTeamData;
      newTeamData = createTeamData(oldTeamData);
      newTeamData[team1].opponents[team2] += 1;
      newTeamData[team1].actualPointsEarned += team1points;
      newTeamData[team1].actualPointsConceded += team2points;
      newTeamData[team2].opponents[team1] += 1;
      newTeamData[team2].actualPointsEarned += team2points;
      newTeamData[team2].actualPointsConceded += team1points;
      return newTeamData;
   };

   iterateRatings = function (oldTeamData) {
      var averageActualPointsPerMatch, newTeamData, numMatches;
      numMatches = oldTeamData.reduce(function (numMatchesSoFar, team) {
         return numMatchesSoFar + team.opponents.reduce(function (numMatchesSoFar, timesPlayed) {
            return numMatchesSoFar + timesPlayed;
         }, 0);
      }, 0);
      averageActualPointsPerMatch = oldTeamData.reduce(function (numPointsSoFar, team) {
         return numPointsSoFar + team.actualPointsEarned;
      }, 0) / numMatches;
      newTeamData = createTeamData(oldTeamData);
      oldTeamData.forEach(function (team, whichTeam) {
         var laplaceEquivalentMatches, numMatchesPlayed, opponentsRatingConceded, opponentsRatingEarned, strengthOfScheduleFactor;
         strengthOfScheduleFactor = 1; // default 1; should be nonnegative and maybe no more than 1
         laplaceEquivalentMatches = 2; // default 2; should be positive
         numMatchesPlayed = team.opponents.reduce(function (numMatchesSoFar, timesPlayed) {
            return numMatchesSoFar + timesPlayed;
         }, 0);
         opponentsRatingConceded = team.opponents.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
            return effectivePointsSoFar + timesPlayed * (typeof oldTeamData[whichOpponent].ratingConceded === 'number' ? oldTeamData[whichOpponent].ratingConceded : averageActualPointsPerMatch);
         }, 0);
         newTeamData[whichTeam].effectivePointsEarned = team.actualPointsEarned + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - opponentsRatingConceded);
         newTeamData[whichTeam].ratingEarned = (laplaceEquivalentMatches * averageActualPointsPerMatch + newTeamData[whichTeam].effectivePointsEarned) / (laplaceEquivalentMatches + numMatchesPlayed);
         opponentsRatingEarned = team.opponents.reduce(function (effectivePointsSoFar, timesPlayed, whichOpponent) {
            return effectivePointsSoFar + timesPlayed * (typeof oldTeamData[whichOpponent].ratingEarned === 'number' ? oldTeamData[whichOpponent].ratingEarned : averageActualPointsPerMatch);
         }, 0);
         newTeamData[whichTeam].effectivePointsConceded = team.actualPointsConceded + strengthOfScheduleFactor * (numMatchesPlayed * averageActualPointsPerMatch - opponentsRatingEarned);
         newTeamData[whichTeam].ratingConceded = (laplaceEquivalentMatches * averageActualPointsPerMatch + newTeamData[whichTeam].effectivePointsConceded) / (laplaceEquivalentMatches + numMatchesPlayed);
      });
      return newTeamData;
   };

   teamData = createTeamData(5);
   teamData = addMatchResult(teamData, 0, 1, 2, 0);
   teamData = addMatchResult(teamData, 1, 1, 4, 0);
   teamData = addMatchResult(teamData, 2, 1, 1, 0);
   teamData = addMatchResult(teamData, 2, 1, 3, 0);
   teamData = addMatchResult(teamData, 3, 1, 0, 0);
   teamData = addMatchResult(teamData, 4, 1, 0, 0);
   teamData = addMatchResult(teamData, 4, 1, 2, 0);
   /*
   teamData = createTeamData(6);
   teamData = addMatchResult(teamData, 0, 1, 1, 1);
   teamData = addMatchResult(teamData, 0, 4, 2, 0);
   teamData = addMatchResult(teamData, 1, 1, 2, 1);
   teamData = addMatchResult(teamData, 0, 4, 5, 0);
   teamData = addMatchResult(teamData, 1, 4, 4, 0);
   teamData = addMatchResult(teamData, 2, 4, 3, 0);
   teamData = addMatchResult(teamData, 3, 4, 4, 0);
   teamData = addMatchResult(teamData, 3, 4, 5, 0);
   teamData = addMatchResult(teamData, 4, 4, 5, 0);
   */

   console.log(teamData);
   console.log('---------------------------');
   teamData = iterateRatings(teamData);
   console.log(teamData);
   console.log('---------------------------');
   (function f(moreTimes) {
      if (moreTimes > 0) {
         teamData = iterateRatings(teamData);
         f(moreTimes - 1);
      }
   }(100));
   console.log(teamData);
   teamData.forEach(function (team, whichTeam) {
      console.log('team ' + whichTeam + ': ' + team.ratingEarned);
   });
}());
