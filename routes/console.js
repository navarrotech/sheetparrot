import { ObjectId } from 'mongodb'
import Stripe from 'stripe'
import User from '#objects/User.js'

const stripe = Stripe(process.env.STRIPE_API_KEY)

export default function(app, { authorization, tools, database, sendgrid }){

    app.use('/console', authorization, async (req, res, next) => {

        if((req.session && req.session.user && req.session.user.preferences && req.session.user.preferences.billing && req.session.user.preferences.billing.plan === "admin") || process.env.NODE_ENV != 'production'){
            req.lexicon.requesting_page = req.url
            req.lexicon.user = req.session.user

            next()
        }
        else {
            res.status(404);
            res.render('404-not-found', req.lexicon)
        }
    })
    app.get('/console', async (req, res) => {
        let check_date = new Date()
        check_date = new Date(check_date.setDate(check_date.getDate() - 30))

        let total_users = database.dynamic_call({
            collection:'users',
            method:'countDocuments',
            query:{ "last_login":{ $exists:true } }
        })
        let total_users_last_30_days = database.dynamic_call({
            collection:'users',
            method:'countDocuments',
            query:{ signed_up:{ $gte:check_date }, "last_login":{ $exists:true } }
        })
        let total_paying = database.dynamic_call({
            collection:'users',
            method:'countDocuments',
            query:{
                "preferences.billing.subscriptionID":{ $ne:null }
            }
        })

        let total_paying_last_30_days = database.dynamic_call({
            collection:'users',
            method:'countDocuments',
            query:{
                "preferences.billing.subscriptionID":{ $exists:true },
                signed_up:{ $gte:check_date }
            }
        })

        let total_sheets = database.dynamic_call({
            collection:'sheets',
            method:'countDocuments',
            query:{}
        })

        let total_sheets_last_30_days = database.dynamic_call({
            collection:'sheets',
            method:'countDocuments',
            query:{ created:{ $gte:check_date } }
        })

        let vals = await Promise.all([total_users, total_paying, total_sheets, total_users_last_30_days, total_paying_last_30_days, total_sheets_last_30_days])

        req.lexicon.total_users  = vals[0]
        req.lexicon.total_paying = vals[1]
        req.lexicon.total_sheets = vals[2]

        req.lexicon.total_users_last30 = vals[3] //Math.round((vals[3] / vals[0]) * 100)
        req.lexicon.total_paying_last30 = vals[4] //Math.round((vals[4] / vals[1]) * 100)
        req.lexicon.total_sheets_last30 = vals[5] //Math.round((vals[5] / vals[2]) * 100)

        res.render('console/dashboard', req.lexicon)
    })
    app.get('/console/users', async (req, res) => {
    
        let page = (req.query.page && req.query.page <= 0) ? 0 : (req.query.page && parseInt(req.query.page - 1)) || 0,
            search = req.query.search || '',
            query = {},
            pagination_limit = 10

        if(search){ 
            let regex = { $regex:( new RegExp(search, 'i') ) } 
            query = { $or:[ { "name":regex }, { "email":regex } ] }
        }

        let users_call = database.dynamic_call({
            collection:'users',
            method:'find',
            query,
            options:{ sort:{ signed_up:-1 } },
            pagination:page,
            pagination_limit
        })
        let total_users_call = database.dynamic_call({
            collection:'users',
            method:'countDocuments',
            query
        })

        Promise.all([users_call, total_users_call]).then(vals => {
            let users = vals[0],
                total = vals[1]

            if(total.length == 0 || !users){
                req.lexicon.content = { users:[], total:0 }
            }
            else {
                users.forEach(u => {
                    u.prettyTimeFromCreatedDate = tools.prettyPrintTimeBetweenTwoDates(new Date(u.signed_up), new Date())
                    u.prettyTimeFromLastLogin   = tools.prettyPrintTimeBetweenTwoDates(new Date(u.last_login || u.signed_up), new Date())
                })

                req.lexicon.pagination = {
                    current:page + 1,
                    limit:pagination_limit,
                    final_page:Math.ceil( total / pagination_limit )
                }
                if(search)
                    req.lexicon.search = search
                req.lexicon.content = { users, total }

                res.render('console/users', req.lexicon)
            }
        })
        
    })
    app.get('/console/assumeIdentity', async (req, res) => {
        if(req.session.user.preferences.billing.plan !== "admin"){ console.log("invalid permissions"); res.redirect('/dashboard'); return; }

        let return_email = req.email

        let user_doc = await database.dynamic_call({
            collection:'users',
            method:'findOne',
            query:{ _id:ObjectId(req.query._id) }
        })
        if(!user_doc){ res.redirect('/console/users'); return; }

        delete req.session.customer
        delete req.session.subscription
        delete req.session.last_invoice
        delete req.session.paymentMethod
        
        req.session.user = user_doc
        req.session.admin_identity = return_email

        res.redirect('/dashboard')
    })
    app.get('/returnCommand', async (req, res) => {
        if(req.session.admin_identity){

            let user_doc = await database.dynamic_call({
                collection:'users',
                method:'findOne',
                query:{ email:req.session.admin_identity }
            })
            if(!user_doc){ res.redirect('/console/users'); return; }

            delete req.session.customer
            delete req.session.subscription
            delete req.session.last_invoice
            delete req.session.paymentMethod
            
            delete req.session.admin_identity

            req.session.user = user_doc

            res.redirect('/console/users')
        }
        else{
            res.render('404-not-found', req.lexicon)
        }
    })
    app.get('/console/user/:id', async (req, res) => {
    
        let { id:_id } = req.params

        if(_id){

            let user = await database.dynamic_call({
                collection:'users',
                method:'findOne',
                query:{ _id }
            })

            if(!user){
                res.send("<h1>404: User not found</h1>"); return;
            }
            
            if(user.preferences && user.preferences.billing && user.preferences.billing.plan_renews)
                req.lexicon.renews_pretty = tools.prettyPrintTimeBetweenTwoDates(new Date(user.preferences.billing.plan_renews), new Date())
            req.lexicon.selected = user
            res.render('console/view_user', req.lexicon)

        }
    })
    app.get('/console/sheets', async (req, res) => {
    
        let page = (req.query.page && req.query.page <= 0) ? 0 : (req.query.page && parseInt(req.query.page - 1)) || 0,
            filter_email  = req.query.filter_email || '',
            filter_uname  = req.query.filter_uname || '',
            filter_sname  = req.query.filter_sname || '',
            query = {},
            pagination_limit = 10

        if(filter_email){
            query['owner'] = { $regex:( new RegExp(filter_email, 'i') ) } 
        }
        if(filter_uname){
            query['author.name'] = { $regex:( new RegExp(filter_uname, 'i') ) } 
        }
        if(filter_sname){
            query['sheetname'] = { $regex:( new RegExp(filter_sname, 'i') ) } 
        }

        let sheets_call = database.dynamic_call({
            collection:'sheets',
            method:'find',
            query,
            options:{ sort:{created:-1} },
            pagination:page,
            pagination_limit
        })
        let total_sheets_call = database.dynamic_call({
            collection:'sheets',
            method:'countDocuments',
            query
        })

        Promise.all([sheets_call, total_sheets_call]).then(vals => {
            let sheets = vals[0],
                total = vals[1]

            if(total.length == 0 || !sheets){
                req.lexicon.content = { sheets:[], total:0 }
            }
            else {
                sheets.forEach(u => {
                    let created = u.history[0],
                        last_modified = u.history[0] // TODO: Change me to array.filter => the last modified date

                    u.prettyTimeFromCreatedDate = tools.prettyPrintTimeBetweenTwoDates(new Date(created), new Date()),
                    u.prettyTimeFromModifiedDate = tools.prettyPrintTimeBetweenTwoDates(new Date(last_modified), new Date())
                })

                req.lexicon.pagination = {
                    current:page + 1,
                    limit:pagination_limit,
                    final_page:Math.ceil( total / pagination_limit )
                }
                if(filter_email){
                    req.lexicon.filter_email = filter_email
                }
                if(filter_uname){
                    req.lexicon.filter_uname = filter_uname
                }
                if(filter_sname){
                    req.lexicon.filter_sname = filter_sname
                }
                req.lexicon.content = { sheets, total }

                res.render('console/sheets', req.lexicon)
            }
        })
    })
    app.get('/console/reports', async (req, res) => {
        req.lexicon.global = await database.dynamic_call({
            collection:'global',
            method:'findOne',
            query:{ type:"constant" }
        })
        res.render('console/reports', req.lexicon)
    })

    /* Actions */
    app.post('/console/a/changeUserEmail', async (req, res) => {
        let status_code = 200,
            _id = req.body._id, // User ID to change
            email = req.body.email, // New email
            promises = []

        if(!_id){ res.sendStatus(400); return; }
        try{ ObjectId(_id) } catch(e){ res.sendStatus(400); return; } // Validate the ObjectId

        if(email)
            email = email.toLowerCase()

        let user = await database.dynamic_call({
            collection:'users',
            method:'findOne',
            query:{ _id:ObjectId(_id) }
        })
        if(!user){ res.sendStatus(404); return; }

        // Does the email address we're about to change already exist?
        let checkExisting = await database.dynamic_call({
            collection:'users',
            method:'findOne',
            query:{ email }
        })
        if(checkExisting){ res.sendStatus(409); return; }

        if(email && user.email.toLowerCase() !== email){ 
            // Update the user
            promises.push( 
                database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:ObjectId(_id) }, actions:{ $set:{ email } } }) 
            )
            if(user.preferences && user.preferences.billing && user.preferences.billing.stripeID){
                // Update on Stripe
                promises.push(
                    stripe.customers.update(user.preferences.billing.stripeID, { email } )
                )
            }
            // Update submitted_sheets "owner of sheet"
            promises.push( 
                database.dynamic_call({ collection:'submissions', method:'updateMany', query:{ owner:user.email }, actions:{ $set:{ owner:email } } }) 
            )
            // Update submitted_sheets "who submitted"
            promises.push( 
                database.dynamic_call({ collection:'submissions', method:'updateMany', query:{ user_email:user.email }, actions:{ $set:{ user_email:email } } }) 
            )
            // Update assigned_sheets "owner of assignment"
            promises.push( 
                database.dynamic_call({ collection:'assigned_sheets', method:'updateMany', query:{ teacher_email:user.email }, actions:{ $set:{ teacher_email:email } } }) 
            )
            // Update assigned_sheets "who assigned"
            promises.push( 
                database.dynamic_call({ collection:'assigned_sheets', method:'updateMany', query:{ who_assigned:user.email }, actions:{ $set:{ who_assigned:email } } }) 
            )
            // Update questions
            promises.push( 
                database.dynamic_call({ collection:'questions', method:'updateMany', query:{ user_email:user.email }, actions:{ $set:{ user_email:email } } }) 
            )
            // Update sheets
            promises.push( 
                database.dynamic_call({ collection:'sheets', method:'updateMany', query:{ owner:user.email }, actions:{ $set:{ owner:email } } }) 
            )
            // Update teacher array in users
            promises.push( 
                database.dynamic_call({ collection:'users', method:'updateMany', query:{ "teachers.teacher":user.email }, actions:{ $set:{ "teachers.$.teacher":email } } }) 
            )
        }
        
        res.status(status_code)
        res.cookie('update_user_status', String(status_code))
        Promise.all(promises).then(prom => {
            if(_id)
                res.redirect(`/console/user/${_id}`)
            else
                res.redirect(`/console/users`)
        })
        
    })
    app.post('/console/a/updateUser', async (req, res) => {
        let status_code = 200,
            _id = req.body._id,
            promises = []
        
        if(!_id){ res.sendStatus(400); return; }
        try{ ObjectId(_id) } catch(e){ res.sendStatus(400); return; } // Validate the ObjectId

        let name = req.body.name,
            admin_note = req.body.admin_note

        let user = await database.dynamic_call({
            collection:'users',
            method:'findOne',
            query:{ _id:ObjectId(_id) }
        })
        if(!user){ res.sendStatus(404); return; }

        let email = user.email
        
        promises.push(
            database.dynamic_call({
                collection:'users',
                method:'updateOne',
                query:{ _id:ObjectId(_id) },
                actions:{
                    $set:{
                        "preferences.admin_note":admin_note,
                        name
                    }
                }
            })
        )

        if(user.name !== name){
            // Update the users
            promises.push( 
                database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:ObjectId(_id) }, actions:{ $set:{  } } }) 
            )
            // Update submissions
            promises.push( 
                database.dynamic_call({ collection:'submissions', method:'updateMany', query:{ user_email:email }, actions:{ $set:{ user_name:name } } })
            )
            // Update questions
            promises.push( 
                database.dynamic_call({ collection:'questions', method:'updateMany', query:{ user_email:email }, actions:{ $set:{ user_name:name } } })
            )
            // Update questions
            promises.push( 
                database.dynamic_call({ collection:'questions', method:'updateMany', query:{ teacher_email:email }, actions:{ $set:{ teacher_name:name } } })
            )
        }

        res.status(status_code)
        res.cookie('update_user_status', String(status_code))
        Promise.all(promises).then(prom => {
            if(_id)
                res.redirect(`/console/user/${_id}`)
            else
                res.redirect(`/console/users`)
        })
    })
    app.post('/console/a/resetProfilePicture', async (req, res) => {
        let _id = req.body._id

        if(!_id){ res.sendStatus(400); return; }
        try{ ObjectId(_id) } catch(e){ res.sendStatus(400); return; } // Validate the ObjectId

        await database.dynamic_call({
            collection:'users',
            method:'updateOne',
            query:{ _id:ObjectId(_id) },
            actions:{ $set:{ profile_picture:'https://www.sheetparrot.com/images/account.svg' } }
        })

        res.sendStatus(200);
    })
    app.post('/console/a/alterNotification', async (req, res) => {
        
        let T   = req.body.setting.toLowerCase() || undefined,
            A   = (req.body.value == true || req.body.value == 'true') ? true : false // Ensure it's a boolean value
            _id = req.body._id

        if(!T){ res.sendStatus(400); return; }
        try{ ObjectId(_id) } catch(e){ res.sendStatus(400); return; }

        let acceptable_setting_values = ["on_submissions", "on_newassignment", "on_login", "weekly_report", "marketing", "app_updates"]
        if( !acceptable_setting_values.includes(T) ){ res.sendStatus(400); return; }

        let s = {}
        s["preferences.notifications." + T] = A

        req.session.user.preferences.notifications[T] = A

        await database.dynamic_call({
            collection:'users',
            method:'updateOne',
            query:{ _id:ObjectId(_id) },
            actions:{ $set:s }
        })

        res.sendStatus(200)

    })
    app.post('/console/a/deleteUser', async (req, res) => {
        let _id = req.body._id, superPassword = req.body.superPassword;
        if(!_id){ res.sendStatus(400); return; }
        if(!superPassword || superPassword !== process.env.SUPERPASSWORD){ res.sendStatus(401); return; }

        let user = new User()
        await user.connectById(_id)

        if(user.isConnected()){
            try{
                await user.deleteCompletely()
            } catch(e){
                console.log(e);
            }
            res.sendStatus(200)
        }
        else{
            res.sendStatus(404)
        }
    })

    /* Tools */
    app.get('/console/t/getUserByEmail', async (req, res) => {
        let email = req.query.email || ''

        let user = await database.dynamic_call({
            collection:'users',
            method:'findOne',
            query:{ email },
            options:{ projection:{ _id:1 } }
        })

        if(!user || !email){ res.redirect('/console/users') }
        else{ res.redirect(`/console/user/${user._id}`) }
    })
}