const scraper = require('masterani-scraper')

const async = require('async');

//env
require('dotenv').config()

//proxy
const proxyList = require('../proxyList.json');


const HttpsProxyAgent = require('https-proxy-agent');

//threads
const threads = 4;

module.exports = {
    scrapeURL: async (searchAnime, kitsuID, db) => {
        let start = new Date();
        let proxy = `http://${process.env.PROXY}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`
        //let agent = new HttpsProxyAgent(proxy);
        let agent = require('proxying-agent').create(proxy, "https://masterani.me")

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
            let src = await scraper.getSources(searchAnime.slug, episodeNumber, { method: 'GET' });
            console.log(src)
            db.ref(`scrape-results/${kitsuID}/episodes/${episodeNumber}`).set(src);
        }

        await new Promise((resolve) => {
            //scraper.getSources(searchAnime.slug, { method: 'GET'}).then(async(sources) => {
            scraper.getMeta(searchAnime.id, { method: 'GET' }).then((meta) => {
                episode_count = (meta.info.episode_count) ? meta.info.episode_count : meta.episodes.length;
                //check if there are new episodes and append them if so
                db.ref(`scrape-results/${kitsuID}/episodes`).once('value').then((snapshot) => {
                    if (snapshot.val()) {
                        let currentEpLength = Object.values(snapshot.val()).length;
                        if (episode_count >= currentEpLength) {
                            let scrapeSources = [];
                            for (let i = currentEpLength; i <= episode_count; i++) {
                                scrapeSources.push(i);
                            }
                            resolve(scrapeSources);
                        }
                    }
                    let a = []
                    for(let i = 1; i <= episode_count; i++) {
                        a.push(i);
                    }
                    resolve(a);
                });
            });
        }).then((sources) => {
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
