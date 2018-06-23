const async = require('async');
const retry = require('async-retry');
const puppeteer = require('puppeteer');
const scrape = require('9anime-scraper')

//proxy
const proxyList = require('../proxyList.json');
const proxySettings = require('../proxySettings.json')

//threads
const threads = 4;

module.exports = {
    scrapeURL: async (url, title, db) => {
        return await new Promise(async (re, rej) => {
            let start = new Date();
            let browser, anime, sources, headers = new Map();
            //login with proxy and get all scrape sources
            await new Promise((resolve, reject) => {
                retry(async (bail) => {
                    browser = await puppeteer.launch({
                        headless: true, ignoreHTTPSErrors: true, args: [
                            `--proxy-server=http://${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`]
                    });
                    //authenticate at first
                    let page = await browser.newPage();
                    
                    try {
                        await page.authenticate({ username: proxySettings.username, password: proxySettings.password })
                    } catch (err) {
                        console.log(err)
                        return;
                    }
                    try {
                    await page.goto('https://www6.9anime.is', { waitUntil: "domcontentloaded" })
                    } catch (err) {
                        console.log(err)
                        await browser.close();
                    }
                    //await page.close();
                    resolve();

                }, { retries: 100 })
            });

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
                    console.log(`Execution Completed: ${new Date() - start}ms`);
                    re();
                })();
            }


            async function package(url, index, browser, anime, db, headers) {
                console.log(index);
                let page = await browser.newPage();
                //await page.authenticate({ username: proxySettings.username, password: proxySettings.password });
                //await page.setExtraHTTPHeaders(headers);
                let player = await scrape.getPlayer(page, url);
                await page.close();

                let episode = { source: player };

                db.ref(`scrape-results/${anime.title}/episodes/${index}`).set(episode);
            }

            await new Promise((resolve, reject) => {
                scrape.getSource(url, null, (sources) => {
                    //check if there are new episodes and append them if so
                    db.ref(`scrape-results/${anime.title}/episodes`).once('value').then((snapshot) => {
                        if (snapshot.val()) {
                            let currentEpLength = Object.values(snapshot.val()).length;
                            if (sources[0].sourceList.length >= currentEpLength) {
                                let scrapeSources = sources[0].sourceList.slice(currentEpLength);
                                resolve(scrapeSources);
                            }
                        }
                        resolve(sources[0].sourceList);
                    });
                });
            }).then((sources) => {
                if (!sources.length) {
                    console.log("No new episodes found!");
                    (async () => {
                        await browser.close();
                        re();
                    })();
                }
                async.each(sources, (s) => {
                    puppet.push({ func: package, args: [`https://www6.9anime.is${s.href}`, s.index, browser, anime, db] })
                });
            });
        })
    }
}