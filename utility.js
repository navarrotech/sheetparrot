import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

// Amazon imports
import fs from 'fs'
import AWS from 'aws-sdk'

// Database imports
import { MongoClient } from 'mongodb'
import crypto from 'crypto'
import moment from 'moment'
import axios  from 'axios'

// Sendgrid imports
import SendGrid from '@sendgrid/mail'
import SendGridClient from '@sendgrid/client';

const {
    MongoUri,
    SENDGRID_API_KEY,
} = process.env

const admin_email = 'support@sheetparrot.com'

SendGrid.setApiKey(SENDGRID_API_KEY)
SendGridClient.setApiKey(SENDGRID_API_KEY);

const TESTING_MODE = (process.env.NODE_ENV === "development");

// Database
const mongoClient = new MongoClient(process.env.MongoUri, {    
    keepAlive: 1,
    connectTimeoutMS: 60000,
    socketTimeoutMS: 60000,
    useNewUrlParser: true,
    useUnifiedTopology: true
})

var connection,
    collection,
    myDB;

const dynamic_call = async function(data_set){
    
    /* 
    let data_set = {
        database:'sheetparrot',
        collection:'users',
        method:'updateOne',
        query:{ email:'alex@navarrocity.com' },
        actions:{ $set:{ test:true } },
        options:{ sort:{ name: 1 } },
        pagination:1,
        pagination_limit:20,
        callback:function(){ console.log("Yes absolutely!") }
    } */
    
    try {
        if(!connection){
            connection = await mongoClient.connect()
        }
        if(!myDB){
            myDB = connection.db('sheetparrot')
            console.log('Connected to database (backup)')
        }
        let collection;
        if(data_set.database == 'sheetparrot'){
            collection = myDB.collection(data_set.collection)
        }
        else{
            let temp_DB = connection.db(data_set.database)
            collection = temp_DB.collection(data_set.collection)
        }

        let cursor = null;

        /* Depending on which method they selected, we'll query correctly. */
        if(data_set.method === 'updateOne')
            cursor = await collection.updateOne( data_set.query || null, data_set.actions || null, data_set.options || null )
        else if(data_set.method === 'updateMany')
            cursor = await collection.updateMany( data_set.query || null, data_set.actions || null, data_set.options || null )
        else if (data_set.method === 'findOne')
            cursor = await collection.findOne( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'find' && data_set.pagination === undefined)
            cursor = await collection.find( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'find' && data_set.pagination !== undefined)
            cursor = await collection.find( data_set.query || null, data_set.options || null ).skip((data_set.pagination || 0) * data_set.pagination_limit).limit(data_set.pagination_limit || 20)
        else if (data_set.method === 'insertOne')
            cursor = await collection.insertOne( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'insertMany')
            cursor = await collection.insertMany( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'replaceOne')
            cursor = await collection.replaceOne( data_set.query || null, data_set.actions || null )
        else if (data_set.method === 'updateOne')
            cursor = await collection.findOneAndUpdate( data_set.query || null, data_set.actions || null )
        else if (data_set.method === 'deleteOne')
            cursor = await collection.deleteOne( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'deleteMany')
            cursor = await collection.deleteMany( data_set.query || null, data_set.options || null )
        else if (data_set.method === 'countDocuments')
            cursor = await collection.countDocuments( data_set.query || null, data_set.options || null )

        if(data_set.method === 'find'){
            let document_list = []
            await cursor.forEach(doc => document_list.push(doc))
            cursor = document_list
        }

        // Verbose
        if((data_set.v || data_set.verbose) && process.env.NODE_ENV != 'production'){
            if(["find", "findOne"].includes(data_set.method)){
                let count = data_set.method == "find"?cursor.length:(cursor == null)?0:1;
                console.log(`Database: [${data_set.method}] => (${data_set.collection}) ${JSON.stringify(data_set.query)} returned [${count}] items.`)
            }
            if(['countDocuments'].includes(data_set.method)){
                console.log(`Database: [${data_set.method}] => (${data_set.collection}) ${JSON.stringify(data_set.query)} counted [${cursor || 0}] items.`)
            }
            if(['updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne', 'replaceMany'].includes(data_set.method)){
                console.log(`Database: [${data_set.method}] => (${data_set.collection}) ${JSON.stringify(data_set.query)}; Updated: [${cursor.modifiedCount}] | Matched: [${cursor.matchedCount}]`)
            }
            if(['insertOne', 'insertMany'].includes(data_set.method)){
                let status = 'undecided'
                console.log(cursor);
                console.log(`Databse: [${data_set.method}] => returned [${status}]`)
            }
        }

        // Return the result, whether it's an async return or callback return. Callback will always override the standard return.
        if(data_set.method === 'countDocuments'){ return (cursor || 0) } 
        else if(data_set.method === 'deleteOne'){ return true }
        else if(cursor === null && data_set.callback){ data_set.callback(null) }
        else if(cursor === null && data_set.callback === undefined){ return null; }
        else if(data_set.callback){ data_set.callback(cursor) }
        else if(data_set.method == "updateOne" || data_set.method == "insertOne"){ return data_set.query; }
        else { return cursor }
        
    } 
    catch(e){
        if(e.code == "ETIMEOUT"){
            console.log("Mongodb: ETIMEOUT detected. Attempting to reconnect...")
            mongoClient.connect().then(c => { console.log("Reconnected!"); myDB = c.db('sheetparrot')})
            return null;
        } else {
            console.log("Error originating from query_mongodb")
            console.log(e);
        }
    }
    //finally { await client.close() }
}

