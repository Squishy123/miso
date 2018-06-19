//firebase stuff
const admin = require('firebase-admin');
const serviceAccount = require("./amine-7eb29-firebase-adminsdk-b3cu9-4b3d779435.json");

//async
const async = require('async');

//search result processing
const stringSimilarity = require('string-similarity');

//Scrapers
const nineAnimeScraper = require('9anime-scraper');

//Tasks
const nineAnimeRequest = require('./tasks/9animeRequest.js');

//Proxy Properties
const proxySettings = require('./proxySettings.json');
const proxyList = require('./proxylist.json');

//server stuff
const Hapi = require('hapi');
const server = Hapi.server({
  port: 8000
});

server.route({
  method: 'GET',
  path: '/',
  handler: (request, h) => {
    return 'Miso is Online!';
  }
});

const init = async () => {
  await server.start();
  console.log(`Server running at ${server.info.uri}`);

  //setup task manager
  let taskQueue = async.queue(async (task, callback) => {
    console.log(`Running Task`)
    await task.func.apply(null.task.args);
    callback();
  }, 8);

  taskQueue.saturated = () => {
    console.log(`Waiting for current tasks to complete...`)
  }

  //init firebase admin with uid miso
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://amine-7eb29.firebaseio.com",
    databaseAuthVariableOverride: {
      uid: 'miso'
    }
  });

  //setup database
  let db = admin.database();

  //ref for 9anime search results
  let nineSearchResults = db.ref('9anime-search-results');

  //reference for 9anime search requests
  let nineSearchRequest = db.ref('9anime-search-requests');
  nineSearchRequest.on('child_added', (snapshot) => {
    let query = snapshot.val();
    async.retry({ times: 100 },
      (cb, results) => {
        nineAnimeScraper.getSearch(query, `http://${proxySettings.username}:${proxySettings.password}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`, (res) => {
          if (res instanceof Error)
            cb(new Error("Tunnel Failed"));

          let similaritySorted = res.sort((a, b) => {
            return stringSimilarity.compareTwoStrings(b.title, query) - stringSimilarity.compareTwoStrings(a.title, query);
          });
          //push to search results cache
          db.ref(`9anime-search-results/${query}`).set({results: similaritySorted});
          //remove index
          db.ref(`9anime-search-requests/${snapshot.key}`).remove();
        })
      }, (err, res) => {
        console.log(err);
      });
  });

  //reference for scrape requests
  let scrapeRequests = db.ref('scrape-requests');
  scrapeRequests.on('child_added', (snapshot) => {
    console.log(snapshot.val());
    db.ref(`scrape-request/${snapshot.key}`).remove();
  });
}

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();