!async function(){
    var elements = {
        _root:$('#content'),
        dashboard:$(`<div></div>`)
    }

    let welcomeMenuShown = false;
    async function welcomeMenu(res){
        if(welcomeMenuShown){ 
            elements._root.html('<div class="loader is-large"></div>')
            return;
        }
        welcomeMenuShown = true;

        console.log('Showing first time welcome menu...')

        $('[data-global=verify_email]').remove()

        let container = $(`<div class="candisable has-text-centered">
            <h1 class="title is-size-1">Welcome to SheetParrot ${res.first_name}!</h1>
            <h2 class="subtitle is-size-5">Help us to learn a little bit more about you</h2>

            <label class="label">I am a...</label>
            <div class="columns is-vcentered">
                <div class="column is-4 is-offset-2">
                    <div class="box is-clickable typeButton" action="setType" data-type="teacher">
                        <h1 class="pt-4"> <span class="icon"><i class="fas fa-3x fa-chalkboard-user"></i></span> </h1>
                        <h1 class="is-size-4 has-text-weight-bold is-cera"> <span>Teacher</span> </h1>
                    </div>
                </div>
                <div class="column is-4">
                    <div class="box is-clickable typeButton" action="setType" data-type="student">
                        <h1 class="pt-4"> <span class="icon"><i class="fas fa-3x fa-graduation-cap"></i></span> </h1>
                        <h1 class="is-size-4 has-text-weight-bold is-cera"> <span>Student</span> </h1>
                    </div>
                </div>
            </div>
            <div class="buttons is-centered is-hidden">
                <a class="button is-primary">
                    <span>Next</span>
                    <span class="icon"><i class="fas fa-arrow-right"></i></span>
                </a>
            </div>
        </div>`);

        // Definitions
        let add = $(`<div><h1>Hello world</h1></div>`), 
            boxes = container.find('.box[action=setType]'),
            next = container.find('.buttons.is-centered'),
            type = ''

        // Events
        container.on('click', '.box[action=setType]', async function(event) {
            let target = $(this);

            type = target.attr('data-type');

            boxes.removeClass('is-selected');
            target.addClass('is-selected');

            next.removeClass('is-hidden');
        })

        // Callbacks
        next.find('.button.is-primary').click(async () => {
            if(!type){ console.log("No type chosen!"); return; }
            if(!['student', 'teacher'].includes(type)){ console.error(`Unacceptable type ['${type}'] given!`); return; }

            next.addClass('is-loading')
            container.addClass('is-disabled')

            await $POST('/settings/save', { type }, (A) => {
                console.log(`Type changed to ['${type}'] with status ${A.status}`)
                res.type == type;
                elements._root.html('');
                refresh()
            });

            // Put more checks here! Like birthday, change plan, watch tutorial, etc
            elements._root.html('');
            refresh(true)
        })

        // Appending
        elements._root.append(container)
    }

    async function refresh(force_reload=false, blockloop=false){
        elements.dashboard = $(`<div></div>`)
        elements._root.html('')

        let bkg_loading_mode = false;

        // If previously fetched: Get the cached result, to load super quickly
        // Then after loading in the background we refresh the data.
        let req, res = localStorage.getItem('dashboardContent');
        if(res){
            res = JSON.parse(res);
            if(blockloop){ force_reload=false; }
            else if(
                res.email != _EMAIL
                || !res.sent
                || !moment(res.sent).subtract('15', 'minutes').isBefore()
            ){
                console.log("Last cache update was longer than 15 minutes ago, forcing refresh...")
                force_reload = true;
            }
            else{
                force_reload = false;
                bkg_loading_mode = true;
                console.log("Restoring content from cache...")
                console.log({ res })
                $GET('/dashboard/me', (request, text) => {
                    console.log("Received updated content from server now")
                    console.log({ req:request, res:JSON.parse(text) })
                    // Not JSON parsed because it's already stringified
                    localStorage.setItem('dashboardContent', text)
                    refresh(false, true);
                })
            }
        }
        
        if(force_reload || !res){
            console.log("Forcing reload from server...")
            req = await $GET('/dashboard/me');
            res = await req.json();
            if(res && res.first_name){
                localStorage.setItem('dashboardContent', JSON.stringify(res))
            }
            console.log({ req, res })
        } 
    
        elements._root.html('')

        if(res.type == 'any'){
            welcomeMenu(res); return;
        }
    
        let animatedProgressBars = []
    
        function bigStat(title, subtitle, icon, stat, value, makeSmaller=false){
            let container_id = `animated-progressbar-${animatedProgressBars.length}`
    
            let container = $(`<div class="column">
                <div class="status-card">
                    <div class="status-card-body px-0">
                        <h1 class="is-size-5 has-text-centered">
                            <span class="icon"><i class="${icon}"></i></span>
                            <span>${title}</span>
                        </h1>
                        <div class="dashboard-progress is-clickable">
                            <div class="circular_progressbar large" id="${container_id}"></div>
                            <span class="${makeSmaller?'is-size-3':'is-size-1'} centerIcon is-cera has-font-weight-bold">${stat}</span>
                        </div>
                        <h1 class="is-size-5 has-text-centered">
                            <span>${subtitle}</span>
                        </h1>
                    </div>
                </div>
            </div>`)
    
            animatedProgressBars.push({ container_id, value })
    
            return container;
        }

        function createRecentBox(options){
            let { label, content, content_type, view_more, view_more_label } = options;
            let container = $(`<div class="block">
                <div class="twobox is-centered is-spaced">
                    <label class="label">${label}</label>
                    ${ view_more ?`
                        <div class="buttons is-right">
                            <a class="button is-small is-primary" href="${view_more}">
                                <span>${view_more_label}</span>
                                <span class="icon">
                                    <i class="fas fa-arrow-right"></i>
                                </span>
                            </a>
                        </div>
                    `:'' }
                </div><div class="box recentBox"></div></div>`)
            
            let parent = container.find('.box')

            if(!content.length){
                let text = '',
                    icon = ''
                if(res.type == "student" && content_type == "submission"){
                    text = "No submissions have been sent yet.";
                    icon = 'fas fa-arrow-right';
                }
                else if(res.type == "student" && content_type == "sheet"){
                    text = "You're all caught up!";
                    icon = 'fas fa-check';
                }
                else if(content_type == "submission"){
                    text = "You're all caught up!";
                    icon = 'fas fa-check';
                }
                else if(content_type == "sheet"){
                    text = "No sheets have been created yet.";
                    icon = 'fas fa-arrow-right';
                }

                container.find('.recentBox').append(
                    `<div class="spacedText is-medium is-centered">
                        <p class="icon-text is-size-7 has-text-grey">
                            <span class="icon"><i class="${icon}"></i></span>
                            <span>${text}</span>
                        </p>
                    </div>`
                )
                return container;
            }

            content.forEach(obj => {
                let sheet, paper, href, headline, subheadline;
    
                if(res.type == "student" && content_type == "submission"){
                    sheet = obj.sheet;
                    paper = obj.paper;
                    href  = `${_DOMAIN}/sheet/${obj._id}`
                    headline = obj.sheet.headline;
                    subheadline = 'Final grade: 90.2%';
                }
                else if(res.type == "student" && content_type == "sheet"){
                    sheet = obj;
                    paper = obj.paper;
                    href  = `${_DOMAIN}/sheet/${obj._id}`
                    headline = obj.headline;
                    subheadline = (obj.due_date.enabled?`Due in ${moment(obj.due_date.date).fromNow()}`:`Viewed ${moment(obj.last_visited).fromNow()}`);
                }
                else if(content_type == "submission"){
                    let { graded, total } = obj.grade
                    let grade_completion = Math.round(( graded / total ) * 100)
                    if(isNaN(grade_completion)){ grade_completion = 0; }
                    sheet = obj.sheet;
                    paper = obj.paper;
                    href  = `${_DOMAIN}/grade?i=${obj.student}&s=${obj._id}`
                    headline = obj.student_document.first_name + ' ' + obj.student_document.last_name;
                    subheadline = grade_completion + '% Graded - Not Finished';
                }
                else if(content_type == "sheet"){
                    sheet = obj;
                    paper = obj.paper;
                    href  = `${_DOMAIN}/sheets/view/${obj._id}`
                    headline = obj.headline;
                    subheadline = `Created ${moment(obj.history[0].when).fromNow()}`;
                }
    
                let thumbnail = $(`<a class="clickableSheet is-clickable natural-outline" href="${href}">
                    <div class="is-relative">
                        <div class="sheetWindowPreview"></div>
                    </div>
                    <div class="py-3 pr-3 pl-3 titles">
                        <p class="title master_headline has-text-weight-normal is-size-6 text-clipped">${headline}</p>
                        <p class="subtitle has-text-grey is-size-7">${subheadline}</p>
                    </div>
                </a>`)
    
                let element = new Paper({ mode:'fake', paper, sheet, parent:thumbnail.find('.sheetWindowPreview') })
                element.render()
    
                parent.append( thumbnail )
            })

            // Quick query params 'check'
            let ise = getParam('ise')
            if(ise && ise == 1){
                toast("Error: Internal Server Error. Something went wrong, we've already been notified and will have it fixed as soon as we can.", 'danger', true, true)
            }

            return container;
        }
        function createLeaderboard(options){
            let { label, content, type } = options,
                container = $(`<div class="block"><label class="label">${label}</label><div class="box leaderboard"></div></div>`),
                table = $(`<table class="table is-fullwidth is-hoverable is-vcentered"><thead>
                    <th style="width:64px;"></th>
                    <th>Name</th>
                    <th>Average Grade</th>
                </thead><tbody></tbody></table>`),
                tbody = table.find('tbody')

            if(!content.length){
                container.find('.leaderboard').append(
                    $(`<div class="spacedText is-medium is-centered has-text-grey">
                        <p>
                            <span class="icon"><i class="fas fa-check"></i></span>
                            <span>Your top students will appear here after some submissions have been graded!</span>
                        </p>
                    </div>`)
                )
                return container;
            }
    
            content.forEach(item => {
                if(type == "submission"){
                    if(item.status == "success"){
                        let sub = $(`<tr>
                            <td style="width:64px;"><figure class="image is-48x48 is-rounded"><img src="${item.student.profile_picture}"/></figure></td>
                            <td>${item.student.name}</td>
                            <td class="average-grade"><div class="loader mx-0"></div></td>
                        </tr>`);
                        tbody.append(sub)
                        $GET(`/dashboard/getAverageGrade?student=${item._id}`, (request, text) => {
                            text = JSON.parse(text);
                            sub.find('.average-grade').html(`<p>${text.average=='--'?'--':text.average+'%'}</p>`)
                        })
                    }
                }
            })
    
            container.find('.leaderboard').append(table);
            return container;
        }
    
        function createSidebar(){
            let email = res.email
            if(email.length >= 24){ email = email.substring(0, 20) + '...' }

            let plan_map = new Map();
            plan_map.set('free', 'Free Plan')
            plan_map.set('professional', 'Professional')
            plan_map.set('vip', 'VIP Unlimited')
            plan_map.set('admin', 'Admin')

            let { usage } = res;

            let progress = res.plan == 'free' ? Math.round((usage.sheet_usage / usage.sheet_limit) * 100) : '100'

            let container = $(`<div>
                <div class="field" style="height:44px;">
                    <a class="button is-fullwidth is-primary has-text-weight-semibold" id="create" style="height:36px;">
                        <span class="icon"><i class="fas fa-plus"></i></span>
                        <span>Create Worksheet</span>
                    </a>
                </div>
                <div class="block box is-size-6 has-text-black">
                    <div class="twobox also-mobile">
                        <p class="has-text-weight-bold">Plan</p>
                        <a class="has-text-black" href="${_DOMAIN}/billing">${plan_map.get(res.plan)}</a>
                    </div>
                    ${res.plan == 'free' ? '' : ` <div class="twobox also-mobile">
                        <p class="has-text-weight-bold">Plan Renews:</p>
                        <p>${fancyCase(moment(res.plan_renews).fromNow())}</p>
                    </div> `}
                    <div class="twobox also-mobile">
                        <p class="has-text-weight-bold">Account:</p>
                        <a class="has-text-black" href="${_DOMAIN}/settings">${email}</a>
                    </div>
                    <hr>
                    <div class="twobox also-mobile">
                        <p class="has-text-weight-bold">Worksheets:</p>
                        <p>${ res.plan == 'free' ? `${usage.sheet_usage} of ${usage.sheet_limit}` : 'Unlimited' }</p>
                    </div>
                    <div class="mt-2">
                        <progress class="progress is-primary is-small" value="${progress}" max="100">${progress?progress+'%':'0%'}</progress>
                    </div>
                </div>
                <div class="block box">
                    <figure class="field image is-centered" style="max-width:220px;">
                        <img src="${_DOMAIN}/images/people-6.svg" alt="Students"/>
                    </figure>
                    <div class="field has-text-centered is-montserrat">
                        <h2 class="is-size-4 has-text-weight-bold">Upgrade To Professional</h2>
                        <p class="is-size-7">Upgrade your account to get unlimited worksheets and submissions.</p>
                    </div>
                    <div class="field buttons is-centered">
                        <a class="button is-primary has-text-weight-bold upgradeNow">
                            <span>Upgrade Now</span>
                        </a>
                    </div>
                </div>
            </div>`)

            let upgrade = container.find('.upgradeNow').click(() => {
                promptToUpgrade();
            })

            let button = container.find('#create')
            button.click(async () => {
                if(button.hasClass('is-loading')){ return; }
                button.addClass('is-loading');

                let create_result = await $POST('/sheets/create', { sheet_name:"New Sheet", folder_id:'root' }),
                    { status } = create_result,
                    { url } = await create_result.json()

                if(status == 402){
                    let modal = $(`<div class="modal is-small is-active">
                        <div class="modal-background"></div>
                        <div class="modal-card">
                            <header class="modal-card-head">
                            <p class="modal-card-title">Plan Limit Exceeded!</p>
                            <button class="delete" aria-label="close"></button>
                            </header>
                            <section class="modal-card-body">
                                <h1 class="title has-text-centered" style="font-size:65px !important;">100%</h1>
                                <p class="subtitle is-size-5 has-text-centered">of your sheet limit reached!</p>
            
                                <hr>
            
                                <p class="mb-2 is-size-6 has-text-centered">
                                    <strong>You have created ${usage.sheet_usage} sheets<br>of your ${usage.sheet_limit} monthly sheet limit.</strong>
                                </p>
                                <p class="mb-2 is-size-6 has-text-centered">
                                    Your usage will reset ${moment(res.plan_renews).fromNow()}.
                                </p>
                                <p class="mb-2 is-size-6 has-text-centered">
                                    You can either wait until then and you'll get ${usage.sheet_limit} more sheets to create for the month, or you can upgrade your plan to meet your needs.
                                </p>
                                
                            </section>
                            <footer class="modal-card-foot buttons is-centered"> 
                                <a class="button" aria-label="close">Close</a>
                                <a class="button is-success" href="${_DOMAIN}/billing/plans">View Plans</a>
                            </footer>
                        </div>
                    </div>`)

                    modal.on('click', '.modal-background', () => modal.remove())
                    modal.on('click', '[aria-label=close]', () => modal.remove())

                    $(`body`).append(modal)
                }
                else if(status == 200){
                    window.location.href = url;
                    return
                }
                else{
                    toast("Something went wrong trying to create your sheet. Please try again later.", "danger", true, true);
                    console.error(create_result)
                }
                button.removeClass('is-loading')
            })

            return container;
        }

        let headline = $(`<div class="field icon-text" style="height:44px;">
            ${bkg_loading_mode?`<div class="loader icon mx-1"></div>`:''}
            <h1 class="title is-size-1 is-cera">Welcome Back ${res.first_name}</h1>
        </div>`)
    
        if(res.type == "teacher"){
            elements.dashboard.addClass('column')
            
            let remaining_notifications = res.notifications_total - res.notifications.length

            elements.dashboard.append(
                headline,
                $(`<div class="block columns"></div>`).append(
                    bigStat(`Total Submissions`, 'All Time', `far fa-paper-plane`, res.totalSubmissions, 1),
                    bigStat(`Average Grade`, 'Of All Submissions', `fas fa-pen-fancy`, res.studentsAverage=='--'?'--':parseInt(res.studentsAverage * 10) / 10+'%', res.studentsAverage=='--'?1:res.studentsAverage/100),
                    bigStat(`Recent Submissions`, 'Last 7 days', `far fa-paper-plane`, res.submissionsLast7Days, 1)
                ),
                createRecentBox({
                    label:"Submissions that need to be graded",
                    content:res.notifications,
                    content_type:"submission",
                    view_more:(res.notifications_total>3)?`${_DOMAIN}/viewAll/submissions`:'',
                    view_more_label:`${ remaining_notifications > 0 ? `View ${remaining_notifications} more` :'View all' }`
                }),
                createRecentBox({
                    label:"Recently Created Worksheets",
                    content:res.recentSheets,
                    content_type:"sheet",
                    view_more:(res.recentSheets>=1)?`${_DOMAIN}/sheets`:'',
                    view_more_label:`View All`
                }),
                createLeaderboard({
                    label:"Top Students",
                    content:res.leaderboard,
                    type:'submission'
                })
            )
    
            elements._root.append(
                $(`<div class="columns is-reversed-mobile"></div>`).append(
                    elements.dashboard,
                    $(`<div class="column is-dashboard-sidebar"></div>`).append(createSidebar())
                )
            )
            
        }
        else{
            let averageTime = res.averageTime;
            if(averageTime != '--'){
                averageTime = moment.duration(res.averageTime, 'seconds').humanize()
                averageTime = averageTime.replaceAll('minutes', 'mins').replaceAll('seconds', 'secs')
            }
            elements.dashboard.append(
                headline,
                $(`<div class="columns"></div>`).append(
                    bigStat(`Total Submissions`, 'All Time', `far fa-paper-plane`, res.totalSubmissions || 0, 1),
                    bigStat(`My Average Grade`, 'All Time', `fas fa-pen-fancy`, res.averageGrade + '%', res.averageGrade=='--'?1:res.averageGrade/100),
                    bigStat(`Recent Submissions`, 'Last 7 Days', `far fa-paper-plane`, res.recentSubmissions || 0, 1),
                    bigStat(`Time Per Sheet`, 'All Time Average', `fas fa-stopwatch`, averageTime, 1, true)
                ),
                createRecentBox({
                    label:"Recently Visited",
                    content:res.visitedHistory,
                    content_type:"sheet"
                }),
                createRecentBox({
                    label:"Recent Submissions",
                    content:res.submittedHistory,
                    content_type:"submission",
                    view_more:(res.submittedHistory>=1)?`${_DOMAIN}/viewAll/submissions`:'',
                    view_more_label:`View All`
                })
            )
            elements._root.append(
                elements.dashboard
            )
        }
    
        animatedProgressBars.forEach((pb, index) => {
            let { container_id, value } = pb;
            let progressBar = new ProgressBar.Circle('#' + container_id, {
                strokeWidth: 3,
                easing: 'easeInOut',
                from: { color: '#07cdff' },
                to: { color: '#23c554' },
                duration: 1600 + (250 * index),
                step: function(state, circle) {
                    circle.path.setAttribute('stroke', state.color);
                }
            });
            progressBar.animate(value);
    
            $('#'+container_id).parent().click(() => { progressBar.set(0); progressBar.animate(value); })
        });
    }

    await refresh();
    
    function pushFromLocalEditor(){
        let LS = localStorage.getItem('SP_publicEditor'); if(!LS){ return; }
        LS = JSON.parse(LS)
        
        // Create a new worksheet for the previously autosaved item
       $POST('/sheets/create', {})
            .then(req => { if(req.status != 200){ throw new Error({ req }); }; return req.json() })
            .then(res => { return $POST(`/sheet/v2/save?sheetid=${res.sheetid}`, LS); })
            .then(req => { if(req.status != 200){ throw new Error({ req }); }; return true; })
            .then(res => { localStorage.removeItem('SP_publicEditor') })
            .catch(console.error)
    }

}();