const connect  = async (col) => {
    let m = await mongoClient.connect();
    myDB = await m.db(col);
    collection = col;
    return;
}
const shutdown = async () => {
    if(myDB){
        await mongoClient.close()
    }
    console.log("Database connection closed!")
}

const aggregation = async function(data_set){
    /* 
    let data_set = {
        collection:'users',
        query:{ email:'alex@navarrocity.com' },
        actions:{ $set:{ test:true } },
        callback:function(){ console.log("Yes absolutely!") }
    } */
    
    try {
        let collection = myDB.collection(data_set.collection)

        let cursor = await collection.aggregate( [data_set.query || null, data_set.actions || null ] )
        
        let document_list = []
        if(cursor){
            await cursor.forEach(doc => document_list.push(doc))
            cursor = document_list
        }
        return document_list || cursor;

        // Return the result, whether it's an async return or callback return. Callback will always override the standard return.
        if(cursor === null && data_set.callback){ data_set.callback(null) }
        else if(cursor === null && data_set.callback === undefined){ return null; }
        else if(data_set.callback){ data_set.callback(((document_list.length == 0) ? document_list : null)) }
        else { return ((document_list.length == 0) ? document_list : null) }
    } 
    catch(e){ console.log(e); }
    //finally { await client.close() }

}

/* Validation Functions */
const deepSanitize = function(json){
    if(typeof json === 'string' || typeof json === 'number' || typeof json === 'boolean'){ return json; }
    else if(typeof json === 'function'){ return String(json) }
    let sanitize_layer = function(layer){
        
        let new_layer = {}, keys = Object.keys(layer), _san, key, value;
        
        for(_san=0;_san<keys.length;_san++){
            key = keys[_san]
            value = layer[key]
            if(typeof value === "object"){ new_layer[key] = sanitize_layer(value) }
            else if(typeof value === "function"){ new_layer[key] = String(value) }
            else{ new_layer[key] = value }
        }
        return new_layer;
    }
    return sanitize_layer(json);
}
const sanitize = function (text){

    text = String(text)

    /*
     * Illegal Characters:
     * ',"&<>=
     */

    // Replacing characters
    text = text.replaceAll(`&`, '&amp;')
    text = text.replaceAll(`"`, '&quot;')
    text = text.replaceAll(`'`, '&#096;')
    text = text.replaceAll(`\``, '"')
    text = text.replaceAll(`=`, '&equals;')
    text = text.replaceAll(`<`, '') // Removal of <>
    text = text.replaceAll(`>`, '') // InnerHTML will parse it as a tag

    return text;
}

