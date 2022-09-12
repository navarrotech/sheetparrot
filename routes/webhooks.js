import Stripe from 'stripe'
import User from '#objects/User.js'

const stripe = Stripe(process.env.STRIPE_API_KEY);

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

export default function(app, { authorization, tools, database, sendgrid }){

    // 2.0
    app.get('/webhooks/stripe', async (req, res) => {
        try{
            
            // <-- Validate & verify the webhook is legit -->
            let { id } = req.body;
            if(!id){ res.sendStatus(400); return; }

            if(req.body && req.body.data && req.body.data.object && !req.body.data.object.livemode){ res.status(200).json({ received:true, livemode:false }) }

            let event;
            try{ event = await stripe.events.retrieve(id); } catch(e){ event = null }
            if(!event){ console.log("Unable to find webhook event: " + id); res.sendStatus(400); return; }

            // <-- Gather Data -->
            let stripeID = event.data && event.data.length?event.data.object.customer:null;
            if(!stripeID){ res.sendStatus(400); return; }

            let user_doc = await database.dynamic_call({ collection:'users', method:'findOne', query:{ "preferences.billing.stripeID":stripeID } })
            if(!user_doc){ res.sendStatus(409); return; }

            let user = new User(user_doc)

            // <-- Declarations -->
            let { email, _id, first_name, last_name } = user_doc,
                payload = event.data.object;

            if(process.env.NODE_ENV != "production"){ console.log(payload) }

            // <-- Actions -->
            switch(event.type){
                case "invoice.paid":
                    let subscription;
                    try{ subscription = await stripe.subscription.retrieve(payload.subscription) } catch(e){ subscription = null; }
                    if(!subscription){ res.sendStatus(429); return; }

                    let thePriceIsRight = price_table[subscription.plan.id]

                    database.dynamic_call({
                        collection:'users', method:'updateOne', query:{ _id:this.document._id },
                        actions:{
                            $unset:{ "preferences.billing.failed_payment":0 },
                            $set:{
                                "preferences.billing.plan":thePriceIsRight?thePriceIsRight.name:"professional",
                                "preferences.billing.plan_renews":new Date(subscription.current_period_end * 1000),
                                "preferences.billing.subscriptionID":subscription.id,
                                "preferences.billing.last_invoice":subscription.latest_invoice,
                                "preferences.usage.sheet_limit":thePriceIsRight?thePriceIsRight.new_limit:"unlimited",
                                "preferences.usage.sheet_usage":0
                            },
                            $inc:{
                                "preferences.stats.moneySpent":(payload.amount_paid || 1200) / 100,
                                "preferences.stats.paymentsMade":1
                            }
                        }
                    })

                    break;
                case "invoice.payment_failed":
                    database.dynamic_call({
                        collection:'users', method:'updateOne', query:{ _id },
                        actions:{ $set:{ "preferences.billing.failed_payment":payload.id || true } }
                    })
                    /* Gonna use Stripe's internal for this one :)
                    sendgrid.send_dynamic_template({
                        templateId:sendgrid.TEMPLATES.APP.FAILED_PAYMENT_NOTIFICATION,
                        templateData:{
                            button_href:`${req.lexicon.domain}/billing`,
                            amount:tools.formatStripeNumber(req.webhook.amount),
                            expiration_date:moment(req.event.created * 1000).add(14,'days').format('MMM DD')
                        },
                        toWhom:req.user.email
                    }) */
                    break;
                case "customer.subscription.deleted":
                    database.dynamic_call({
                        collection:'users', method:'updateOne', query:{ _id },
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
                        }
                    })
            
            
                    try{
                        /* Sendgrid Contacts Stuff */
                        sendgrid.addUserToList(email, first_name, last_name, sendgrid.CONTACT_LISTS.CANCELLED)
                        sendgrid.deleteUserFromList(email, sendgrid.CONTACT_LISTS.PAYING)

                        /* Reset all their stuff >:D */
                        user.resetContent();
                        user.resetPhotoLibrary();
                    } catch(e){ console.log(e); }
            
                    break;
                default:
                    console.log("Received unknown webhook: " + event.type)
                    break;
            }

            // <-- End -->
            res.status(200).json({ received:true })

        } catch(err){ database.logInternalError({ req, res, err }) }
    })

}