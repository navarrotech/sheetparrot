import {
    database, sendgrid, amazon, tools, authorization
} from '../utility.js'

import Stripe from 'stripe'
import { ObjectId } from 'mongodb'
import twofactor    from "node-2fa"
import moment from 'moment'
import * as StringLimits from '#root/limits.json' assert { type: 'json' }

const stripe = Stripe(process.env.STRIPE_API_KEY);

function regenerateSession(session){
    return new Promise(acc => { session.regenerate(acc) })
}

export default class User {

    /*
        this.document = database object
        this.billing = user.preferences.billing
        this.plan = plan
        this.email = email
    */

    // You can use the constructor to generate from a session, or an already-pulled database object.
    constructor(user_object){
        if(user_object && user_object.name && user_object.email){
            this.document = user_object
            this.billing = user_object.preferences.billing
            this.plan = this.billing.plan
            this.email = user_object.email;
        }
    }

    isConnected(){ return (this.document) ? true : false }
    
    /* <---- Connectors ----> */
    async connectByEmail(email){
        email = String(email).toLowerCase();
        this.document = await database.dynamic_call({ collection:'users', method:'findOne', query:{ email } }); await this.setup();
    }
    async connectById(id){
        this.document = await database.dynamic_call({ collection:'users', method:'findOne', query:{ _id:ObjectId(id) } }); await this.setup();
    }
    // Similar to constructor, however is designed to be interally used for connect() methods
    async setup(){
        if(!this.isConnected()){return;}
        if(this.document.preferences && this.document.preferences.billing){
            this.billing = this.document.preferences.billing;
            this.plan = this.billing.plan;
        }
        this.email = this.document.email;
    }
    async refresh(){
        if(!this.document || !this.document._id){ return; }
        await this.connectById(this.document._id);
    }

    /* <---- Plan Permissions ----> */
    canCreateSheet(){
        if(!this.isConnected()){ return false; }

        // Paid plans
        if(this.plan == "basic"){ return true; }
        if(this.plan == "professional"){ return true; }

        // Exceptions
        if(this.document.is_vip && this.document.is_vip == true){ return true; }
        if(this.plan == "admin"){ return true; }

        // Free plan, usage
        let limit = (this.document.preferences && this.document.preferences.usage) ? this.document.preferences.usage.sheet_limit : 0,
            curr  = (this.document.preferences && this.document.preferences.usage) ? this.document.preferences.usage.sheet_usage : 0
            
        if(curr < limit){ return true; }

        return false;
    }
    canCreateClassroom(){
        if(!this.isConnected()){ return false; }

        // Paid plans
        if(this.plan == "basic"){ return false; }
        if(this.plan == "professional"){ return true; }

        // Exceptions
        if(this.document.is_vip && this.document.is_vip == true){ return true; }
        if(this.plan == "admin"){ return true; }

        return false;
    }

    /* <---- Settings ----> */
    sendVerification(){
        if(this.document.verified || process.env.DOMAIN.includes('localhost')){ return; }
        sendgrid.send_dynamic_template({
            templateId: sendgrid.TEMPLATES.USER.VERIFY_EMAIL,
            templateData:{
                "firstname":this.document.first_name,
                "name": this.document.name || '',
                "email": this.document.email,
                "image": (this.document.profile_picture) || 'https://www.sheetparrot.com/images/account.svg',
                "button_href":`${process.env.DOMAIN}/verify?token=${database.encrypt(this.document.email)}`
            },
            toWhom:this.document.email
        })
    }