/* Encryption */
const encrypt = (text) => {

    let cipher = crypto.createCipheriv('aes-256-ctr', process.env.ENCRYPTION_KEY, Buffer.from(process.env.ENCRYPTION_IV) );
    let encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return encrypted.toString('hex')
}
const decrypt = (text) => {

    let decipher = crypto.createDecipheriv('aes-256-ctr', process.env.ENCRYPTION_KEY, Buffer.from(process.env.ENCRYPTION_IV), 'hex');
    let decrpyted = Buffer.concat([decipher.update(Buffer.from(String(text), 'hex')), decipher.final()]);

    return decrpyted.toString()
}
const encryptPassword = (text) => { 

    let iv = crypto.randomBytes(16)

    let cipher = crypto.createCipheriv(
        'aes-256-ctr', // Algorithm
        process.env.PASSWORD_KEY, // Key
        iv // IV
    )

    let encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return `${encrypted.toString('hex')}.${iv.toString('hex')}`

}
const decryptPassword = (text) => {

    let hash = text.split('.'), 
        pass = hash[0],
        iv = hash[1]

    const decipher = crypto.createDecipheriv(
        'aes-256-ctr',  // Algorithm
        process.env.PASSWORD_KEY, // Key
        Buffer.from(iv, 'hex') // IV
    );

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(pass, 'hex')), decipher.final()]);

    return decrpyted.toString();

}
const generateNumberToken = function (type){
    if(type !== null)
        return type + "_" + Math.floor(10000000 + Math.random() * 90000000)
    else
        return Math.floor(10000000 + Math.random() * 90000000)
}
const generateSecureToken = function (){
    return crypto.randomBytes(32).toString('hex')
}
const getURI = function(){ return MongoUri; }
const getDB = function(){ return myDB; }

