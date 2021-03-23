"use strict";

const cheerio = require("cheerio");
const request = require("request");
const fs = require("fs");
const path = require("path");

const baseUrl = "https://www.espncricinfo.com";

const stats = {};

request(
    baseUrl + "/series/ipl-2020-21-1210595/match-results",
    function (err, res, body) {
        if (err) {
            console.log(err);
        } else {
            extractMatches(body);
        }
    }
);

function extractMatches(html) {
    const selector = cheerio.load(html);
    const matches = selector(".match-info-link-FIXTURES");
    for (let i = 0; i < matches.length; i++) {
        const matchLink = baseUrl + selector(matches[i]).attr("href");
        request(matchLink, function (err, res, body) {
            if (err) {
                console.log(err);
            } else {
                extractBatsman(body);
            }
        });
    }
    // console.log(matches.length);
}

function extractBatsman(html) {
    const selector = cheerio.load(html);
    const event = selector(".event");
    const teams = [];
    const teamNames = event.find(".name");
    teams.push(selector(teamNames[0]).text());
    teams.push(selector(teamNames[1]).text());

    const description = event.find(".event .description");
    const [, venue, date] = description.text().split(",");

    const commonData = {
        venue,
        date,
        result: event.find(".status-text").text(),
    };

    const table = selector(".table.batsman");
    for (let i = 0; i < table.length; i++) {
        const td = selector(table[i]).find(
            "tbody tr td:not(.text-left):not(.text-right)"
        );
        const tdData = [];
        for (let d of td) {
            const text = selector(d).text().trim();
            if (text != "" && text != "-" && text != "Extras") {
                tdData.push(text);
            }
        }
        // console.log(tdData);
        const numOfPlayers = Math.trunc(tdData.length / 6);
        for (let j = 0; j < numOfPlayers; j++) {
            let obj = {};
            for (let k = 0; k < 6; k++) {
                if (k === 0) {
                    obj.name = tdData[6 * j + k];
                } else if (k === 1) {
                    obj.runs = tdData[6 * j + k];
                } else if (k === 2) {
                    obj.balls = tdData[6 * j + k];
                } else if (k === 3) {
                    obj.fours = tdData[6 * j + k];
                } else if (k === 4) {
                    obj.sixes = tdData[6 * j + k];
                } else if (k === 5) {
                    obj.strikeRate = tdData[6 * j + k];
                }
            }
            obj.venue = commonData.venue;
            obj.date = commonData.date;
            obj.result = commonData.result;
            obj.opponent = teams[i === 0 ? 1 : 0];

            const currentTeam = teams[i];
            const playerName = obj.name
                .split("(")
                .shift()
                .trim()
                .split("†")
                .shift()
                .trim();

            delete obj.name;

            createDirectory(currentTeam);
            if (stats[currentTeam] === undefined) {
                stats[currentTeam] = [];
                stats[currentTeam][playerName] = [];
                stats[currentTeam][playerName].push(obj);
            } else {
                if (stats[currentTeam][playerName] === undefined) {
                    stats[currentTeam][playerName] = [];
                    stats[currentTeam][playerName].push(obj);
                } else {
                    stats[currentTeam][playerName].push(obj);
                }
            }

            // createFile(currentTeam, playerName);
        }
    }
}

function createDirectory(dirname) {
    const teamsContainer = path.join(__dirname, "Teams");
    if (!fs.existsSync(teamsContainer)) {
        fs.mkdirSync(teamsContainer);
    }

    const teamFolder = path.join(teamsContainer, dirname);
    if (!fs.existsSync(teamFolder)) {
        fs.mkdirSync(teamFolder);
    }
}

setTimeout(function () {
    for (const [team, players] of Object.entries(stats)) {
        for (const [player, data] of Object.entries(players)) {
            const filepath = path.resolve(
                "./Teams/" + team + "/" + player + ".json"
            );
            fs.writeFileSync(filepath, JSON.stringify(data));
        }
    }
}, 10000);
