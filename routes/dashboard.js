import moment from 'moment'

export default function(app, { authorization, tools, database, sendgrid }){

    app.use('/dashboard', authorization)

    app.get('/dashboard', async (req, res) => {
        try{
            res.render('dashboard/main', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.get('/dashboard/me', async (req, res) => {
        try{
            /*
                Student 
                    Can see average grade
                    Can see their last 5 "visited" sheets
                    Can see their last 5 "submitted" sheets
                Teacher
                    Can see the latest activity of submissions (Like an "unread notifications" board)
                    Can see latest 5 sheets they own/manage
                    Can see a leaderboard of top students?
            */

            let user = req.session.user;

            let plan = user.preferences.billing.plan;
            if(user.is_vip){ plan = 'vip' }

            let type = user.type,
                payload = {
                    name:user.name,
                    email:user.email,
                    first_name:user.first_name,
                    last_name:user.last_name,
                    profile_picture:user.profile_picture,
                    type,
                    plan,
                    plan_renews:user.preferences.billing.plan_renews,
                    usage:user.preferences.usage,
                    statistics:user.preferences.stats,
                    sent:new Date().getTime()
                }, 
                db = database.getDB()

            if(type == "student"){

                let history = user.preferences.visitedHistory || []

                let [ averageGrade_cursor, submittedHistory, visitedHistory, recentSubmissions, averageTime_cursor, self_session_object ] = await Promise.all([
                    db.collection('submissions').aggregate([
                        { $match:{ "student":user._id } },
                        { $group:{ _id:"$sheetid", "percentage":{ $avg:"$grade.percentage" } } },
                        { $group:{ _id:"calculation", "average":{ $avg:"$percentage" } } }
                    ]),
                    database.dynamic_call({
                        collection:'submissions', method:'find',
                        query:{ student:user._id },
                        options:{ sort:{ created:1 } },
                        pagination:0, pagination_limit:5
                    }),
                    database.dynamic_call({
                        collection:'sheets', method:'find',
                        query:{ _id:{ $in:history.map(s => s.sheetid) } },
                        options:{ projection:{
                            paper:1, theme:1, _id:1, video:1, headline:1, subheadline:1, privacy:1, sheetname:1, due_date:1, history:1
                        }}
                    }),
                    database.dynamic_call({
                        collection:'submissions', method:'countDocuments',
                        query:{ student:user._id, created:{ $gt:moment().subtract(7, 'days').toDate() } }
                    }),
                    db.collection('submissions').aggregate([
                        { $match:{ "student":user._id } },
                        { $group:{ _id:"$sheetid", "time":{ $avg:"$time" } } },
                        { $group:{ _id:"calculation", "average":{ $avg:"$time" } } }
                    ]),
                    database.dynamic_call({
                        collection:'users', method:'findOne', query:{ _id:user._id }
                    })
                ])

                if(self_session_object){
                    req.session.user = self_session_object;
                    user = self_session_object;
                }

                // Average grade finalization
                let averageGrade = []; await averageGrade_cursor.forEach(d=>averageGrade.push(d));
                if(averageGrade[0] && averageGrade[0].average){ averageGrade = averageGrade[0].average }
                else{ averageGrade = '--' }
                
                // Average time finalization
                let averageTime = []; await averageTime_cursor.forEach(d=>averageTime.push(d));
                if(averageTime[0] && averageTime[0].average){ averageTime = averageTime[0].average }
                else{ averageTime = '--' }
                

                // Visited History finalization
                visitedHistory.forEach(sheet => {
                    sheet.last_visited = history.find(b => b.sheetid = sheet._id).visited
                })

                let sheets = await database.dynamic_call({
                    collection:'sheets', method:'find', query:{ _id:{ $in:submittedHistory.map(a => a.sheetid) } },
                    options:{ projection:{ _id:1, theme:1, headline:1, subheadline:1 } }
                });
                submittedHistory.forEach(history => {
                    history.sheet = sheets.find(a => a._id == history.sheetid);
                })
        
                payload.averageGrade = averageGrade;
                payload.submittedHistory = submittedHistory;
                payload.visitedHistory = visitedHistory;

                payload.averageTime = averageTime;
                payload.totalSubmissions = req.session.user.preferences.mySubmissions;
                payload.recentSubmissions = recentSubmissions;
            }
            else if (type == "teacher"){
                
                let [ self_session_object, notifications, notifications_total, recentSheets, studentsAverage_cursor, submissionsLast7Days, leaderboard_cursor ] = 
                    await Promise.all([
                        database.dynamic_call({
                            collection:'users', method:'findOne', query:{ _id:user._id }
                        }),
                        database.dynamic_call({
                            collection:'submissions', method:'find', query:{ owner:user._id, 'grade.finished':false }, 
                            options:{ projection:{  }, sort:{ created:-1 } }, pagination:0, pagination_limit:10
                        }),
                        database.dynamic_call({
                            collection:'submissions', method:'countDocuments', query:{ owner:user._id, 'grade.finished':false }
                        }),
                        database.dynamic_call({
                            collection:'sheets', method:'find', query:{ owner:user._id }, 
                            options:{ projection:{  }, sort:{ last_submit:1 } }, pagination:0, pagination_limit:3
                        }),
                        db.collection('submissions').aggregate([
                            { $match:{ "owner":user._id, "grade.finished":true } },
                            { $group:{ _id:"$sheetid", "percentage":{ $avg:"$grade.percentage" } } },
                            { $group:{ _id:"calculation", "average":{ $avg:"$percentage" } } }
                        ]),
                        database.dynamic_call({
                            collection:'submissions', method:'countDocuments',
                            query:{ owner:user._id, created:{ $gt:moment().subtract(7, 'days').toDate() } }
                        }),
                        db.collection('submissions').aggregate([
                            { $match:{ owner:String(user._id) } },
                            { $group:{ _id:"$student", "rank":{ $sum:"$grade.percentage" } }, },
                            { $sort:{ rank:-1 } },
                            { $limit:10 }
                        ]),
                    ])

                if(self_session_object){
                    req.session.user = self_session_object;
                    user = self_session_object;
                }
                
                // Students average finalization
                let studentsAverage = []; await studentsAverage_cursor.forEach(d=>studentsAverage.push(d));
                if(studentsAverage[0] && studentsAverage[0].average){ studentsAverage = studentsAverage[0].average }
                else{ studentsAverage = '--' }
                
                // Leaderboard finalization
                let leaderboard = [];
                await leaderboard_cursor.forEach(d=>leaderboard.push(d));

                let [ leaderboard_students, notification_student_objs, notification_sheet_objs ] = await Promise.all([
                    await database.dynamic_call({
                        collection:'users', method:'find', query:{ _id:{ $in:leaderboard.map(a => a._id) } },
                        options:{ projection:{ _id:1, name:1, email:1, profile_picture:1 } }
                    }),
                    await database.dynamic_call({
                        collection:'users', method:'find', query:{ _id:{ $in:notifications.length?notifications.map(a => a.student):[] } },
                        options:{ projection:{ first_name:1, last_name:1, profile_picture:1, _id:1 } }
                    }),
                    await database.dynamic_call({
                        collection:'sheets', method:'find', query:{ _id:{ $in:notifications.length?notifications.map(a => a.sheetid):[] } },
                        options:{ projection:{ theme:1, headline:1, subheadline:1, video:1, _id:1 } }
                    })
                ])

                if(leaderboard_students && leaderboard_students.length){
                    leaderboard.forEach(item => {
                        let student = leaderboard_students.find(a => a._id == item._id)
                        if(student){ delete student._id; item.student = student; item.status = "success"; }
                        else{ item.student = { name:"Deleted User", email:"Deleted User", profile_picture:1 }; item.status = "deleted"; }
                    })
                }

                if(notifications.length && notification_student_objs && notification_student_objs.length){
                    notifications.forEach(note => {
                        // Part 1: Student
                        let student_doc = notification_student_objs.find(a => a._id == note.student)
                        if(student_doc){
                            let { first_name, last_name, profile_picture } = student_doc;
                            note.student_document = { first_name, last_name, profile_picture }
                        }
                        else{
                            note.student_document = { first_name:'Anonymous', last_name:'', profile_picture:'' }
                        }
                        // Part 2: The sheet
                        let sheet_doc = notification_sheet_objs.find(a => a._id = note.sheetid)
                        if(sheet_doc){ note.sheet = sheet_doc }
                    })
                }

                payload.notifications = notifications || [];
                payload.notifications_total = notifications_total;
                payload.recentSheets = recentSheets;

                payload.totalSubmissions = user.preferences.stats.submissionsToMe;
                payload.studentsAverage = studentsAverage;
                payload.submissionsLast7Days = submissionsLast7Days;

                payload.leaderboard = leaderboard;
            }
            res.status(200);
            res.send(payload)
        } catch(err){ database.logInternalError({ req, res, err }) }
    })

    app.get('/viewAll/submissions', authorization, async (req, res) => {
        try{ res.render('dashboard/viewAllSubmissions', req.lexicon) }
        catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    app.post('/dashboard/getSubmissions', authorization, async (req, res) => {

        try{
            let { page:pagination=0, pagination_limit=100, startDate, endDate } = req.body, // ?p=0&l=100 => page=0 & limit = 100
                { type, _id } = req.session.user

            pagination = parseInt(pagination)
            pagination_limit = parseInt(pagination_limit)

            let query = (type == 'student' || type == 'any') ? { student:_id } : { owner:_id }

            if(startDate){
                query.created = { "$gte":new Date(startDate) }
            }
            if(endDate){
                if(!query.created){ query.created = {} }
                query.created.$lte = new Date(endDate)
            }

            let [ submissions, total ] = await Promise.all([
                database.dynamic_call({ collection:'submissions', method:'find', query, pagination, pagination_limit, options:{ sort:{ created:-1 } } }),
                database.dynamic_call({ collection:'submissions', method:'countDocuments', query })
            ])

            if(type == 'teacher' && submissions.length){
                let [ students, sheets ] = await Promise.all([
                    database.dynamic_call({ collection:'users', method:'find', query:{ _id:{ $in:submissions.map(s => s.student) } }, options:{ projection:{ _id:1, profile_picture:1, first_name:1, last_name:1, name:1, email:1 } } }),
                    database.dynamic_call({ collection:'sheets', method:'find', query:{ _id:{ $in:submissions.map(s => s.sheetid) } }, options:{ projection:{ _id:1, sheetname:1, } } })
                ])
                submissions.forEach(sub => {
                    let student = students.find(stud => stud._id == sub.student)
                    sub.student = student ? student : {
                        profile_picture:`${process.env.DOMAIN}/images/account.svg`,
                        first_name:`Anonymous`,
                        last_name:``,
                        name:`Anonymous`,
                        email:`Anonymous`
                    };
                    let sheet = sheets.find(sheet => sheet._id == sub.sheetid)
                    sub.sheet = sheet ? sheet : {
                        _id:null,
                        sheetname:"Not Found"
                    }
                })
            }
            if((type == 'student' || type == 'any') && submissions.length){
                let [ owners, sheets ] = await Promise.all([
                    database.dynamic_call({ collection:'users', method:'find', query:{ _id:{ $in:submissions.map(s => s.owner) } }, options:{ projection:{ _id:1, profile_picture:1, first_name:1, last_name:1, name:1, email:1 } } }),
                    database.dynamic_call({ collection:'sheets', method:'find', query:{ _id:{ $in:submissions.map(s => s.sheetid) } }, options:{ projection:{ _id:1, sheetname:1, } } })
                ])
                submissions.forEach(sub => {
                    let owner = owners.find(user => user._id == sub.owner)
                    sub.teacher = owner ? owner : {
                        profile_picture:`${process.env.DOMAIN}/images/account.svg`,
                        first_name:`Not Found`,
                        last_name:``,
                        name:`Not Found`,
                        email:`Not Found`
                    };
                    let sheet = sheets.find(sheet => sheet._id == sub.sheetid)
                    sub.sheet = sheet ? sheet : {
                        _id:null,
                        sheetname:"Not Found"
                    }
                })
            }

            res.send({
                empty:total==0,
                submissions,
                type,
                total,
                pagination:{
                    pages:Math.ceil(total / pagination_limit),
                    pagination_limit,
                    pagination
                }
            });
            
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

    app.get('/dashboard/getAverageGrade', async (req, res) => {
        try{
            let { student } = req.query,
                db = database.getDB()

            if(!student){ res.status(400).send({ message:"Please provide a student id!" }); }

            let cursor = await db.collection('submissions').aggregate([
                { $match:{ owner:req.session.user._id, student } },
                { $group:{ _id:"$sheetid", "percentage":{ $avg:"$grade.percentage" } } },
                { $group:{ _id:"calculation", "average":{ $avg:"$percentage" } } }
            ])

            let r = [];
            await cursor.forEach(i => r.push(i));
            if(r.length){
                res.status(200).send({ average:r[0].average });
            }
            else{ res.status(200).send({ average:'--' }) }
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    
    app.post('/dashboard/processLocalUpdates', async (req, res) => {
        try{
        let { visitedHistory } = req.body

        if(visitedHistory && typeof visitedHistory == 'object'){
            let history = req.session.user.preferences.visitedHistory
            visitedHistory.forEach(his => history.push(his))

            history = history.sort((a,b) => {
                if( moment(a.visited).isBefore(b.visited) ){ return 1; }
                else{ return -1; }
            }).slice(0,5)

            // Need to test. This should remove duplicates
            history = history.filter((value, index, self) =>
                index === self.findIndex((t) => ( t.sheetid === value.sheetid ))
            )

            req.session.user.preferences.visitedHistory = history;
            database.dynamic_call({
                collection:'users', method:'updateOne', query:{ _id:req.session.user._id },
                actions:{ $set:{ 'preferences.visitedHistory':history } }
            })
        }

        res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
}