const uuid = function(len=11) {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
  
    for (var i = 0; i < len; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

const alertDiscord = function(message="undefined message"){
    try{
        axios.post('https://discord.com/api/webhooks/1018902148504899585/FjXXR-2YiYkoqDkAhMtpI4GyUN61_uQYWW1X3sukfQvXsqXDGd6x3imvd3eUzQzN5Y85', { content:message })
    } catch(e){ console.log('Failed to alert discord!'); console.log({ message }) }
}

const logInternalError = function({ req, res, err, is_page=false }){

    // Send headers (First Priority)
    if(!res.headersSent){
        let method = req.method.toLowerCase();
        if(['post','get'].includes(method) && !is_page){
            res.status(500).send({ success:false, message:"Internal Server Error" })
        }
        else{
            //res.render('error', req)
            res.redirect('/dashboard?ise=1')
        }
    }
    try{
        alertDiscord(`Server Internal Error: \nWhen: ${moment().format('MMM Do [at] h:mma ZZ')}\nError: ${typeof err == 'object' ? err : err }\nRoute: ${req.url}\nMethod: ${req.method}\nUser: ${req.authorized?req.session.user.email:'Anonymous'}`)
    } catch(e){ console.log(e); }

    // Log it into console
    console.log('Log internal error: ')
    console.log(err)

    // Log error in database
    dynamic_call({
        collection:'internalErrors',
        method:'insertOne',
        query:{
            created:new Date(),
            route:req.url,
            method:req.method,
            error:err
        }
    })

    if(process.env.NODE_ENV != 'production'){ return; }

    // Message admins
    sendgrid.send_dynamic_template({
        templateId:sendgrid.TEMPLATES.ADMIN_ALERTS.ERROR,
        templateData:{
            error_report:err.toString(),
            crash_date:moment().format('MMM Do [at] h:mma')
        },
        toWhom:process.env.ADMIN_NOTIFICATIONS_EMAIL
    })
}

export const database = {
    // Main method:
    dynamic_call, aggregation,
    // Sanitization:
    deepSanitize, sanitize, 
    // Encryption & security
    encrypt, decrypt, encryptPassword, decryptPassword,
    // Generation
    generateNumberToken, generateSecureToken,
    // Utility
    logInternalError, alertDiscord,
    // Getters
    getURI, getDB, uuid,
    // App management
    shutdown, connect
}

// Sendgrid
const SENDER = { email:"app@sheetparrot.com", name:"SheetParrot" }
const TEMPLATES = {
    ADMIN_ALERTS:{
        ERROR: "d-49f5f67f93c1428c9a1746ff92d3aca2",
        WEEKLY_REPORTS:"d-3c25ff52c981421fa57ac52f8a98ecf9",
        NEW_CANCELLATION:"d-fba2368030bf4664bf07070d19912a98"
    },
    USER:{
        LOGIN:"d-cc228b3d24e44cf8aff6ce5340472fb7",
        VERIFY_EMAIL:"d-56dee3d201f34354a4bee98c3c555894",
        WELCOME:"d-be09c08fa9d54d5badd8bc4376c8c2c2",
        DEADLINE_EXPIRED:"d-f318c5167ec549de98fc1a13190f4b87",
        DEADLINE_EXPIRED_TO_TEACHER:"d-a131dd4aaa904b3e8faf5ee37c1338e4",
        DEADLINE_SOON:"d-e9e751ccf19c48eea2f18d13cc6d038b",
        DEADLINE_SOON_TO_TEACHER:"d-3d9882114e964c1da44a9e2cede28445",
        RESET_PASSWORD:"d-6d56160b85bc4cf8a5eb7f7d444958ae",
        NEW_PASSWORD_ALERT:"d-1cc94e68dd4941e89b42bc2528ee8ebb",
        CANCELLATION_GOODBYE:"d-555a786a6f8b4664a7e9d6dc87561dca",
        STUDENT_INVITE:"d-288cc82bff464c539d6ab5cab5616060",
        STUDENT_INVITE_EXISTING:"d-288cc82bff464c539d6ab5cab5616060",
        NEW_ASSIGNMENT_ALERT:"d-057ea893d3b14fc8b2c868ca3c9a090b",
        SUBMISSION_GRADED:"d-f94360bb781844e1be15c7c224efb6df",
        RECEIVED_NEW_SUBMISSION:"d-b5ac647cca1e4c309a3bfecd63050651",
        NEW_QUESTION:"d-cda5748d401144e182f5f032c91fe730",
        QUESTION_REPLY:"d-65182498d0fa479bbf8c5803ba296a8e"
    },
    APP:{
        FEEDBACK:"d-a8c331f35a4a4b25913ebc74f2f4bfee",
        FAILED_PAYMENT_NOTIFICATION:"d-62f546f122584718ae2621f003be8141",
        CONTACT_US:"d-c890eb8b0bc24c0089edc04a69f328d8"
    },
    ORGANIZATION:{
        INVITE_TEACHER:"d-6523a2b3cf5549de97ae6f7039ca6a8f",
        INVITE_TEACHER_NEW:"d-82aa646fa1d348c7adb9cf5c02219fbf",
        TEACHER_REMOVED:"d-282d671632ca4f28b73476d110310402"
    }
}

const CONTACT_LISTS = {
    USERS:    "74c94f84-d624-4bc8-b495-b403afd27ad9",
    LEADS:    "28fd0b76-15fc-4c5e-abae-71582a6500ad",
    PAYING:   "556b4211-7e11-497d-8bd9-cad3ab976620",
    CANCELLED:"adf3730f-5466-4f65-bc69-a08858d36b96",
    STUDENTS: "7d9a4dfd-ad36-45f0-96df-f00f67500a26",
    TEACHERS: "c41d8a9d-7522-4f92-952a-68ee0bc7f917"
}
const ASM = {
    APP:15609,
}

const send_dynamic_template = async function(data){
    /* {
        templateId:'',
        templateData:{},
        toWhom:'',
        asm:'',
        BCC_ADMINS:true
    } */
   let message = {
        from:SENDER,
        templateId:data.templateId,
        dynamic_template_data:data.templateData,
        asm:{
            group_id:data.asm || ASM.APP
        }
    }
    await sendEmail(data.toWhom, message, (data.BCC_ADMINS || false))
}

const sendEmail = async function (to_whom, message, BCC_ADMINS=false){
    
    // Attach Alex to email for testing?
    if(((BCC_ADMINS || TESTING_MODE) && to_whom !== admin_email))
        message.personalizations = [{ to: [{ "email": to_whom }], bcc: [{ "email": admin_email }] }]
    else
        message.personalizations = [{ to: [{ "email": to_whom }] }]

    // Don't log warnings in live environment, and log when we do in local.
    if(!TESTING_MODE)
        message['hideWarnings'] = true
    else
        console.log("[SENDGRID] Sending an email to user now.")

    await SendGrid.send(message).catch(err => {
        if(err.code == 401 && err.response.body.errors[0].message == "Maximum credits exceeded"){
            console.log("[ERROR!] Sendgrid is maxed out!! We must upgrade our plan immediately!!")
        }
        else{
            console.log(err.response && err.response.body && err.response.body.errors ? err.response.body.errors : err)
        }
        console.log("EMAIL FAILED TO SEND.")
    })

}
const makeSendGridSafe = function(text){
    text = String(text)

    //let l = "{{{",r = "}}}"

    text = text.replaceAll('&quot;'  ,`"`)
    text = text.replaceAll('&#096;'  ,`'`)
    text = text.replaceAll('&amp;'   ,`&`)
    text = text.replaceAll('&equals;',`=`)
    text = text.replaceAll('&lt;'    , ``)
    text = text.replaceAll('&gt;'    , ``)
    
    return text;
}

const addUserToList = function(email, first_name, last_name, list){

    if(email.includes('@sheetparrot.com')){ console.log(`Would have added ${email} to SendGrid list, except it's a sheetparrot address.`); return; }

    const request = {
        method: 'PUT',
        url: 'v3/marketing/contacts',
        body:{
            list_ids:[list],
            contacts:[{
                email,
                first_name,
                last_name
            }]
        }
    }

    SendGridClient.request(request)
        .then(([response, body]) => {
            console.log(`Added [${email}] to SendGrid contact list with response code: ${response.statusCode}`);
        })
        .catch(err => {
            console.error(err)
            console.log(err.response.body)
        })
}
const deleteUserFromList = async function(user_email, list){

    if(user_email.includes('@sheetparrot.com')){ console.log(`Would have removed ${user_email} from SendGrid list, except it's a sheetparrot address.`); return; }

    function isBad(iss){ return null; }

    let user = await lookupUserByEmail(user_email)
    if(!user){ isBad('Contact not found'); return null; }

    // Gotta get through all the unnecessary nesting with erroring
    user = user.result;      if(!user){ isBad('No result'); return null; }
    user = user[user_email]; if(!user){ isBad('No user'); return null; }
    user = user.contact;     if(!user){ isBad('No contact'); return null; }

    let list_ids = user.list_ids
    if(!list_ids.length){ isBad('No list_ids'); return null; }

    if(!list_ids.includes(list)){ isBad('Not on list to be removed from'); return null; }

    const request = {
        method: 'DELETE',
        url: `v3/marketing/lists/${list}/contacts?contact_ids=${user.id}`
    }

    try{
        let [response, body] = await SendGridClient.request(request)
        console.log(`Removed [${user_email}] to SendGrid contact list with response code: ${response.statusCode}`);
        if(response && response.statusCode == 202){ return true; } else{ return false; }
    }
    catch(err){
        console.error(err); console.log(err.response.body)
    }

}
const lookupUserByEmail = async function(email){
    
    const request = {
        method: 'POST',
        url: `v3/marketing/contacts/search/emails`,
        body:{
            emails:[email]
        }
    }

    try{
        let [response, body] = await SendGridClient.request(request)
        if(response.statusCode == 200){ return body; }
        else{ console.log(response); return null; }
    } catch(err){
        if(err.code == 404){ return null; } else{ console.log(err); }
    }

}

export const sendgrid = {
    // JSON
    CONTACT_LISTS, TEMPLATES, ASM,
    // Dynamic sending
    send_dynamic_template, makeSendGridSafe,
    // Contact lists
    addUserToList, deleteUserFromList, lookupUserByEmail
}

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_KEYID,
    secretAccessKey: process.env.S3_ACCESS_KEY,
});

