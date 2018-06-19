const async = require('async');
const retry = require('async-retry');
const puppeteer = require('puppeteer');
const scrape = require('9anime-scraper')

//proxy
const proxyList = require('../proxyList.json');
const proxySettings = require('../proxySettings.json')

//threads
const threads = 8;

//firebase stuff
/*
const admin = require('firebase-admin');
const serviceAccount = require("../amine-7eb29-firebase-adminsdk-b3cu9-4b3d779435.json");

//init firebase
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://amine-7eb29.firebaseio.com",
    databaseAuthVariableOverride: {
        uid: 'miso'
    }
});

//setup database
let db = admin.database();*/

async function package(url, index, browser, anime, db) {
    let page = await scrape.initPage(browser);
    //await page.authenticate({ username: proxySettings.username, password: proxySettings.password });
    let player = await scrape.getPlayer(page, url);
    await page.close();

    /*
    let episode = { id: index, source: player };
    console.log(episode);

    //push to episode
    let ref = db.ref(`scrape-results/${anime.title}/episodes`).push();
    ref.set(episode);*/
    let episode = {source: player};
    db.ref(`scrape-results/${anime.title}/episodes/${index}`).set(episode);
}

module.exports = {
    scrapeURL: async (url, title, db) => {
        let start = new Date();
        let browser, page, anime, sources;

        //login with proxy and get all scrape sources
        //await retry(async () => {
            browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true})//, args: [`--proxy-server=http://${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`] });
            page = await scrape.initPage(browser);
           // await page.authenticate({ username: proxySettings.username, password: proxySettings.password });
      //  }, { retries: 100 });
        [sources, ...rest] = await Promise.all([new Promise((resolve, reject) => {
            scrape.getSource(url, null, (sources) => {
                resolve(sources);
            })
        }), page.goto(url, { waitUntil: "domcontentloaded" })]);

        //new anime object
        anime = { title: title };

        let numTask = 0;
        let puppet = async.queue(async (task, callback) => {
            numTask++;
            console.log(`task: ${numTask}`)
            await task.func.apply(null, task.args)
            callback();
        }, threads)

        puppet.saturated = () => {
            console.log("Waiting for current tasks to complete...")
        }

        puppet.drain = () => {
            console.log("All tasks completed!");
            (async () => {
                await browser.close();
            })();
            console.log(`Execution Completed: ${new Date() - start}ms`);
        }
        async.each(sources[0].sourceList, (s) => {
            puppet.push({ func: package, args: [`https://www6.9anime.is${s.href}`, s.index, browser, anime, db] }, () => { return console.log("Completed task!") })
        });
    }
}