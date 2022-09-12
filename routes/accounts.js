import multer from 'multer'
import fs from 'fs'
import twofactor from "node-2fa"
import rateLimit from "express-rate-limit"

import User from '#objects/User.js'
import StringLimits from '#root/limits.json' assert { type: 'json' }

import { OAuth2Client } from 'google-auth-library'
import Facebook from 'fb'

const upload = multer({ dest: 'tmp/' })
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default function(app, { database, sendgrid, amazon, authorization }){

    app.get('/login', (req, res) => {
        try{
            let redirect = req.query.redirect ||  req.cookies['redirect_after_login'] || '/dashboard'

            if(req.query.redirect)
                res.cookie('redirect_after_login', redirect, 0)

            req.lexicon.logout_reason = req.query.status || req.cookies['logout_reason']

            if(req.cookies['logout_reason']){
                // Delete the cookie if it exists, because we've already got it in the lexicon now.
                res.cookie('logout_reason', '', 0)
            }

            if( req.authorized ){
                res.redirect(redirect)
            }
            else {
                req.session.loginredirecter = req.query.redirect
                res.render('authorization/login', req.lexicon)
            }
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/signup', (req, res) => {
        try{
            if(req.authorized){ res.redirect('/dashboard'); return; }
            res.render('authorization/signup', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    app.post('/login/:method',
        rateLimit({ windowMs: 5 * 60 * 1000, max:15, message:{ message:"You have had too many login attempts in a row, please try again in a few minutes." } }),
        async (req, res) => {
            try{

                /* 
                * Redirect priority: 
                * 1. Redirect to ?redirect=[]
                * 2. Redirect to cookie redirect value
                * 3. Redirect to /dashboard as default
                */

                let redirect = req.query.redirect || ((req.cookies && req.cookies.redirect_after_login) ? req.cookies.redirect_after_login : '/dashboard') || '/dashboard'

                let { email, password, token, code } = req.body,
                    { method } = req.params

                email = email?email.toLowerCase():'';

                let whitelist = ["native", "facebook", "google"]
                if(!method || !whitelist.includes(method)){ method = whitelist[0] }


                // First, we need to validate that their email is legit!
                let validated = false,
                    user;

                switch(method){
                    case "facebook":
                        if(!token){
                            res.status(400);
                            res.send({
                                message:"Please provide a token to login with Facebook"
                            }); return;
                        }
                        let get_access_token = await Facebook.api('oauth/access_token', {
                            client_id: process.env.FACEBOOK_APP_ID,
                            client_secret: process.env.FACEBOOK_APP_SECRET,
                            grant_type: 'client_credentials'
                        });
                        if(!get_access_token || get_access_token.error){
                            console.log('New Facebook Error!'); console.log(get_access_token.error);
                            res.status(500); res.send({
                                message:`Facebook error: ${get_access_token.error}`
                            }); return;
                        }
                        
                        let access_token = get_access_token.access_token

                        let debug_token = await Facebook.api('debug_token', {
                            access_token,
                            input_token:token
                        })

                        if(debug_token && debug_token.data && debug_token.data.is_valid){
                            validated = true;
                            try{
                                let user_info = await Facebook.api('me', { fields: ['email'], access_token:token })
                                if(user_info && user_info.email){
                                    email = user_info.email
                                }
                                user = await database.dynamic_call({
                                    collection:'users', method:'findOne',
                                    query:{ fb_user_id:debug_token.data.user_id }
                                })
                                if(!user && email){
                                    user = await database.dynamic_call({
                                        collection:'users', method:'findOne',
                                        query:{ email }
                                    })
                                }
                            } catch(e){ console.error(e); }
                        }

                        break;
                    case "google":
                        if(!token){
                            res.status(400);
                            res.send({
                                message:"Please provide a token to login with Google"
                            }); return;
                        }
                        let google_ticket = await googleClient.verifyIdToken({
                            idToken: token,
                            audience: process.env.GOOGLE_CLIENT_ID
                        });
                        let payload = google_ticket.getPayload();

                        validated = (payload.email && payload.name)?true:false;
                        email = payload.email;

                        if(validated){
                            user = await database.dynamic_call({
                                collection:'users', method:'findOne',
                                query:{ email }
                            })
                        }

                        break;
                    case "native":
                        validated = true;
                        user = await database.dynamic_call({
                            collection:'users', method:'findOne',
                            query:{ email }
                        })
                        break;
                }

                if(!validated){
                    res.status(405);
                    res.send({
                        message:"We were unable to verify the email you provided is legitimate"
                    }); return; 
                }

                if(!email){
                    res.status(400);
                    res.send({
                        message:"Error, no email address provided. Please provide a valid email address."
                    }); return;
                }

                if(!user){
                    res.status(207);
                    res.send({
                        message:`We were unable to find an account for ${email}, would you like to <a href="/signup?email=${email}">signup for free instead?</a>`,
                    }); return;
                }

                let userObj = new User(user),
                    signinMethod = user.preferences.signin;

                if( signinMethod == 'native' ){

                    if(!password){
                        res.status(202)
                        res.send({
                            message:"Please proceed to enter your password for this account.",
                            use:'native',
                            first_name:user.first_name
                        }); return;
                    }

                    if(String(password).substring(0, StringLimits.general.password) !== database.decryptPassword(user.password)){
                        res.status(401)
                        res.send({
                            message:"Your email and password do not match. Please try again."
                        }); return;
                    }

                    if(userObj.hasTwoFactorEnabled() && !code){
                        res.status(406)
                        res.send({
                            message:"Two factor authentication is required, please enter the 6 digit code sent to your authentication app.",
                            use:'2FA'
                        }); return;
                    }

                    if(code && !userObj.testTwoFactor(code)){
                        res.status(412)
                        res.send({
                            message:"The 6 digit code you have entered for two factor authentication is incorrect, please try again."
                        }); return;
                    }

                    await userObj.authenticate(req,res);
                    res.cookie('redirect_after_login', '')
                    res.status(200)
                    res.send({
                        message:"You have successfully logged in.",
                        profile:{
                            _id:user._id,
                            profile_picture:user.profile_picture,
                            first_name:user.first_name,
                            last_name:user.last_name,
                            email,
                        },
                        redirect
                    }); return;
                }

                // If their account is [facebook] only, and the method is [facebook], proceed. Also valid with google, and native.
                if( signinMethod == method ){
                    await userObj.authenticate(req,res);
                    res.cookie('redirect_after_login', '')
                    res.status(200)
                    res.send({
                        message:"You have successfully logged in.",
                        profile:{
                            _id:user._id,
                            profile_picture:user.profile_picture,
                            first_name:user.first_name,
                            last_name:user.last_name,
                            email,
                        },
                        redirect
                    }); return;
                }
                else{ // If they tried logging in with Google, but should have logged in with Facebook! Or etc.
                    res.status(202)
                    res.send({
                        message:`Please sign in with ${signinMethod} instead.`,
                        use:signinMethod || 'native'
                    }); return;
                }
            } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/signup/:method', 
        rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message:{ message:"You have attempted to signup a lot in the last couple of minutes. Please wait a couple of minutes before signing up again." } }), 
        async (req, res) => {
            try{
                let { email, first_name, last_name, password, token, referrer, type } = req.body,
                    { method } = req.params;

                email = email?email.toLowerCase():undefined;

                let whitelist = ["native", "facebook", "google"]
                if(!method || !whitelist.includes(method)){ method = whitelist[0] }

                // First, we need to validate that their email is legit!
                let validated = false,
                    fb_user_id,
                    profile_picture=`${req.lexicon.domain}/images/account.svg`,
                    user;

                switch(method){
                    case "native":
                        validated = (email && first_name && last_name && password && email.includes('@'))?true:false;
                        if(!validated){
                            res.status(400);
                            res.send({
                                message:"Please sign up with a valid email address and include the appropriate fields."
                            }); return;
                        }
                        break;
                    case "facebook":
                        if(!token){
                            res.status(400);
                            res.send({
                                message:"To signup with a Facebook account, please provide a valid Facebook account token"
                            }); return;
                        }
                        let get_access_token = await Facebook.api('oauth/access_token', {
                            client_id: process.env.FACEBOOK_APP_ID,
                            client_secret: process.env.FACEBOOK_APP_SECRET,
                            grant_type: 'client_credentials'
                        });
                        if(!get_access_token || get_access_token.error){
                            console.log('New Facebook Error!'); console.log(get_access_token.error);
                            res.status(500); res.send({
                                message:`Facebook error: ${get_access_token.error}`
                            }); return;
                        }
                        
                        let access_token = get_access_token.access_token

                        let debug_token = await Facebook.api('debug_token', {
                            access_token,
                            input_token:token
                        })

                        if(debug_token && debug_token.data && debug_token.data.is_valid){
                            validated = true;
                            try{
                                let user_info = await Facebook.api('me', { fields: ['email','first_name','last_name'], access_token:token })
                                if(user_info && user_info.email){
                                    email = user_info.email
                                    first_name = user_info.first_name
                                    last_name = user_info.last_name
                                    fb_user_id = debug_token.data.user_id
                                }
                            } catch(e){ console.error(e); }
                            try{
                                // This might change over time... Need to be safe.
                                // If this link still returns Alex's profile picture after a long time, we should use this then!
                                // https://platform-lookaside.fbsbx.com/platform/profilepic/?asid=4550099238392183&height=50&width=50&ext=1642716202&hash=AeSbb3RT6rVtU4waUqA
                                // This link was generated on Dec 21 2021
                                // http://graph.facebook.com/USER_ID/picture?type=large&access_token=ACCESS_TOKEN
                                // http://graph.facebook.com/USER_ID/?fields=picture&access_token=ACCESS_TOKEN
                                //let facebook_picture = await Facebook.api(`/${fb_user_id}/?fields=picture&access_token=${access_token}&type=large`)
                                //let facebook_picture = await Facebook.api(`/${fb_user_id}/picture?type=large&access_token=${access_token}`)
                                //if(facebook_picture){
                                //    console.log(facebook_picture.picture.data)
                                //}
                            } catch(e){ console.error(e); }
                            if(!email){
                                res.status(403);
                                res.send({
                                    message:"Your Facebook account is not associated with an email address, and therefor cannot be used to signup for SheetParrot! Please signup using another method."
                                }); return;
                            }
                        }
                        break;
                    case "google":
                        if(!token){
                            res.status(400);
                            res.send({
                                message:"In order to signup with Google, please provide a valid Google account token to signup from."
                            }); return;
                        }
                        let google_ticket = await googleClient.verifyIdToken({
                            idToken: token,
                            audience: process.env.GOOGLE_CLIENT_ID
                        });
                        let payload = google_ticket.getPayload();

                        validated = (payload.email && payload.name)?true:false;
                        email = payload.email;
                        first_name = payload.given_name
                        last_name = payload.family_name
                        profile_picture = (payload.picture) ? payload.picture : profile_picture

                        break;
                }

                if(!email){
                    res.status(400);
                    res.send({
                        message:"We did not receive a valid email address to signup with."
                    }); return;
                }

                let existing_user_check = await database.dynamic_call({ collection:'users', method:'findOne', query:{ email } });

                if(existing_user_check){
                    res.status(409);
                    res.send({
                        message:`An account registered with "${email}" already exists! Please <a class="has-text-white" href="${req.lexicon.domain}/login?email=${email}"><u>login instead.</u></a>`
                    }); return;
                }

                let newUser = new User();
                try{
                    await newUser.create({
                        first_name,
                        last_name,
                        email,
                        password,
                        fb_user_id,
                        profile_picture,
                        method,
                        referrer,
                        type
                    })
                }
                catch(e){
                    console.error(e);
                    res.status(500);
                    res.send({
                        message:'Internal server error, something went wrong trying to create your account. Please try again.'
                    }); return;
                }

                await regenerateSession(req.session)

                req.session.user = newUser.document;
                req.session.authorized = true;
                req.authorized = true;

                await req.session.save()

                res.status(200);
                res.send({
                    message:"You have successfully signed up!"
                })
                return;
            } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.get('/2FA/getMyQR', authorization, async (req, res) => {
        try{
            let newSecret = twofactor.generateSecret({ name: "SheetParrot", account:req.session.user.email })

            // Need to save the secret in session object (newSecret.secret) until they verify the QR/code once.
            req.session.twofactor_secret = newSecret.secret

            // They will need to scan the QR code, add it, and verify it once before we add it to our database.
            res.send(newSecret.uri + '&digits=6');
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/2FA/removeMy2FA', authorization, async (req, res) => {
        try{
            if(req.session.user.preferences && (!req.session.user.preferences.twofactor || req.session.user.preferences.twofactor.enabled == false)){ res.sendStatus(400); return; }
            else {
                database.dynamic_call({
                    collection:'users',
                    method:'updateOne',
                    query:{ email:req.email },
                    actions:{ $set:{ "preferences.twofactor.secret":null, "preferences.twofactor.enabled":false } }
                })
                req.session.user.preferences.twofactor.secret  = null
                req.session.user.preferences.twofactor.enabled = false
                res.sendStatus(200); return;
            }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/2FA/saveMy2FA', authorization, async (req, res) => {
        try{
        let secret = req.session.twofactor_secret,
            code   = req.body.code

        verifyToken = twofactor.verifyToken(secret, code); // => { delta: 0 } is success, null is false

        if(verifyToken == null){
            res.sendStatus('403')
        }
        else{
            res.sendStatus('201')
            database.dynamic_call({
                collection:'users',
                method:'updateOne',
                query:{ email:req.session.user.email },
                actions:{
                    $set:{
                        'preferences.twofactor.secret':secret,
                        'preferences.twofactor.enabled':true
                    }
                }
            })
            req.session.user.preferences.twofactor = { secret, enabled:true }
        }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.get('/verify', async (req, res) => {
        try{
            req.lexicon.is_verified = false;

            let { token } = req.query

            if(token){ 
                let email = database.decrypt(token)

                await database.dynamic_call({
                    collection:'users', method:'updateOne', query:{ email },
                    actions:{ $set:{ verified:true } }
                })

                req.lexicon.is_verified = true;
            }

            res.render('misc/verify', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    app.use('/settings', authorization)

    app.get('/settings', async (req, res) => {
        try{
            res.render('./misc/settings', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/settings/me', async (req, res) => {
        try{
            let { notifications, twofactor, interface:userInterface, signin } = req.session.user.preferences
            let { email, first_name, last_name, profile_picture, type } = req.session.user;
            res.send({ email, first_name, last_name, profile_picture, notifications, twofactor, interface:userInterface, signin, type })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/settings/password', async (req, res) => {
        try{
            let { current, password } = req.body;

            if(!current || !password){ res.status(400); res.send({ message:"Please include your current password and your new password." }); return; }

            current  = String(current)
            password = String(password).substring(0, StringLimits.general.password)

            if(password.length < 7){ res.sendStatus(400); res.send({ message:"Your new password must be at least 7 characters long!" }); return; }

            let password_validation = await database.dynamic_call({ collection:'users', method:'findOne', query:{ email:req.email }, options:{ projection:{ password:1, _id:0 } } })
            if(!password_validation){ res.status(400); res.send({ message:"Something went wrong trying to change your password, please try again later." }); return; }
            
            if(database.decryptPassword(password_validation.password) != current){
                res.status(400); res.send({ message:"The previous password did not match your account's current password. Please try again." }); return;
            }

            password = database.encryptPassword(password);
            await database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email }, actions:{ $set:{ password } } })

            res.status(200);
            res.send({ message:"Successfully updated your password!" });

            sendgrid.send_dynamic_template({ templateId:sendgrid.TEMPLATES.USER.NEW_PASSWORD_ALERT, templateData:{}, toWhom:req.email, BCC_ADMINS:false })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/settings/resendVerification', 
        rateLimit({ windowMs: 5 * 60 * 1000, max:1, message:{ message:"We have already sent you an email. Please wait a few minutes before trying to verify your account again." } }),
        (req, res) => {
            try{
                let user = new User(req.session.user)
                user.sendVerification();
                res.sendStatus(200);
            } catch(err){ database.logInternalError({ req, res, err }) }
        }
    )
    app.post('/settings/save', async (req, res) => {
        try{
            let { notifications, interface:userInterface, first_name, last_name, type } = req.body

            function parseBoolean(bool,defaultTo=false){
                if(['true','false'].includes(bool)){ return bool='true'?true:false }
                if([true,false].includes(bool)){ return bool } else{ return defaultTo; }
            }

            let $set = {}

            if(type && ['student', 'teacher'].includes(type)){
                $set['type'] = type
                req.session.user.type = type
            }
            if(first_name){
                $set['first_name'] = String(first_name).substring(0, StringLimits.general.first_name);
                req.session.user.first_name = $set['first_name']
            }
            if(last_name) {
                $set['last_name' ] = String(last_name) .substring(0, StringLimits.general.last_name );
                req.session.user.first_name = $set['first_name']
            }
            if(notifications && typeof notifications == 'object'){
                if(notifications['login'] && [true,false,'true','false'].includes(notifications['login'])){
                    $set['preferences.notifications.login'] = parseBoolean(notifications.login, false)
                    req.session.user.preferences.notifications.login = $set['preferences.notifications.login'];
                }
                if(notifications['updates'] && [true,false,'true','false'].includes(notifications['updates'])){
                    $set['preferences.notifications.updates'] = parseBoolean(notifications.updates, false)
                    req.session.user.preferences.notifications.updates = $set['preferences.notifications.updates'];
                }
                if(notifications['marketing'] && [true,false,'true','false'].includes(notifications['marketing'])){
                    $set['preferences.notifications.marketing'] = parseBoolean(notifications.marketing, false)
                    req.session.user.preferences.notifications.marketing = $set['preferences.notifications.marketing'];
                }
                if(notifications['submissions'] && [true,false,'true','false'].includes(notifications['submissions'])){
                    $set['preferences.notifications.submissions'] = parseBoolean(notifications.submissions, false)
                    req.session.user.preferences.notifications.submissions = $set['preferences.notifications.submissions'];
                }
            }
            if(userInterface && typeof userInterface == 'object'){
                if(userInterface['onSubmit']){
                    $set['preferences.interface.onSubmit'] = String(userInterface.onSubmit).substring(0, StringLimits.sheets.submission.message);
                    req.session.user.preferences.interface.onSubmit = $set['preferences.interface.onSubmit'];
                }
                if(userInterface['theme']){
                    $set['preferences.interface.theme'] = String(userInterface.theme).substring(0, StringLimits.sheets.theme.background);
                    req.session.user.preferences.interface.theme = $set['preferences.interface.theme'];
                }
            }

            if(Object.keys($set).length){
                await database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:req.session.user._id }, actions:{ $set } })
            }

            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    
    function unlink(file){
        try{ fs.unlink(file.path, err => { if(err){ console.error(err) } }) } catch(e){ console.log(e); }
    }
    app.use('/upload/*', authorization, upload.single('image'), async (req, res, next) => {
        let nocontinue = false;
        try{
            try{ file = req.file } catch(e){ console.error(e); file = undefined; }
            if(!file){
                res.status(400);
                res.send({ message:"No photo was uploaded, please ensure you send us a correct file." });
                return;
            }

            let limit = 3;
            if(req.originalUrl.includes('/profile')){ limit = StringLimits.images.profile_picture; }
            else if (req.originalUrl.includes('/library')){ limit = StringLimits.images.image_library; }
            else if (req.originalUrl.includes('/logo')){ limit = StringLimits.images.logo; }

            // Is the file larger than the limit?
            if(file.size >= 1048576 * limit){ // 1 MB = 1048576 Bytes, so the limit is in megabytes
                res.status(400);
                res.send({ message:`Image is too large! Please upload a file smaller than ${limit} megabytes.` });
                unlink(file);
                return;
            } 

            // Is it a .png or .jpg?
            if( !(file.mimetype === "image/png" || file.mimetype === "image/jpeg") ){
                res.status(400);
                res.send({ message:"Please ensure your image is a .PNG or .JPG image!" });
                unlink(file);
                return;
            } 

            } catch(err){ database.logInternalError({ req, res, err }); nocontinue = true; }
        
        if(nocontinue){ return; }
        next();
    })
    app.use('/upload/:path', async (req, res, next) => {
        let { _id } = req.session.user,
            { path } = req.params;

        _id = String(_id)

        if(!['logo', 'profile', 'library'].includes(path)){ path = "library" }

        let name = file.filename // <-- file.originalName for authentic filename
        if(path == "profile"){ name="avatar" }
        
        let s3_data = await amazon.uploadToS3({
            file,
            path:`/${path}/${_id}/`,
            name
        }).catch(console.log)

        if(!s3_data || !s3_data.key){
            res.status(500);
            res.send({ message:"Something went wrong trying to upload your image to our servers. Please try again." });
            unlink(file);
            return;
        }

        req.s3_picture = {
            url:`${process.env.DOMAIN}/image/${s3_data.key}`,
            key:s3_data.key
        }

        res.status(200);
        res.send({ message:"Successfully uploaded your image!", url:req.s3_picture.url });

        next()
    })
    app.post('/upload/profile', async (req, res, next) => {
        req.session.user.profile_picture = req.s3_picture.url
        await database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email }, actions:{ $set:{ profile_picture:req.s3_picture.url } } })
        next()
    })
    app.post('/upload/library', async (req, res, next) => {
        if(!req.s3_picture.url){ next(); return; }
        req.session.user.images.unshift(req.s3_picture.url)
        await database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email },
            actions:{
                $push:{
                    images:{
                        $each:[ req.s3_picture.url ],
                        $position:0
                    }
                }
            }
        })
        next()
    })
    app.post('/upload/logo', async (req, res, next) => {
        req.session.user.preferences.interface.default_logo = req.s3_picture.url
        await database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email }, actions:{ $set:{ 'preferences.interface.default_logo':req.s3_picture.url } } })
        next()
    })
    app.use('/upload/*', async (req, res) => unlink(req.file))

    app.get('/image/:path/:_id/:key', async (req, res) => {
        let { path, _id, key } = req.params;

        let { data } = await amazon.getFromS3(`${path}/${_id}/${key}`).catch(err => {})

        if(data){
            res.writeHead(200, {'Content-Type': 'image/jpeg'});
            res.write(data.Body, 'binary');
            res.end(null, 'binary');
            return;
        }

        if(path == "profile"){
            res.writeHead(200, {'Content-Type': 'image/svg+xml'});
            res.write(fs.readFileSync('./public/images/account.svg'), 'binary');
            res.end(null, 'binary');
            return;
        }
        // Put a "default" image here other than the account photo
        res.writeHead(200, {'Content-Type': 'image/svg+xml'});
        res.write(fs.readFileSync('./public/images/account.svg'), 'binary');
        res.end(null, 'binary');
    })

    app.get('/reset-password', (req, res) => {
        try{
            if(req.authorized)
                res.redirect('/dashboard')
            else
                res.render('authorization/forgot_password', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.post('/reset-password', async (req, res) => {
        try{
            let email = database.sanitize(req.body.email).toLowerCase()

            if(email && email.includes('@')){
                res.sendStatus(200)
                let user = await database.dynamic_call({
                    collection:'users',
                    method:'findOne',
                    query:{ email }
                })
                if(!user){ return; }
                let reset_token_1 = database.generateSecureToken(),
                    reset_token_2 = database.generateSecureToken(),
                    reset_expires = new Date()

                reset_expires = reset_expires.setDate(reset_expires.getDate() + 2)
                reset_expires = new Date(reset_expires)

                await database.dynamic_call({
                    collection:'users',
                    method:'updateOne',
                    query:{ email },
                    actions:{ $set:{ 
                        reset_token_1, 
                        reset_token_2,
                        reset_expires
                    }}
                })

                let button_href = encodeURI(`${req.lexicon.domain}/new-password?t=${reset_token_1}&v=${reset_token_2}&e=${email}`)

                sendgrid.send_dynamic_template({
                    templateId:sendgrid.TEMPLATES.USER.RESET_PASSWORD,
                    templateData:{
                        button_href
                    },
                    toWhom:email,
                    BCC_ADMINS:true
                })
            }
            else{
                res.sendStatus(400)
            }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/new-password', async (req, res) => {
        try{
            let reset_token_1 = req.query.t,
                reset_token_2 = req.query.v,
                email   = req.query.e

            let user = await database.dynamic_call({
                collection:'users',
                method:'findOne',
                query:{ 
                    reset_token_1, 
                    reset_token_2, 
                    email
                }
            })
            
            req.lexicon.can_reset = (reset_token_1 && reset_token_2 && email && user && user.reset_expires > new Date())
            req.lexicon.email = email
            req.lexicon.token_1 = reset_token_1
            req.lexicon.token_2 = reset_token_2

            res.render('authorization/new_password', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.post('/new-password', async (req, res) => {
        try{
            let reset_token_1  = req.body.token_1,
                reset_token_2  = req.body.token_2,
                password = req.body.value,
                email    = database.sanitize(req.body.email).toLowerCase()

            if(!reset_token_1 || !reset_token_2 || !password || !email || password.length < 8){ res.sendStatus(400); }
            else {
                let r = await database.dynamic_call({
                    collection:'users',
                    method:'updateOne',
                    query:{
                        reset_expires:{ $gte:new Date() },
                        reset_token_1, 
                        reset_token_2, 
                        email
                    },
                    actions:{ 
                        $set:{ password:database.encryptPassword(password) },
                        $unset:{ reset_token_1, reset_token_2, reset_expires:0 }
                    }
                })
                
                if(r && r.modifiedCount > 0){
                    sendgrid.send_dynamic_template({
                        templateId:sendgrid.TEMPLATES.USER.NEW_PASSWORD_ALERT,
                        templateData:{},
                        toWhom:email,
                        BCC_ADMINS:true
                    })
                }

                res.sendStatus(200);
            }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/logout', (req, res) => {
        try{
            let logout_url = (req.query.r) ? (req.query.r) : req.lexicon.domain
            req.session.destroy((err) => {
                if(err){ console.log(err) }
                res.redirect(logout_url)
            })
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    
}