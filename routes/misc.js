import sqrl from 'squirrelly'
import moment from 'moment'
import fs from 'fs'

export default function(app, { authorization, tools, database, sendgrid, amazon }){

    /* <---- Squirrelly Helpers ----> */
    sqrl.helpers.define("formatStripeNumber", function(content) {
        if(content.params[0] !== undefined || content.params[0] !== null){
            return tools.formatStripeNumber( String(content.params[0]) );
        } else return ""
    })

    /* <---- Legal ----> */
    app.get('/legal', (req, res) => res.redirect('/terms-of-service', req.lexicon))
    app.get('/terms-of-service', (req, res) => res.render('misc/legal/legal-TOS', req.lexicon))
    app.get('/privacy-policy', (req, res) =>  res.render('misc/legal/legal-privacy', req.lexicon))
    app.get('/refund-policy', (req, res) => res.render('misc/legal/refund', req.lexicon))
    app.get('/cookies', (req, res) =>  res.render('misc/legal/cookie-policy', req.lexicon))

    /* <---- Redirects ----> */
    app.get('/robots/checkAlive', (req, res) => { res.sendStatus(200) });
    app.get('/sitemap.xml', async (req, res) => {
        res.set('Content-Type', 'text/xml')
        // <lastmod>{{it.last_modified}}</lastmod>
        // format: 2021-10-22T20:29:29+00:00
        req.lexicon.last_modified = new Date().toISOString()
        res.send( await sqrl.renderFile( req.lexicon.dir + '/views/misc/sitemap.squirrelly', req.lexicon ) );
    })
    app.get('/status', (req, res) => res.redirect('https://stats.uptimerobot.com/yznYjS76p8'));

    /* <---- Files ----> */
    app.get('/favicon.ico', (req, res) => {
        res.writeHead(200, {'Content-Type': 'image/svg'});
        res.write(fs.readFileSync('./public/images/logo.svg'), 'binary');
        res.end(null, 'binary');
    })

    /* <---- Photo Library ----> */
    app.get('/myPhotos', authorization, async (req, res) => {
        res.send(req.session.user.images);
    })
    app.post('/deleteMyPhoto', authorization, async (req, res) => {
        try{
            let { url } = req.body
            if(!url){ res.status(400).send({ message:"Please include the parameter [url] in the body of your request!" }); }

            if(!url.includes(process.env.DOMAIN)){
                await database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email }, actions:{ $pull:{ images:url } } });
                req.session.user.images.filter(a => a != url)
                res.status(200).send({ message:"Successfully deleted your photo!" }); return;
            }

            let paths = new RegExp(/\/image\/([^\/]+\/)?([^\/]+\/)?([^\/]+)?$/gmi).exec(url)
            if(!paths || !paths.length){ res.status(404).send({ message:"The photo you're trying to delete isn't formatted correctly to be deleted!" }); return; }

            paths.shift();
            paths = paths.slice(0,3);

            if(paths.length != 3 || paths[0] != 'library/'){ res.status(400).send({ message:"Something went wrong trying to delete that image, please try again." }); return; }

            let key = `library/${String(req.session.user._id)}/${paths[2]}`,
                final_url = process.env.DOMAIN + '/image/' + key

            await Promise.all([
                database.dynamic_call({ collection:'users', method:'updateOne', query:{ email:req.email }, actions:{ $pull:{ images:final_url } } }),
                amazon.deleteFromS3(key)
            ])

            req.session.user.images.filter(a => a != url)

            res.status(200).send({ message:"Successfully deleted your photo!" });
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/addImage', authorization, async (req, res) => {
        try{
            let { url } = req.body,
                { _id } = req.session.user;

            // Validation
            if(!url){ return res.status(400).send({ message:"Please include parameter 'url' in your body request" }) }

            // Is it a valid link?
            let is_valid = new RegExp(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[\w]*))?)/)
                .test(url)

            if(!is_valid){ return res.status(400).send({ is_invalid:true, message:"That is not a valid URL! Please add a valid URL." }) }

            // Does it already exist?
            // If so, remove the old one, and re-add it to the top! :)
            let existing = req.session.user.images.find(image => image == url)
            if(existing){
                req.session.user.images = req.session.user.images.filter(a => a != url)
                await database.dynamic_call({
                    collection:'users',  method:'updateOne', query:{ _id },
                    actions:{ $pull:{ images:url } }
                })
            }

            // Update
            await database.dynamic_call({
                collection:'users',  method:'updateOne', query:{ _id },
                actions:{
                    $push:{
                        images:{
                            $each:[ url ],
                            $position:0
                        }
                    }
                }
            })
            req.session.user.images.unshift(url)

            res.status(200).send({ message:"Succesfully added that image to your library!", success:is_valid, url, is_invalid:!is_valid, replaced:existing?true:false })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    
    /* <---- Feedback Form ----> */
    app.get('/feedback', (req, res) => {
        try{
            if(req.cookies && req.cookies['feedback-submitted'] == 'true'){ res.redirect('/feedback/thank-you'); return; }
            req.lexicon.user = (req.session && req.session.user && req.session.user.email && req.session.user.name) ? req.session.user : null
            res.render('misc/marketing/feedback', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.post('/feedback', async (req, res) => {
        try{
            let message = req.body.message,
                name = req.body.name || "",
                email = req.body.email || "";

            await sendgrid.send_dynamic_template({
                templateId:sendgrid.TEMPLATES.APP.FEEDBACK,
                templateData:{ message, name, email },
                toWhom:process.env.ADMIN_NOTIFICATIONS_EMAIL
            });
        } catch(e){ console.log(e); }
        try{
            res.cookie('feedback-submitted', 'true', { maxAge:(1000 * 60 * 60 * 24 * 7), httpOnly:true })
            res.redirect('/feedback/thank-you')
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/feedback/thank-you', (req, res) => { res.render('misc/marketing/feedback_thank_you', req.lexicon) })

    app.post('/log/localError', (req,res) => {
        try{
            if(process.env.NODE_ENV != 'production'){ return res.status(200).send({ success:true, message:"Local error successfully logged." }) }
            let { msg='', source='', lineNo='', columnNo='', error='', screenX='', screenY='', userAgent='', browser='' } = req.body;

            // Log error in database
            database.dynamic_call({
                collection:'localErrors',
                method:'insertOne',
                query:{
                    created:new Date(),
                    route:req.url,
                    userAgent,
                    browser,
                    user:req.authorized?req.session.user.email:null,
                    error:{
                        msg, source, lineNo, columnNo, error, screenX, screenY, 
                    }
                }
            })

            database.alertDiscord(`New local error at ${req.url}
                User Agent: ${userAgent}
                Browser: ${browser}
                User: ${req.authorized?req.session.user.email:null}
                Error: ${msg}
                ${error}
                Source: ${source}
                LineNo:${lineNo}, ColumnNo:${columnNo}
                Screen size: ${screenX}x${screenY}`)

            // Message admins
            sendgrid.send_dynamic_template({
                templateId:sendgrid.TEMPLATES.ADMIN_ALERTS.ERROR,
                templateData:{
                    error_report:'LOCAL ERROR: ' + error.toString(),
                    crash_date:moment().format('MMM Do [at] h:mma')
                },
                toWhom:process.env.ADMIN_NOTIFICATIONS_EMAIL
            })

            res.status(200).send({ success:true, message:"Local error successfully logged." })
        }
        catch(e){ database.logInternalError({ req, res, err }) }
    })

    /* <---- Developer Tools ----> */
    if(process.env.NODE_ENV != "development"){ return; }

    app.get('/encrypter', (req, res) => {
        res.send("<h1>" + database.encrypt(req.query.item || '') + "</h1>")
    })
    app.get('/decrypter', (req, res) => {
        res.send("<h1>" + database.decrypt(req.query.item || '') + "</h1>")
    })
    app.get('/S/encrypter', (req, res) => {
        res.send("<h1>" + database.encryptPassword(req.query.item || '') + "</h1>")
    })
    app.get('/S/decrypter', (req, res) => {
        res.send("<h1>" + database.decryptPassword(req.query.item || '') + "</h1>")
    })
    app.get('/draft', (req, res) => res.render('draft', req.lexicon))
    app.get('/session', (req, res) => res.render('developer/viewSession', req.lexicon))
    app.get('/photoLibrary', (req, res) => res.render('developer/photoLibraryTest', req.lexicon))
}