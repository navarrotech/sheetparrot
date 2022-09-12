import {
    database, sendgrid, amazon, tools, authorization
} from '../utility.js'

import moment from 'moment'

import * as StringLimits from '../limits.json' assert { type: 'json' }

export default class Sheet {

    /*
     * this.sheet = raw sheet object from database
     * this.sheetid = _id,
     * this.paper = paper
     */

    /* Initialization */
    constructor(existing_sheet, existing_paper){
        if(existing_sheet){
            this.sheet = existing_sheet;
            this.sheetid = existing_sheet._id;
        }
        else{ this.sheet = {}; this.sheetid = "" }

        if(existing_paper){
            this.paper = existing_paper
        }
    }
    async connect(_id, owner){
        return new Promise(async (resolve, reject) => {

            let query = (owner) ? { _id, owner } : { _id },
                sheet = await database.dynamic_call({ collection:'sheets', method:'findOne', query })

            if(sheet){ resolve(sheet) } else{ resolve(null); }

        }).then(s => {
            if(s){
                this.sheet = s;
                this.sheetid = _id;
                this.owner = owner?owner:s.owner;
                this.paper = s.paper;
            }
        });
    }

    /* Foundations */
    async create(sheetname, user, parentFolder="root"){
        async function createUniqueSheetid(){
            let sheetid = database.uuid();
    
            // Make sure it's unique!
            let existing_sheet = await database.dynamic_call({
                collection:'sheets',
                method:'findOne',
                query:{ _id:sheetid }
            })
    
            if(!existing_sheet){ return sheetid }
            else{ return (await createUniqueSheetid()) }
        }

        // Set due date to 7 days from now, naturally
        let due = new Date()
        due.setDate(due.getDate() + 7)

        /*
            [
                {
                    "type": "card",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Your question here",
                    "subtitle": "Write your answer below",
                    "hint": "Your answer here...",
                },
                {
                    "type": "multichoice",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Your question here",
                    "subtitle": "Select an option below",
                    "option_1": "Blue",
                    "option_2": "No yellow!",
                    "option_3": "I meant red!",
                    "option_4": "None of the above"
                },
                {
                    "type": "button",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Your question here",
                    "subtitle": "Click the link below",
                    "options":{
                        "label":"Open website",
                        "href":"https://google.com/",
                        "target":"_blank",
                        "size":"normal",
                        "color":"#42b1f9"
                    }
                }
            ]
            [
                {
                    "type": "dropdown",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Your question here",
                    "subtitle": "Choose wisely",
                    "options": [
                        { "label": "An African swallow?" },
                        { "label": "A European swallow?" },
                        { "label": "I don't know" }
                    ],
                    "label": "Select an option:"
                },
                {
                    "type": "multiline",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Your question here",
                    "subtitle": "Fill out the options below",
                    "options":[
                        { "label":"Answer #1" },
                        { "label":"Answer #2" },
                        { "label":"Answer #3" },
                    ]
                },
                {
                    "type": "video",
                    "id": "card_" + database.uuid().substring(0,8),
                    "title": "Watch this video to learn more about how to use SheetParrot!",
                    "subtitle": "Watch the video below",
                    "video_type": "vimeo",
                    "video_key": "640486262"
                }
            ]
        */

        let _id = await createUniqueSheetid()
        let template = {
            _id,
            owner:user._id,
            sheet_password:"",
            sheetname,
            privacy:"public",
            headline:"My new sheet",
            subheadline:`Created by ${user.first_name}`,
            due_date:{
                enabled:false,
                date:due,
                allow_late_submissions:false
            },
            video:{
                enabled:true,
                key:"", 
                type:""
            },
            theme:{
                background:(user.preferences.interface.theme || "#1F3A8A"),
                layout:"splash-standard",
                logo:(user.preferences.interface.default_logo || (process.env.DOMAIN + "/images/logo.svg")),
                title:(user.preferences.interface.default_brand || "SheetParrot")
            },
            paper: [
                [
                    {
                        "type": "multichoice",
                        "id": "card_" + database.uuid().substring(0,8),
                        "title": "Your question here",
                        "subtitle": "Select an option below",
                        "option_1": "Option 1",
                        "option_2": "Option 2",
                        "option_3": "Option 3",
                        "option_4": "Option 4",
                    },
                    {
                        "type": "multichoice",
                        "id": "card_" + database.uuid().substring(0,8),
                        "title": "Your question here",
                        "subtitle": "Select an option below",
                        "option_1": "Option 1",
                        "option_2": "Option 2",
                        "option_3": "Option 3",
                        "option_4": "Option 4",
                    },
                    {
                        "type": "video",
                        "id": "card_" + database.uuid().substring(0,8),
                        "title": "This video will teach you more!",
                        "subtitle": "Watch the video below",
                        "video_type": "vimeo",
                        "video_key": "640486262"
                    }
                ]
            ],
            submission:{
                message:(user.preferences.interface.onSubmit || "Thank you for your submission! Your work has been submitted and will be reviewed later."),
            },
            stats:{
                views:0,
                uniques:0,
                submissions:0,
                graded_submissions:0
            },
            history:[
                {
                    who:user.email,
                    what:"Created Sheet",
                    when:new Date()
                }
            ],
            parentFolder
        }

        await database.dynamic_call({
            collection:'sheets',
            method:'insertOne',
            query:template
        })

        this.sheet = template;
        this.sheetid = template.sheetid;

        return _id;
    }
    async delete(){
        if(!this.isConnected()){ return; }

        console.log(`Now deleting sheet: [${this.sheet._id}] for [${this.sheet.owner}]`)
        return new Promise(async (resolve, reject) => {
            let promises = [],
                _id = this.sheet._id,
                owner = this.sheet.owner;

            // Delete the sheet
            promises.push( database.dynamic_call({collection:'sheets',method:'deleteOne', query:{ _id }}) )
            // Delete all submissions
            promises.push( database.dynamic_call({collection:'submissions',method:'deleteMany', query:{ _id }}) )
            // Delete all assignments
            promises.push( database.dynamic_call({ collection:'assigned_sheets', method:'deleteMany', query:{ _id } }) )
            // Delete all questions
            promises.push( database.dynamic_call({ collection:'questions', method:'deleteMany', query:{ _id } }) )
            // Statistics
            promises.push( database.dynamic_call({
                collection:'users', method:'updateOne', query:{ _id:owner },
                actions:{ $inc:{ "preferences.stats.sheets":-1 } }
            }) )

            await Promise.all(promises)

            resolve()

        }).then(s => { delete this.sheet; });
    }
    async rename(new_name){
        return new Promise((resolve, reject) => {
            new_name = String(new_name).substring(0, StringLimits.sheetname)
            database.dynamic_call({
                collection:'sheets',
                method:'updateOne',
                query:{_id:this.sheetid},
                actions:{
                    $set:{
                        "sheetname":new_name
                    }
                }})
            resolve()
        }).then(s => { this.sheet.sheetname = new_name; });
    }