    /* <---- Deletion ----> */
    async deleteCompletely(){
        if(!this.isConnected()){ return false; }
        // Let's go on a killing spree with all of their stuff

        //await this.resetPhotoLibrary() <- Why reset when we are deleting?
        await this.resetContent()

        await database.dynamic_call({
            collection:'users',
            method:'deleteOne',
            query:{ email:this.email }
        })
        
        stripe.customers.del(
            this.document.preferences.billing.stripeID
        );
    }
    async resetPhotoLibrary(){
        if(!this.isConnected()){ return false; }

        let _id = String(this.document._id)
        amazon.deleteFromS3(`library/${_id}`)
        amazon.deleteFromS3(`profile/${_id}`)
        amazon.deleteFromS3(`logo/${_id}`)
    }
    async resetContent(){

        let sheets_to_delete = [], 
            promises = [];

        let call_1 = await database.dynamic_call({
            collection:'sheets',
            method:'find',
            query:{ owner:this.email },
            options:{ projection:{ sheetid:1 } }
        })
        call_1.forEach(s => { sheets_to_delete.push( s.sheetid ) })

        // Remove all sheets created under the user
        promises.push(database.dynamic_call({
            collection:'sheets',
            method:'deleteMany',
            query:{ owner:this.email }
        }));
        // Remove all submissions to sheets that were under the user
        promises.push(database.dynamic_call({
            collection:'submissions',
            method:'deleteMany',
            query:{ owner:this.email }
        }));
        // Remove all questions to sheets that were under the user
        promises.push(database.dynamic_call({
            collection:'questions',
            method:'deleteMany',
            query:{ sheetid:{ $in:sheets_to_delete } }
        }));
        // Remove all folders in their name
        promises.push(database.dynamic_call({
            collection:'folders',
            method:'deleteMany',
            query:{ owner:this.email }
        }))
        
        console.log(`RESET USER: [${this.email}]`)

        await Promise.all(promises)
        return true;
    }
    async create({ first_name, last_name, email, password, fb_user_id, method, referrer, type='student' }){
        let today = new Date(),
            thirty_days_from_now = new Date(today.setMonth(today.getMonth() + 1));

        if(!['student', 'teacher', 'any'].includes(type)){ type='student' }

        async function createUniqueId(){
            let _id = database.uuid();

            let existing = await database.dynamic_call({
                collection:'users', method:'findOne', query:{ _id }
            })
    
            if(!existing){ return _id; }
            else{ return (await createUniqueId()) }
        }

        let { id:stripeID } = await stripe.customers.create({
            email, name:`${first_name} ${last_name}`
        });

        let _id = await createUniqueId()

        first_name = String(first_name).substring(0, StringLimits.general.first_name)
        last_name = String(last_name).substring(0, StringLimits.general.last_name)
        email = String(email).substring(0, StringLimits.general.email)

        let template = {
            _id,
            name:`${first_name} ${last_name}`,
            first_name,
            last_name,
            email,
            signed_up:new Date(),
            verified:false,
            images:[],
            //type,
            type:'any',
            profile_picture:`${process.env.DOMAIN}/images/account.svg`,
            preferences:{
                signin:method,
                billing:{
                    plan:"free",
                    stripeID,
                    plan_renews:thirty_days_from_now,
                    subscriptionID:null,
                    paymentMethod:null,
                    last_invoice:null
                },
                notifications:{
                    login:false,
                    submissions:true,
                    updates:true,
                    marketing:true
                },
                twofactor:{
                    secret:'',
                    enabled:false
                },
                interface:{
                    author:{
                        name:`By ${first_name} ${last_name}`,
                        showPicture:true
                    },
                    default_brand:"SheetParrot",
                    default_logo:process.env.DOMAIN + "/images/logo.svg",
                    theme:"#1f3a8a",
                    onSubmit:"Thank you for your submitting your work! Once your work is graded, you can view it in your dashboard."
                },
                visitedHistory:[],
                usage:{
                    sheet_usage:0,
                    sheet_limit:5
                },
                stats:{
                    last_login:new Date(),
                    logins:1,
                    paymentsMade:0,
                    moneySpent:0,
                    mySubmissions:0,
                    submissionsToMe:0,
                    graded_papers:0
                },
                referrer
            }
        }

        if(method == 'native' && password){
            password = String(password).substring(0, StringLimits.general.password)
            template.password = database.encryptPassword(password)
        }
        if(method == 'facebook' && fb_user_id){ template.fb_user_id = fb_user_id }

        this.email = email;
        this.document = template;
        this.plan = template.preferences.billing.plan;
        this.billing = template.preferences.billing;

        // Verification Email
        if(method == "native"){ this.sendVerification() }

        // Notify Admins
        if(!process.env.DOMAIN.includes('localhost')){
            //sendgrid.send_dynamic_template({ templateId:sendgrid.TEMPLATES.USER.WELCOME, templateData:{ email }, toWhom:process.env.ADMIN_NOTIFICATIONS_EMAIL })
            database.alertDiscord(`New signup: ${first_name} ${last_name}\nEmail: ${email}\nMethod: ${method}`)
        }

        // Add user to SendGrid contacts list
        sendgrid.addUserToList(email, first_name, last_name, sendgrid.CONTACT_LISTS.USERS)
        sendgrid.deleteUserFromList(email, sendgrid.CONTACT_LISTS.LEADS, false) 

        await database.dynamic_call({
            collection:'users', method:'insertOne', query:template
        })
    }

