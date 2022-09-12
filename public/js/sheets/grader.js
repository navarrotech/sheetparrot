var submissionid,
    recalculateProgressbar=()=>{};
!async function(){

    var sheetid = getParam('i'),
        is_loading = true;

    let finishButtons = []

    let currentPaper;

    submissionid = getParam('s');

    var ELEMENTS = {
        _root:$('body .view'),
        sheet:$(`<div class="sheet is-grader"></div>`),
        splash:$(`<div class="splash pt-4" style="background:#1F3A8A;"></div>`),
        primary:$(`<div class="header_master shadow20" style="height:48px;"><div class="container is-max-widescreen"><div class="twobox pt-2"></div></div></div>`),
        secondary:$(`<div class="container is-max-widescreen"><div class="twobox"></div></div>`),
        colorlight:$(`<style>.colorlight{color:rgb(255,255,255);}</style>`),
        columns:{
            _root:$(`<div class="container is-fullhd papercontainer"><div class="columns"></div></div>`),
            grader:$(`<div class="column"><div class="loader is-medium"></div></div>`),
            list:$(`<div class="column is-one-quarter"><label class="label colorlight has-text-weight-light">Other Submissions</label><div class="box"><div class="loader is-medium"></div></div></div>`)
        }
    }

    $GET('/grader/sheets', async (req, res) => {
        if(!req.status == 200){ console.error({req,res}); return; }

        res = await JSON.parse(res)
        if(!res.total){ return; }

        let buttons = $(`<div class="buttons mb-0"></div>`)
        res.sheets.forEach(sheet => {
            let select_button = $(`<a class="button is-light is-rounded mb-0">${sheet.sheetname}</a>`)
                .on('click', () => { console.log("I am clicked.") })
            buttons.append(select_button)
        })
        ELEMENTS.secondary.find('.twobox').append(buttons)

        ELEMENTS.secondary.find('.twobox').append(
            $(`<a class="button is-dark is-rounded mb-0">Select Sheet</a>`)
                .on('click', () => { console.log("Selecting a new sheet now") })
        )
    })

    async function markSheetAsFinished(_id=submissionid, disabled=false, nocallback=false){
        if(disabled){ return; }
        
        let p = currentPaper.getProgress();

        // Are they SURE they want to do this?
        function doubleCheck(callback){
            let dontShowMeAgain = localStorage.getItem('setting_dblcheckmarkcomplete')
            if(dontShowMeAgain && String(dontShowMeAgain) === 'true'){ return callback(); }

            let modal = $(`<div class="modal is-small is-active">
                <div class="modal-background" action="close"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">WAIT! Are you ready?</p>
                        <a class="delete" action="close"></a>
                    </header>
                    <section class="modal-card-body">
                        <div class="has-text-centered">
                            <div class="field has-text-weight-bold">
                                <p>How marking sheet as complete works:</p>
                            </div>
                            <div class="field">
                                <p>Your student will be emailed about their grade being available AND you won't be able to grade this submission any further.</p>
                            </div>
                            <div class="field">
                                <p>This action is final and cannot be undone. Please ensure that you've graded it the way you want it first.</p>
                            </div>
                            <div class="field">
                                <p>Do you still wish to proceed?</p>
                            </div>
                            <div class="field">
                                <label class="checkbox">
                                    <input type="checkbox" id="dontShow">
                                    Don't show me this warning again
                                </label>
                            </div>
                        </div>
                    </section>
                    <footer class="modal-card-foot buttons is-right">
                        <a class="button is-light" action="close">
                            <span class="icon"><i class="fas fa-times"></i></span>
                            <span>Cancel</span>
                        </a>
                        <a class="button is-success">
                            <span class="icon"><i class="fas fa-check"></i></span>
                            <span>Yes I'm Sure</span>
                        </a>
                    </footer>
                </div>
            </div>`)
                .on('change', '#dontShow', function(e){ localStorage.setItem('setting_dblcheckmarkcomplete', (this).prop('checked'));  })
                .on('click', '[action=close]', () => modal.remove())
                .on('click', '.button.is-success', () => { callback(); modal.remove(); })

            $('body').append(modal);
        }
        if(p.total != p.graded && !nocallback){ doubleCheck(() => markSheetAsFinished(_id, disabled, true)); return; }
        
        finishButtons.forEach(f => f.addClass('is-loading'))

        let request = await $POST('/submission/complete', { _id }),
            response = await request.json();

        if(request.response != 200){ console.error({ request, response }) }

        finishButtons.forEach(f => f.removeClass('is-loading'))

        ELEMENTS.sheet.addClass('is-finished');

        clearAllMessages();
        toast(`This submission is complete, and can not be edited further.`, 'success', true, true)
    }

    function fetchOtherSubmissions(selected_sheetid){
        $GET(`/grader/submissions?sheetid=${selected_sheetid}`, async (req, res) => {
            if(req.status != 200){ console.error({req,res}); return; }
            res = JSON.parse(res);
            
            if(!res.total || res.total == 1){ ELEMENTS.columns.list.addClass('is-hidden'); return; }
            ELEMENTS.columns.list.removeClass('is-hidden');

            let list = $(`<ul></ul>`)
            res.list.forEach(submission => {
                list.append(
                    $(`<a class="field button is-fullwidth is-light is-rounded">${submission.name}</a>`)
                        .on('click', async (e) => {
                            if(is_loading){ return; }
                            $(e.target).addClass('is-loading');
                            fetchSubmission(submission._id, (success=true) => {
                                $(e.target).removeClass('is-loading');
                                if(!success){ $(e.target).remove() }
                            })
                        })
                )
            })
            ELEMENTS.columns.list.find('.box').html('');
            ELEMENTS.columns.list.find('.box').append(list)
        })
    }
    if(sheetid){ fetchOtherSubmissions(sheetid) }
    else{ ELEMENTS.columns.list.addClass('is-hidden') }

    function fetchSubmission(submission_id, callback){
        clearAllMessages();
        is_loading = true;
        submissionid = submission_id;
        ELEMENTS.columns.grader.html('<div class="loader is-medium"></div>')
        $GET(`/submission/get?_id=${submission_id}`, (req, res) => {
            if(req.status != 200){
                if(req.status == 404){
                    toast("Submission not found", 'danger', true, true)
                }
                console.error({ req, res });
                is_loading = false;
                callback(false);
                return;
            }
            res = JSON.parse(res)

            let { owner, student, sheet, submission } = res;
            if(!sheetid){ sheetid = sheet._id; fetchOtherSubmissions(sheetid) }

            ELEMENTS.columns.grader.html('')

            // SETUP THE SPLASH
            ELEMENTS.colorlight.html(`.colorlight{color:rgb(${calculateColorlight(sheet.theme.background)})}`)
            ELEMENTS.splash.css('background', sheet.theme.background)
            
            // Big name rendering
            ELEMENTS.columns.grader.append(`
                <div class="field is-grouped">
                    <figure class="image is-64x64 is-rounded mr-4 mt-1"><img src="${student.profile_picture}"/></figure>
                    <div>
                        <h1 class="superTitle colorlight is-cera mb-0">${student.name}</h1>
                        <h2 class="is-size-5 colorlight is-cera mb-0 has-text-weight-normal">Submitted ${moment(submission.created).fromNow()}</h2>
                    </div>
                </div>
            `)
            
            let secondHeaderbar = $(`<div class="box">
                <div class="twobox">
                    <div style="width:50%">
                        <p class="is-size-7">Final Grade:</p>
                        <h1 class="mb-2" style="line-height:1;">
                            <b>
                                <span class="superTitle percent">${submission.grade.percent}</span>
                                <span class="superTitle is-size-2 letter"></span>
                            </b>
                        </h1>
                        <div class="multi-progress" style="max-width:260px; overflow:visible;">
                            <div class="chunk is-success has-tooltip-bottom" style="width:0%;"></div>
                            <div class="chunk is-danger has-tooltip-bottom" style="width:0%;"></div>
                        </div>
                    </div>
                    <div style="width:50%">
                        <p>
                            <b>Time Taken:</b>
                            <span>${fancyCase(moment.duration(submission.time, 's').humanize())}</span>
                        </p>
                        <p>
                            <b>Submitted:</b>
                            <span>${moment(submission.created).format('MMM Do [at] h:mma')}</span>
                        </p>
                        <p>
                            <b>Student:</b>
                            <span>${student.email}</span>
                        </p>
                    </div>
                </div>
            </div>`)

            // Statistics rendering
            ELEMENTS.columns.grader.append(`<label class="label colorlight has-text-weight-light">Submission for: <b>"${sheet.sheetname}"</b></label>`)
            ELEMENTS.columns.grader.append(secondHeaderbar)

            let multiprogressbar = secondHeaderbar.find('.multi-progress'),
                gradePercent = secondHeaderbar.find('.superTitle.percent')
                gradeLetter = secondHeaderbar.find('.superTitle.letter')

            // PAPER rendering

            let paper_parent = $(`<div></div>`)

            let PAPER = new Paper({
                sheet,
                paper:submission.paper,
                parent:paper_parent,
                mode:"grading"
                //mode:'normal'
            })
            currentPaper = PAPER;
            let render = PAPER.renderPaper();
            render.css('margin', '0px auto')

            ELEMENTS.sheet.toggleClass('is-finished', submission.grade.finished)
            finishButtons.forEach(f => {
                if(submission.grade.finished){ f.attr('disabled', 'true') }
                else{ f.removeAttr('disabled')}
            })

            recalculateProgressbar = () => {
                /* { 
                    correct: 1
                    grade_over_graded: 50
                    grade_over_total: 17
                    graded: 2
                    grading_progress: 33
                    incorrect: 1
                    incorrect_over_total:22,
                    total: 6,
                    letter:'B-'
                } */
                let progress = PAPER.getProgress()
                let [ success, danger ] = [ multiprogressbar.find('.chunk.is-success'), multiprogressbar.find('.chunk.is-danger') ];

                // Width
                success.css('width', progress.grade_over_total + '%')
                danger .css('width', progress.incorrect_over_total + '%')

                // Tooltips
                success.attr('data-tooltip', `${progress.correct} Question${progress.correct == 1?'':'s'} Marked Correct`)
                danger .attr('data-tooltip', `${progress.incorrect} Question${progress.incorrect == 1?'':'s'} Marked Incorrect`)

                // Final grade
                if(progress.grade_over_total == 0){
                    gradePercent.text('--')
                    gradeLetter.text('')
                }
                else{
                    gradePercent.text(progress.grade_over_total+'%')
                    gradeLetter.text('('+progress.letter+')')
                }

                // Is the grading done?
                if(progress.graded == progress.total && !submission.grade.finished){
                    if(window.superToast){ window.superToast.remove(); }
                    window.superToast = $(toast(`<div class="twobox is-spaced">
                        <p class="is-size-6">Finished grading ${student.first_name}'s work?</p>
                        <a class="button is-primary">
                            <span class="icon"><i class="fas fa-check"></i></span>
                            <span>Mark As Complete</span>
                        </a>
                    </div>`, 'dark', true, true))
                    window.superToast.on('click', '.button', () => { markSheetAsFinished(submission_id, submission.grade.finished); })
                    finishButtons.push(window.superToast.find('.button'));
                }
                else if(submission.grade.finished){
                    toast(`This submission is complete, and can not be edited further.`, 'success', true, true)
                }

                // Recalculate if the sheet is done or not
                finishButtons.forEach(f => {
                    if(submission.grade.finished){ f.attr('disabled', 'true') }
                    else{ f.removeAttr('disabled')}
                })
            }

            recalculateProgressbar()

            ELEMENTS.columns.grader.append(`<label class="label colorlight has-text-weight-light>${student.first_name}'s Submitted Work</label>`)
            ELEMENTS.columns.grader.append( render )
            is_loading = false;

            callback && callback();
        })
    }
    if(submissionid){ fetchSubmission(submissionid); }
    else if(sheetid){
        $GET(`/grader/mostRecent?sheetid=${sheetid}`, (res, text) => {
            let { success, result } = JSON.parse(text);
            if(success){ return fetchSubmission(result); }
            console.log("Scenario C1 - No submissions found at all")
        })
    }
    else{
        $GET(`/grader/mostRecent`, (res, text) => {
            let { success, result, sheetid:sid } = JSON.parse(text);
            if(success){
                sheetid = sid; 
                fetchSubmission(result);
                fetchOtherSubmissions(sheetid)
                return;
            }
            console.log("Scenario C2 - No submissions found at all")
        })
    }

    let finishButton = $(`<a class="button is-primary mb-0">
        <span class="icon"><i class="fas fa-check"></i></span><span>Mark As Complete</span>
    </a>`)

    finishButton.click(() => { markSheetAsFinished(null, finishButton.attr('disabled')?true:false); })
    finishButtons.push(finishButton)

    ELEMENTS.primary.find('.twobox')
        .append(`<div class="buttons mb-0">
            <a class="button is-dark mb-0" href="${_DOMAIN}${sheetid?`/sheets/view/${sheetid}`:'/sheets'}">
                <span class="icon" style="transform:rotate(180deg);"><i class="fas fa-sign-out-alt"></i></span><span>Exit</span>
            </a>
        </div>`)
        .append(
            $(`<div class="buttons mb-0 is-right"></div>`)
            .append(finishButton)
        )

    ELEMENTS._root.append(ELEMENTS.primary)
    ELEMENTS._root.append(ELEMENTS.sheet)
    ELEMENTS.sheet.append(ELEMENTS.splash)
    ELEMENTS.splash.append(ELEMENTS.secondary)
    ELEMENTS.columns._root.find('.columns').append(ELEMENTS.columns.grader)
    ELEMENTS.columns._root.find('.columns').append(ELEMENTS.columns.list)
    ELEMENTS.sheet.append(ELEMENTS.columns._root)
    ELEMENTS._root.append(ELEMENTS.colorlight)

}()