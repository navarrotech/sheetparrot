import moment from 'moment'

import User  from '#objects/User.js'
import Sheet from '#objects/Sheet.js'

import * as StringLimits from '#root/limits.json' assert { type: 'json' }

export default function(app, { authorization, tools, database, sendgrid }){

    /* <---- Remastered ----> */
    /* Middleware */
    app.use('/sheet/v2/*', async (req, res, next) => {
        let nocontinue = false;
        try{
            let sheetid = (req.query.sheetid) ? req.query.sheetid : (req.params && req.params.sheetid) ? req.params.sheetid : (req.body && req.body.sheetid) ? req.body.sheetid : undefined;
            if(!sheetid){ res.status(400); res.send({ message:"Missing paremeter: sheetid" }); return; }
            req.sheetid = sheetid;

            let sheet = new Sheet()
            await sheet.connect(sheetid)
            if(!sheet.isConnected()){ res.status(404); res.send({ message:"The sheet you're trying to modify cannot be found." }); return; }

            req.sheet = sheet;
        } catch(err){ database.logInternalError({ req, res, err }); nocontinue = true; }

        if(nocontinue){ return; }

        next()
    })

    /* User Routes */
    app.get('/sheet/:sheetid', async (req, res) => {
        try{
            /* <-- Sheet statistics --> */
            let { sheetid } = req.params,
                $inc = { "stats.views":1 };

            req.lexicon.sheetid = sheetid

            //if(!req.cookies[`viewed_${sheetid}`]){ $inc["stats.uniques"] = 1; }

            database.dynamic_call({ collection:'sheets', method:'updateOne', query:{ _id:sheetid }, actions:{ $inc } })
            if(req.authorized){
                // Check for duplicates
                req.session.user.preferences.visitedHistory = req.session.user.preferences.visitedHistory.filter(a => a.sheetid != sheetid)
                // Push new to history
                req.session.user.preferences.visitedHistory.push({ sheetid, visited:new Date() })
                req.session.user.preferences.visitedHistory = req.session.user.preferences.visitedHistory.slice(0, 5)
                database.dynamic_call({
                    collection:'users', method:'updateOne', query:{ _id:req.session.user._id },
                    actions:{ $set:{ 'preferences.visitedHistory':req.session.user.preferences.visitedHistory } }
                })
            }

            //res.cookie(`viewed_${sheetid}`, 'true', { maxAge:1000*60*60*24, httpOnly:true, secure:!process.env.DOMAIN.includes('localhost') })
            res.render('sheets/sheet', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/sheets', authorization, (req, res) => {
        try{
            let user = new User(req.session.user)
            req.lexicon.can_create = user.canCreateSheet()

            res.render('sheets/list', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })
    app.get('/sheets/view/:sheetid', authorization, async (req, res) => {

        try{
            let { sheetid } = req.params;
            if(!sheetid){ res.cookie('status','sheet_not_found'); res.redirect('/sheets'); return; }

            let sheet = new Sheet();
            await sheet.connect(sheetid, req.session.user._id)

            if(!sheet.isConnected()){ res.cookie('status','sheet_not_found'); res.redirect('/sheets'); return; }

            req.lexicon.folder = await sheet.getParentFolder();
            req.lexicon.sheet = await sheet.sheet;

            res.render('sheets/details', req.lexicon)

        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }

    })
    app.get('/sheet/v2/edit', async (req, res) => {
        try{
            req.lexicon.sheet = await req.sheet.sheet;

            req.lexicon.default_brand = req.authorized ? req.session.user.preferences.interface.default_brand : ''
            req.lexicon.default_logo = req.authorized ? req.session.user.preferences.interface.default_logo : ''

            res.render('sheets/editor', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    /* $GET requests */
    app.get('/sheets/v2/list', authorization, async (req, res) => {
        try{
            let folder_id = req.query.f,
                content = [],
                folder = { name:"root", path:"root", pathids:"root", subfolders:[], sheets:[] },
                subfolders = [],
                view = req.query.view

            // If no folder given, we just get the "root"
            // If a folder IS given, we find it and search for all ids in the folder.
            // If a folder IS given and not found, we should return 404

            let sheets_call = {
                collection:'sheets',
                method:'find',
                query:{ owner:req.session.user._id },
                options:{ 
                    sort:{  sheetname:1 },
                    projection:{ 
                        sheet_password:0,
                        author:0,
                        submission:0,
                        success_message:0
                    }
                }
            }

            if(folder_id){
                let folder_call = await database.dynamic_call({ collection:'folders', method:'findOne', query:{ _id:folder_id } })
                if(folder_call){ 
                    folder = folder_call;
                    subfolders = folder.subfolders
                    sheets_call.query['sheetid'] = { $in:folder_call.sheets }
                }
            }
            else{
                subfolders = await database.dynamic_call({
                    collection:'folders',
                    method:'find',
                    query:{
                        owner:req.session.user._id,
                        parentFolder:'root'
                    },
                    options:{
                        projection:{
                            name:1,
                            _id:1,
                            color:1
                        },
                        sort:{
                            modified:-1
                        }
                    }
                }) || []
            }
            if(folder.path != "root"){
                sheets_call.query.sheetid = { $in:folder.sheets }
            }
            else{
                sheets_call.query.parentFolder = "root"
            }

            if(!(view && view == "folders"))
                content = await database.dynamic_call(sheets_call)

            res.status(200)
            res.send({content, folder, subfolders})
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/sheet/v2/property/:property', authorization, async (req, res) => {
        try{
            let { property } = req.params,
                { sheetid } = req,
                { pagination=0 } = req.query;

            if(typeof pagination == 'string'){ pagination = parseInt(pagination) }

            if(!['questions', 'submissions'].includes(property)){ res.sendStatus(400); return; }

            let content_call, total_call;
            switch(property){
                case "questions":
                    content_call = {
                        collection:'questions',
                        method:'find',
                        query:{ sheetid },
                        options:{ sort:{ created:1 }, sort:{ status:-1, created:-1  } }, 
                        pagination,
                        pagination_limit:15
                    }
                    total_call = {
                        collection:'questions',
                        method:'countDocuments',
                        query:{ sheetid }
                    }
                    break;
                case "submissions":
                    content_call = {
                        collection:'submissions',
                        method:'find',
                        query:{ sheetid },
                        options:{ sort:{ submitted_time:1 } },
                        pagination,
                        pagination_limit:20
                    }
                    total_call = {
                        collection:'submissions',
                        method:'countDocuments',
                        query:{ sheetid }
                    }
                    break;
                case "students":
                    content_call = {
                        collection:'users',
                        method:'find',
                        query:{ 'teachers.teacher':req.email }, // $or:[ {assigned_sheets:sheetID}, { submissions:sheetID } ]
                        options:{ sort:{ email:1 }, projection:{ preferences:0, password:0, _id:0, verified:0, authorization:0, } },
                        pagination,// parseInt(pagination),
                        pagination_limit:15
                    }
                    total_call = {
                        collection:'users',
                        method:'countDocuments',
                        query:{ 'teachers.teacher':req.email }
                    }
                    break;
            }

            let [content, total] = await Promise.all([
                database.dynamic_call(content_call),
                database.dynamic_call(total_call)
            ])

            // Some security modifications
            if(property == "students"){
                content.forEach(student => {
                    student.teacher = (student.teachers || []).filter((i) => i.teacher == req.email)
                    if(student.teacher.length){ student.teacher = student.teacher[0] }
                    delete student.teachers
                })
            }

            if(property == "submissions"){
                let students_docs = await database.dynamic_call({ collection:'users', method:'find', query:{ _id:{ $in: content.map(s => s.student) } },
                    options:{ projection:{ _id:1, name:1, first_name:1, profile_picture:1, email:1 } } })
                content.forEach(c => {
                    let index = students_docs.findIndex(s => c.student == s._id);
                    if(index == -1){
                        c.student = {
                            name:"Anonymous",
                            first_name:"Anonymous",
                            profile_picture:`${process.env.DOMAIN}/images/account.svg`,
                            email:"Anonymous"
                        };
                        return;
                    };
                    c.student = students_docs[index]
                })
            }
            //console.log(content)

            res.status(200);
            res.send({ content, total })
        } catch(err){ database.logInternalError({ req, res, err }) }

    })
    app.get('/sheet/v2/toCSV/:property', authorization, async (req, res) => {
        try{
            let whitelist = ['submissions'], property = req.params.property
            if(!whitelist.includes(property)){ res.sendStatus(400); return; }

            let iterable = await database.dynamic_call({
                collection:'submissions',
                method:'find',
                query:{ sheetid:req.sheetid },
                options:{ sort:{ submitted_time:1 } }
            })
            if(!iterable || iterable.length === 0){ res.sendStatus(204); return; }

            let final_status = 200,
                paperObj = null,
                data = `"Student Email","Student Name","Final Grade","Total Questions","Total Graded","Correct Answers","Wrong Answers","Student Time To Complete","Start Time","Submitted Time"\n`;
            try{

                iterable.forEach(subs => {
                    let line = `${subs.user_email},${subs.user_name},`

                    // Total Time Calculation
                    let start = new Date( String(subs['started_time']) ),
                        stop  = new Date( String(subs['submitted_time']) )

                    paperObj = new Sheet(null, subs['paper']);
                    let grades = paperObj.getProgress("grading")
                
                    line += `"${(grades.graded == 0) ? "Not Graded" : subs['grade'] + "%"}",`
                    line += `"${grades.total || '0'}",`
                    line += `"${grades.graded || '0'}",`
                    line += `"${grades.correct || '0'}",`
                    line += `"${grades.incorrect || '0'}",`
                    line += `"${tools.prettyPrintTimeBetweenTwoDates(start, stop)}",`
                    line += `"${new Date(subs.started_time).toLocaleString()}",`
                    line += `"${new Date(subs.submitted_time).toLocaleString()}"`

                    data += line + '\n'
                })

            }
            catch(e){ final_status = 500; console.log(e); }
            finally{ res.status(final_status); res.send(data); }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/sheet/v2/settings', authorization, async (req, res) => {

        try{
            res.status(200)
            res.send({
                sheetname     :req.sheet.sheet.sheetname,
                owner         :req.sheet.sheet.owner,
                privacy       :req.sheet.sheet.privacy,
                sheet_password:req.sheet.sheet.sheetname,
                submission    :req.sheet.sheet.submission,
                due_date      :req.sheet.sheet.due_date,
            })
        } catch(err){ database.logInternalError({ req, res, err }) }

    })
    app.get('/sheet/v2/get', authorization, async (req, res) => {
        try{
            res.status(200); res.send(await req.sheet.sheet);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/sheet/v2/graph', authorization, async (req, res) => {
        try{
            let old_date = new Date()
            old_date.setDate(old_date.getDate() - 30)
            old_date = new Date(old_date) 

            let [last_30_days, total_submissions] = await Promise.all([
                database.dynamic_call({
                    collection:'submissions',
                    method:'find',
                    query:{ sheetid:req.sheetid, submitted_time:{ $gte:old_date } },
                    options:{ sort:{ submitted_time:1 }, projection:{ submitted_time:1 } }
                }),
                database.dynamic_call({
                    collection:'submissions',
                    method:'countDocuments',
                    query:{ owner:req.email, sheetid:req.sheetid }
                })
            ])

            res.status(200)
            res.send({last_30_days, total_submissions})
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/sheet/public/get', async (req, res) => {
        try{
            let { sheetid, p:sheet_password, vs, i } = req.query;

            let sheet = new Sheet()

            let submission_call = null;
            if(vs && i){
                submission_call = database.dynamic_call({ collection:'submissions', method:'findOne', query:{ sheetid, student:i, _id:vs } })
            }
            else if(req.authorized){
                submission_call = database.dynamic_call({ collection:'submissions', method:'findOne', query:{ sheetid, student:req.session.user._id } })
            }

        let [ past_submission ] = await Promise.all([
                submission_call,
                sheet.connect(sheetid)
            ])
            
            if(!sheet.isConnected()){ res.status(404); res.send({ message:"The requested sheet that you're requesting cannot be found" }); return; }

            let data = await sheet.getPublicVersion(),
                sheetname = sheet.sheet.sheetname,
                is_owner = (req.authorized && sheet.sheet.owner == req.email)

            if(past_submission){ res.status(202); res.send({ paper:past_submission.paper, submission:past_submission, sheet:data }); return; }
            
            if(sheet.sheet.privacy == "password" && sheet.sheet.sheet_password){
                if(!sheet_password){
                    res.status(412); res.send({ message:"A password has been set by the teacher and is required to access this sheet.", sheetname, theme:sheet.sheet.theme }); return;
                }
                if(sheet_password != sheet.sheet.sheet_password){
                    res.status(409); res.send({ message:"The password you have entered is incorrect. Please try again.", sheetname }); return;
                }
            }
            if(sheet.sheet.privacy == "private" && !is_owner){
                res.status(423); res.send({ message:"This sheet is set to private! Please login or change the privacy mode to view this sheet.", sheetname, theme:sheet.sheet.theme }); return;
            }

            // Get the teacher/owner's document
            let owner = await database.dynamic_call({ collection:'users', method:'findOne', query:{ _id:sheet.sheet.owner } })

            if(owner){
                data.author = {
                    name:owner.preferences.interface.author.name,
                    profile_picture:(owner.preferences.interface.author.showPicture) ? owner.profile_picture : ''
                }
            } else{ console.log(`OWNER NOT FOUND FOR SHEET: [${sheet.sheet.owner}]`) }

            if(sheet.isPastDue() && !is_owner){
                res.status(208); res.send({ message:"This sheet is past it's due date! You cannot submit work for this sheet after it's due.", sheetname, due_date:sheet.sheet.due_date.date }); return;
            }

            if(owner && req.authorized && req.session.user.email == owner.email){ res.status(203); }
            else if (sheet.isPastDue()){ res.status(207); }
            else{ res.status(200); }

            res.send(data);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    /* $POST requests */
    app.post('/sheet/v2/save', authorization, async (req, res) => {
        try{
            let { sheetid } = req,
                $set = {}, invalid_parameters = [];

            if(!req.body){ req.body = {} }

            let keys = Object.keys(req.body)
            keys.forEach(key => {
                key = key.toLowerCase()

                if(['stats', 'history'].includes(key)){ return; }
                else if(key == 'paper'){
                    let p = new Sheet(null, req.body.paper)
                    p = p.validatePaper("normal")
                    if(p.invalid_parameters && p.invalid_parameters.length){
                        p.invalid_parameters.forEach(inv => invalid_parameters.push(inv))
                        return;
                    }
                    $set.paper = p.paper;
                }
                else if(['video', 'theme', 'submission', 'due_date'].includes(key)){
                    if(typeof req.body[key] != 'object'){ return; }
                    let subkeys = Object.keys(req.body[key])
                    if(!subkeys || !subkeys.length){ return; }
                    subkeys.forEach(subkey => {
                        subkey = String(subkey)

                        if(!StringLimits.sheets[key] || !StringLimits.sheets[key][subkey]){
                            invalid_parameters.push(`Received unknown parameter: [${key}.${subkey}]`); return;
                        }

                        if(subkey == 'enabled'){
                            $set[`${key}.${subkey}`] = ['true', true].includes(req.body[key][subkey])?true:false
                        }
                        else{
                            $set[`${key}.${subkey}`] = String(req.body[key][subkey]).substring(0, StringLimits.sheets[key][subkey])
                        }
                    })
                }
                else if(key == 'privacy'){
                    if(['public','private','password'].includes(req.body[key])){ $set['privacy'] = req.body[key]; }
                    else{ invalid_parameters.push(`Parameter 'privacy' contains invalid value '${req.body[key]}' -> Must be set to 'public', 'private', or 'password'`) }
                }
                else if(['headline', 'subheadline', 'sheetname', 'sheet_password'].includes(key)){
                    $set[key] = String(req.body[key]).substring(0, StringLimits.sheets[key])
                }
                else if(['_id', 'sheetid', 'owner', 'parent_folder', 'parentfolder', 'last_submit'].includes(key)){
                    delete req.body[key]
                }
                else{
                    invalid_parameters.push(`Received unknown parameter: [${key}]`)
                }
            })

            if(invalid_parameters.length){
                res.status(400);
                res.send({ message:"Received invalid parameters", invalid_parameters });
                return;
            }

            let actions = { $set }
            
            let last_history_item = req.sheet.sheet.history.slice(-1).pop()
            if(last_history_item && last_history_item.what == "Edited Sheet"){ actions.$pop = { "history":1 } }

            let promises = []
            promises.push(
                database.dynamic_call({
                    collection:'sheets',
                    method:'updateOne',
                    query:{ _id:sheetid },
                    actions
                })
            );
            req.sheet.updateHistory(req.email, "Edited Sheet")

            await Promise.all(promises)

            res.status(200);
            res.send({ message:"You have successfully saved this sheet!" })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheets/create', authorization, async (req, res) => {
        try{
            // Authorization is enabled, because this is not being used by the middleware
            //let sheetname = req.body.sheet_name;
            //if(!sheetname){ res.sendStatus(400); return; }
            //if(sheetname.length < 5){ res.sendStatus(406); return; }
            let sheetname = 'New Sheet'

            let thisUser = new User(req.session.user)
            if(!thisUser.canCreateSheet()){ res.sendStatus(402); return; }

            let folder_id = req.body.folder_id || 'root', folder_exists = false;

            if(folder_id && folder_id != "root"){
                folder_exists = (await database.dynamic_call({
                    collection:'folders',method:'findOne',query:{owner:req.email,_id:folder_id}
                })) ? true : false
            }

            let sheet = new Sheet()
            let new_id = await sheet.create(sheetname, req.session.user, (folder_exists)?folder_id:'root')

            req.session.user.preferences.usage.sheet_usage += 1

            database.dynamic_call({
                collection:'users', method:'updateOne', query:{ _id:req.session.user._id },
                actions:{ $inc:{ "preferences.usage.sheet_usage":1, "preferences.stats.sheets":1 } }
            })

            if(folder_id && folder_id != "root"){
                await database.dynamic_call({
                    collection:'folders',method:'updateOne',query:{owner:req.email,_id:folder_id},
                    actions:{ $push:{sheets:new_id}, $set:{ modified:new Date() } }
                })
            }

            res.status(200);
            res.send({ url:`/sheet/v2/edit?sheetid=${new_id}`, sheetid:new_id });
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheet/v2/submit', authorization, async (req, res) => {
        try{
            let { sheetid } = req.query,
                { submission, time } = req.body,
                sheet = req.sheet;
            
            if(!submission){ res.status(400); res.send({ message:`Missing parameters! Please try this request again with the correct parameters.`}); return; }

            let [past_submission, owner] = await Promise.all([
                database.dynamic_call({ collection:'submissions', method:'findOne', query:{ user_email:req.email, sheetid } }),
                database.dynamic_call({ collection:'users', method:'findOne', query:{ _id:sheet.sheet.owner } })
            ])

            // If they've already submitted their work
            if(past_submission){ res.status(409); res.send({ message:"You have already submitted your work for this worksheet!" }); return; }

            // If the due date has already passed
            if(sheet.isPastDue()){ res.status(411); res.send({ message:"The deadline for submitting this sheet has already passed, you can't submit late work." }); return; }

            sheet.updateStat('submissions', 1)
            sheet.updateHistory(req.email, 'submissions')
            sheet.setParameter('last_submit', new Date())

            async function createUniqueId(){
                let _id = database.uuid()
                let existing_sheet = await database.dynamic_call({ collection:'submissions', method:'findOne', query:{ _id } })
                if(!existing_sheet){ return _id } else{ return (await createUniqueId()) }
            }

            let Submission = new Sheet(null, submission.paper)

            let p = await Submission.validatePaper("submission")
            if(p.invalid_parameters && p.invalid_parameters.length){
                res.status(400); res.send({ message:"Received unknown parameters for paper object", invalid_parameters:p.invalid_parameters }); return;
            }

            let paper = p.paper

            let grade = Submission.getProgress('grading')

            console.log({ connected:Submission.isConnected() })
            console.log(grade)

            // answers = tools.autoGrade(answers, sheet.paper, true)

            let document = {
                _id:await createUniqueId(),
                student:req.session.user._id,
                created:new Date(),
                owner:owner._id,
                sheetid,
                time,
                paper,
                grade:{
                    graded:grade.graded,
                    correct:grade.correct,
                    total:grade.total,
                    percentage:grade.grade_over_graded,
                    finished:grade.finished
                }
            }

            await database.dynamic_call({ collection:'submissions', method:'insertOne', query:document })

            // Email the owner about the new submission!
            if(owner && owner.preferences.notifications.submissions){
                sendgrid.send_dynamic_template({
                    templateId:sendgrid.TEMPLATES.USER.RECEIVED_NEW_SUBMISSION,
                    toWhom:owner.email,
                    templateData:{
                        name:req.session.user.name,
                        first_name:req.session.user.first_name,
                        email:req.email,
                        sheetid,
                        sheetname:req.sheet.sheet.sheetname
                    }
                })
            }

            req.session.user.preferences.stats.mySubmissions += 1;
            database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:req.session.user._id }, actions:{ $inc:{ "preferences.stats.mySubmissions":1 } } })
            database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id:sheet.sheet.owner }, actions:{ $inc:{ "preferences.stats.submissionsToMe":1 } } })

            res.status(200);
            res.send({ message:"Successfully submitted your work!"})
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheets/v2/moveToFolder', authorization, async (req, res) => {
        try{
            // An array of sheetids
            let sheetids = req.body.sheets,
                folderid = req.body.folderid;

            sheetids.forEach(async (sheet) => {
                let sheetObj = new Sheet()
                await sheetObj.connect(sheet)
                await sheetObj.move(folderid)
            })
            
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheet/v2/delete', authorization, async (req, res) => {
        try{
            await req.sheet.delete();
            req.session.user.preferences.stats.sheets -= 1

            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheet/v2/settings', authorization, async (req, res) => {
        try{
            let d = req.body,
                name = d.sheetname,
                priv = d.privacy,
                pass = d.privacy_password,
                mssg = d.success_message,
                edit = d.editable,
                view = d.show_correct,
                due  = d.is_due,
                dueD = d.due_date,
                dueS = d.submit_after_due,
                sheetid = req.sheetid,
                $set = {},
                items= [name,priv,pass,mssg,edit,view,due,dueD,dueS]

            items.forEach(i => { if(i){ database.sanitize(i) } })

            // Sheet details
            if(name){ $set['sheetname'] = name.substring(0, StringLimits.sheets.sheetname) }
            if(priv){
                let whitelist = ['public', 'private', 'password']
                if(whitelist.includes(priv)){ $set['privacy'] = priv }
            }
            if(pass){ $set['sheet_password'] = pass.substring(0, StringLimits.sheets.sheet_password) }
            // On submit
            if(mssg){ $set['submission.success_message'] = mssg.substring(0, StringLimits.sheets.successMessage) }
            if(edit){ $set['submission.can_students_edit'] = (edit == true || edit == 'true') ? true : false }
            if(view){ $set['submission.show_correct_ans']  = (view == true || view == 'true') ? true : false }
            if(view){ $set['submission.allow_anonymous']  = (view == true || view == 'true') ? true : false }
            // Due date
            if(due ){ $set['due_date.enabled'] = (due == true || due == 'true') ? true : false }
            if(dueD){ $set['due_date.date'] = new Date(dueD) }
            if(dueS){ $set['due_date.can_submit_after_due'] = (dueS == true || dueS == 'true') ? true : false }

            //if(Object.keys($set).length === 0){ res.sendStatus(400); return; }

            if(Object.keys($set).length != 0){

                await database.dynamic_call({
                    collection:'sheets',
                    method:'updateOne',
                    query:{ _id:sheetid, owner:req.session.user._id },
                    actions:{ $set }
                })
            }

            res.sendStatus(200)
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/sheet/v2/uniqueView', authorization, async (req, res) => {
        try{
            let { sheetid } = req;
            database.dynamic_call({ collection:'sheets', method:'updateOne', query:{ _id:sheetid }, actions:{ $inc:{ 'stats.uniques':1 } }})
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.post('/setDefault/logo', authorization, async (req, res) => {
        try{
            let { value } = req.body,
                { _id } = req.session.user;
            if(!value){ return res.sendStatus(400); }
            req.session.user.preferences.interface.default_logo = value;
            database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id }, actions:{ $set:{ "preferences.interface.default_logo":value } } })
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/setDefault/brandTitle', authorization, async (req, res) => {
        try{
            let { value } = req.body,
                { _id } = req.session.user;
            if(!value){ return res.sendStatus(400); }
            req.session.user.preferences.interface.default_brand = value;
            database.dynamic_call({ collection:'users', method:'updateOne', query:{ _id }, actions:{ $set:{ "preferences.interface.default_brand":value } } })
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
}