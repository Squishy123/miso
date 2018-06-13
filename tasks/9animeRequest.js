const async = require('async');
const retry = require('async-retry');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const scrape = require('9anime-scraper')

//proxy
const proxyList = require('../proxyList.json');
const proxySettings = require('../proxySettings.json')

//schemas
const Anime = require('../schemas/animeSchema.js');
const Episode = require('../schemas/episodeSchema.js');

const threads = 8;

async function package(url, index, browser, an) {
    let page = await scrape.initPage(browser);
    //await page.authenticate({ username: 'peter@packp.net', password: 'gnawwang' });
    let player = await scrape.getPlayer(page, url);
    let sources = [];
    sources.push({ player: `${player}&q=1080p`, quality: "1080p" })

    let ep = new Episode({ id: index, sources: sources })
    await ep.save((err) => {
        if (err) console.log(err);
        console.log("Saved Episode Successfully!")
    });
    await Anime.findOneAndUpdate({ _id: an._id }, { $addToSet: { episodes: ep } }, (err) => {
        if (err) console.log(err)
    });
    await an.save();
    await Anime.findOne({ title: an.title })
        .populate('episodes')
        .exec((err, a) => {
            if (err) console.log(err);
        })
    await page.close();
}

module.exports = {
    scrapeURL: async (url, title) => {
        console.log(url);
        let start = new Date();
        let browser, page, sources;
        await retry(async () => {
            browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: true })//, args: [`--proxy-server=http://${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`] });
            page = await scrape.initPage(browser);
            //await page.authenticate({username: proxySettings.username, password: proxySettings.password});
        }, { retries: 100 });
        [sources, ...rest] = await Promise.all([new Promise((resolve, reject) => {
            scrape.getSource(url, null, (sources) => {
                resolve(sources);
            })
        }), page.goto(url, { waitUntil: "domcontentloaded" })]);

        if (!title) {
            let title = await page.evaluate(() => {
                return document.querySelector('#main > div > div.widget.player > div.widget-title > h1').innerHTML;
            });
        }
        await page.close();

        await Anime.findOne({ title: title }, (err, a) => {
            let an;
            //Using rapidvideo sources 
            //for scrapes
            let scrapeSources = []
            if (a) {
                an = a;
                //check if there are new sources 
                if (sources[0].sourceList.length > an.episodes.length) {
                    scrapeSources = sources[0].sourceList.slice(an.episodes.length - 1, an.episodes.length + (sources[0].sourceList.length - an.episodes.length) - 1)
                }
            } else {
                an = new Anime({ title: title });
                an.save((err) => {
                    if (err) console.log(err);
                    console.log("Saved Anime Successfully!")
                });
                scrapeSources = sources[0].sourceList;
            }

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
            async.each(scrapeSources, (s) => {
                puppet.push({ func: package, args: [`https://www5.9anime.is/${s.href}`, s.index, browser, an] }, () => { return console.log("Completed task!") })
            });
        });
    }
}