/* S3 - New Functions */
const formatS3Key = function(Key){

    Key = Key.replaceAll(' ', '')

    /*
    Key = Key.normalize('NFD').replace(/[\u0300-\u036f]/g, "")

    Key = Key.replaceAll('&', '-A-')
    Key = Key.replaceAll('$', '-B-')
    Key = Key.replaceAll('=', '-D-')
    Key = Key.replaceAll(';', '-E-')
    Key = Key.replaceAll(':', '-F-')
    Key = Key.replaceAll('+', '-G-')
    Key = Key.replaceAll(',', '-H-')
    Key = Key.replaceAll('?', '-I-')
    Key = Key.replaceAll('\\', '-J-')
    Key = Key.replaceAll('{', '-K-')
    Key = Key.replaceAll('}', '-L-')
    Key = Key.replaceAll('^', '-M-')
    Key = Key.replaceAll('%', '-N-')
    Key = Key.replaceAll('`', '-O-')
    Key = Key.replaceAll('[', '-P-')
    Key = Key.replaceAll(']', '-Q-')
    Key = Key.replaceAll('<', '-R-')
    Key = Key.replaceAll('>', '-S-')
    Key = Key.replaceAll('~', '-T-')
    Key = Key.replaceAll('#', '-U-')
    Key = Key.replaceAll('|', '-V-')
    Key = Key.replaceAll('\"', '-W-')
    Key = Key.replaceAll('@', '-AT-')
    Key = Key.replaceAll('.', '-DOT-')
     */

    return Key;
}
const uploadToS3 = function(data){
    /*
        {
            file:image_file,
            path:"/library/_id",
            name:"123.png"
        }
    */

    if(data.path.endsWith('/')){ data.path = data.path.slice(0, -1); }
    if(data.path.startsWith('/')){ data.path = data.path.slice(1); }
    if(!data.name.startsWith('/')){ data.name = '/' + data.name }

    let Key = data.path + data.name

    Key = formatS3Key(Key)

    if(data.file.mimetype == "image/jpeg"){
        Key = Key + '.jpg'
    } else if(data.file.mimetype == "image/png"){
        Key = Key + '.png'
    } else if(data.file.mimetype == "image/svg+xml"){
        Key = Key + '.svg'
    } else if(data.file.mimetype == "image/gif"){
        Key = Key + '.gif'
    }else if(data.file.mimetype == "image/webp"){
        Key = Key + '.webp'
    }

    try{
        // Setting up S3 upload parameters
        let params = {
            Bucket: process.env.S3_BUCKET,
            Key, // File path + name
            Body: fs.readFileSync(data.file.path),
            ContentType:data.file.mimetype
        };
        
        // Uploading files to the bucket
        return new Promise(acc => {
            s3.upload(params, function(err, data) {
                if (err) {
                    console.error( err );
                    acc(null);
                }
                else{
                    acc(data)
                }
            });
        })
    } catch(e){ console.log(e) }
}
const getFromS3 = function(key){
    return new Promise(acc => s3.getObject({ Bucket: process.env.S3_BUCKET, Key:formatS3Key(key) }, (err, data) => acc({ err, data })))
}
const deleteFromS3 = function(Key){
    Key = formatS3Key(Key)

    if(Key.startsWith('/')){ Key = Key.slice(1) }

    return s3.deleteObject({ Bucket: process.env.S3_BUCKET, Key }).promise();
}
const deleteMultipleFromS3 = function(ListOfKeys=[]){
    /* 
     Usage: [
            { Key: 'a.txt' },
            { Key: 'b.txt' },
            { Key: 'c.txt' }
        ]
    */
    var deleteParam = {
        Bucket: process.env.S3_BUCKET,
        Delete: { Objects:ListOfKeys }
    };    
    return s3.deleteObjects(deleteParam).promise();
}

