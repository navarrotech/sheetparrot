!function(){

    var elements = {
        _root:$('#results'),
        tabs:{
            overview:$('#tab_overview'),
            submissions:$('#tab_submissions')
        },
        toolbar:$('#third_toolbar'),
        count:$('#reuslts_count'),
        paginator:$('.pagination')
    }

    function createCircularProgressBar(options={}){
        /* options={ upper:{ title:'', subtitle:'' }, lower:{ title:'', subtitle:'' }, value:0.5, icon:'fas fa-pen-fancy' } */
        let container = $(`
            <div class="status-card">
                <div class="status-card-body">
                    <h1>${options.upper && options.upper.title}</h1>
                    <h2><b>${options.upper && options.upper.subtitle}</b></h2>
                    <div class="dashboard-progress">
                        <div class="circular_progressbar large"></div><i class="${options.icon || 'fas fa-spinner'} fa-2x centerIcon"></i></div>
                    <p>${options.lower && options.lower.title}</p>
                    <h3>${options.lower && options.lower.subtitle}</h3>
                </div>
            </div>
        `)

        let pb = new ProgressBar.Circle(container.find('.circular_progressbar').get()[0], {
            strokeWidth: 3, easing: 'easeInOut', from: { color: '#07cdff' }, to: { color: '#23c554' },
            duration: 1600, step: function(state, circle) { circle.path.setAttribute('stroke', state.color); }
        }); //pb.animate(options.value);

        //container.ready(() => pb.animate())
        //container.click(() => { pb.set(0); pb.animate(options.value); })

        return container;
    }

    async function tab_overview(){
 
        elements._root.html('<div class="loader medium"></div>')

        let [sheet_request, graph_request] = await Promise.all([
            $GET(`/sheet/v2/get?sheetid=${sheetid}`),
            $GET(`/sheet/v2/graph?sheetid=${sheetid}`)
        ])

        if(sheet_request.status != 200 || graph_request.status != 200){ console.error({ graph_request, sheet_request }); return; }

        let [sheet, graph] = await Promise.all([sheet_request.json(), graph_request.json() ])

        let parent = $(`<div class="columns">
            <div class="column">
                <div class="columns"><div class="column stats_views"></div><div class="column stats_submissions"></div><div class="column stats_averageGrade"></div></div>
                <div class="graph_container is-30days"></div>
            </div>
            <div class="column is-one-third">
                <div class="box"><h1 class="subtitle is-size-6">Latest activity</h1></div>
            </div>
        </div>`)

        // Three big stats column

        parent.find('.stats_views').append( createCircularProgressBar({
            upper:{ title:'Unique Views', subtitle:sheet.stats.uniques },
            lower:{ title:'Total views:', subtitle:sheet.stats.views },
            value:(sheet.stats.uniques <= 10) ? '0.3' : (sheet.stats.uniques % 100) / 100,
            icon:'fas fa-eye'
        }) );
        parent.find('.stats_submissions').append( createCircularProgressBar({
            upper:{ title:'Submissions', subtitle:sheet.stats.submissions },
            lower:{ title:'&nbsp;', subtitle:'&nbsp;' },
            value:Math.round(sheet.stats.submissions * 100 / 100) / 100,
            icon:'far fa-paper-plane'
        }) );
        parent.find('.stats_averageGrade').append( createCircularProgressBar({
            upper:{ title:'Average Grade', subtitle:sheet.average_grade ? sheet.average_grade + '%' : '--' },
            lower:{
                title:`${(sheet.stats && sheet.stats.graded_submissions)?`From ${sheet.stats.graded_submissions} graded submission${sheet.stats.graded_submissions==1?'':'s'}`:'Waiting for submissions...'}`,
                subtitle:''
            },
            value:(sheet.average_grade) ? sheet.average_grade / 100 : '0',
            icon:'fas fa-pen-fancy'
        }) );

        // Chart at the bottom of the page

        let graph_container = $(`<div class="box graph" style="height:300px;max-height:300px;"><h1 class="title is-size-6">Submissions in the last 30 days</h1></div>`)
        parent.find('.graph_container').append(graph_container)

        graph_container.get()[0].appendChild( create30DaysSubmissionsChart(graph.last_30_days) )
        console.log(create30DaysSubmissionsChart(graph.last_30_days))

        function create30DaysSubmissionsChart(incoming_data){

            let dates_30_days = [],
                labels_30_days = [],
                data_points = [],
                weekdays = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'],
                months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                i=0

            let tallest = 0

            for(i=0; i<30; i++){
                let viewing_date = new Date()
                viewing_date.setDate(viewing_date.getDate() - i)
                dates_30_days.push(viewing_date)

                let prettyDay = months[viewing_date.getMonth()] + ' ' + viewing_date.getDate()
                labels_30_days.push(prettyDay)

                let before = new Date(viewing_date.toISOString())
                before = new Date(before.setDate(before.getDate() - 2))

                let result = incoming_data.filter(sheet_item => (
                    new Date(sheet_item.submitted_time) <= viewing_date && 
                    new Date(sheet_item.submitted_time) > before
                ));

                data_points.push(result.length)

                if(result.length > tallest){ tallest = result.length }
            }

            if(tallest <= 10){ tallest = tallest + 6 }
            else if(tallest > 10 && tallest <= 50){ tallest = tallest + 10 }
            else{ tallest = tallest + Math.round(tallest  / 5) }

            let canvas = document.createElement('canvas')
            canvas.setAttribute('height', '400px')
        
            let ctx = canvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels_30_days,
                    datasets: [{
                        label: 'Submissions',
                        data: data_points,
                        fill: false,
                        borderColor: '#4285F4',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins:{
                        legend:{
                            display:false
                        }
                    },
                    scales: {
                        y: {
                            suggestedMin: 0,
                            suggestedMax: tallest,
                            grid:{
                                display:false
                            }
                        },
                        x:{
                            reverse:true,
                            grid:{
                                color:'rgba(0,0,0,0.03)'
                            }
                        }
                    }
                }
            });

            return canvas;
        }

        // Activity Column

        let activity = $(`<div class="activity"></div>`)
        sheet.history = sheet.history.slice(-10).reverse()
        sheet.history.forEach(h => {
            
            activity.append(`
                <div class="icon-text block">
                    <span class="icon">
                        <i class="fa-2x ${h.what == 'New Submission' ? 'far fa-paper-plane' : h.what == 'Created Sheet' ? 'fas fa-save' : 'fas fa-hammer'}"></i>
                    </span>
                    <div class="text is-size-7">
                        <p><b>${h.what}</b>${h.what == 'New Submission' ? `&nbsp;&nbsp;<a href="${_DOMAIN}/grade?i=${sheetid}&s=${h._id}">Grade now</a>` : ''}</p>
                        <p><span>${h.who}</span> &bullet; ${moment(h.when).fromNow()}</p>
                    </div>
                </div>
            `)
        })

        parent.find('.column.is-one-third .box').append(activity)

        elements._root.html('').append(parent);
    }

    tab_overview();

};

