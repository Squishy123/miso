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

mongoose.connect("mongodb://localhost:27017/media").then(() => {
    console.log("Connection to database successful!")
}).catch(err => console.log(err))

async function main () {
    let title, url ="https://www5.9anime.is/watch/neon-genesis-evangelion-dub.yk0z/x6kxv3"
    let start = new Date();
           let browser, page, sources;
           await retry(async() => {
               console.log("retry")
               browser = await puppeteer.launch({headless: false, ignoreHTTPSErrors: true});
               page = await scrape.initPage(browser);
               //await page.authenticate({username: proxySettings.username, password: proxySettings.password});
               sources = await new Promise((resolve, reject) => {scrape.getSource(url, null, (sources) => {
                   resolve(sources);
                })});
                await page.goto(url, { waitUntil: "domcontentloaded" });
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
   
                   async function package(ur, index) {
                       let p = await scrape.initPage(browser);
                       await p.goto(url, { waitUntil: "domcontentloaded" });
                       await p.click('#player')
                        try {
                            await page.waitForSelector('#player > iframe');
                        } catch (err) { }
                        let player = await p.evaluate(() => {
                            return document.querySelector('#player > iframe').src;
                        })
                       //await p.authenticate({ username: 'peter@packp.net', password: 'gnawwang' });
                       let s = [];
                       s.push({ player: `${player}&q=360p`, quality: "360p" })
                       s.push({ player: `${player}&q=480p`, quality: "480p" })
                       s.push({ player: `${player}&q=720p`, quality: "720p" })
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
                   async.each(sources[0].sourceList, (s) => {
                       puppet.push({ func: package, args: [s.href, s.index] }, () => { console.log("Completed task!") })
                   });
               }
           });
   }

   main();