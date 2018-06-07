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

const threads = 4;

module.exports = {
    scrapeURL: async (url, title) => {
        let start = new Date();
        let browser, page, sources;
        await retry(async() => {
            browser = await puppeteer.launch({headless: true, ignoreHTTPSErrors: true, args: [`--proxy-server=http://${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`] });
            page = await scrape.initPage(browser);
            await page.authenticate({username: proxySettings.username, password: proxySettings.password});
            sources = await scrape.getSource(url, null, (sources) => {
                return sources;
            });
            console.log(sources);
        }, {retries: 100});
        
        if (!title) {
            let title = await page.evaluate(() => {
                return document.querySelector('#main > div > div.widget.player > div.widget-title > h1').innerHTML;
            });
        }
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

                async function package(url, index) {
                    let page = await scrape.initPage(browser);
                    await page.authenticate({ username: 'peter@packp.net', password: 'gnawwang' });
                    let player = await scrape.getPlayer(page, url);
                    let sources = [];
                    sources.push({ player: `${player}&q=360p`, quality: "360p" })
                    sources.push({ player: `${player}&q=480p`, quality: "480p" })
                    sources.push({ player: `${player}&q=720p`, quality: "720p" })
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
                async.each(sources[0].sourceList, (s) => {
                    puppet.push({ func: package, args: [s.href, s.index] }, () => { console.log("Completed task!") })
                });
            }
        });
    }
}