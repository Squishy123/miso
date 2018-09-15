//firebase stuff
const admin = require('firebase-admin');
const serviceAccount = require("./amine-7eb29-firebase-adminsdk-b3cu9-4b3d779435.json");

//env
require('dotenv').config()

//async
const async = require('async');

//Scrapers
const scraper = require('masterani-scraper');

//Tasks
const masterAnimeRequest = require('./tasks/masteranimeRequest-firebase.js');


const HttpsProxyAgent = require('https-proxy-agent');

//Proxy Properties
const proxyList = require('./proxyList.json');

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
  }, 1);

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
  let db = admin.database();;

  //ref for masteranime search requests
  let masteranimeSearchRequests = db.ref('search-requests');

  masteranimeSearchRequests.on('child_added', async (snapshot) => {
    let query = snapshot.val();
    let proxy = `http://${process.env.PROXY}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`
    let agent = new HttpsProxyAgent(proxy);
    let res = await scraper.getSearch(query, { agent: agent, method: 'GET' })
    console.log(res);
    //push to search results cache
    db.ref(`search-results/${query}`).set({ results: res });
    //remove index
    db.ref(`search-requests/${snapshot.key}`).remove();
  })

  //reference for scrape requests
  let scrapeRequests = db.ref('scrape-requests');
  scrapeRequests.on('child_added', (snapshot) => {
    db.ref(`search-results/${snapshot.val()}`).once('value', sh => {
      let query = sh.val();
      if (query) {
        let data = query.results[0];
        taskQueue.push({ func: masterAnimeRequest.scrapeURL(data, db), args: [data, db] }, () => { db.ref(`scrape-requests/${snapshot.key}`).remove(); return console.log(`Scraping ${data.title}`) });
      } else {
        let proxy = `http://${process.env.PROXY}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`
        let agent = new HttpsProxyAgent(proxy);
        scraper.getSearch(snapshot.val(), { method: 'GET' })
          .then((res) => {
            
            console.log(res);
            //push to search results cache
            db.ref(`search-results/${snapshot.val()}`).set({ results: res });

            taskQueue.push({ func: masterAnimeRequest.scrapeURL(res[0], db), args: [res[0], db] }, () => { db.ref(`scrape-requests/${snapshot.key}`).remove(); return console.log(`Scraping ${res[0].title}`) });
          }).catch((err) => {
            console.log(err);
          })
      }
    });
  });
}

process.on('unhandledRejection', (err) => {
  console.log(err);
  process.exit(1);
});

init();
