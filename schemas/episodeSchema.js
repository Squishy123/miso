const mongoose = require('mongoose');
const Source = require('./sourceSchema.js');

let EpisodeSchema = new mongoose.Schema({
    id: Number,
    title: String, 
    sources: [{player: String, url: String, quality: String}],
})

module.exports = mongoose.model('Episode', EpisodeSchema)