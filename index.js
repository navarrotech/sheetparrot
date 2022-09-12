import { URL } from 'url';
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import express      from 'express'
import session      from 'express-session'
import cookieParser from 'cookie-parser'
import bodyParser   from 'body-parser'
import helmet       from 'helmet'
import MongoStore   from 'connect-mongo'
import compression  from 'compression'
import minifyHTML   from 'express-minify-html'

import accounts     from './routes/accounts.js'
import billing      from './routes/billing.js'
import adminConsole from './routes/console.js'
import dashboard    from './routes/dashboard.js'
import folders      from './routes/folders.js'
import grader       from './routes/grader.js'
import home         from './routes/home.js'
import misc         from './routes/misc.js'
import sheets       from './routes/sheets.js'
import webhooks     from './routes/webhooks.js'

import {
    database, amazon, sendgrid, tools, authorization
} from './utility.js'

const {
    PORT:port=8080,
    DOMAIN:domain=`localhost:8080`
} = process.env

const __dirname = new URL('.', import.meta.url).pathname;
const rootDomain = domain.replaceAll('http://', '').replaceAll('https://', '')

const app = express()

database
    .connect()
    // Always redirect http to https
    .then(() => {
        if(domain && !domain.includes('localhost')){
            app.use('*', function(req, res, next) { req.secure ? next() : res.redirect('https://' + rootDomain + req.url) })
        }
    })
    // Middlewares
    .then(() => {
        app.set( "view engine", "squirrelly" )
        app.set( "views", `views` )
        app.enable('trust proxy')

        app.use(compression())

        app.use( bodyParser.urlencoded({ extended: true }) )
        app.use(express.json())
        app.use(bodyParser.json({ limit: '5mb' }))
        app.use(function(err, req, res, next) {
            if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
              // do your own thing here 👍
              res.status(400).send({ code: 400, message: "Bad request: Please check your JSON body payload" }); return;
            } else next();
        });
        
        app.use(cookieParser())
        app.use( helmet({contentSecurityPolicy: false}) )

        if(process.env.NODE_ENV == "production"){
            app.use(minifyHTML({
                override:      true,
                exception_url: false,
                htmlMinifier: {
                    removeComments:            true,
                    collapseWhitespace:        true,
                    collapseBooleanAttributes: true,
                    removeAttributeQuotes:     false,
                    removeEmptyAttributes:     false,
                    minifyJS:                  false
                }
            }));
        }
    })
    // Static public directory
    .then(() => {
        app.use(
            express.static(`${__dirname}/public`, {
                maxAge: 1000 * 60 * 24,
                setHeaders:function(r,p) {
                    r.setHeader("Expires", new Date(Date.now() + 1000*60*24).toUTCString());
                }
            })
        )
    })
    // Session management
    .then(() => {
        const mongoSessionStore = MongoStore.create({
            mongoUrl: database.getURI(),
            ttl: 24 * 60 * 60 * 24, // = 1 day. Default
            autoRemove: 'native', // Default
            collectionName: 'mongo-sessions',
            stringify:false,
            //crypto: { secret: 'FieRazXRjkeHiucpjjBmmauaxBBMNJYk' }
        });

        app.use(session({
            secret: 'FieRazXRjkeHiucpjjBmmauaxBBMNJYk',
            name: 'sheetparrot_sid',
            resave: true, // Save even if nothing is changed
            saveUninitialized: false, // Save even if nothing has been set in req.session yet
            rolling: true,
            cookie: {
                secure: 'auto',
                httpOnly: true,
                //domain:'www.sheetparrot.com',
                sameSite: true,
                maxAge: 1000 * 60 * 60 * 6 // 6 hours
            },
            store: mongoSessionStore
        }))
    })
    // Lexicon
    .then(() => {
        app.use((req, res, next) => {

            /* Lexicon: Which page are we about to load? */
            let requesting_page = req.originalUrl.toLowerCase()
            if(requesting_page.includes("?"))
                requesting_page = requesting_page.substring(0, requesting_page.indexOf("?"))
            if(requesting_page.includes("#"))
                requesting_page = requesting_page.substring(0, requesting_page.indexOf("#"))
    
            req.lexicon = {
                domain:(process.env.NODE_ENV == "production" ? (process.env.DOMAIN) : `http://localhost:${ process.env.PORT || 8080 }`),
                ENV:process.env,
                css_version:(new Date().toLocaleDateString()).replaceAll('/','_'),
                dir:__dirname,
                RAYGUN_API_KEY:process.env.RAYGUN_API_KEY,
                url:req.url,
                requesting_page
            }
    
            if(req.session && req.session.user){
    
                if(req.session.user.email){
                    req.session.user.email = req.session.user.email.toLowerCase()
                    req.authorized = true;
                }
                req.lexicon.user = req.session.user
                req.lexicon.authorized = true
    
                req.user_plan = tools.getDeepObjectAttribute(req.session.user, ["preferences","billing","plan"])
                if(req.user_plan){ req.user_plan = String(req.user_plan).toLowerCase() }
    
            }
            else{
                req.lexicon.authorized = false;
            }
            
            // For admin's assuming an identity "login as" feature
            if(req.session.admin_identity){ req.lexicon.admin_identity = true }
    
            next()
        })
    })
    // Create routes
    .then(() => {
        const utility = { database, amazon, sendgrid, tools, authorization }
        
        // Initialize each route
        accounts(app, utility);
        billing(app, utility);
        adminConsole(app, utility);
        dashboard(app, utility);
        folders(app, utility);
        grader(app, utility);
        home(app, utility);
        misc(app, utility);
        sheets(app, utility);
        webhooks(app, utility);
    
        // Final 404 pages
        app.get('*', (req, res) => res.redirect('/'))
        app.post('*', (req, res) => res.sendStatus(404))
    })
    // Start the server
    .then(() => {
        console.log("Connected to Database!")
        app.listen(port, () => console.log(`[Server] :: Running (${domain})`))
    })

// Error handling
process.on('uncaughtException', async (err) => {
    console.log(':: Uncaught exception: ' + err);
    console.error(err.stack);

    if(process.env.NODE_ENV === "production"){
        await sendgrid.send_dynamic_template({
            templateId:sendgrid.TEMPLATES.ADMIN_ALERTS.ERROR,
            templateData:{
                error_report:err.toString(),
                crash_date:new Date().toLocaleString()
            },
            toWhom:'alex@navarrocity.com' // process.env.ADMIN_NOTIFICATIONS_EMAIL
        })
    }
    process.kill(process.pid, 'SIGINT')
});