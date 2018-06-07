const Hapi = require('hapi');

const mongoose = require('mongoose');

//For task management
const async = require('async');
const retry = require('async-retry');
let taskQueue, taskLimit = 5;

//Scrapers
const nineAnimeScraper = require('9anime-scraper');

//Tasks
const nineAnimeRequest = require('./tasks/9animeRequest.js');

//schemas
const Anime = require('./schemas/animeSchema.js');

//Proxy Properties
const proxySettings = require('./proxySettings.json');
const proxyList = require('./proxylist.json');

const server = Hapi.server({
    port: 8000,
    host: 'localhost'
});

const io = require('socket.io')(server.listener);

io.on('connection', function (socket) {
    console.log('Socket Connected!')
});

const edge = io.of('/api/edge');

edge.on('connection', (socket) => {
    console.log("Connected to API socket")
    socket.on('/anime', (query) => {
        Anime.find(query, (err, animes) => {
            if (err) return edge.emit(`animes/${query.title}`, err);
            if (animes.length == 0) return edge.emit(`animes/${query.title}`, null)
            return api.emit(`animes/${query.title}`, animes);
        })
    });
    socket.on('/episodes', (query) => {
        Episode.find(query, (err, episodes) => {
            if (err) return api.emit(`episode/${query._id}`, err)
            if (!e) return api.emit(`episode/${query._id}`, null)
            return api.emit(`episode/${query._id}`, e);
        })
    });
});

const nineAnime = io.of('/source/9anime');

nineAnime.on('connection', (socket) => {
    console.log("Connected to 9anime socket!")
    socket.on('search/anime', (query) => {
        console.log("COpy That");
        if(query)
            async.retry({times: 100}, 
            (cb, results) => {
                //nineAnimeScraper.getSearch(query.keyword, `http://${proxySettings.username}:${proxySettings.password}@${proxyList[Math.floor(Math.random() * Math.floor(proxyList.length))]}:80`, (res) => {
                    nineAnimeScraper.getSearch(query.keyword, null, (res) => {
                if(res instanceof Error)
                        cb(new Error("Tunnel Failed"));
                    else return nineAnime.emit(`search/${query.keyword}`, [res]);
                })
            }, (err, res) => {
                console.log(err);
            });
    });

    socket.on('/request', (query) => {
        if(query)
            taskQueue.push({func: nineAnimeRequest.scrapeURL(), args: [query.url, query.title]}, () => {console.log(`Finished scraping ${query.title}`)});
    })
})

server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
        return 'Hello World!';
    }
});

const init = async () => {
    await server.start();
    console.log(`Server running at ${server.info.uri}`);

    // database setup
    mongoose.connect("mongodb://localhost:27017/media").then(() => {
        console.log("Connection to database successful!")
    }).catch(err => console.log(err))

    //setup task manager
    taskQueue = async.queue(async(task, callback) => {
        console.log(`Running Task`)
        await task.func.apply(null. task.args);
        callback();
    }, taskLimit);

    taskQueue.saturated = () => {
        console.log(`Waiting for current tasks to complete...`)
    }
};

process.on('unhandledRejection', (err) => {
    console.log(err);
    process.exit(1);
});

init();