export const amazon = {
    uploadToS3,
    getFromS3,
    deleteFromS3,
    deleteMultipleFromS3
}

// Misc tools
function queryArrayOfObjects(array, query_key, query_value){
    let result = null;
    if(typeof array !== "object"){ return null }
    try{
        let obj; i=0; for(i=0; i<array.length; i++){
            obj = array[i]; 
            try{ if(obj[query_key] === query_value){ result = obj; break; } } catch(e){}
        }
    } catch(e){}
    return result;
}

function getDeepObjectAttribute(object, search_array){
    try{
        let val = object, stop = false;
        search_array.forEach(i => {
            // "Look before you leap" concept
            if(val[i] && stop == false)
                val = val[i]
            else
                stop = true
        })
        return val
    }
    catch(e){ 
        return null;
    }
}

function JSONforEach(obj, fn){
    if(typeof obj !== 'object'){ throw new Error("Given object is not a object") }
    try{
        let len = Object.keys(obj)
        let iteration; for(iteration=0; iteration<len.length; iteration++){
            let key = len[iteration], value = obj[len[iteration]]
            fn(key, value, iteration)
        }
    } catch(e){ console.error(e) }
}
function searchPaperForCardByCardID(object, cardID){
    try{
        let r = null;
        JSONforEach(object, (row_key, row_val) => {
            JSONforEach(row_val, (card_key, card_val) => {
                if(card_val["card-id"] == cardID || card_key == cardID)
                    r = { row_key, card_key, card_val }
            })
        })
        return r;
    }
    catch(e){
        console.error(e)
        return null
    }
}

