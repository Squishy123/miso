const scraper = require('masterani-scraper')

const async = require('async');

//env
require('dotenv').config()

//proxy
const proxyList = require('../proxyList.json');

//threads
const threads = 4;

module.exports = {
    scrapeURL: async (searchAnime, db) => {
        let start = new Date();
        let proxy = `http://${process.env.PROXY}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}`;


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
            console.log(`Execution Completed: ${new Date() - start}ms`);
        }


        async function package(episodeNumber, db) {
            console.log(episodeNumber);
            let src = await scraper.getSources(searchAnime.slug, episodeNumber,  { proxy: proxy, port: 80, method: 'GET'});
            db.ref(`scrape-results/${searchAnime.title}/episodes/${episodeNumber}`).set(src);
        }

        await new Promise((resolve) => {
            scraper.getSources(searchAnime.slug, { proxy: proxy, port: 80, method: 'GET'}).then(async(sources) => {
                let meta = await scraper.getMeta(searchAnime.id, { proxy: proxy, port: 80, method: 'GET'});
                //check if there are new episodes and append them if so
                db.ref(`scrape-results/${searchAnime.title}/episodes`).once('value').then((snapshot) => {
                    if (snapshot.val()) {
                        let currentEpLength = Object.values(snapshot.val()).length;
                        if (meta.episode_count >= currentEpLength) {
                            let scrapeSources = [];
                            for (let i = currentEpLength; i <= meta.episode_count; i++) {
                                scrapeSources.push(i);
                            }
                            resolve(i);
                        }
                    }
                    console.log(meta);
                    let a = new Array();
                    a.fill((1, meta.episode_count));
                    resolve(a);
                });
            });
        }).then((sources) => {
            console.log(sources);
            if (sources && !sources.length) {
                console.log("No new episodes found!");
            } else {
                async.each(sources, (s) => {
                    puppet.push({ func: package, args: [s, db] })
                });
            }
        });
    }
}
