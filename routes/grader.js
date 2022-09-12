import Submission from '#objects/Submission.js'
import Sheet      from '#objects/Sheet.js'

import * as StringLimits from '#root/limits.json' assert { type: 'json' }

export default function(app, { authorization, tools, database, sendgrid }){

    app.get('/grade', authorization, async (req, res) => {
        try{
            res.render('./sheets/grader', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    function requireOwnership(req, res, next){
        if(req.submission && req.submission.owner._id == req.session.user._id){ next(); return; }
        res.status(404).send({ message:"Submission not found" }); return;
    }

    app.use('/submission', authorization, async (req, res, next) => {
        try{
            let submissionid = req.query._id || req.body._id;
            if(!submissionid){ res.status(400); res.send({ message:"Please include the submission id in your request!" }); return; }

            req.submission = new Submission();
            await req.submission.connect(submissionid)
            if(!req.submission.isConnected()){ res.status(404); res.send({ message:`Could not find a submission with the id: [${submissionid}]` }); return; }
        } catch(err){ database.logInternalError({ req, res, err }) }
        next();
    }, requireOwnership)
    
    app.get('/submission/get', async (req, res) => {
        try{
            res.status(200);
            res.send( await req.submission.getPublicVersion() )
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/submission/edit', async (req, res) => {
        try{
            let { cardid, key, value, multiline } = req.body,
                { _id } = req.submission,
                $set = {}, actions = {};

            /*
                Usage:  /submission/edit?_id=[submissionid]
                        Body: {
                            cardid:"card_1234",
                            key:"grade",
                            value:1
                        }
                value -> determines grade (1 = correct, 0 = reset/ignore, -1 = )
            */

            // TODO: Build support for multiline

            if(cardid == undefined){ res.status(400).send({ message:`Required body parameter is missing: ['cardid']`}); return; }
            if(key == undefined   ){ res.status(400).send({ message:`Required body parameter is missing: ['key']`   }); return; }
            if(value == undefined ){ res.status(400).send({ message:`Required body parameter is missing: ['value']` }); return; }

            let lookup = req.submission.getCardById(cardid)
            if(!lookup.success){ res.status(404).send({ message:`Unable to find card with id ["${cardid}"]!` }); return; }
            let set_key = `paper.${lookup.row_index}.${lookup.card_index}`

            if(lookup.card.type == 'multiline' && multiline == undefined){
                res.status(400).send({ message:`Required body parameter is missing for card type 'multiline': ['multiline'] (index of)` }); return;
            }

            if(key == 'grade'){
                // Validate the value
                if(isNaN(value = parseInt(value)) || ![1, -1, 0].includes(value)){ res.status(400).send({ message:`Invalid value ["${value}"] received` }) }

                // Check if the value isn't already set! To prevent duplicates
                if(lookup.card.type != 'multiline' && lookup.card[key] != value){
                    req.submission.paper[lookup.row_index][lookup.card_index][key] = value;
                    req.submission.paper[lookup.row_index][lookup.card_index]['graded'] = (value != 0);

                    let { correct, graded, total } = req.submission.getProgress('grading')
                    $set = {
                        'grade.correct':correct,
                        'grade.graded':graded,
                        'grade.total':total,
                        'grade.percentage':Math.round(( correct / total ) * 10000) / 100,
                        //'grade.finished':(graded == total)
                    }
                    $set[`${set_key}.${key}`] = value;
                    $set[`${set_key}.graded`] = (value != 0);
                }
                else if(lookup.card.type == 'multiline' && lookup.card[key] != value){
                    multiline = parseInt(multiline)
                    if(isNaN(multiline)){ res.status(400).send({ message:`Body parameter ['multiline'] must be an integer!` }); return; }

                    req.submission.paper[lookup.row_index][lookup.card_index].options[multiline][key] = value;
                    req.submission.paper[lookup.row_index][lookup.card_index].options[multiline]['graded'] = (value != 0);

                    let { correct, graded, total } = req.submission.getProgress('grading')
                    $set = {
                        'grade.correct':correct,
                        'grade.graded':graded,
                        'grade.total':total,
                        'grade.percentage':Math.round(( correct / total ) * 10000) / 100,
                        //'grade.finished':(graded == total)
                    }
                    $set[`${set_key}.options.${multiline}.${key}`] = value;
                    $set[`${set_key}.options.${multiline}.graded`] = (value != 0);
                }
            }
            else if(key == 'note'){
                $set[set_key + `.${key}`] = String(value).substring(0, StringLimits.submissions.notes);
            }
            else{
                res.status(400).send({ message:`Invalid key: ["${key}}"]` }); return;
            }

            if(Object.keys($set).length){ actions.$set = $set; }
            //if(Object.keys($inc).length){ actions.$inc = $inc; }
            if(Object.keys(actions).length){
                database.dynamic_call({ collection:'submissions', method:'updateOne', query:{ _id }, actions, v:1 })
                .then(r => { res.status(200).send({ message:"Successfully updated the submission.", changed:true }); }); return;
            }
            res.status(200).send({ message:"The submission was already set that way.", changed:false });
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/submission/delete', async (req, res) => {
        try{
            await req.submission.delete(); res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/submission/complete', (req, res) => {
        try{
            let { _id } = req.submission;

            if(req.submission.isFinished()){
                res.status(409).send({ message:"This submission has already been marked as complete!" }); return;
            }

            database.dynamic_call({
                collection:'submissions', method:'updatedOne', query:{ _id:req.submission },
                actions:{ 'grade.finished':true }
            })
            .then(async () => {
                
                let [ student, sheet ] = await Promise.all([
                    database.dynamic_call({
                        collection:'users', method:'findOne', query:{ _id:req.submission.submission.student },
                        options:{ projection:{ _id:0, email:1 } }, v:1
                    }),
                    database.dynamic_call({
                        collection:'sheets', method:'findOne', query:{ _id:req.submission.sheet.sheetid },
                        options:{ projection:{ _id:0, sheetname:1 } }, v:1
                    })
                ])

                let { correct, total } = req.submission.submission.grade

                let grade = Math.round((correct / total) * 10000) / 100
                sendgrid.send_dynamic_template({
                    templateId:sendgrid.TEMPLATES.USER.SUBMISSION_GRADED,
                    templateData:{
                        grade:`${grade}%`,
                        sheetname:sheet.sheetname,
                        button_href:`${process.env.DOMAIN}/sheet/${req.submission.sheet.sheetid}?vs=${_id}&i=${req.submission.student}` //vs = view_submission
                    },
                    toWhom:student.email
                })
            })
            res.status(200).send({ message:"Successfully marked the submission as complete." });
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.get('/submissions/getByQuestion', authorization, async (req, res) => {
        try{
            // Used to grade by single question instead of each submission one at a time

            let { pagination_limit=100, pagination=0, sheetid, cardid } = req.query;
            let { _id:owner } = req.session.user

            if(!sheetid){ res.status(400).send({ message:`Required query parameter is missing: ['sheetid']` }); return; }
            if(!cardid ){ res.status(400).send({ message:`Required query parameter is missing: ['cardid']`  }); return; }


            let sheet = new Sheet()
            await sheet.connect(sheetid, owner);
            if(!sheet.isConnected()){ res.status(404).send({ message:`Sheet not found` }); return; }

            let { row_index=0, card_index=0, success } = sheet.getCardById(cardid)
            if(!success){ res.status(404).send({ message:`Unable to find a card with the id: [${cardid}]` }); return; }

            let r = await database.dynamic_call({
                collection:'submissions', method:'find', query:{ sheetid, owner },
                pagination, pagination_limit, options:{
                    projection:{  _id:1, 'paper':{ $arrayElemAt:[ {$arrayElemAt:['$paper', row_index]}, card_index] } } // Upgrade one day to search for the ID? instead of a fixed index?
                }
            })

            // Re-validation
            if(r && r.length){
                // r.forEach(row => { if(row.id != cardid){ delete row } })
                r = r.filter(row => { return (row.id == cardid) })
            }

            res.status(200).send(r);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/grader/sheets', authorization, async (req, res) => {
        try{
            // Used to collect other sheets by the owner, to display in the grader
            let [total, sheets] = await Promise.all([
                database.dynamic_call({ collection:'sheets', method:'countDocuments', query:{ owner:req.email, last_submit:{ $exists:true } } }),
                database.dynamic_call({ collection:'sheets', method:'find', query:{ owner:req.email, last_submit:{ $exists:true } }, pagination_limit:6, pagination:0,
                    options:{ projection:{ _id:0, sheetid:1, sheetname:1 }, sort:{ last_submit:1 } } }),
            ])
            res.status(200);
            res.send({ sheets, total })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/grader/mostRecent', authorization, async (req, res) => {
        try{
            let { sheetid } = req.query,
                { _id:owner } = req.session.user
            
            let query = { owner }
            if(sheetid && sheetid != "undefined"){ query.sheetid = sheetid }

            let result = await database.dynamic_call({
                collection:'submissions', method:'findOne', query, options:{ sort:{ created:1 } }
            })
            res.send({ success:result?true:false, result:result?result._id:null, sheetid:result ? result.sheetid : sheetid });
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.get('/grader/submissions', authorization,  async (req,res) => {
        try{
            // Used to show other submissions in the grader
            let { sheetid, page=0, limit=100 } = req.query;
            if(!sheetid){ res.status(400); res.send({ message:"Please include parameter [sheetid] in your URL query!" }); return; }

            let sheetCheck = new Sheet()

            let [total, list] = await Promise.all([
                database.dynamic_call({ collection:'submissions', method:'countDocuments', query:{ sheetid } }),
                database.dynamic_call({ collection:'submissions', method:'find', query:{ sheetid }, pagination_limit:limit, pagination:page,
                    options:{ projection:{ _id:1, student:1, grade:1, created:1 }, sort:{ created:1 } } }),
                sheetCheck.connect(sheetid, req.email)
            ])

            if(!sheetCheck.isConnected){ res.status(404); res.send({ message:"The sheet you're looking for cannot be found!" }); return; }

            let student_names = await database.dynamic_call({ collection:'users', method:'find',
                query:{ _id:{ $in:list.map(s => s.student) } }, options:{ projection:{name:1, email:1, _id:1 } } })

            list.forEach(submission => {
                let index = student_names.findIndex(e => e._id == submission.student)
                if(index != -1 && list[index]){
                    submission.name = student_names[index].name;
                    submission.email = student_names[index].email;
                }
            })
            
            res.send({ total, list })
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
}