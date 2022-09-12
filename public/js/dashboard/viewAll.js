!async function(){
    var elements = {
        root:$('#results'),
        toolbar:$("<div class=\"block container is-hidden\"><div class=\"twobox is-centered is-spaced\"><div class=\"buttons m-0 has-addons\"></div></div></div>"),
        content:$("#content"),
        total_ticker:$("<p></p>"),
        paginator:$("<ul class=\"pagination-list\"></ul>")
    }

    var search = '',
        page = 0,
        pagination_limit = 100

    function showLoading(){
        elements.content.html("<div class=\"loader is-medium\"></div>");
    }

    async function refresh(){
        showLoading();

        let request = await $POST('/dashboard/getSubmissions', { page, pagination_limit, search }),
            result = await request.json();

        if(request.status != 200){ console.error({ request, result }); }

        elements.total_ticker.text("Showing " + result.submissions.length + " of " + result.total)

        if(result.empty){
            console.log("No submissions found")
            //elements.content.html('');
            elements.content.html("<div class=\"box has-text-centered\" style=\"width:fit-content; margin:0 auto;\">"
                +"<h1 class=\"subtitle is-size-5 has-text-grey\">You're all caught up! No recent submissions.</h1>"
                +"</div>");
            return;
        }

        let table = $("<table class=\"table is-fullwidth is-hoverable is-vcentered\"></table>")
        elements.content.html("<div class=\"box\"></div>")

        if(result.type == 'teacher'){
            table.append('<thead><tr><th></th><th>Student</th><th>Sheet</th><th class="has-text-centered">Grade</th><th class="has-text-centered">Time Taken</th><th class="has-text-right">Actions</th></tr></thead>')
            table.append('<tbody></tbody>')

            let getGrade = function(grade){
                if(grade.finished){
                    return Paper.getGradeLetter(grade.percentage) + " (" + grade.percentage + ")%";
                }
                else if(grade.total - grade.graded == 0){
                    return "Incomplete";
                }
                else{
                    return String(grade.total - grade.graded ) + ' not graded';
                }
            }

            result.submissions.forEach(submission => {
                /*
                    created: "2022-03-28T18:46:35.145Z"
                    grade: {graded: 6, correct: 4, total: 6, percentage: 66.67, finished: true}
                    owner: "4uxeHYO4xeG"
                    sheet: { sheetname:"My Sheet", _id:"ggUdDuqPHtb" }
                    paper: (2) [Array(3), Array(3)]
                    sheetid: "ggUdDuqPHtb"
                    student: {profile_picture: 'http://localhost:8080/images/account.svg', first_name: 'SheetParrot', last_name: 'Test', name: 'SheetParrot Test', email: 'adnavarro001@gmail.com'}
                    time: 103
                    _id: "vfXiXBrQfef"
                */
               
                let row = $("<tr>"
                + "<td>"
                + "<figure class=\"image is-48x48\">"
                + "<img src=\""+submission.student.profile_picture+"\"/>"
                + "</figure>"
                + "</td>"
                + "<td>"
                + "<div>"
                + "<h1 class=\"title is-size-5\">"+submission.student.name+"</h1>"
                + "<h2 class=\"subtitle is-size-7 has-text-grey\">"+submission.student.email+"</h2>"
                + "</div>"
                + "</td>"
                + "<td>"
                + "<p class=\"is-capitalized\">"+submission.sheet.sheetname+"</p>"
                + "</td>"
                + "<td>"
                + "<p class=\"is-capitalized has-text-centered has-text-"+(submission.grade.finished?('dark'):('danger'))+"\">"+getGrade(submission.grade)+"</p>"
                + "</td>"
                + "<td>"
                + "<div class=\"has-text-centered\">"
                + "<p class=\"is-capitalized\">Finished in "+moment.duration(moment(submission.time), 'seconds').humanize()+"</p>"
                + "<p class=\"is-capitalized\">Submitted "+moment(submission.created).fromNow()+"</p>"
                + "</td>"
                + "<td>"
                + "<div class=\"buttons has-addons is-right m-0\">"
                + (submission.grade && submission.grade.finished ? ("<a class=\"button m-0 is-link is-light\" href=\""+_DOMAIN+"/grade?i="+submission.sheetid+"&s="+submission._id+"\">"
                    + "<span class=\"icon\"><i class=\"fas fa-eye\"></i></span>"
                    + "<span>View</span>"
                    + "</a>")
                :
                    ("<a class=\"button m-0 is-primary\" href=\""+_DOMAIN+"/grade?i="+submission.sheetid+"&s="+submission._id+"\">"
                    + "<span class=\"icon\"><i class=\"fas fa-pen-fancy\"></i></span>"
                    + "<span>Grade</span>"
                    + "</a>"))
                + "<a class=\"button m-0 is-danger is-light deleteButton\">"
                + "<span class=\"icon\"><i class=\"fas fa-trash-alt\"></i></span>"
                + "</a>"
                + "</div>"
                + "</td>"
                + "</tr>")

                row.on('click', '.deleteButton', async () => {
                    if(!confirm("Are you sure you want to delete " + submission.student.first_name + "'s submission? This cannot be undone!")){ return; }
                    await $POST('/submission/delete?_id=' + submission._id, { _id:submission._id })
                    row.remove();
                    result.total -= 1;
                    elements.total_ticker.text("Showing " + (result.submissions.length - 1) + " of " + (result.total - 1))
                    if(result.total == 0){
                        if(page != 0){ page -= 1; }
                        refresh();
                    }
                })

                table.find('tbody').append(row)

            })
        }
        else{
            elements.toolbar.find('.exportBtn').remove();
            table.append('<thead><tr><th>Sheet</th><th class="has-text-centered">Grade</th><th class="has-text-centered">Time Taken</th><th class="has-text-right">Actions</th></tr></thead>')
            table.append('<tbody></tbody>')

            let getGrade = function(grade){
                if(grade.finished){
                    return Paper.getGradeLetter( grade.percentage ) + " (" + grade.percentage + ")%";
                }
                else{
                    return 'Not graded yet';
                }
            }

            result.submissions.forEach(submission => {
                let row = $("<tr>"
                    + "<td>"
                        + "<div>"
                            + "<h1 class=\"title is-size-5\">"+submission.sheet.sheetname+"</h1>"
                            + "<h2 class=\"subtitle is-size-7 has-text-grey\">Created by "+submission.teacher.name+"</h2>"
                        + "</div>"
                    + "</td>"
                    + "<td>"
                        + "<p class=\"is-capitalized has-text-centered\">"+getGrade(submission.grade)+"</p>"
                    + "</td>"
                    + "<td>"
                        + "<div class=\"has-text-centered\">"
                            + "<p class=\"is-capitalized\">Finished in "+moment.duration(moment(submission.time), 'seconds').humanize()+"</p>"
                            + "<p class=\"is-capitalized\">Submitted "+moment(submission.created).fromNow()+"</p>"
                        + "</td>"
                    + "<td>"
                        + "<div class=\"buttons is-right m-0\">"
                            + "<a class=\"button m-0 is-link is-light\" target=\"_blank\" href=\""+_DOMAIN+"/sheet/"+submission.sheetid+"?vs="+submission._id+"&i="+submission.student+"\">"
                                + "<span class=\"icon\"><i class=\"fas fa-eye\"></i></span>"
                                + "<span>View</span>"
                            + "</a>"
                        + "</div>"
                    + "</td>"
                + "</tr>")

                table.find('tbody').append(row)

            })
        }

        elements.paginator.html('')
        if(result.pagination.pages > 1){
            paginate(elements.paginator.get()[0], result.total, result.pagination.pagination_limit, result.pagination.pagination, (selected_page) => { page = selected_page; refresh(); })
        }

        elements.toolbar.removeClass('is-hidden')
        elements.content.find('.loader').remove();
        elements.content.find('.box').append(table);
    }

    //let pagination_limit_selected = $("<div class=\"control\"><div class=\"select\"><select><option value=\"10\">10</option><option value=\"25\">25</option><option value=\"50\">50</option><option value=\"100\">100</option></select></div></div>")
    //pagination_limit_selected.on('change select', 'select', () => { pagination_limit = parseInt(pagination_limit_selected.find('select').val()); refresh(); })
    //elements.toolbar.find('.twobox .buttons').append( pagination_limit_selected )

    let export_btn = $("<a class=\"button is-primary m-0 exportBtn\"><span class=\"icon\"><i class=\"fas fa-file-export\"></i></span><span>Export To CSV</span></a>")
    export_btn.click(() => {
        let modal = $("<div class=\"modal is-active\">"
        + "<div class=\"modal-background\" action=\"close\"></div>"
        + "<div class=\"modal-card\">"
        + "<header class=\"modal-card-head\">"
        + "<p class=\"modal-card-title\">Export Submissions</p>"
        + "<button class=\"delete\" aria-label=\"close\" action=\"close\"></button>"
        + "</header>"
        + "<section class=\"modal-card-body\">"
        + "<div class=\"block\">"
        + "<label class=\"label candisable\">Date Range</label>"
        + "<div class=\"datePickers candisable\"></div>"
        + "<div class=\"customPicker mt-2 candisable\" style=\"max-width:370px;\"></div>"
        + "</div>"
        + "<div class=\"block candisable\">"
        + "<label class=\"label\">Columns To Export</label>"
        + "<div class=\"columns\">"
        + "<div class=\"column column-a\"></div>"
        + "<div class=\"column column-b\"></div>"
        + "</div>"
        + "</div>"
        + "</section>"
        + "<footer class=\"modal-card-foot buttons is-right\">"
        + "<button class=\"button\" action=\"close\">Cancel</button>"
        + "<button class=\"button is-success\">Export</button>"
        + "</footer>"
        + "</div>"
        + "</div>");
        
        let onClose = null;
        
        modal.on('click', '[action=close]', () => {
            modal.remove();
            if(onClose){ onClose(); }
        })

        let downloadBtn = $("<a class=\"button is-primary\"><span>Download</span><span class=\"icon\"><i class=\"fas fa-download\"></i></span></a>")

        let datePickers = modal.find('.datePickers'),
            customPicker = modal.find('.customPicker')
        
        let dates = [
            { title:"Today",         startDate:moment().subtract(24, 'hours'), endDate:moment() },
            { title:"Last 7 days",   startDate:moment().subtract(7, 'days'), endDate:moment() },
            { title:"Current Month", startDate:moment().startOf('month'), endDate:moment().endOf('month') },
            { title:"Last Month",    startDate:moment().subtract(1, 'months').startOf('month'), endDate:moment().subtract(1, 'month').endOf('month') },
            { title:"All Time",      startDate:null, endDate:null },
            { title:"Custom",        startDate:null, endDate:null },
        ]

        let startDate = dates[0].startDate,
            endDate = dates[0].endDate

        dates.forEach((day, index) => {
            let rangeText = day.startDate && !['Today', 'Custom'].includes(day.title) ? day.startDate.format('MMM DD') + ' -> ' + day.endDate.format('MMM DD') : day.title == 'Today' ? day.startDate.format('MMM DD') : '';
            let element = $("<div class=\"control\"><div class=\"twobox\"><div class=\"halfbox\"><label class=\"radio\"><input type=\"radio\" class=\"mr-2\" name=\"dateSelector\""+(index==0?' checked':'')+"/>"+day.title+"</label></div><div class=\"halfbox\"><p>"+rangeText+"</p></div></div></div>"),
                input = element.find('input')

            input.on('change', () => {
                downloadBtn.addClass('is-hidden')
                if(day.title == "Custom"){
                    startDate = moment().subtract(7, 'days'),
                    endDate = moment()

                    let custom_input = $("<input type=\"date\"/>")
                    customPicker.append(custom_input)
                    bulmaCalendar.attach(custom_input.get()[0], {
                        type:'date',
                        color:'primary',
                        isRange:true,
                        allowSameDayRange:true,
                        displayMode:'dialog',
                        showHeader:false,
                        showButtons:false,
                        showFooter:false,
                        showTodayButton:false,
                        showClearButton:false,
                        startDate:startDate.toDate(),
                        endDate:endDate.toDate()
                    });

                    custom_input.get()[0].bulmaCalendar.on('select', function({ data={} }) {
                        downloadBtn.addClass('is-hidden')
                        let { startDate:s, endDate:e } = data
                        startDate = moment(s)
                        endDate = moment(e)
                    });
                    return;
                }
                customPicker.html("")
                startDate = day.startDate;
                endDate = day.endDate;
            })

            datePickers.append(element)
        })

        let column_a = modal.find('.column-a'),
            column_b = modal.find('.column-b')

        let include = [
            { title:"Submitted Date",  value:"created",        include:true },
            { title:"Student Name",    value:"studentname",    include:true },
            { title:"Student Email",   value:"studentemail",   include:true },
            { title:"Sheet Name",      value:"sheetname",      include:true },
            { title:"Sheet Link",      value:"sheetlink",      include:true },
            { title:"Submission Link", value:"submissionlink", include:true },
            { title:"Grade Percent",   value:"gradepercent",   include:true },
            { title:"Grade Letter",    value:"gradeletter",    include:true },
            { title:"Grade Link",      value:"gradelink",      include:true },
            { title:"Grade Values",    value:"gradevalues",    include:true },
            { title:"Grade Status",    value:"gradestatus",    include:true },
            { title:"Time Taken",      value:"time",           include:true },
            //{ title:"Sheet Answers",   value:"paper",        include:true }
        ]

        modal.find('.modal-card-title').click(() => console.log(include))

        let halfsies = Math.floor(include.length / 2)
        include.forEach((item, index) => {
            let checker = $("<div class=\"mini-field\"><label class=\"checkbox\"><input type=\"checkbox\""+(item.include?' checked':'')+">"+item.title+"</label></div>")
            let input = checker.find('input[type=checkbox]')
            input.on('change', () => { item.include = input.is(':checked'); downloadBtn.addClass('is-hidden') })
            if(index <= halfsies){ column_a.append(checker ) } else { column_b.append(checker) }
        })

        let export_btn = modal.find('.modal-card-foot .button.is-success'),
            is_exporting = false;
        export_btn.click(async () => {
            if(is_exporting){ return; }

            console.log({ include, startDate, endDate })

            // Lock everything down
            downloadBtn.addClass('is-hidden')
            is_exporting = true;
            modal.find('.candisable').addClass('is-disabled')
            export_btn.addClass('is-loading')
            modal.find('.statusTicker').remove();

            // Status
            let status_ticker = $("<p class=\"\">Export started...</p>")
            let status_holder = $("<div class=\"block statusTicker\"></div>").append(status_ticker)
            modal.find('.modal-card-body').append( status_holder )

            let promises = [], limit = 1;

            // Fetching the data!
            let first_req = await $POST('dashboard/getSubmissions', { page:0, pagination_limit:limit, search:'', startDate:startDate?startDate.toISOString():null, endDate:endDate?endDate.toISOString():null }),
                first_res = await first_req.json();

            if(first_req.status != 200){ console.log({ first_req, first_res }) }

            promises.push(first_res)

            let iterations = Math.ceil(first_res.total / limit),
                completed = 1;

            let onfetched = function(){
                completed += 1;
                status_ticker.html("Gathered " + String(completed * limit) + " of " + first_res.total + " submissions")
            }

            for (let i=1; i<iterations; i++){ 
                promises.push(new Promise(async (acc, rej) => {
                    let req = await $POST('dashboard/getSubmissions', { page:i, pagination_limit:limit, search:'', startDate, endDate }),
                        res = await req.json();

                    if(req.status != 200){ console.log({ req, res }) }

                    onfetched();

                    acc(res);
                }))
            }

            let bigData = await Promise.all(promises),
                submissionList = []

            status_ticker.html("Processing data...")
            bigData.forEach(p => { p.submissions.forEach(sub => submissionList.push(sub)) })

            // Create the CSV header
            let csv_text = ""
            include.forEach(inc => {
                if(!inc.include){ return; }
                if(inc.value == "studentname"){
                    csv_text += 'Name,First Name,Last Name,'
                }
                else if(inc.value == "gradevalues"){
                    csv_text += 'Graded Correct,Graded Incorrect,Total Questions,Total Graded,'
                }
                else{
                    csv_text += inc.title + ','
                }
            })
            csv_text += "\n"

            // Create the CSV body
            submissionList.forEach(submission => {
                include.forEach(inc => {
                    if(!inc.include){ return; }
                    
                    /*if(['created'].includes(inc.value)){ a = submission[inc.value] */
                    if(inc.value == "created"){
                        csv_text += moment(submission.created).format('MMM Do YYYY [at] HH:MMa') + ","
                    }
                    else if(inc.value == "studentname"){
                        csv_text += submission.student.name + "," + submission.student.first_name + "," + submission.student.last_name + ","
                    }
                    else if(inc.value == "studentemail"){
                        csv_text += submission.student.email + ","
                    }
                    else if(inc.value == "sheetname"){
                        csv_text += submission.sheet.sheetname + ","
                    }
                    else if(inc.value == "sheetlink"){
                        csv_text += _DOMAIN + "/sheet/" + submission.sheetid + ","
                    }
                    else if(inc.value == "submissionlink"){
                        csv_text += _DOMAIN + "/sheet/" + submission.sheetid + "?vs=" + submission._id + "&i=" + submission.student._id + ","
                    }
                    else if(inc.value == "gradepercent"){
                        csv_text += submission.grade.percentage + "%,"
                    }
                    else if(inc.value == "gradeletter"){
                        csv_text += (Paper.getGradeLetter(submission.grade.percentage)) + ","
                    }
                    else if(inc.value == "gradelink"){
                        csv_text += _DOMAIN + "/grade?i=" + submission.sheetid + "&s=" + submission._id + ","
                    }
                    else if(inc.value == "gradestatus"){
                        csv_text += (submission.grade.finished?"Grading finished":"Incomplete") + ","
                    }
                    else if(inc.value == "gradevalues"){
                        csv_text += submission.grade.correct + " correct," + (submission.grade.graded - submission.grade.correct) + " wrong," + submission.grade.total + " total," + submission.grade.graded + " graded,"
                    }
                    else if(inc.value == "time"){
                        csv_text += moment.duration(submission.time, 'seconds').humanize() + ","
                    }
                })
                csv_text += "" + "\n"
            })
            await new Promise(acc => setTimeout(acc, 1250));

            status_ticker.html("Export complete!")

            // Make it downloadable
            function download(filename, text) {
                var element = document.createElement('a');
                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                element.setAttribute('download', filename);
              
                element.style.display = 'none';
                document.body.appendChild(element);
              
                element.click();
              
                document.body.removeChild(element);
            }

            download("SheetParrot Submissions Export ("+moment().format('MMM Do YYYY')+").csv", csv_text)
            //let downloadElement = $("<a download=\"SheetParrot%20Export.csv\" style=\"display:none;\"></a>")
            //downloadElement.attr('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(csv_text));
            
            //$('body').append(downloadElement)
            //downloadElement.click()

            //onClose = () => { downloadElement.remove() }

            // Show the download button
            downloadBtn.removeClass('is-hidden')
            downloadBtn.click(() => download("SheetParrot Export.csv", csv_text))
            modal.find('.modal-card-foot').append(downloadBtn)

            // Finish, unlock everything
            export_btn.removeClass('is-loading')
            modal.find('.candisable').removeClass('is-disabled')
            is_exporting = false;
        })

        $('body').append(modal)
    })
    elements.toolbar.find('.twobox .buttons').append( export_btn )

    let search_field = $("<div class=\"field has-addons has-addons-right\">"
        + "<p class=\"control\"><input class=\"input\" type=\"text\" placeholder=\"Search Submissions\"></p>"
        + "<p class=\"control\"><a class=\"button is-primary\"><i class=\"fas fa-search\"></i></a></p>"
        + "</div>")

    let search_timer = null;
    function searchNow(){
        let input = search_field.find('input')
        search = input.val();
        // Start the search 1 second after they stop typing
        if(search_timer){ clearTimeout(search_timer) } else{ showLoading(); page = 0; }
        search_timer = setTimeout(() => { refresh(); search_timer = null; input.focus(); }, 1000)
    }
    search_field.on('keydown', 'input', () => searchNow());
    search_field.on('click', '.button', () => searchNow());

    //elements.toolbar.find('.twobox').append(search_field)
    // Search is not possible, because we would be searching through ID's when they would be searching for a name, email, or sheetname

    let total_ticker_holder = $("<div class=\"has-text-right\"></div>")
    total_ticker_holder.append(elements.total_ticker)
    elements.toolbar.find('.twobox').append(total_ticker_holder)

    elements.root.append(
        elements.toolbar,
        elements.content
    )
    
    let pagination_container = $("<div class=\"container block is-bottom\"><nav class=\"pagination is-centered\" role=\"navigation\" aria-label=\"pagination\"></nav></div>")
    pagination_container.find('.pagination').append(elements.paginator)
    elements.root.append(pagination_container)

    refresh()
}();