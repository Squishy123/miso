const functions = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

/* Express */
const express = require('express');

const app1 = express()
app1.get('*', (req, res) => {
    res.send("Hello World from Firebase!")
})

const api1 = functions.https.onRequest(app1);

/* Node api proxy */
const cors = require('cors');
const request = require('request');
const nodeProxy = express();
nodeProxy.use(cors({origin: true}));

nodeProxy.use('/', (req, res) => {
    let url = req.url;
    req.pipe(request({uri: url})).pipe(res);
})

const apiNodeProxy = functions.https.onRequest(nodeProxy);

module.exports = {
    api1,
    apiNodeProxy
}