(function(){

    var selected_emails = []
    function _generateInstance(){
    
        var isloading = false;
    
        let results_table = $QS('#results'),
            loader = $QS('#content-loader'),
            third_toolbar = $QS('#third_toolbar'),
            results_counter = $QS('#results_count'),
            paginatorEl = $QS('#paginator')
    
        let getListAndGenerate = async function(url, fn){
            results_counter.innerHTML = ''
            $CLASS(results_table, 'box', false)
            let result = await $GET(url)
            if(result.status != 200){ console.error(result); }
    
            let text = await result.text()
            text = JSON.parse(text)
    
            if(!text.content || text.total == 0 || text.content.length == 0){
                results_counter.innerHTML = "No results found"
                fn( null );
                return;
            }
    
            fn( text );
        }
    
        let downloadSubmissionsCSV = function(){
            showLoading("We are getting your sheet's submissions ready for you now, please wait.")
            $GET('/sheet/v2/toCSV/submissions?sheetid=' + sheetid, (result, text) => {
                hideLoading()
                if(result.status === 200){
                    let file_string = "data:text/csv;charset=utf-8," + text
                    var encodedUri = encodeURI(file_string)
                    var link = document.createElement("a")
                    link.setAttribute("href", encodedUri)
                    link.setAttribute("download", sheet_name + ' downloaded on ' + (new Date().toDateString()) + ".csv")
                    document.body.appendChild(link)
                    link.click()
                } 
                else {
                    console.log(result)
                    toast("Something went wrong trying to convert into a CSV file, please try again later.", 'danger', false)
                }
            })
        }
    
        function getGradeProgress(paperObj){
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
                            else if(option_vals.grade == -1)
                                r.incorrect += 1;
                        })
                    }
                })
            })
            return r;
        }
    
        /* Data loading per tab clicked */
        let _displayOverview = async function(){
            $CLASS(loader, 'is-hidden', false)
            resetURL(_DOMAIN + '/sheets/view/' + sheetid)
            results_table.innerHTML = ""
            third_toolbar.innerHTML = ""
            isloading = true;
            $CLASS(results_counter, 'is-hidden', true)
            $CLASS(paginatorEl, 'is-hidden', true)
            $CLASS(results_table, 'box', false)
    
            let sheet_result = $GET('/sheet/v2/get?sheetid='+sheetid);
            let graph_result = $GET('/sheet/v2/graph?sheetid='+sheetid);
    
            let container_counter=0;
    
            [sheet_result, graph_result] = await Promise.all([sheet_result, graph_result])
    
            if(graph_result.status != 200){ console.error(graph_result); return; }
            if(sheet_result.status != 200){ console.error(sheet_result); return; }
    
            let sheet = await sheet_result.json();
            let report = await graph_result.json();
    
            let graph = report.last_30_days,
                total_submissions = report.total_submissions
    
            function create30DaysSubmissionsChart(incoming_data, title){
    
                let dates_30_days = [],
                    labels_30_days = [],
                    data_points = [],
                    weekdays = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat'],
                    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                    i=0
            
                let tallest_y_peak = 0
            
                for(i=0; i<30; i++){
                    let viewing_date = new Date()
                    viewing_date.setDate(viewing_date.getDate() - i)
                    dates_30_days.push(viewing_date)
        
                    let prettyDay = months[viewing_date.getMonth()] + ' ' + viewing_date.getDate()
                    labels_30_days.push(prettyDay)
        
                    let before = new Date(viewing_date.toISOString())
                    before = new Date(before.setDate(before.getDate() - 2))
        
                    let result = incoming_data.filter(sheet_item => (
                        new Date(sheet_item.submitted_time) <= viewing_date && 
                        new Date(sheet_item.submitted_time) > before
                    ));
        
                    data_points.push(result.length)
        
                    if(result.length > tallest_y_peak){ tallest_y_peak = result.length }
                }
            
                if(tallest_y_peak <= 10){
                    tallest_y_peak = tallest_y_peak + 6
                }
                else if(tallest_y_peak > 10 && tallest_y_peak <= 50){
                    tallest_y_peak = tallest_y_peak + 10
                }
                else{
                    tallest_y_peak = tallest_y_peak + Math.round(tallest_y_peak  / 5)
                }
    
                let canvas = document.createElement('canvas')
                canvas.setAttribute('height', '400px')
            
                let ctx = canvas.getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels_30_days,
                        datasets: [{
                            label: 'Submissions',
                            data: data_points,
                            fill: false,
                            borderColor: '#4285F4',
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins:{
                            legend:{
                                display:false
                            }
                        },
                        scales: {
                            y: {
                                suggestedMin: 0,
                                suggestedMax: tallest_y_peak,
                                grid:{
                                    display:false
                                }
                            },
                            x:{
                                reverse:true,
                                grid:{
                                    color:'rgba(0,0,0,0.03)'
                                }
                            }
                        }
                    }
                });
            
                let container = document.createElement('div')
                container.className = "box graph"
                container.innerHTML = `<h1 class="title is-size-6">${title}</h1>`
                container.style.cssText = 'height:300px;max-height:300px;'
                container.appendChild(canvas)
                
                return container;
            }
            function createCircularProgressBar(data){
                let a = document.createElement('div')
                a.className = "status-card"
                a.innerHTML = `<div class="status-card-body">
                    <h1 class="">${data.upperTitle}</h1>
                    <h2 class=""><b>${data.upperSubtitle}</b></h2>
                    <div class="dashboard-progress" value="${data.value}" data-link="container_${container_counter}">
                        <div class="circular_progressbar large" id="container_${container_counter}"></div>
                        <i class="${data.icon} fa-2x centerIcon"></i></div>
                    <p class="">${data.lowerTitle}</p>
                    <h3 class="">${data.lowerSubtitle}</h3>
                </div>`
                container_counter+=1;
    
                return a;
            }
    
            let activity = '';
            for(i=0;i<10;i++){
                let h = sheet.history[sheet.history.length - 1 - i]
                if(!h){ break; }
                if(h.who == logged_in_user){ h.who = `<span>${h.who}</span>` }
                else{ h.who = `${h.who}` }
                activity += `
                <div class="icon-text block">
                    <span class="icon">
                        <i class="fa-2x ${h.what == 'New Submission' ? 'far fa-paper-plane' : h.what == 'Created Sheet' ? 'fas fa-hammer' : 'fas fa-save'}"></i>
                    </span>
                    <div class="text is-size-7">
                        <p><b>${h.what}</b>${h.what == 'New Submission' ? `&nbsp;&nbsp;<a href="${_DOMAIN}/submissions/grader/v1/${sheetid}?id=${h._id}">Grade now</a>` : ''}</p>
                        <p>${h.who} &bullet; ${howLongAgo(new Date(h.when))}</p>
                    </div>
                </div>`
            }
    
            results_table.innerHTML = `
            <div class="columns">
                <div class="column">
                    <div class="columns">
                        <div class="column stats_views"></div>
                        <div class="column stats_submissions"></div>
                        <div class="column stats_averageGrade"></div>
                    </div>
                    <div class="graph_container is-30days"></div>
                </div>
                <div class="column is-one-third">
                    <div class="box">
                        <h1 class="subtitle is-size-6">Latest activity</h1>
                        <div class="activity">
                            ${activity}
                        </div>
    
                    </div>
    
                </div>
            </div>
            `
    
            let stats_views = results_table.querySelector('.stats_views'),
                stats_submissions = results_table.querySelector('.stats_submissions'),
                stats_averageGrade = results_table.querySelector('.stats_averageGrade')
    
            stats_views.appendChild( createCircularProgressBar({
                upperTitle:'Unique Views',
                upperSubtitle:sheet.stats.uniques,
                value:(sheet.stats.uniques <= 10) ? '0.3' : (sheet.stats.uniques % 100) / 100,
                icon:'fas fa-eye',
                lowerTitle:`Total views:`,
                lowerSubtitle:sheet.stats.views
            }) )
            stats_submissions.appendChild( createCircularProgressBar({
                upperTitle:'Submissions',
                upperSubtitle:total_submissions,
                value:Math.round(total_submissions * 100 / 100) / 100,
                icon:'far fa-paper-plane',
                lowerTitle:'Total Submissions:',
                lowerSubtitle:total_submissions
            }) )
            stats_averageGrade.appendChild( createCircularProgressBar({
                upperTitle:'Average Grade',
                upperSubtitle:sheet.average_grade ? sheet.average_grade + '%' : '--',
                value:(sheet.average_grade) ? sheet.average_grade / 100 : '0',
                icon:'fas fa-pen-fancy',
                lowerTitle:`${(sheet.stats && sheet.stats.graded_submissions)?`From ${sheet.stats.graded_submissions} graded submission${sheet.stats.graded_submissions==1?'':'s'}`:'Waiting for submissions...'}`,
                lowerSubtitle:''
            }) )
    
            results_table.querySelector('.graph_container.is-30days').appendChild(create30DaysSubmissionsChart(graph, 'Submissions in the last 30 days'))
    
            function progressNow(container, progress){
                try{
                    let progressBar = new ProgressBar.Circle(container, {
                        strokeWidth: 3,
                        easing: 'easeInOut',
                        from: { color: '#07cdff' },
                        to: { color: '#23c554' },
                        duration: 1600,
                        step: function(state, circle) {
                            circle.path.setAttribute('stroke', state.color);
                        }
                    });
                    progressBar.animate(progress);
    
                    container = $QS(container)
    
                    container.addEventListener('click', () => {
                        progressBar.set(0);
                        progressBar.animate(progress)
                    })
                } catch(error){ console.error(error); }
            }
            let containers = $QSA(".dashboard-progress")
            containers.forEach(c => { progressNow('#' + c.getAttribute('data-link'), c.getAttribute('value')) })
    
            isloading=false;
            $CLASS(loader, 'is-hidden', true)
        }
        let _displaySubmissions = function (page=0){
            resetURL(_DOMAIN + '/sheets/view/' + sheetid + "?page="+page)
            $CLASS(loader, 'is-hidden', false)
            results_table.innerHTML = ""
            third_toolbar.innerHTML = ""
            isloading = true;
            $CLASS(paginatorEl, 'is-hidden', true)
    
            getListAndGenerate('/sheet/v2/property/submissions?sheetid='+sheetid+'&page='+page, (result) => {
                let displayer;
                if(!result || result.total == 0){
                    displayer = document.createElement('div')
                    displayer.className = "box"
                    displayer.innerHTML = "<p class='block is-size-5 has-text-centered'>Nobody has submitted any work for this sheet yet.<p>"
                    displayer.innerHTML += "<div class='block buttons is-centered'><a class='button is-primary copier_link'><span>Copy Share Link</span><span class='icon'><i class='fas fa-link'></i></span></a></div>"
                    let copy_link = displayer.querySelector('a.copier_link'),
                        copy_link_text = copy_link.querySelector("span:not(.icon)")
                    copy_link.addEventListener('click', () => {
                            navigator.clipboard.writeText(_DOMAIN + '/sheet/' + sheetid)
                            .then(r => {
                                $CLASS(copy_link, 'is-primary', false)
                                $CLASS(copy_link, 'is-success', true)
                                copy_link_text.innerHTML = "Copied to clipboard!"
                                setTimeout(() => {
                                    $CLASS(copy_link, 'is-primary', true)
                                    $CLASS(copy_link, 'is-success', false)
                                    copy_link_text.innerHTML = "Copy Share Link"
                                }, 2000)
                            })
                            .catch(e => {
                                console.log(e)
                                $CLASS(copy_link, 'is-primary', false)
                                $CLASS(copy_link, 'is-danger', true)
                                copy_link_text.innerHTML = "Something went wrong"
                                setTimeout(() => {
                                    $CLASS(copy_link, 'is-primary', true)
                                    $CLASS(copy_link, 'is-danger', false)
                                    copy_link_text.innerHTML = "Copy Share Link"
                                }, 2000)
                            })
                    })
                } 
                else {
                    try{ results_counter.innerHTML = result.total + " total submissions" } catch(e){}
                    // Special, just for submissions: Allow users to download
                    let buttons = document.createElement('div')
                    buttons.className = 'buttons is-right'
    
                    let download = document.createElement('a') // Download CSV Button
                    download.className = 'button'
                    download.innerHTML = "Download CSV"
                    download.addEventListener('click', downloadSubmissionsCSV)
                    buttons.appendChild(download)
                    
                    let grader = document.createElement('a') // Start Grading Button
                    grader.className = 'button is-link'
                    grader.innerHTML = "Grade Now"
                    grader.href = `/submissions/grader/v1/${sheetid}`
                    buttons.appendChild(grader)
    
                    third_toolbar.appendChild(buttons)
                    // In the future, add a filter button here :)
    
                    $CLASS(results_table, 'box', true)
                    displayer = document.createElement('table')
                    displayer.className = "table is-fullwidth"
                    displayer.innerHTML = `<thead><tr><th class=\"is-hidden-touch\"></th><th>Student</th><th class=\"is-hidden-touch\">Submitted</th><th>Grade</th><th class=\"is-hidden-touch\">Grading Progress</th><th>Options</th></tr></thead>`
                    let tbody = document.createElement('tbody')
                    result.content.forEach((item, item_iteration) => {
                        let row = document.createElement('tr')
                        row.innerHTML =  `<td class="is-hidden-touch"><figure class="image is-48x48 is-beveled"><img src="${item.student.profile_picture}"/></figure></td>`
                        row.innerHTML += `<td><div><h1 class="title is-size-6"><b>${item.student.name}</b></h1><h2 class="subtitle is-size-7">${item.student.email}</h2></div></td>`
                        row.innerHTML += `<td class="is-hidden-touch">${moment(item.created).fromNow()}</td>`
                        row.innerHTML += `<td>${item.grade ? (item.grade.percentage + '%') : '--'}</td>`
                        let grade_progress = '--'
                        try{
                            //let grades = getGradeProgress(item.paper)
                            let { total=0, graded=0, correct=0 } = item.grade,
                                incorrect = graded - correct;

                            let progressbar = `<div class="multi-progress">
                                <div class="chunk is-success" style="width:${Math.round((correct / total) * 100)}%"></div>
                                <div class="chunk is-danger" style="width:${Math.round((incorrect / total) * 100)}%"></div>
                            </div>`
    
                            if(item.grade.finished){
                                grade_progress = `<div class="has-tooltip-multiline" data-tooltip="You have graded all of ${item.student.first_name}'s work for this sheet.">${progressbar}</div>`
                            }
                            else if (graded === 0){
                                grade_progress = 'Grading not started'
                            }
                            else {
                                grade_progress = `<div class="is-hidden-touch has-tooltip-multiline"
                                    data-tooltip="You have graded ${ Math.round((graded / total) * 100) }% of ${item.student.first_name}'s work for this sheet so far.">${progressbar}
                                </div>`
                            }
                        } catch(e){ grade_progress = '--'; $ERR(e); }
                        row.innerHTML += `<td class="is-hidden-touch ">${grade_progress}</td>`
                        row.innerHTML += `<td><div class="buttons are-small is-right"><a href="${_DOMAIN}/grade?i=${item.sheetid}&s=${item._id}" class="button is-link is-outlined is-rounded">Grade / View</a></div></td>`
                        tbody.appendChild(row)
                    })
                    paginate(paginatorEl, result.total, 15, page, (new_page) => _displaySubmissions(new_page))
                    displayer.appendChild(tbody)
                }
                try{ results_table.appendChild(displayer) } catch(e){ $ERR(e) }
                isloading = false;
                $CLASS(loader, 'is-hidden', true)
                $CLASS(results_counter, 'is-hidden', false)
            })
        }
    
        /* Bind buttons to actions */
        let tab_overview    = $QS("#tab_overview"),
            tab_submissions = $QS('#tab_submissions')
    
        let middleware = function (el, next){
            if(isloading == false){
                $CLASS(tab_overview   , 'is-active', false)
                $CLASS(tab_submissions, 'is-active', false)
                $CLASS(el             , 'is-active', true )
                next()
            }
        }
    
        tab_overview   .addEventListener( 'click', () => middleware(tab_overview   , _displayOverview   ) )
        tab_submissions.addEventListener( 'click', () => middleware(tab_submissions, _displaySubmissions) )
        
        /* Defaults on page load */
        let goto = getParam('goto')
        if(goto && goto === 'submissions'){
            middleware(tab_submissions, () => _displaySubmissions(0))
        }
        else{
            middleware(tab_overview, () => _displayOverview(0))
        }
    
    }
    _generateInstance()
    
})();