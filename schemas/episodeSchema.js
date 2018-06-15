const mongoose = require('mongoose');
const Source = require('./sourceSchema.js');

let EpisodeSchema = new mongoose.Schema({
    id: Number,
    episodeNumber: Number,
    sources: [{player: String, provider: String}],
})

module.exports = mongoose.model('Episode', EpisodeSchema)