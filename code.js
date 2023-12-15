"use strict";

const nodeFetch = require("node-fetch");
const path = require("path");
require("dotenv").config({path: path.resolve(__dirname, '.env')})
const express = require("express");
const app = express();
const prompt = "Stop to shutdown the server: ";
const bodyParser = require("body-parser");
const username = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const db = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;
const uri = `mongodb+srv://${username}:${password}@cmsc335.w3lqlem.mongodb.net/?retryWrites=true&w=majority`;

const {MongoClient, ServerApiVersion} = require('mongodb');
let portNumber = process.argv[2];

app.listen(portNumber);
app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));
app.use(express.static(path.join(__dirname, 'public')));

console.log(`Web server started and running at http://localhost:${portNumber}`)
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  
app.get("/", (request, response) => {
    response.render("index");
})

app.post("/prereqs", (request, response) => {
    let className = request.body.className;
    let studentName = request.body.nameWhenEntering;
    let classList = {};

    const currDate = new Date();
    const hour = currDate.getHours();
    const minutes = currDate.getMinutes();
    const formattedDate = `${hour % 12}:${minutes < 10 ? `0${minutes}` : minutes} ${hour > 12 ? "PM" : "AM"} ${currDate.getMonth() + 1}-${currDate.getDate()}-${currDate.getFullYear()} `;

    nodeFetch(`https://api.umd.io/v1/courses/${className}`)
    .then(async resp => {
        const json = await resp.json();
        let result = "";

        for (let x of json) {
            result += x.course_id;
            result += `<br>Pre-requisites: ${x.relationships?.prereqs ?? "None"} <br>`;
            classList = { className: x.course_id, prereqs: x.relationships?.prereqs ?? "None", date: formattedDate };
        }

        response.render("prereqs", { name: studentName, info: result });
    })
    .then(async () => {
        try {
            await client.connect();
            let retrievedData = await client.db(db).collection(collection).findOne({ studentName: studentName });
            let currList = [];
            if (retrievedData) {
                currList = retrievedData.classList;
                await client.db(db).collection(collection).deleteOne({ studentName: studentName });
            }
            currList.push(classList);
            await client.db(db).collection(collection).insertOne({ studentName: studentName, classList: currList });
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    });
});

app.post("/prevClasses", async (request, response) => {
    let studentName = request.body.nameWhenSearching;

    try {
        await client.connect();
        const cursor = await client.db(db).collection(collection).find({ studentName: studentName });
        const returnedData = await cursor.toArray();

        if (returnedData.length === 0) {
            response.render("prevClasses", { name: studentName, info: `No classes found for ${studentName}`, numClasses: 0 });
            return;
        }

        let result = "<table><tr><th>Class Name</th><th>Pre-requisites</th><th>Date</th></tr>";
        
        returnedData.forEach((elem) => {
            elem.classList.forEach((classInfo) => {
                result += `<tr><td>${classInfo.className}</td><td>${classInfo.prereqs}</td><td>${classInfo.date}</td></tr>`;
            });
        });

        result += "</table>";

        response.render("prevClasses", { name: studentName, info: result, numClasses: returnedData.length });

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.post("/clearData", async (req, res) => {
    try {
        await client.connect();
        await client.db(db).collection(collection).deleteOne({studentName: req.body.nameWhenClearing});
        res.render("clearData");
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

process.stdin.setEncoding('utf-8');
process.stdout.write(prompt);
process.stdin.on('readable', () => {
    let dataInput = process.stdin.read();
    if (dataInput !== null){
        let command = dataInput.trim();
        if (command === "stop"){
            console.log("Shutting down the server");
            process.exit(0);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
})