    /* Folders */
    async getParentFolder(){
        let def = {
            path:'root',
            pathids:'root',
            name:'root'
        }
        if(this.sheet.parentFolder == "root"){ return def; }
        else{
            let folder = await database.dynamic_call({
                collection:'folders',
                method:'findOne',
                query:{ _id:this.sheet.parentFolder }
            })
            return (folder) ? folder : def;
        }
    }
    async moveToRoot(){
        // Update self
        await database.dynamic_call({
            collection:'sheets',
            method:'updateOne',
            query:{ _id:this.sheet.sheetid },
            actions:{
                $set:{ parentFolder:"root" }
            }
        })
        // Update old parent folder
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ "sheets":this.sheet.sheetid },
            actions:{
                $pull:{ sheets:this.sheet.sheetid }
            }
        })
    }
    async move(new_folderId){
        if(!new_folderId){ console.log("No new folder ID given to move sheet to!"); return; }
        if(new_folderId == "root"){ await this.moveToRoot(); return; }
        // Update self
        await database.dynamic_call({
            collection:'sheets',
            method:'updateOne',
            query:{ _id:this.sheet.sheetid },
            actions:{
                $set:{ parentFolder:new_folderId }
            }
        })
        // Update old parent folder
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ "sheets":this.sheet.sheetid },
            actions:{
                $pull:{ sheets:this.sheet.sheetid }
            }
        })
        // Update new parent folder
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id:new_folderId },
            actions:{
                $push:{
                    sheets:this.sheet.sheetid
                }
            }
        })
    }

    /* Getters */
    async getPublicVersion(){
        let r = {};

        Object.keys(this.sheet).forEach(key => {
            if(!['sheet_password', 'owner'].includes(key)){
                r[key] = this.sheet[key]
            }
        })

        return r;
    }

    /* Updaters */
    async updateHistory(who, what){
        if(!this.isConnected()){ return; }
        if(!['New Submission', 'Edited Sheet'].includes(what)){ return; }

        database.dynamic_call({
            collection:'sheets', method:'updateOne', query:{ _id:this.sheetid },
            actions:{ $push:{ history:{ who, what, when:new Date() } } }
        })
    }
    async updateStat(stat, amount){
        if(!this.isConnected()){ return; }

        let $inc = {}; $inc[`stats.${stat}`] = amount
        database.dynamic_call({ collection:'sheets', method:'updateOne', query:{ _id:this.sheetid }, actions:{ $inc } })
    }
    async setParameter(stat, amount){
        if(!this.isConnected()){ return; }

        let $set = {}; $set[`stats.${stat}`] = amount
        database.dynamic_call({ collection:'sheets', method:'updateOne', query:{ _id:this.sheetid }, actions:{ $set } })
    }

    /* Tools */
    isConnected(){
        return (this.sheet && Object.keys(this.sheet).length) ? true : false
    }
    isPastDue(){
        return (this.sheet.due_date && this.sheet.due_date.enabled && moment().isAfter(moment(this.sheet.due_date.date)));
    }
    async calculateGradeAverage(){
        if(!this.sheet || !this.sheet.last_submission){ return ''; }
        if(
            (this.sheet.last_calculated_average && this.sheet.last_submission && this.sheet.average_grade)
            && 
            (new Date(this.sheet.last_calculated_average).getTime() > new Date(this.sheet.last_submission).getTime())
        ){ return this.sheet.average_grade; }

        let submissions = await database.dynamic_call({
            collection:'submissions',
            method:'find',
            query:{
                done_grading:true,
                sheetid:this.sheetid
            },
            options:{
                projection:{ _id:0, grade:1 }
            }
        })

        if(!submissions || !submissions.length){ return ''; }

        let total = 0, average
        submissions.forEach(s =>{ total += parseInt(s.grade)})

        average = Math.round((total / submissions.length) * 100) / 100
        this.sheet.average_grade = average;

        database.dynamic_call({
            collection:'sheets',
            method:'updateOne',
            query:{ _id:this.sheetid },
            actions:{
                $set:{
                    graded_submissions:submissions.length,
                    last_calculated_average:new Date(),
                    average_grade:average
                }
            }
        })
        this.sheet.last_calculated_average = new Date()

        return average;
    }

    /* Paper functions */
    forEachCard(fn){
        this.forEachRow((row, row_index) => row.forEach((card, card_index) => fn(card, row_index, card_index)))
    }
    forEachRow(fn){
        if(!this.paper){ return; }
        this.paper.forEach(fn);
    }
    getCardById(id){
        let r = { success:false, card:null, row:null };
        this.forEachCard((card,row_index,card_index) => {
            if(card.id == id){ r = { success:true, card, row_index, card_index } }
        })
        return r;
    }
    getProgress(mode="submission"){
        let response = {}

        if(mode == "submission"){
            response = {
                total:0,
                answered:0,
                unanswered:0
            }
            this.forEachcCard(card => {
                if(['card', 'multichoice', 'dropdown'].includes(card.type)){
                    response.total += 1;
                    if(card.answer){ response.answered += 1; }
                    else{ response.unanswered += 1; }
                }
                if(['multiline'].includes(card.type)){
                    card.options.forEach(question => {
                        response.total += 1;
                        if(question.answer){ response.answered += 1; }
                        else{ response.unanswered += 1; }
                    })
                }
            })

            response['percent']  = Math.round((response.answered / response.total) * 100)
            response['finished'] = (response.percent == 100)
        }
        if(mode == "grading"){
            response = {
                total:0,
                graded:0,
                correct:0,
                incorrect:0,
                finished:false
            }
            this.forEachCard(card => {
                if(['card', 'multichoice', 'dropdown'].includes(card.type)){
                    response.total += 1;
                    if(card.graded){ response.graded += 1; }
                    if(card.grade == 1){ response.correct += 1; }
                    else if(card.grade == -1){ response.incorrect += 1; }
                }
                if(['multiline'].includes(card.type)){
                    card.options.forEach(question => {
                        response.total += 1;
                        if(question.graded){ response.graded += 1; }
                        if(question.grade == 1){ response.correct += 1; }
                        else if(question.grade == -1){ response.incorrect += 1; }
                    })
                }
            })
            
            response['grade_over_total'] = Math.round((response.correct / response.total) * 100)
            response['grade_over_graded'] = Math.round((response.correct / response.graded) * 100)
            response['grading_progress'] = Math.round((response.graded / response.total) * 100)
            response['finished'] = (response.total == response.graded)

            if(isNaN(response['grade_over_total'])){ response['grade_over_total'] = 0 }
            if(isNaN(response['grade_over_graded'])){ response['grade_over_graded'] = 0 }
            if(isNaN(response['grading_progress'])){ response['grading_progress'] = 0 }
        }
        return response;
    }
    validatePaper(mode="normal"){
        let paper = this.paper,
            invalid_parameters = []

        this.forEachCard(card => {

            // Validate card id
            if(!card.id)  { invalid_parameters.push(`Received card is missing required attribute 'id'!`); return; }
            //if(!(/card_[A-z]{8}/).test(card.id)){ invalid_parameters.push(`Card id (${card.id}) is malformed!`); return; }
            card.id = String(card.id).substring(0, StringLimits.card.id)

            // Validate card type
            if(!card.type){ invalid_parameters.push(`Received card [${card.id}] is missing required attribute 'type'!`); return; }
            if(typeof card != 'object'){ return; }
            if(!['blank','card','multichoice','multiline','dropdown','button','video'].includes(card.type)){
                invalid_parameters.push(`Card ${card.id}: Received unknown type '${card.type}'`); return;
            }

            let card_keys = Object.keys(card)
            card_keys.forEach(card_key => {
                if(['id', 'type'].includes(card_key)){ return; }
                else if(card_key == 'options'){
                    if(typeof card.options != 'object'){ return; }

                    let option_keys = Object.keys(card.options)

                    option_keys.forEach(option_key => {
                        if(['multiline', 'dropdown'].includes(card.type)){
                            let object_in_option_keys = Object.keys(card.options[option_key])
                            object_in_option_keys.forEach(object_in_option => {
                                if(StringLimits.card[card.type][object_in_option]){
                                    card.options[option_key][object_in_option] = String(card.options[option_key][object_in_option]).substring(0, StringLimits.card[card.type][object_in_option])
                                }
                                else{
                                    invalid_parameters.push(`Received unknown parameter ('options[${option_key}].${object_in_option}') for card [${card.id}]`)
                                }
                            })
                        }
                        else if(['button'].includes(card.type) && StringLimits.card[card.type] && StringLimits.card[card.type][option_key]){
                            option_key = String(option_key).substring(0, StringLimits.card[card.type][option_key])
                        }
                        else{
                            invalid_parameters.push(`Received unknown parameter ('options.${option_key}') for card [${card.id}]`)
                        }
                    })
                }
                else if(StringLimits.card[card_key]){
                    card[card_key] = String(card[card_key]).substring(0, StringLimits.card[card_key])
                }
                else{
                    invalid_parameters.push(`Received unknown parameter ('${card_key}') for card [${card.id}]`)
                }
            })
        });

        this.paper = paper;
        return {
            invalid_parameters,
            paper
        };
    }
}