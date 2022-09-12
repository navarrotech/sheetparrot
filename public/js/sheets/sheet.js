var PAPER

!function(){

    var _ROOT = $('.root'),
        time_spent = 0

    function setName(sheetname, theme){
        $('title').text(`${sheetname} | ${theme.title}`)
        $(`#header_title`).text(theme.title)
        $(`#header_logo`).attr('src', theme.logo?theme.logo:`${_DOMAIN}/images/logo.svg`) 
        $(`head link[rel=icon]`).attr('href', theme.logo?theme.logo:`${_DOMAIN}/images/logo.svg`)
    }
    let dropdown_dynamic_addon;
    if(_ID){
        dropdown_dynamic_addon = $(`<a class="dropdown-item" action="submit">Submit Work</a>`)
        dropdown_dynamic_addon.insertBefore('.navbar .navbar-item .dropdown-content .dropdown-divider')
    }

    async function refresh(){

        let has_password = localStorage.getItem(`${_ID}_KEY`);

        // Check: Is their intent to view a submission?
        let vs = getParam('vs'),
            i = getParam('i')
        if(vs && !i && AUTHORIZED == false){
            promptToAuthorize('login'); return;
        }

        let res;
        if(vs && i){
            res = await $GET(`/sheet/public/get?sheetid=${_ID}${has_password?'&p='+has_password:''}&vs=${vs}&i=${i}`)
        }
        else{
            res = await $GET(`/sheet/public/get?sheetid=${_ID}${has_password?'&p='+has_password:''}`)
        }

        // View it normally
        if(res.status == 200 || res.status == 203){
            let sheet = await res.json(),
                disable_submit = false;

            // Unique view tracking
            if(window.SheetParrot.DynamicCache && !window.SheetParrot.DynamicCache.find('viewed_' + _ID)){
                $POST('/sheet/v2/uniqueView', {})
                window.SheetParrot.DynamicCache.insert({ key:'viewed_' + _ID, data:true })
            }

            // If they are the owner...
            if(res.status == 203){
                $( toast('You are the owner of this sheet, it cannot be submitted by you.', 'dark', true, true) ).find('.delete').remove()
                disable_submit = true;
                if(_ID && dropdown_dynamic_addon){
                    dropdown_dynamic_addon.text('Edit this sheet')
                    dropdown_dynamic_addon.attr('href', `${_DOMAIN}/sheet/v2/edit?sheetid=${_ID}`)
                    dropdown_dynamic_addon.removeAttr('action')
                }
            }

            // If it's overdue...
            if(res.status == 207 || res.status == 207){
                $( toast('Warning: Sheet is overdue! As the creator you are able to preview your worksheet, however your students cannot submit any work for this worksheet.', 'danger', true, true) ).find('.delete').remove()
            }

            _ROOT.html('')
        
            PAPER = new Paper({
                autosave:_ID,
                parent:_ROOT,
                sheet,
                paper:sheet.paper,
                mode:"normal",
                disable_submit
            });
        
            setName(sheet.headline,sheet.theme)

            PAPER.render()
            
            $('[action=submit]').click(() => preSubmit())

            let finished_toast;
            function showFinishedToast(){
                if(disable_submit){ return; }
                if(!finished_toast && PAPER.getProgress().finished){
                    // You answered every question on the page.<br>Great job! Login to submit your work
                    finished_toast = toast(`
                        <div class="twobox">
                            <span>Great job! You have answered every question.</span>
                            <div class="buttons is-right">
                                <a class="button is-primary">
                                    <span class="icon">
                                        <i class="far fa-paper-plane"></i>
                                    </span>
                                    <span>Submit Work!</span>
                                </a>
                            </div>
                        </div>
                    `, 'dark', true, true)
                    finished_toast = $(finished_toast)

                    finished_toast.addClass('has-no-delete')
                    finished_toast.find('.delete').remove()
                    finished_toast.find('.button').click(() => preSubmit())
                }
                else if(finished_toast && !PAPER.getProgress().finished){
                    finished_toast.remove();
                    finished_toast = null;
                }
            }
            $('input, textarea, select').on('input change', () => showFinishedToast())
            showFinishedToast()

            return;
        }

        _ROOT.html('')

        // Locked : Needs password
        if(res.status == 412 || res.status == 409){
            let container = $(`
                <div class="container mt-8">
                    <div class="columns">
                        <div class="column"></div>

                        <div class="column is-4">
                            <div class="block image is-96x96 is-centered">
                                <img src="${_DOMAIN}/images/logo.svg" alt/>
                            </div>

                            <div class="block box has-text-centered">
                                <div class="block">
                                    <h1 class="title mt-4">Sheet Password</h1>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">This worksheet requires a password to access. Please contact your teacher if you do not know the worksheet password.</p>
                                </div>
                                <div class="block field">
                                    <p class="control has-icons-left">
                                        <input class="input" type="text" placeholder="Sheet Password">
                                        <span class="icon is-small is-left"> <i class="fas fa-lock"></i> </span>
                                    </p>
                                    ${
                                        res.status == 409?`<p class="help is-danger has-text-left">Incorrect password, please try again!</p>`:''
                                    }
                                </div>
                                <div class="block buttons is-centered">
                                    <a class="button is-primary is-fullwidth">
                                        <span>Continue</span>
                                        <span class="icon"><i class="fas fa-arrow-right"></i></span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div class="column"></div>
                    </div>
                </div>`)

            let j = await res.json();
            setName(j.headline,j.theme)

            if(res.status == 409){
                let inp = container.find('input')
                let on = () => {
                    container.find('p.help').remove()
                    inp.off('input', on)
                }
                inp.on('input', on)

                toast(j.message, 'danger', true, false)
            }

            container.find('.button.is-primary').click(() => {
                localStorage.setItem(`${_ID}_KEY`, container.find('input').val())
                refresh();
            })

            container.find('input').on('keydown', (event) => {
                if(event.Key == "Enter"){ $(event.target).click() }
            }).focus()
        
            _ROOT.append(container)
            return;
        }
        // Private sheet
        if(res.status == 423){
            let container = $(`
                <div class="container mt-8">
                    <div class="columns">
                        <div class="column"></div>

                        <div class="column is-4">
                            <div class="block image is-96x96 is-centered">
                                <img src="${_DOMAIN}/images/logo.svg" alt/>
                            </div>

                            <div class="block box has-text-centered">
                                <div class="block">
                                    <h1 class="title mt-4">You need permission to view this sheet</h1>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">This sheet's privacy is set to a setting that does not allow you to view it.</p>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">The owner of this sheet will need to update this sheet's privacy settings to allow you to have access to this page.</p>
                                </div>
                                <div class="block buttons is-centered">
                                    ${
                                        AUTHORIZED?`
                                            <a class="block button is-light" href="${_DOMAIN}/dashboard">
                                                <span>My Dashboard</span>
                                                <span class="icon"><i class="fas fa-arrow-right"></i></span>
                                            </a>
                                        `:`
                                            <a class="block button is-primary" href="${_DOMAIN}/login">
                                            <span>Login</span>
                                                <span class="icon"><i class="fas fa-sign-in-alt"></i></span>
                                            </a>
                                            <a class="block button is-light" href="${_DOMAIN}">
                                                <span>Back to home</span>
                                            </a>
                                        `
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="column"></div>
                    </div>
                </div>`)

            setName('Private Sheet',{ logo:`${_DOMAIN}/images/logo.svg`, title:"SheetParrot" })

            _ROOT.append(container)
        }
        // Sheet not found
        if(res.status == 404){
            let container = $(`
                <div class="container mt-8">
                    <div class="columns">
                        <div class="column"></div>

                        <div class="column is-4">
                            <div class="block image is-96x96 is-centered">
                                <img src="${_DOMAIN}/images/logo.svg" alt/>
                            </div>

                            <div class="block box has-text-centered">
                                <div class="block">
                                    <h1 class="title mt-4">Sheet Not Found</h1>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">We couldn't find the sheet you are looking for. Please double check the link that you were sent, or try requesting a new link.</p>
                                </div>
                                <div class="block buttons is-centered">
                                    ${
                                        AUTHORIZED?`
                                            <a class="block button is-light" href="${_DOMAIN}/dashboard">
                                                <span>My Dashboard</span>
                                                <span class="icon"><i class="fas fa-arrow-right"></i></span>
                                            </a>
                                        `:`
                                            <a class="block button is-primary" href="${_DOMAIN}/login">
                                            <span>Login</span>
                                                <span class="icon"><i class="fas fa-sign-in-alt"></i></span>
                                            </a>
                                            <a class="block button is-light" href="${_DOMAIN}">
                                                <span>Back to home</span>
                                            </a>
                                        `
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="column"></div>
                    </div>
                </div>`)

            setName('Sheet Not Found', { logo:`${_DOMAIN}/images/logo.svg`, title:"SheetParrot" })

            _ROOT.append(container)
        }
        // View previous submission
        if(res.status == 202){
            let { paper, sheet, submission } = await res.json();
            showPastSubmission(paper, sheet, submission);
            return;
        }
        // Sheet is overdue!
        if(res.status == 208){
            let j = await res.json();

            let container = $(`
                <div class="container mt-8">
                    <div class="columns">
                        <div class="column"></div>

                        <div class="column is-4">
                            <div class="block image is-96x96 is-centered">
                                <img src="${_DOMAIN}/images/logo.svg" alt/>
                            </div>

                            <div class="block box has-text-centered">
                                <div class="block">
                                    <h1 class="title mt-4">Sheet Is Past Due!</h1>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">This was due on <b>${moment(j.due_date).format('ddd, MMM Do YYYY [at] hh:mm a')}</b>, <b>${moment(j.due_date).from(moment())}</b>.</p>
                                </div>
                                <div class="block">
                                    <p class="is-size-6">The owner of this sheet will need to update this sheet's privacy settings to allow you to have access to this page.</p>
                                </div>
                                <div class="block buttons is-centered">
                                    ${
                                        AUTHORIZED?`
                                            <a class="block button is-light" href="${_DOMAIN}/dashboard">
                                                <span>My Dashboard</span>
                                                <span class="icon"><i class="fas fa-arrow-right"></i></span>
                                            </a>
                                        `:`
                                            <a class="block button is-primary" href="${_DOMAIN}/login">
                                            <span>Login</span>
                                                <span class="icon"><i class="fas fa-sign-in-alt"></i></span>
                                            </a>
                                            <a class="block button is-light" href="${_DOMAIN}">
                                                <span>Back to home</span>
                                            </a>
                                        `
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="column"></div>
                    </div>
                </div>`)
                
            setName(j.headline, j.theme)

            _ROOT.append(container)
        }

    };

    function startTimer(){
        /* Timing the student's "time taken to complete", counting seconds */
        let key = `TIME_SPENT_${_ID}`,
            start_value = localStorage.getItem(key) || '0'

        start_value = parseInt(start_value)
        if(isNaN(start_value)){ start_value = 0 }

        let start_time = moment(),
            last_logged_moment = null,
            document_unfocused = false,
            unfocused_time = 0

        setInterval(() => {
            // Use document.visibilityState != "visible" is good, but if they minimize chrome in the background it'll still count up
            // document.hasFocus is good, but if they click on the tab and not the document it won't do anything

            if(last_logged_moment && !document.hasFocus()){ document_unfocused = true; return; }

            if(document_unfocused){
                unfocused_time += moment.duration( moment().diff(last_logged_moment) ).asSeconds() - 1
                document_unfocused = false
            }
            
            time_spent = Math.round(
                moment.duration( moment().diff(start_time) ).asSeconds()
                    + start_value
                    - unfocused_time
            )
            last_logged_moment = moment()
            
            if(isNaN(time_spent)){ time_spent = 0; }
            localStorage.setItem(key, String(time_spent))
        }, 1000)
    }

    function showThankYou(){
        let finished = PAPER.gatherSheet(),
            time = moment.duration(time_spent, 'seconds')._data,
            submitted_timestamp = new Date().toISOString()

        let container = $(`
            <div class="container mt-8">
                <div class="columns">
                    <div class="column"></div>

                    <div class="column is-5">
                        <div class="block image is-96x96 is-centered">
                            <img src="${_DOMAIN}/images/logo.svg" alt/>
                        </div>

                        <div class="block box has-text-centered">
                            <div class="block">
                                <h1 class="title mt-4">Your work has been submitted!</h1>
                            </div>
                            <div class="block">
                                <p class="is-size-6">
                                    <b>Submitted:</b> ${moment().format('MMM Do [at] h:mm a')}
                                </p>
                                <p class="is-size-6">
                                    <b>Time taken:</b> ${time.hours ? `${time.hours} hour${time.hours == 1?'':'s'} `:''}${time.minutes ? `${time.minutes} minute${time.minutes == 1?'':'s'} `:''}${time.hours || !time.seconds ? '' : `and ${time.seconds} second${time.seconds == 1?'':'s'}`}
                                </p>
                            </div>
                            <div class="block">
                                <p class="is-size-6">${
                                    PAPER && PAPER.sheet && PAPER.sheet.submission && PAPER.sheet.submission.message
                                        ? PAPER.sheet.submission.message
                                        : "Thank you for your submission, your homework will be graded soon by your teacher. You will be emailed when your sheet is graded and ready for review!"
                                }</p>
                            </div>

                            <div class="block">
                                <div class="buttons is-centered">
                                    <a class="button is-light" href="${_DOMAIN}/dashboard">
                                    <span class="icon"><i class="fas fa-tachometer-alt"></i></span>
                                        <span>Dashboard</span>
                                    </a>
                                    <a class="button is-primary" action="viewSubmission">
                                    <span class="icon"><i class="far fa-file-alt"></i></span>
                                        <span>View Submission</span>
                                    </a>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div class="column"></div>
                </div>
            </div>`)

        container.find('.button[action=viewSubmission]').click(() => {
            showPastSubmission(finished.paper, finished, { created:submitted_timestamp, time:time_spent })
        })

        _ROOT.html('')
        _ROOT.append(container)

        fireconfetti();
    }

    function showPastSubmission(paper, sheet, submission){

        setName(sheet.headline, sheet.theme)

        _ROOT.html('')

        PAPER = new Paper({
            parent:_ROOT,
            sheet,
            paper,
            mode:"submission",
            meta:{ submission }
        });
    
        PAPER.render()
    }
    function promptToAuthorize(auth='signup', submitAfter=true){
        new Authenticator({
            type:"any",
            auth,
            subtitle:"You need a free account to continue.",
            allowSwitching:true,
            includeBox:false,
            redirect:false,
            prefill_email:getParam('vs')?getParam('vs'):undefined
        }).render()
        
        let modal = $(`<div class="modal is-active"><div class="modal-background"></div><div class="modal-card" style="max-width:400px;"><section class="modal-card-body px-0 is-rounded"></section></div></div>`)
            .on('click', '.modal-background', () => { modal.remove(); window.SheetParrot.Authenticator.onSuccess = () => {} })

        modal.find('.modal-card-body').append(window.SheetParrot.Authenticator.elements._root)
        window.SheetParrot.Authenticator.onSuccess = async (response) => {
            AUTHORIZED = true;
            if(submitAfter){ await submit(); }
            modal.remove();
            if(response && response.profile && response.profile.email){
                toast(`Welcome back ${response.profile.first_name}, you are now logged in!`, "success", true, false)
                let n = $('.navbar .navbar-end .navbar-replacement-nametag')
                n.html(
                `<div class="buttons is-right">
                    <div class="dropdown is-right">
                        <div class="dropdown-trigger is-clickable">
                            <a class="nameBadge pl-4 pt-2 pb-2 mb-2">
                                <figure class="image is-48x48 mr-2"><img class="is-rounded" src="${response.profile.profile_picture}"></figure>
                                <div class="titles">
                                    <h1 class="title is-5"><span>${response.profile.first_name} ${response.profile.last_name}</span><span class="icon"><i class="fas fa-sort-down"></i></span></h1>
                                    <h2 class="subtitle is-7">${response.profile.email}</h2>
                                </div>
                            </a>
                        </div>
                        <div class="dropdown-menu" role="menu">
                            <div class="dropdown-content">
                                <a class="dropdown-item" href="${_DOMAIN}/dashboard" target="_blank">My Dashboard</a>
                                <a class="dropdown-item" action="submit">Submit Work</a><hr class="dropdown-divider">
                                <a href="${_DOMAIN}/logout" class="dropdown-item">Logout</a>
                            </div>
                        </div>
                    </div>
                </div>`);
                
                initDropdown( n.find('.dropdown').get()[0] )
            }
        }

        $('body').append(modal)
    }
    function preSubmit(){

        let progress = PAPER.getProgress(),
            time = moment.duration(time_spent, 'seconds')._data

        let modal = $(`
            <div class="modal is-active">
                <div class="modal-background"></div>
                <div class="modal-card has-text-centered" style="max-width:400px;">
                    <section class="modal-card-body is-rounded">
                    
                        <div class="block">
                            <h1 class="title is-size-3 is-cera has-text-weight-bold">Ready to submit your work?</h1>
                            <h2 class="subtitle is-size-5">Once you submit your work, you<br>can not go back and edit it.</h2>  
                        </div>

                        <div class="block">
                            <figure class="image is-centered" style="max-width:250px;">
                                <img src="${_DOMAIN}/images/people-5.svg"/>
                            </figure>
                        </div>

                        <div class="block is-size-6">
                            <p>You answered ${progress.answered} out of ${progress.total} questions</p>
                            <p>in <b id="spent-time">${time.hours ? `${time.hours} hour${time.hours == 1?'':'s'} `:''}${time.minutes ? `${time.minutes} minute${time.minutes == 1?'':'s'} `:''}${(time.hours || !time.seconds) ? '' : `and ${time.seconds} second${time.seconds == 1?'':'s'}`}</b></p>
                        </div>
                        <!--<div class="block">
                            <progress class="progress is-success is-small" value="${progress.percent}" max="100"></progress>
                        </div>-->

                        <div class="block" id="deadline"></div>

                        <div class="block">
                            <a class="button is-success is-fullwidth is-normal" action="submit" ${progress.finished?'':'disabled'}>Submit My Work!</a>
                        </div>
                        
                    </section>
                </div>
            </div>
        `)

        let spent_time = modal.find('#spent-time')
        spent_time.removeAttr('id')

        let deadline = modal.find('#deadline')
        
        let timer = setInterval(() => {
            t = moment.duration(time_spent, 'seconds')._data

            spent_time.text(
                `${t.hours ? `${t.hours} hour${t.hours == 1?'':'s'} `:''}${t.minutes ? `${t.minutes} minute${t.minutes == 1?'':'s'} `:''}${(t.hours || !t.seconds) ? '' : `and ${t.seconds} second${t.seconds == 1?'':'s'}`}`
            )

            let d = (PAPER.due_date && PAPER.due_date.enabled)?moment.duration(PAPER.due_date.date, 'seconds')._data:null;
            if(d){
                deadline.html(
                    `<p class="is-size-6"><span>The deadline for this sheet is in</span>`
                    + `<b>${d.hours ? `${d.hours} hour${d.hours == 1?'':'s'} `:''}${d.minutes ? `${d.minutes} minute${d.minutes == 1?'':'s'} `:''}${(d.hours || !d.seconds) ? '' : `and ${d.seconds} second${d.seconds == 1?'':'s'}`}</b></p>`
                )
            }
        }, 1000)

        modal.find('.modal-background').click(() => { modal.remove(); clearInterval(timer); })
        modal.find('[action=close]').click(() => { modal.remove(); clearInterval(timer); })

        if(progress.finished){
            let is_loading = false;
            modal.find('[action=submit]').click(() => {
                if(!AUTHORIZED){
                    modal.remove();
                    clearInterval(timer);
                    promptToAuthorize();
                    return;
                }
                if(is_loading){ return; }
                is_loading = true;
                modal.find('[action=submit]').addClass('is-loading');
                modal.remove();
                clearInterval(timer);
                submit();
            })
        }

        $('body').append(modal)
    }

    async function submit(){
        _ROOT.html(`<div class="mt-8 pt-8"><div class="loader is-large"></div><p class="has-text-centered">Submitting your work...<br>Please don't leave the page.</p></div>`)

        let final_sheet = PAPER.gatherSheet()

        let req = await $POST(`/sheet/v2/submit?sheetid=${_ID}`, { submission:final_sheet, time:time_spent }),
            res;
        
        try{ res = await req.json(); } catch(e){ console.log(e); }
        if(req.status != 200){ console.log({ req, res }) }

        window.SheetParrot.DynamicCache.remove(`save_${_ID}`)

        showThankYou();
    }

    refresh();
    startTimer();

    $('[data-action=login]').click(() => promptToAuthorize('login', false))
    $('[data-action=signup]').click(() => promptToAuthorize('signup', false))

    if(!AUTHORIZED){
        let visitedHistory = localStorage.getItem('visitedHistory')
        if(!visitedHistory){ visitedHistory = [] }
        else{ visitedHistory = JSON.parse(visitedHistory); }

        visitedHistory.push({
            sheetid:_ID,
            visited:new Date()
        })

        localStorage.setItem('visitedHistory', JSON.stringify(visitedHistory))
    }

    cookieBanner();
}();