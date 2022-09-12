import Stripe from 'stripe'
import User from "#objects/User.js"

const stripe = Stripe(process.env.STRIPE_API_KEY);

const prices = process.env.NODE_ENV == 'production' ?
{
    professional:{
        id:'prod_LO2R9T8OMbWCQA',
        monthly:'price_1KqPpLLR9MjLBbZosrxaJmrS'
    }
} : {
    professional:{
        id:"prod_KsN875m2kyP9rE",
        monthly:"price_1KqPqVLR9MjLBbZoT8f4dDVH"
    }
}

const price_table = process.env.NODE_ENV == 'production' ?
{
    'price_1KqPpLLR9MjLBbZosrxaJmrS':{
        id:'prod_LO2R9T8OMbWCQA',
        new_limit:'unlimited',
        name:'professional'
    }
} : {
    'price_1KqPqVLR9MjLBbZoT8f4dDVH':{
        id:'prod_KsN875m2kyP9rE',
        new_limit:'unlimited',
        name:'professional'
    }
}

export default function(app, { authorization, database, sendgrid }){
    
    app.use('/billing/', authorization)

    app.get('/billing/', (req, res) => {
        try{
            res.render('./billing/singlepage', req.lexicon);
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/upgrade', (req, res) => {
        try{
            res.redirect('/billing')
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    // 1.0
    app.get('/billing/failedPayment', async (req, res) => {
        try{
            let user_billing = req.session.user.preferences.billing

            // DEVELOPER OVERRIDE
            if(process.env.NODE_ENV === "development"){
                req.lexicon.failed_card = await stripe.charges.retrieve("ch_3JlHJJLR9MjLBbZo1MQzah0X").catch(e => { req.lexicon.failed_card = null; });

                if(!req.lexicon.failed_card){ console.log("Charge not found!"); res.redirect('/billing/paymentMethods'); return; }

                let retry_expires = new Date(req.lexicon.failed_card.created * 1000);
                retry_expires = new Date( retry_expires.setDate(retry_expires.getDate() + 14) ).toDateString().slice(4);

                req.lexicon.failed_card.retry_expires = retry_expires
                res.render('./billing/failedPayment', req.lexicon)
                return;
            }

            if(user_billing.status && user_billing.status == "failed" && user_billing.failed_payment){
                req.lexicon.failed_card = await stripe.charges.retrieve(user_billing.failed_payment).catch(e => { req.lexicon.failed_card = null; });

                if(!req.lexicon.failed_card){ res.redirect('/billing/paymentMethods'); return; }

                let retry_expires = new Date(req.lexicon.failed_card.created * 1000);
                retry_expires = new Date( retry_expires.setDate(retry_expires.getDate() + 14) ).toDateString().slice(4);

                req.lexicon.failed_card.retry_expires = retry_expires
                res.render('./billing/failedPayment', req.lexicon)
                return;
            }
            res.redirect('/billing')
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    // 2.0
    app.get('/billing/v2/data', async (req, res) => {
        try{
            let { stripeID, subscriptionID, paymentMethod, last_invoice, plan } = req.session.user.preferences.billing
            let { email, profile_picture, first_name, is_vip } = req.session.user

            let [customer, subscription, invoice, primaryPaymentMethod, user] = await Promise.all([
                stripe.customers.retrieve(stripeID), // Customer object
                subscriptionID?stripe.subscriptions.retrieve(subscriptionID):null, // Subscription object
                last_invoice?stripe.invoices.retrieve(last_invoice):null,  // Latest invoice
                paymentMethod?stripe.paymentMethods.retrieve(paymentMethod):null,
                database.dynamic_call({ collection:'users', method:'findOne', query:{ _id:req.session.user._id } }) // Update the session!
            ]);
            
            if(subscription && subscription.cancel_at_period_end){
                subscription.status = 'cancelling'
            }
            if(subscription && subscription.status == 'canceled' && process.env.NODE_ENV != 'production'){
                console.log("Unsetting subscription-- Localhost only")
                database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:req.session.user._id },
                actions:{
                    $set:{
                        "preferences.billing.plan":"free",
                        "preferences.billing.plan_renews":new Date(),
                        "preferences.usage.sheet_limit":3,
                        "preferences.usage.sheet_usage":0
                    },
                    $unset:{
                        "preferences.billing.subscriptionID":1,
                        "preferences.billing.failed_payment":1
                    }
                }})
            }

            if(user && process.env.NODE_ENV != 'production'){ console.log('Updating the session now from billing/data!'); req.session.user = user; }

            res.status(200).send({
                plan:is_vip?'vip':plan,
                email,
                first_name,
                profile_picture,
                stripe:{
                    customer,
                    subscription,
                    primaryPaymentMethod,
                    invoice
                }
            })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/billing/plans', (req, res) => {
        try{
            res.render('billing/plans', req.lexicon);
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    // Post calls
    app.post('/billing/update', async (req, res) => {
        try{
            // <-- Variable Declaration -->
            let { _id, first_name } = req.session.user,
                { plan, subscriptionID } = req.session.user.preferences.billing,
                { feedback, cancel_at_period_end=true } = req.body

            // <-- Validation -->
            if(plan == "free" || !req.session.user.preferences.billing.subscriptionID){ // Cancel check
                res.status(409).send({ message:`Cannot cancel plan, there is no subscription currently active!` }); return;
            }

            // <-- Updates -->
            const subscription = await stripe.subscriptions.update(subscriptionID, { cancel_at_period_end });

            await database.dynamic_call({
                collection:'users', method:'updateOne', query:{ _id },
                actions:{ $set:{
                    "preferences.billing.subscriptionID":subscription.id,
                    "preferences.billing.plan_renews":new Date(subscription.current_period_end * 1000),
                    "preferences.billing.last_invoice":subscription.latest_invoice
                }}
            });

            req.session.user.preferences.billing.subscriptionID = subscription.id;
            req.session.user.preferences.billing.plan_renews = new Date(subscription.current_period_end * 1000);
            req.session.user.preferences.billing.last_invoice = subscription.latest_invoice;

            // <-- Response -->
            res.status(200).send({
                message:`Successfully updated your subscription.`,
                last_day:subscription.current_period_end * 1000,
                status:cancel_at_period_end?'cancelling':'active'
            })

            if(!cancel_at_period_end){ return; }

            // <-- Post actions -->
            sendgrid.send_dynamic_template({
                templateId:sendgrid.TEMPLATES.ADMIN_ALERTS.NEW_CANCELLATION,
                templateData:{
                    feedback,
                    email:req.email,
                    name:req.session.user.first_name + ' ' + req.session.user.last_name
                },
                toWhom:process.env.ADMIN_NOTIFICATIONS_EMAIL
            })

            // Email them and thank them for being a part of SheetParrot.
            sendgrid.send_dynamic_template({
                templateId:sendgrid.TEMPLATES.USER.CANCELLATION_GOODBYE,
                templateData:{
                    name:first_name
                },
                toWhom:req.email
            })
            
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    // 3.0 - Stripe Routes
    app.get('/stripe/checkout', authorization, async (req, res) => {
        try{
            let { price=prices.professional.monthly } = req.query,
                { stripeID:customer, subscriptionID:subscription } = req.session.user.preferences.billing

            // If they already have a subscription, why let them create a second one??
            if(subscription){ res.redirect('/billing/'); return; }

            const session = await stripe.checkout.sessions.create({
                mode: 'subscription',
                customer,
                line_items: [ { price, quantity:1 } ],
                success_url: `${process.env.DOMAIN}/stripe/thank-you?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.DOMAIN}/stripe/return`,
            });

            res.redirect(303, session.url)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    });
    app.get('/stripe/portal', authorization, async (req, res) => {
        try{
            let { stripeID:customer } = req.session.user.preferences.billing

            const session = await stripe.billingPortal.sessions.create({
                customer, return_url: `${process.env.DOMAIN}/stripe/return`,
            });
            
            res.redirect(session.url)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/stripe/thank-you', (req, res) => {
        try{
            let { session_id } = req.query
            // We have to do it this way, because express session doesn't play nice with this route.
            // When this route is called from stripe.com, it doesn't send the cookies with it!
            res.send(`<!doctype html><html><head><title>Redirecting...</title><script>window.location.href = "${process.env.DOMAIN}/billing/processPayment?s=${session_id}"</script></head><body></body></html>`)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/billing/processPayment', async (req, res) => {
        try{
            // http://localhost:8080/stripe/thank-you?session_id=cs_test_a1SVN9LhBsk0PwErv8KqKBPONKyE3QHOIs7uEh875fDj1QFyDdyE1PoiU8
            let { s:session_id } = req.query;
            if(!session_id || !req.authorized){ if(req.authorized){ console.log(`Skipping checkout post-processing payment for user ${req.session.user.email}`); } res.redirect('/billing?goto=1'); return; }

            /* Sendgrid Contacts Stuff */
            try{
                if(req.authorized){
                    let { email, first_name, last_name } = req.session.user;
                    sendgrid.addUserToList(email, first_name, last_name, sendgrid.CONTACT_LISTS.PAYING)
                    sendgrid.deleteUserFromList(email, sendgrid.CONTACT_LISTS.CANCELLED)
                }
                database.alertDiscord(`@everyone New checkout purchase from ${first_name} ${last_name} (${email})`)
            } catch(e){ console.log(e); }

            let event, subscription;
            try{ event = await stripe.checkout.sessions.retrieve(session_id) } catch(e){ console.log(e); event = null; }
            try{ subscription = await stripe.subscriptions.retrieve(event.subscription) } catch(e){ console.log(e); subscription=null; }

            if(event && event.customer === req.session.user.preferences.billing.stripeID && subscription){
                if(process.env.NODE_ENV != 'production'){ "Successfully updating user's session to match their checkout session" }

                let thePriceIsRight = price_table[subscription.plan.id]
                req.session.user.preferences.billing.plan = thePriceIsRight.name
                req.session.user.preferences.billing.plan_renews = new Date(subscription.current_period_end * 1000)
                req.session.user.preferences.billing.subscriptionID = event.subscription
                req.session.user.preferences.billing.last_invoice = subscription.latest_invoice
                req.session.user.preferences.usage.sheet_limit = 'unlimited'

                database.dynamic_call({
                    collection:'users', method:'updateOne', query:{ _id:req.session.user._id },
                    actions:{
                        $set:{
                            "preferences.billing.plan":thePriceIsRight.name,
                            "preferences.billing.plan_renews":new Date(subscription.current_period_end * 1000),
                            "preferences.billing.subscriptionID":event.subscription,
                            "preferences.billing.last_invoice":event.subscription,
                            "preferences.usage.sheet_limit":'unlimited',
                            "preferences.usage.sheet_usage":0
                        },
                        $unset:{
                            "preferences.billing.failed_payment":1
                        }
                    }
                })
            }

            res.redirect('/billing?goto=1')
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/stripe/return', (req, res) => {
        try{
            // We have to do it this way, because express session doesn't play nice with this route.
            // When this route is called from stripe.com, it doesn't send the cookies with it!
            res.send(`<!doctype html><html><head><title>Redirecting...</title><script>window.location.href = "${process.env.DOMAIN}/billing"</script></head><body></body></html>`)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/stripe/check', async (req, res) => {
        try{
            //let event = await stripe.checkout.sessions.retrieve("cs_test_a1xyChA1OA2Xd4AnXUzqyu0FjMsnA0U60BVATdsQzfzMPNF1iFII7focZG")
            let event = await stripe.subscriptions.retrieve("sub_1KgYtELR9MjLBbZoKXuUwYKT")
            res.send(event);
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
}