function prettyPrintTimeBetweenTwoDates(then_date, now_date){
    let then = new Date(String(then_date)),
        now  = new Date(String(now_date)),
        mils = now.getTime() - then.getTime(),
        mins = Math.ceil( mils / (1000 * 60) ),
        hrs  = Math.ceil( mils / (1000 * 3600) ),
        days = Math.round( mils / (1000 * 3600 * 24) ),
        r = ''

        // If it was in the same day, within the minute
        if(days == 0 && mins <= 2){
            r = "one minute"
        }
        // If it was within the hour
        else if(days == 0 && mins >= 2 && mins < 60){
            r = mins + " minutes"
        }
        // If it was within the day
        else if(days == 0 && mins > 60){
            let mns = mins - 60
            r = Math.floor(mins / 60) + " hours and " + String(mns % 60) + " minutes"
        }
        // If it was yesterday
        else if(days == 1){
            r = "one day"
        }
        // If it's within the last month:
        else if(days >= 2 && days <= 30){
            r = days + " days"
            
            let leftover_hrs = hrs % 24,
                leftover_mins= mins % 60

            if(leftover_hrs !== 0 || leftover_mins == 0)
                r += ` and ${leftover_hrs} hours`
            else
                r += ` and ${leftover_mins} minutes`
        }
        // If it's longer than a month:
        else if(days > 30){
            r = Math.round(days / 30)
            r = (r == 1) ? "1 month" : r + " months"
        }
        // If it's longer than a year:
        else if(days > 365){
            r = Math.round(days / 365)
            r = (r == 1) ? "1 year" : r + " years"
        }
        return r;
}

function formatStripeNumber(str='000'){
    str = String(str)
    if(str == ''){ str="000" }
    if(str.length == 1){ str = "00" + str }
    else if(str.length == 2){ str = "0" + str }

    if(str.startsWith('-'))
        return "-$" + str.slice(1, -2) + '.' + str.slice(-2)
    else
        return "$" + str.slice(0, -2) + '.' + str.slice(-2)
}

const getGradeProgress = function(paperObj){
    let r = {
        total:0,
        graded:0,
        correct:0,
        incorrect:0
    }
    JSONforEach(paperObj, (row_keys, row_vals) => {
        JSONforEach(row_vals, (card_keys, card_vals) => {
            if(card_vals.type !== 'video' && card_vals.type !== 'button' && card_vals.type !== 'multiline'){
                r.total += 1;
                if(card_vals.graded)
                    r.graded += 1;
                if(card_vals.grade == 1)
                    r.correct += 1;
                else if(card_vals.grade == -1)
                    r.incorrect += 1;
            }
            else if (card_vals.type == 'multiline'){
                JSONforEach(card_vals.multiline_data, (option_key, option_vals) => {
                    r.total += 1;
                    if(option_vals.graded)
                        r.graded += 1;
                    if(option_vals.grade == 1)
                        r.correct += 1;
                    else if(card_vals.grade == -1)
                        r.incorrect += 1;
                })
            }
        })
    })
    return r;
}

export const tools = {
    queryArrayOfObjects,
    getDeepObjectAttribute,
    searchPaperForCardByCardID,
    JSONforEach,
    prettyPrintTimeBetweenTwoDates,
    formatStripeNumber,
    getGradeProgress
}

// Authentication & Permissions

export const authorization = (req, res, next) => {

    let cookie_options = {
        httpOnly: true,
        sameSite: true,
        secure:   true
    }

    // If they are logged in, proceed
    if(req.session && req.session.authorized){
        req.session.user.email = (req.session.user.email).toLowerCase()
        req.email = (req.session.user.email).toLowerCase()
        next()
    }
    // If they are not logged in, deny the request
    else if(req.method == "POST"){
        res.status(401).send({ message:"Please login to make that request!" }); return;
    }
    // If they are not logged in, send them to login!
    else {
        if( !req.url.startsWith('/login') )
            res.cookie('redirect_after_login', req.originalUrl, cookie_options)
        res.cookie('logout_reason', 'mustlogin', cookie_options)

        res.redirect(307, '/login'); return;
    } 
}