import {
    database, sendgrid, amazon, tools, authorization
} from '../utility.js'

import Sheet from './Sheet.js'

export default class Submission extends Sheet { 

    /*
     * this._id = submission_id
     * this.sheet = submission's parent sheet data (has original paper object)
     * this.paper = submission's paper
     * this.owner = submission's owner doc
     * this.count = total submissions for 
     * this.submission = default submission doc from database
     */
   
    constructor(){ super() }
    async connect(submission_id){
        return new Promise(async (acc) => {
            let submission = await database.dynamic_call({ collection:'submissions', method:'findOne', query:{ _id:submission_id } })
            if(!submission){ acc(null); return; }
            let [sheet, owner, student] = await Promise.all([
                database.dynamic_call({ collection:'sheets', method:'findOne', query:{ _id:submission.sheetid } }),
                database.dynamic_call({ collection:'users',  method:'findOne', query:{ _id:submission.owner   } }),
                database.dynamic_call({ collection:'users',  method:'findOne', query:{ _id:submission.student } }),
            ])
            acc({ submission, sheet, owner, student })
        })
        .then(s => { if(s){
            this._id = submission_id; this.sheet = s;
            this.sheet = new Sheet(s.sheet, s.submission.paper);
            this.submission = s.submission;
            this.paper = (s.submission) ? s.submission.paper : null;
            this.owner = s.owner;
            this.student = s.student;
        } });
    }
    async getPublicVersion(){
        let owner = {},
            student = {}
        Object.keys(this.owner).forEach(key => {
            if(!['password', 'preferences', 'signed_up', 'images', 'verified'].includes(key)){ owner[key] = this.owner[key] }
        })
        Object.keys(this.student).forEach(key => {
            if(!['password', 'preferences', 'signed_up', 'images', 'verified'].includes(key)){ student[key] = this.student[key] }
        })

        return {
            submission:this.submission,
            sheet:await this.sheet.getPublicVersion(),
            owner,
            student
        }
    }
    async delete(){
        return await database.dynamic_call({ collection:"submissions", method:"deleteOne", query:{ _id:this._id } });
    }
    isFinished(){
        return this.submission.grade.finished;
    }
}