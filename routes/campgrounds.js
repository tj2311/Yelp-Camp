const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const multer = require('multer');
const { storage } = require('../cloudinary'); // do not need to write cloudinary/index as node automatically looks for index.js file
const upload = multer({ storage });
const { cloudinary }= require('../cloudinary');
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding')
const mapBoxToken = process.env.MAPBOX_TOKEN;
const geoCoder = mbxGeocoding({accessToken: mapBoxToken});

 

const { isLoggedIn,validateCampground, isAuthor } = require('../middleware');


const Campground = require('../models/campground');



router.get('/', catchAsync(async (req, res) => {
    const campgrounds = await Campground.find({});
    res.render('campgrounds/index', { campgrounds })
}));

router.get('/new', isLoggedIn, (req, res) => { // getting from to create a new campground if you are logged in 
   
    res.render('campgrounds/new');
})


router.post('/', isLoggedIn, upload.array('image'), validateCampground, catchAsync(async (req, res, next) => { // creating new campground
    // if (!req.body.campground) throw new ExpressError('Invalid Campground Data', 400);
    const geoData = await geoCoder.forwardGeocode({
        query: req.body.campground.location,
        limit: 1
    }).send()
    const campground = new Campground(req.body.campground);
    campground.geometry = geoData.body.features[0].geometry;
    campground.images = req.files.map(f => ({url: f.path, filename: f.filename}))
    campground.author = req.user._id;
    await campground.save();
    
    req.flash('success', 'Successfully made a new campground!');
    res.redirect(`/campgrounds/${campground._id}`)
}))

router.post(('/'), upload.array('image'), (req , res) =>{
    console.log(req.body,req.files);
    res.send('It worked')
})

router.get('/:id', catchAsync(async (req, res,) => { // show page for specific campground
    const campground = await Campground.findById(req.params.id).populate({
        path: 'reviews', // nested populate. populates reviews first and then its authors
        populate: {
            path: 'author'
        }
    }).populate('author');
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/show', { campground });
}));

router.get('/:id/edit', isLoggedIn, isAuthor, catchAsync(async (req, res) => { // getting edit form
    const { id } = req.params;
    const campground = await Campground.findById(id)
    if (!campground) {
        req.flash('error', 'Cannot find that campground!');
        return res.redirect('/campgrounds');
    }
    res.render('campgrounds/edit', { campground });
}))

router.put('/:id', isLoggedIn, isAuthor, upload.array('image'), validateCampground, catchAsync(async (req, res) => { // update
     
    const { id } = req.params;
    
    const campground = await Campground.findByIdAndUpdate(id, { ...req.body.campground });
    const imgs = req.files.map(f => ({url: f.path, filename: f.filename})) // imgs is an array
    campground.images.push(...imgs) // we want to only add the elements of imgs array not array itself so we use spread operator (...)
    await campground.save()
    if (req.body.deleteImages){
        for(let filename of req.body.deleteImages){
           await cloudinary.uploader.destroy(filename); // deletes images from cloudinary
        }
        await campground.updateOne({$pull: {images:{ filename: {$in: req.body.deleteImages}}}}) // deletes images from mongoDb
        
    }
    req.flash('success', 'Successfully updated campground!');
    res.redirect(`/campgrounds/${campground._id}`)
}));

router.delete('/:id', isLoggedIn, catchAsync(async (req, res) => {
    const { id } = req.params;
    await Campground.findByIdAndDelete(id);
    req.flash('success', 'Successfully deleted campground')
    res.redirect('/campgrounds');
}));

module.exports = router;