if(process.env.NODE_ENV !== "production"){
    require('dotenv').config();
}

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const ExpressError = require('./utils/ExpressError');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const mongoSanitize = require('express-mongo-sanitize');
const helmet = require('helmet');
const dbUrl =  process.env.DB_URL;


const campgroundsRoutes = require('./routes/campgrounds');
const reviewsRoutes = require('./routes/reviews');
const userRoutes = require('./routes/users');

const MongoDBStore = require("connect-mongo")(session);



mongoose.connect(dbUrl, { // connects to database
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});

const app = express();

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method')); // used to override form to be able to send requests other than just post reqs
app.use(express.static(path.join(__dirname, 'public')))
app.use(mongoSanitize());
app.use(helmet({contentSecurityPolicy: false}));


const store = new MongoDBStore({
    url: dbUrl,
    secret: 'thisshouldbeasecret!',
    touchAfter: 24 * 60 * 60,
})

store.on("error", function(e){
    console.log("session store errors")
})
const sessionConfig = {
    store,
    secret: 'thisshouldbeabettersecret!',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}
app.use(session(sessionConfig));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser()); // store user in session
passport.deserializeUser(User.deserializeUser()); // de-store user in session

app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user; // allows access to currentUser accross all templates
    next();
})
// In Express.js, res.locals is an object that provides a way to pass data through the application during the request-response cycle. 
// It allows you to store variables that can be accessed by your templates and other middleware functions.

app.get('/fakeUser', async (req, res) => {
    const user = new User({email: 'tejas@gmail.com', username: 'tejas'});
    const newUser = await User.register(user, 'chicken'); // creates new user object "chicken" is the password
    res.send(newUser);
})

app.use('/campgrounds', campgroundsRoutes); // using express router
app.use('/campgrounds/:id/reviews', reviewsRoutes);
app.use('/', userRoutes);

app.get('/', (req, res) => {
    res.render('home')
});


app.all('*', (req, res, next) => { // Error 404
    next(new ExpressError('Page Not Found', 404))
})

app.use((err, req, res, next) => { // Error handler
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err })
})

app.listen(3000, () => {
    console.log('Serving on port 3000')
})