    /* <---- Billing ----> */
    // Used when they login
    async refreshSubscription(){

        let plan = (this.billing)?this.billing.plan:'free'

        let $set = {}

        if(plan == "free"){
            $set = {
                "preferences.usage.sheet_limit":3,
                "preferences.usage.sheet_usage":0
            }
            this.document.preferences.usage.sheet_limit = 3
            this.document.preferences.usage.sheet_usage = 0
        }
        if(plan == "professional"){
            $set = {
                "preferences.usage.sheet_limit":"unlimited",
                "preferences.usage.sheet_usage":0
            }
            this.document.preferences.usage.sheet_limit = "unlimited"
            this.document.preferences.usage.sheet_usage = 0
        }

        await database.dynamic_call({
            collection:'users', method:'updateOne', query:{ email:this.email }, actions:{ $set }
        })

    }
    // Used when a webhook cancels their account
    async cancelAccount(){

        if(this.document.is_vip){ return; }

        // TODO: how does this update the session object?

        this.document.preferences.billing.plan = "free"
        this.document.preferences.billing.subscriptionID = null
        this.document.preferences.usage.sheet_limit = 3
        this.document.preferences.usage.sheet_usage = 0

        let $set = {
            "preferences.billing.plan":"free",
            "preferences.billing.subscriptionID":null,
            "preferences.usage.sheet_limit":3,
            "preferences.usage.sheet_usage":0
        }

        await database.dynamic_call({
            collection:'users', method:'updateOne', query:{ email:this.email }, actions:{ $set }
        })

    }

    /* <---- Authentication ----> */
    hasTwoFactorEnabled(){
        if(!this.isConnected()){ return false; }
        return (this.document.preferences.twofactor && this.document.preferences.twofactor.secret && this.document.preferences.twofactor.enabled == true)
    }
    testTwoFactor(code){
        if(!this.hasTwoFactorEnabled()){ return true; }
        let test = twofactor.verifyToken(this.document.preferences.twofactor.secret, code);
        if(test && test.delta == 0){ return true; }
        return false;
    }
    async authenticate(req, res){
        await regenerateSession(req.session)
        req.session.user = this.document;
        req.session.authorized = true;
        req.authorized = true;

        /* NEW LOGIN TO YOUR ACCOUNT WARNING : Slug size was 150mb D: !!
        REQUIRES: const DeviceDetector from 'node-device-detector'); const Detector = new DeviceDetector;
        MODULES: node-device-detector, 

        if(this.document.preferences.notifications.login && this.document.preferences.signin == "native" && process.env.NODE_ENV == "production"){
            let userAgent = req.get('User-Agent');
            sendgrid.send_dynamic_template({
                templateId:sendgrid.TEMPLATES.USER.LOGIN,
                toWhom:this.email,
                templateData:{
                    date:moment.utc(moment()).format('MMM Do YYYY'),
                    time:moment.utc(moment()).format('hh:mm a'),
                    email:this.email,
                    device:Detector.detect(userAgent),
                    ip:req.ipInfo
                }
            })
        }*/

        database.dynamic_call({
            collection:'users',
            method:'updateOne',
            query:{ email:this.email },
            actions:{
                $set:{ 'preferences.stats.last_login':new Date() },
                $inc:{ 'preferences.stats.logins':1 }
            }
        })

        let billing = this.billing

        if(billing.plan_renews && billing.subscriptionID && new Date(billing.plan_renews).getTime() < (new Date()).getTime()){

            let $set = {}

            let subscription;
            if(billing.subscriptionID){
                subscription = await stripe.subscriptions.retrieve(billing.subscriptionID)

                if(subscription && subscription.status == "canceled"){ 
                    $set["preferences.billing.plan_renews"] = null
                    console.log(`CANCELLING billing for [${this.email}] to [${(billing.plan).toUpperCase()}]`)
                    // "Downgrade" them to free plan here.
                    await this.cancelAccount();
                }
                else if(subscription){
                    $set["preferences.billing.plan_renews"] = new Date(subscription.current_period_end * 1000)
                    console.log(`RENEWING billing for [${this.email}] [${(billing.plan).toUpperCase()}]`)
                    // Re-upadate their subscription's benefits here
                    await this.refreshSubscription();
                }
            }

            req.session.user = this.document;

            if(!$set["preferences.billing.plan_renews"]){ return; }
            database.dynamic_call({
                collection:'users', method:'updateOne', query:{ email:this.email }, actions:{ $set }
            })



        }
        
    }
}