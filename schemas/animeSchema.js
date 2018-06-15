const mongoose = require('mongoose');
const Episode = require('./episodeSchema.js');
const Source = require('./sourceSchema.js');

let AnimeSchema = new mongoose.Schema({
    id: Number,
    episodes: [{type: mongoose.Schema.Types.ObjectId, ref: 'Episode', episodeNumber: Number}],
    scrapeDate: Date
})

AnimeSchema.pre('save', function(next) {
    this.scrapeDate = new Date();
    next();
})
/**
 * Find an anime by title
 * @param {String} title 
 * @param {Function} cb 
 */
AnimeSchema.statics.findByTitle = function(title, cb) {
    return this.find({title: new RegExp(title, 'i')}, cb);
}

module.exports = mongoose.model('Anime', AnimeSchema)