const async = require('async');
const retry = require('async-retry');
const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const scrape = require('9anime-scraper')

//proxy
//const proxyList = require('../proxylist.json');
//const proxySettings = require('../proxySettings.json')

//schemas
const Anime = require('../schemas/animeSchema.js');
const Episode = require('../schemas/episodeSchema.js');

const threads = 4;


mongoose.connect("mongodb://localhost:27017/media").then(() => {
    console.log("Connection to database successful!")
}).catch(err => console.log(err))

/*
async function package(url, index, browser, an) {
    console.log(`${url} ${index}`)
    let p = await scrape.initPage(browser);
    let player = await scrape.getPlayer(p, url);
    console.log(player);

    let s = [];
    s.push({ player: `${player}&q=1080p`, quality: "1080p" })

    let ep = new Episode({ id: index, sources: s })
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
    await p.close();
}


async function main() {
    let title, url = "https://www5.9anime.is/watch/neon-genesis-evangelion-dub.yk0z/x6kxv3"
    let start = new Date();
    let browser, page, sources;
    await retry(async () => {
        console.log("retry")
        browser = await puppeteer.launch({ headless: true, ignoreHTTPSErrors: false });
        page = await scrape.initPage(browser);
        //await page.authenticate({username: proxySettings.username, password: proxySettings.password});
        sources = await new Promise((resolve, reject) => {
            scrape.getSource(url, null, (sources) => {
                resolve(sources);
            })
        });
    }, { retries: 100 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    title = await page.evaluate(() => {
        return document.querySelector('#main > div > div.widget.player > div.widget-title > h1').innerHTML;
    });
    console.log(title);
    await page.close();

    await Anime.findOne({ title: title }, (err, a) => {
        if (a) {
            let an = a;
        } else {
            let an = new Anime({ title: title });
            an.save((err) => {
                if (err) console.log(err);
                console.log("Saved Anime Successfully!")
            });

            console.log("Running Task Now!")
            let numTask = 0;
            let puppet = async.queue((task, callback) => {
                numTask++;
                console.log(`task: ${numTask}`)
                task.func.apply(null, task.args).then(() => {
                    callback();
                })
            }, threads)

            puppet.saturated = () => {
                console.log("Waiting for current tasks to complete...")
            }

            puppet.drain = () => {
                console.log("All tasks completed!");
                browser.close().then(() => {
                    console.log(`Execution Completed: ${new Date() - start}ms`);
                });
            }

            async.each(sources[0].sourceList, (s) => {
                puppet.push({ func: package, args: [`https://www5.9anime.is/${s.href}`, s.index, browser, an] }, () => { return console.log("Completed task!") })
            });
        }
    });
}

//main();*/

const request = require('./9animeRequest.js');
(async() => {
    await request.scrapeURL("https://www5.9anime.is/watch/neon-genesis-evangelion-dub.yk0z/x6kxv3")
})();
