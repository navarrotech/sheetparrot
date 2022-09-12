function loadup(){

    function randomID(){
        return Math.floor(Math.random() * 10000000000000000000000000)
    }

    function method_byStudent(is_singleStudentView){
        var CURR_DATASET = {}, // includes the most recently loaded "paginated" chunk of students
            current_pagination = 0, // current_pagination is the current "student" that we're on.
            paper = $QS('#paper'), // The paper object that results are printed onto :)
            total_sheets = 0,
            is_loading = false,
            menu_modal = $QS("#byStudent_menu");

            function removeItemFromUrlQuery(text, A=window.location.href){
                text = String(text)
                let B, C
                if(A.includes(text + '=')){
                    C = A.substring(A.indexOf(text + '=') - 1, A.indexOf(text + '='))
                    B = A.substring(A.indexOf(text + '=') - 1)
                    if(B.substring(1).includes('&'))
                        B = B.substring(0, B.substring(1).indexOf('&') + 1)
                    
                    if(C == '?'){
                        A = A.replace(B, C)
                        A = A.replace('?&', '?')
                    } else
                        A = A.replace(B,'')
                }
                return A;
            }
        
        function deleteSubmission(){
            if(confirm("Are you SURE you want to delete this submission? Deleting this will allow your student to re-submit again in the future. This CAN NOT be undone.")){               
                showLoading()
                
                $POST('/submission/delete', { _id:CURR_DATASET._id }, (result, text) => {
                    let new_href = removeItemFromUrlQuery('p') // Remove the specific student and pagination from the query, before refresh
                        new_href = removeItemFromUrlQuery('student', new_href)

                    let new_page = current_pagination - 1
                    if(new_page < 0){ new_page = 0 }
                    setCookie('grader_curpage_ ' + SHEETID, new_page, 0)

                    window.location.href = new_href
                })

            }
        }

        function resetSubmission(){
            showLoading()
            $POST('/submissions/grader/api/clearAllGrades', { SHEETID, user_email:CURR_DATASET.user_email }, (result, text) => {
                let new_href = removeItemFromUrlQuery('p') // Remove the specific student and pagination from the query, before refresh
                    new_href = removeItemFromUrlQuery('student', new_href)

                let mod = new_href.includes('?') ? '&' : '?'

                new_href = new_href + mod + 'p=' + current_pagination

                window.location.href = new_href
            })
        }

        function makePaperLoading(){
            // Paper loading
            let c = `<div class="tile is-ancestor"><div class="tile is-parent">
                     <div class="tile is-child box"><div class="loading-1"></div><div class="loading-2"></div></div>
                     <div class="tile is-child box"><div class="loading-1"></div><div class="loading-2"></div></div>
                     <div class="tile is-child box"><div class="loading-1"></div><div class="loading-2"></div></div>
                     </div></div>`
            paper.innerHTML = (c + c + c)

            // Header loading
            try{
                $QS('.header_toolbar .nameBadge .image img').src = "https://www.sheetparrot.com/images/loading.gif"
                $QS('.header_toolbar .nameBadge .title.name').innerHTML = ""
                $QS('.header_toolbar .nameBadge .subtitle.email').innerHTML = ""

                $QS('#byStudent_menu .image img').src = "https://www.sheetparrot.com/images/loading.gif"
                $QS('#byStudent_menu .title.name').innerHTML = ""
                $QS('#byStudent_menu .subtitle.email').innerHTML = ""

                $QS('.header_toolbar .grade').innerHTML = "--"

                // Progressbar Loading
                $QS('#byStudent_menu .multi-progress .chunk.is-blank'   ).style.width = "100%"
                $QS('#byStudent_menu .multi-progress .chunk.is-danger'  ).style.width = "0%"
                $QS('#byStudent_menu .multi-progress .chunk.is-success' ).style.width = "0%"

                $QS('.floating_toolbar .multi-progress .chunk.is-blank'  ).style.width = "100%"
                $QS('.floating_toolbar .multi-progress .chunk.is-danger' ).style.width = "0%"
                $QS('.floating_toolbar .multi-progress .chunk.is-success').style.width = "0%"
            }
            catch(e){ $ERR(e) }
        }

        function loadPaper(obj){

            function loadCol(col){
                let grade = ''
                if(col.graded)
                    grade = `grade-status="graded" grade-mark="${col.grade_mark}"`
                if(col.grade_note)
                    grade += ` grade-note="${col.grade_note || ''}"`
                let r=`<div class="block">`;
                switch(col.type){
                    case "card":
                        r+= `<textarea class="textarea markable" placeholder="${col.hint}" data-id="${col["card-id"]}" readonly data-type="question" ${grade}>${col.answer || ''}</textarea>`
                        if(col.correct_answer){ // Correct answer
                            r+= `<div class="answers"><p class="help">Correct Answer:</p><p class="help is-success">${col.correct_answer}</p></div>`
                        }
                        break;
                    case "multichoice":
                        let group_id = randomID(), s = ''
                        r+= `<div class="field radio-card markable" data-id="${col["card-id"]}" data-type="multichoice" ${grade}>`

                        let option_1 = randomID()
                        s = (col.selected == 'option_1') ? 'checked' : 'disabled'
                        r+= `<div class="control"> 
                                <input class="is-checkradio" id="radio_${option_1}" type="radio" name="radio_group_${group_id}" data-type="option_1" ${s}>
                                <label for="radio_${option_1}">${col.option_1}</label>
                                </div>`

                        let option_2 = randomID()
                        s = (col.selected == 'option_2') ? 'checked' : 'disabled'
                        r+= `<div class="control"> 
                            <input class="is-checkradio" id="radio_${option_2}" type="radio" name="radio_group_${group_id}" data-type="option_2" ${s}>
                            <label for="radio_${option_2}">${col.option_2}</label>
                            </div>`

                        let option_3 = randomID()
                        s = (col.selected == 'option_3') ? 'checked' : 'disabled'
                        r+= `<div class="control"> 
                            <input class="is-checkradio" id="radio_${option_3}" type="radio" name="radio_group_${group_id}" data-type="option_3" ${s}>
                            <label for="radio_${option_3}">${col.option_3}</label>
                            </div>`

                        let option_4 = randomID()
                        s = (col.selected == 'option_4') ? 'checked' : 'disabled'
                        r+= `<div class="control"> 
                            <input class="is-checkradio" id="radio_${option_4}" type="radio" name="radio_group_${group_id}" data-type="option_4" ${s}>
                            <label for="radio_${option_4}">${col.option_4}</label>
                            </div>`

                        r+= `</div>`

                        if(col.correct_answer){ // Correct answer
                            col.correct_answer = String(col.correct_answer)
                            let correct = (col.correct_answer == "1") ? col.option_1 : (col.correct_answer == "2") ? col.option_2 : (col.correct_answer == "3") ? col.option_3 : (col.correct_answer == "4") ? col.option_4 : ""
                            r+= `<div class="answers"><p class="help">Correct Answer:</p><p class="help is-success">${correct}</p></div>`
                        }

                        break;
                    case "multiline":
                        JSONforEach(col.multiline_data, (key, multiline) => {
                            let graded_vals = '', note_vals = '';
                            if(multiline.graded)
                                graded_vals = `grade-status="graded" grade-mark="${multiline.grade_mark}" grade-note="${multiline.grade_note || ''}"`;
                            //if(multiline.grade_note){ note_vals = 'has-notes' }
                            
                            let correct = (multiline.correct_answer) ? `<div class="answers"><p class="help">Correct Answer:</p><p class="help is-success">${multiline.correct_answer}</p></div>` : ''

                            r+= `<div class="field multiline-item ${note_vals}">
                                 <label class="label">${multiline.question}</label>
                                 <div class="control">
                                 <input class="input markable" type="text" placeholder="${multiline.question}" readonly value="${multiline.answer || ''}" data-id="${col["card-id"]}"  data-type="multiline" ${grade} data-option="${key}" ${graded_vals}>
                                 ${correct}
                                 </div>
                                 </div>`
                        })
                        break;
                    case "dropdown":
                        r+=`<div class="field"> 
                            <label class="label">"${col.label}"</label> 
                            <div class="control"> 
                            <div class="select markable" data-id="${col["card-id"]}" data-type="dropdown" ${grade}> 
                            <select><option value="${col.answer.value}" selected>${col.answer.text}</option></select> 
                            </div>
                            <div class="answers">
                                <p class="help">Correct Answer:</p>
                                <p class="help is-success">${col.correct_answer}</p>
                            </div>
                            </div>
                            </div>`
                        break;
                    case "button":
                        r+= `<div class="buttons is-centered"><a class="button is-link is-rounded" href="https://google.com/" target="_blank"><div class="icon is-small"><i class="fas fa-external-link-square-alt"></i></div><span>${col.button_text}</span></a></div>`
                        break;
                    case "video":
                        r+= `<div class="image is-16by9"><iframe class="has-ratio" allowfullscreen="" src="${col.video_link}"></iframe></div>`
                        break;
                }
                return r + '</div>';
            }

            // Clear the "pre-loaded paper preview"
            paper.innerHTML = ''
            
            // Insert new paper data from database call
            JSONforEach(obj, (row, row_data) => {
                let ancestor = document.createElement('div')
                ancestor.className = "tile is-ancestor"
                JSONforEach(row_data, (col, col_data) => {
                    let parent = document.createElement('div')
                    parent.className = "tile is-parent"
                    let child = document.createElement('div')
                    child.className = 'tile is-child box ' + col_data['type']
                    if(col_data.graded && col_data.type !== 'multiline')
                        child.setAttribute('grade-mark', col_data.grade_mark)
                    child.id = col_data["card-id"]
                    let card_img = (col_data.card_img) ? `<div class="card_image image is-16by9"><img src="${col_data.card_img}"/></div>` : ''
                    child.innerHTML = `<div class="block titles"><h1 class="title is-size-4">${col_data.subtitle}</h1><h2 class="subtitle is-size-6">${col_data.title}</h2></div>${card_img}${loadCol(col_data)}`
                    parent.appendChild(child)
                    ancestor.appendChild(parent)
                })
                paper.appendChild(ancestor)
            })

            // The markable actions for each
            let markables = $QSA('.markable')
            markables.forEach(question => {
                let actions_holder = document.createElement('div')
                actions_holder.className = "markable_actions_holder"
                let actions = document.createElement('div')
                actions.className = 'markable_actions buttons are-small is-centered mt-2'

                let createButton = function(type, icon, tooltip_text){
                    let newEl = document.createElement('a')
                    newEl.className = 'button is-light ' + type
                    newEl.innerHTML = "<span class=\"icon\"><i class=\""+icon+"\"></i></span>"
                    let parentEl = document.createElement('div')
                    parentEl.setAttribute('data-tooltip', tooltip_text)
                    parentEl.appendChild(newEl)
                    return parentEl
                }

                let mark_correct = createButton('is-success mark_correct', 'fas fa-check', 'Mark answer as correct')
                actions.appendChild(mark_correct)
                let mark_clear = createButton('is-black mark_clear', 'fas fa-sync', 'Clear answer marks')
                actions.appendChild(mark_clear)
                let mark_wrong = createButton('is-danger mark_wrong', 'fas fa-times', 'Mark answer as incorrect')
                actions.appendChild(mark_wrong)
                let mark_note;
                if(question.getAttribute('grade-note'))
                    mark_note = createButton('is-warning add_note', 'fas fa-sticky-note', 'Edit/View Note')
                else
                    mark_note = createButton('is-warning add_note', 'fas fa-sticky-note', 'Add a note')
                actions.appendChild(mark_note)

                if(question.getAttribute('grade-note'))
                    $CLASS(question.parentElement, 'has-notes', true)

                let markDisabled = function(ty){
                    if(ty){
                        mark_correct.setAttribute('disabled',true);
                        mark_clear  .setAttribute('disabled',true);
                        mark_wrong  .setAttribute('disabled',true);
                        mark_note   .setAttribute('disabled',true);
                        mark_correct.querySelector('a').setAttribute('disabled',true);
                        mark_clear  .querySelector('a').setAttribute('disabled',true);
                        mark_wrong  .querySelector('a').setAttribute('disabled',true);
                        mark_note   .querySelector('a').setAttribute('disabled',true);
                    }
                    else {
                        mark_correct.removeAttribute('disabled');
                        mark_clear  .removeAttribute('disabled');
                        mark_wrong  .removeAttribute('disabled');
                        mark_note   .removeAttribute('disabled');
                        mark_correct.querySelector('a').removeAttribute('disabled');
                        mark_clear  .querySelector('a').removeAttribute('disabled');
                        mark_wrong  .querySelector('a').removeAttribute('disabled');
                        mark_note   .querySelector('a').removeAttribute('disabled');
                    }
                }

                mark_correct.addEventListener('click', () => {
                    if(!mark_correct.getAttribute('disabled')){
                        // Classes
                        $CLASS(mark_correct.querySelector('.button'), 'is-loading', true )
                        $CLASS(mark_correct.querySelector('.button'), 'is-light',   false)
                        $CLASS(actions, 'processing', true)
                        markDisabled(true)

                        // Update HTML metadata
                        question.setAttribute('grade-status', 'graded')
                        question.setAttribute('grade-mark', 'correct')
                        let p = getMarkablesParentChildCard(question)

                        if(p && question.getAttribute('data-type') !== 'multiline'){
                            p.setAttribute('grade-status', 'graded')
                            p.setAttribute('grade-mark', 'correct')
                        }

                        markCorrect(question, () => {
                            // Resets
                            $CLASS(mark_correct.querySelector('.button'), 'is-loading', false)
                            $CLASS(mark_correct.querySelector('.button'), 'is-light',   true )
                            $CLASS(actions, 'processing', false)
                            markDisabled(false)

                            // Update data
                            if(question.getAttribute('data-type') == 'multiline')
                                updateCurrDataMultiline(question.getAttribute('data-id'), question.getAttribute('data-option'), 'correct')
                            else
                                updateCurrData(question.getAttribute('data-id'), 'correct')
                            updateProgressbar()
                        })
                    }
                })
                mark_clear.addEventListener('click', () => {
                    if(!mark_clear.getAttribute('disabled')){
                        // Classes
                        $CLASS(mark_clear.querySelector('.button'), 'is-loading', true )
                        $CLASS(mark_clear.querySelector('.button'), 'is-light',   false)
                        $CLASS(actions, 'processing', true)
                        markDisabled(true)

                        // Update HTML metadata
                        question.removeAttribute('grade-status')
                        question.removeAttribute('grade-mark')
                        let p = getMarkablesParentChildCard(question)
                        if(p && question.getAttribute('data-type') !== 'multiline'){
                            p.removeAttribute('grade-status')
                            p.removeAttribute('grade-mark')
                        }

                        markClear(question, () => {

                            // Resets
                            $CLASS(mark_clear.querySelector('.button'), 'is-loading', false)
                            $CLASS(mark_clear.querySelector('.button'), 'is-light',   true )
                            $CLASS(actions, 'processing', false)
                            markDisabled(false)

                            // Update data
                            if(question.getAttribute('data-type') == 'multiline')
                                updateCurrDataMultiline(question.getAttribute('data-id'), question.getAttribute('data-option'), null)
                            else
                                updateCurrData(question.getAttribute('data-id'), null)
                            updateProgressbar()
                        })
                    }
                })
                mark_wrong.addEventListener('click', () => {
                    if(!mark_wrong.getAttribute('disabled')){
                        // Classes
                        $CLASS(mark_wrong.querySelector('.button'), 'is-loading', true )
                        $CLASS(mark_wrong.querySelector('.button'), 'is-light',   false)
                        $CLASS(actions, 'processing', true)
                        markDisabled(true)

                        // Update HTML metadata
                        question.setAttribute('grade-status', 'graded')
                        question.setAttribute('grade-mark', 'wrong')
                        let p = getMarkablesParentChildCard(question)
                        if(p && question.getAttribute('data-type') !== 'multiline'){
                            p.setAttribute('grade-status', 'graded')
                            p.setAttribute('grade-mark', 'wrong')
                        }

                        markWrong(question, () => {

                            // Resets
                            $CLASS(mark_wrong.querySelector('.button'), 'is-loading', false)
                            $CLASS(mark_wrong.querySelector('.button'), 'is-light',   true )
                            $CLASS(actions, 'processing', false)
                            markDisabled(false)

                            // Update data
                            if(question.getAttribute('data-type') == 'multiline')
                                updateCurrDataMultiline(question.getAttribute('data-id'), question.getAttribute('data-option'), 'wrong')
                            else
                                updateCurrData(question.getAttribute('data-id'), 'wrong')
                            updateProgressbar()
                        })
                    }
                })
                mark_note.addEventListener('click', () => {
                    // Classes
                    $CLASS(mark_note, 'is-loading', true )
                    $CLASS(mark_note, 'is-light',   false)
                    $CLASS(actions, 'processing', true)

                    // Update HTML metadata

                    promptForNote(question, () => { 
                        // Resets
                        $CLASS(mark_note, 'is-loading', false)
                        $CLASS(mark_note, 'is-light',   true )
                        $CLASS(actions, 'processing', false)
                    })
                })

                actions_holder.appendChild(actions)
                question.parentNode.insertBefore(actions_holder, question.nextElementSibling)

                let hover_function = function(apply){
                    /*let has_notes = question.parentNode.parentNode.querySelector('.control.has-notes')
                    if(has_notes){
                        $CLASS(has_notes, '', apply)
                    }*/
                    $CLASS(question.parentNode.parentNode, 'tools-available', apply)
                }

                // The "hover" effect for applying
                question.parentNode.parentNode.addEventListener('mouseenter', () => { hover_function(true)  })
                question.parentNode.parentNode.addEventListener('mouseleave', () => { hover_function(false) })
            })

        }
        function updateCurrDataMultiline(col_id, option, grade_status){
            JSONforEach(CURR_DATASET.paper, (row_key, row_val) => {
                JSONforEach(row_val, (card_key, card_val) => {
                    if(col_id == card_key){
                        JSONforEach(card_val.multiline_data, (option_key, option_val) => {
                            if(option_key == option){
                                if(!grade_status){
                                    delete CURR_DATASET['paper'][row_key][card_key]["multiline_data"][option_key].graded
                                    delete CURR_DATASET['paper'][row_key][card_key]["multiline_data"][option_key].grade_mark
                                }
                                else{
                                    CURR_DATASET['paper'][row_key][card_key]["multiline_data"][option_key].graded = true
                                    CURR_DATASET['paper'][row_key][card_key]["multiline_data"][option_key].grade_mark = grade_status
                                }
                            }
                        })
                    }
                        
                })
            })
        }

        function updateCurrData(col_id, grade_status){
            JSONforEach(CURR_DATASET.paper, (row_key, row_val) => {
                JSONforEach(row_val, (card_key, card_val) => {
                    if(col_id == card_key){
                        if(!grade_status){
                            delete CURR_DATASET['paper'][row_key][card_key].graded
                            delete CURR_DATASET['paper'][row_key][card_key].grade_mark
                        }
                        else{
                            CURR_DATASET['paper'][row_key][card_key].graded = true
                            CURR_DATASET['paper'][row_key][card_key].grade_mark = grade_status
                        }
                    }
                        
                })
            })
        }

        function getMarkablesParentChildCard(markable){
            let limit = 8, i, target = markable, r = null;
            for(i=0;i<limit;i++){
                target = target.parentElement;
                if(target.classList.contains('tile') && target.classList.contains('is-child')){
                    r = target;
                    break;
                }
            }
            return r;
        }

        function markCorrect(markable_object, fn){
            let post_data = {
                SHEETID:SHEETID,
                user_email:CURR_DATASET.user_email,
                card_id:markable_object.getAttribute('data-id'),
                grade_mark:'correct' 
            }
            if(markable_object.getAttribute('data-type') == 'multiline')
                post_data['sub_id'] = markable_object.getAttribute('data-option')

            $POST('/submissions/grader/api/addGrade', post_data, (result) => {
                if(result.status !== 200){ console.log(result) } else { console.log(result); }
                if(fn){ fn() }
            })
        }
        function markClear(markable_object, fn){
            let post_data = {
                SHEETID:SHEETID,
                user_email:CURR_DATASET.user_email,
                card_id:markable_object.getAttribute('data-id')
            }
            if(markable_object.getAttribute('data-type') == 'multiline')
                post_data['sub_id'] = markable_object.getAttribute('data-option')

            $POST('/submissions/grader/api/clearGrade', post_data, (result) => {
                if(result.status !== 200){ console.log(result) } else { console.log(result); }
                if(fn){ fn() }
            })
        }
        function markWrong(markable_object, fn){
            let post_data = {
                SHEETID:SHEETID,
                user_email:CURR_DATASET.user_email,
                card_id:markable_object.getAttribute('data-id'),
                grade_mark:'wrong' 
            }
            if(markable_object.getAttribute('data-type') == 'multiline')
                post_data['sub_id'] = markable_object.getAttribute('data-option')

            $POST('/submissions/grader/api/addGrade', post_data, (result) => {
                if(result.status !== 200){ console.log(result) } else { console.log(result); }
                if(fn){ fn() }
            })
        }
        function promptForNote(markable_object, fn){
            let note_modal = $QS('#addNoteModal')
            let note_textarea = $QS('#note_feedback')
            let save_button = note_modal.querySelector('.button.is-success')

            let predefined_value = markable_object.getAttribute("grade-note")
            if(predefined_value){
                predefined_value = predefined_value.replaceAll("&quot;", "\"") || ""
                note_textarea.value = predefined_value
            }
            else
                note_textarea.value = ''
            $CLASS(note_modal, 'is-active', true)

            let save_handler = function(){
                $CLASS(save_button, 'is-loading', true)
                markNote(markable_object, note_textarea.value, () => {
                    $CLASS(note_modal, 'is-active', false)
                    $CLASS(save_button, 'is-loading', false)
                    fn()
                })
                save_button.removeEventListener('click', save_handler)
            }
            
            save_button.addEventListener('click', save_handler)
        }
        function markNote(markable_object, note, fn){
            markable_object.setAttribute('grade-note', note.replaceAll('\"', "&quot;"))
            let tooltip_el = markable_object.parentElement.querySelector('.add_note')
            if(tooltip_el){
                tooltip_el.parentElement.setAttribute('data-tooltip', 'Edit/View Note')
            }
            $CLASS(markable_object.parentElement, 'has-notes', true)
            let post_data = {
                SHEETID:SHEETID,
                user_email:CURR_DATASET.user_email,
                card_id:markable_object.getAttribute('data-id'),
                grade_note:note
            }
            if(markable_object.getAttribute('data-type') == 'multiline')
                post_data['sub_id'] = markable_object.getAttribute('data-option')

            $POST('/submissions/grader/api/addNote', post_data, (result) => {
                if(result.status !== 200){ console.log(result) } else { console.log(result); }
                if(fn){ fn() }
            })
        }

        function getGradeProgress(paperObj){
            let r = {
                total:0,
                graded:0,
                correct:0,
            }
            JSONforEach(paperObj, (row_keys, row_vals) => {
                JSONforEach(row_vals, (card_keys, card_vals) => {
                    if(card_vals.type !== 'video' && card_vals.type !== 'button' && card_vals.type !== 'multiline'){
                        r.total += 1;
                        if(card_vals.graded)
                            r.graded += 1;
                        if(card_vals.grade_mark == 'correct')
                            r.correct += 1;
                    }
                    else if (card_vals.type == 'multiline'){
                        JSONforEach(card_vals.multiline_data, (option_key, option_vals) => {
                            r.total += 1;
                            if(option_vals.graded)
                                r.graded += 1;
                            if(option_vals.grade_mark == 'correct')
                                r.correct += 1;
                        })
                    }
                })
            })
            return r;
        }

        function loadToolbar(obj){
            let toolbar = $QS('.floating_toolbar')
            if(!is_singleStudentView){
                // Reveal the next & previous buttons if they're not just viewing this single student's submission
                $CLASS( toolbar.querySelector('a.button.previous'), 'is-invisible', false )
                $CLASS( toolbar.querySelector(  'a.button.next'  ), 'is-invisible', false )
            }

            updateProgressbar()
            updateCurrentGrade()

            // Name, email, picture on header toolbar
            $QS('.header_toolbar .nameBadge .image img').src = obj.user_image
            $QS('.header_toolbar .nameBadge .title.name').innerHTML = obj.user_name
            $QS('.header_toolbar .nameBadge .subtitle.email').innerHTML = obj.user_email

            // Name, email, picture on popup
            $QS('#byStudent_menu .nameBadge .image img').src = obj.user_image
            $QS('#byStudent_menu .nameBadge .title.name').innerHTML = obj.user_name
            $QS('#byStudent_menu .nameBadge .subtitle.email').innerHTML = obj.user_email

            let previous_btn = $QS('.floating_toolbar .button.previous')
            let next_btn = $QS('.floating_toolbar .button.next')

            // Bottom limit
            if(current_pagination <= 0){
                previous_btn.setAttribute('disabled', 'true')
                $CLASS(previous_btn, 'is-invisible', true)
            }
            else if(master_query_pagination !== 0){
                previous_btn.removeAttribute('disabled')
                $CLASS(previous_btn, 'is-invisible', false)
            }
            // Top limit
            if(current_pagination >= (total_sheets - 1)){
                next_btn.setAttribute('disabled', 'true')
                $CLASS(next_btn, 'is-invisible', true)
            }
            else if(master_query_pagination !== 0){
                next_btn.removeAttribute('disabled')
                $CLASS(next_btn, 'is-invisible', false)
            }

            previous_btn.addEventListener('click', () => {
                if(!is_loading){
                    if(current_pagination <= 0){
                        previous_btn.setAttribute('disabled', 'true')
                        $CLASS(previous_btn, 'is-invisible', true)
                    } 
                    else if(master_query_pagination !== 0){
                        previous_btn.removeAttribute('disabled')
                        $CLASS(previous_btn, 'is-invisible', false)
                    }
                    makePaperLoading()
                    fetchSubmissionsFromServer(current_pagination - 1, '')
                }
            })
            next_btn.addEventListener('click', () => {
                if(!is_loading){
                    if(current_pagination >= (total_sheets - 1)){
                        next_btn.setAttribute('disabled', 'true')
                        $CLASS(next_btn, 'is-invisible', true)
                    }
                    else if(master_query_pagination !== 0){
                        next_btn.removeAttribute('disabled')
                        $CLASS(next_btn, 'is-invisible', false)
                    }
                    makePaperLoading()
                    fetchSubmissionsFromServer(current_pagination + 1, '')
                }
            })
        }

        function updateProgressbar(){
            // Progressbar
            let progress = getGradeProgress(CURR_DATASET.paper),
                toolbar = $QS('.floating_toolbar'),
                multiProgressbar = toolbar.querySelector('.multi-progress'),
                goodChunk = multiProgressbar.querySelector('.chunk.is-success'),
                badChunk = multiProgressbar.querySelector('.chunk.is-danger')

            console.log(progress)

            // Text at the top
            if(progress.graded == progress.total)
                toolbar.querySelector('.grading_progress p').innerHTML = "This sheet is 100% graded."
            else
                toolbar.querySelector('.grading_progress p').innerHTML = "You have graded " + progress.graded + " of " + progress.total + " questions."
            
            // Set the progressbar's value
            let header_blankchunk = $QS('.floating_toolbar .multi-progress .chunk.is-blank'  )
            $CLASS(header_blankchunk, 'is-hidden', true)
            header_blankchunk.style.width = "0%"
            setTimeout(() => $CLASS(header_blankchunk, 'is-hidden', false), 350)

            goodChunk.style.width = String(Math.round((progress.correct / progress.total) * 100) + '%')
            badChunk.style.width  = String(Math.round(((progress.graded - progress.correct) / progress.total) * 100) + '%')

            // Progressbar in popup
            let menu_blankchunk = $QS('#byStudent_menu .multi-progress .chunk.is-blank'  )
            $CLASS(menu_blankchunk, 'is-hidden', true)
            menu_blankchunk.style.width = "0%"
            setTimeout(() => $CLASS(menu_blankchunk, 'is-hidden', false), 350)

            $QS('#byStudent_menu .multi-progress .chunk.is-success' ).style.width = String(Math.round((progress.correct / progress.total) * 100) + '%')
            $QS('#byStudent_menu .multi-progress .chunk.is-danger').style.width = String(Math.round(((progress.graded - progress.correct) / progress.total) * 100) + '%')

            //toolbar.querySelector('.grading_progress progress').setAttribute('value', String(Math.floor((progress.graded / progress.total) * 100)))

            // If there's nothing to grade, don't show a progressbar.
            if(progress.total === 0)
                $CLASS(multiProgressbar, 'is-hidden', true)
            else
                $CLASS(multiProgressbar, 'is-hidden', false)

            // Only reveal the toolbar if it's not a singleview OR if the total is 0.
            if(progress.total !== 0 || !is_singleStudentView)
                $CLASS(toolbar, 'is-hidden', false)

            updateCurrentGrade()
            updateDetailsModal()
        }

        function updateDetailsModal(){
            let details_started   = $QS('#details_started'),
                details_submitted = $QS('#details_submitted'),
                details_total     = $QS('#details_total'),
                details_correct   = $QS('#details_correct'),
                details_incorrect = $QS('#details_incorrect'),
                details_questions = $QS('#details_questions'),
                progress = getGradeProgress(CURR_DATASET.paper)

            let details_graded_inline = $QS('#details_graded_inline'),
                details_total_inline = $QS('#details_total_inline')

            let started   = new Date(CURR_DATASET.started_time),
                a_pretty  = started.toDateString() + "at " + started.toLocaleTimeString().slice(0,-6),
                submitted = new Date(CURR_DATASET.submitted_time),
                b_pretty  = submitted.toDateString() + "at " + submitted.toLocaleTimeString().slice(0,-6),
                timetaken = "<b>" + prettyPrintTimeBetweenTwoDates(started, submitted) + "</b>"

            if(details_started)  { details_started  .innerHTML = a_pretty  }
            if(details_submitted){ details_submitted.innerHTML = b_pretty  }
            if(details_total)    { details_total    .innerHTML = timetaken }

            if(details_graded_inline){ details_graded_inline.innerHTML = progress.graded }
            if(details_total_inline) { details_total_inline .innerHTML = progress.total  }

            if(details_correct)  { details_correct  .innerHTML = progress.correct }
            if(details_incorrect){ details_incorrect.innerHTML = progress.total - progress.correct  }
            if(details_questions){ details_questions.innerHTML = progress.total  }
        }

        function updateCurrentGrade(){
            let grade = $QS('.grade'),
                grade_helper = $QS('.grade_helper'),
                details_final = $QS('#details_final'),
                progress = getGradeProgress(CURR_DATASET.paper)

            if(progress.graded === 0){
                grade_helper.innerHTML = "Current Grade:"
                grade.innerHTML = "--"
                $CLASS(grade, 'is-final', false)
                if(details_final){ details_final.innerHTML = "--" }
            } else{
                grade_helper.innerHTML = "Current Grade:"
                grade.innerHTML = Math.round((progress.correct / progress.graded) * 100) + "%"
                $CLASS(grade, 'is-final', false)
                if(details_final){ details_final.innerHTML = "<b>" + Math.round((progress.correct / progress.graded) * 100) + "%</b>"}
            }
            if(progress.graded === progress.total){
                grade_helper.innerHTML = "Final Grade:"
                $CLASS(grade, 'is-final', true)
            }
        }

        function fetchSubmissionsFromServer(pagination=0, specific_student=''){

            let saved_current_page = getCookie('grader_curpage_ ' + SHEETID, current_pagination, 0);
            if(saved_current_page){
                console.log("Pagination Reset By Scenario 1")
                saved_current_page = parseInt(saved_current_page)
            }
            if(specific_student !== ''){
                console.log("Specific Student Set By Scenario 2")
                specific_student = '&student=' + specific_student
            }
            /*else if(!isNaN(saved_current_page) && saved_current_page && pagination === 0 && saved_current_page !== 0 && saved_current_page !== pagination){
                console.log("Pagination Reset By Scenario 3")
                pagination = saved_current_page
            }*/
            is_loading = true;
            makePaperLoading()
            $GET(`/submissions/grader/get/${SHEETID}?pagination=${pagination}${specific_student}`, (result, text) => {
                if(!text){
                    displayMessage("Something went wrong trying to load this submission. Please try again later.", "danger", true)
                    try{ throw new Error('GRADING_SYSTEM_404') } catch(e){ $ERR(e); } // This will report the error to the server
                }
                else {

                    text = JSON.parse(text)

                    current_pagination = pagination;
                    CURR_DATASET = text.sheets;
                    setCookie('grader_curpage_ ' + SHEETID, pagination, 0)
                    total_sheets = text.total;

                    if((total_sheets == '0' || total_sheets == 0)){ // WAS HERE:  || ((current_pagination) > total_sheets)
                        window.location.href = "https://www.sheetparrot.com/sheets/view/" + SHEETID
                    }

                    is_loading = false;
                    
                    try{ loadPaper(text.sheets.paper) } catch(e){ $ERR(e); }
                    try{ loadToolbar(text.sheets) } catch(e){ $ERR(e); }
                    // Initialize popup menu
                    try{
                        let menu = $QS('#byStudent_menu')

                        if(menu){
                            let current = $QS('span.stat_current_page'),
                                total = $QS('span.stat_total_pages')
                            
                            current.innerHTML = pagination
                            total.innerHTML = total_sheets

                            // Initialize delete submission button
                            menu.querySelector('a.button[action-label="delete"]').addEventListener('click', () => deleteSubmission() )
                            
                            // Initialize reset submission button
                            menu.querySelector('a.button[action-label="reset"]').addEventListener('click', () => resetSubmission() )
                        }
                    } catch(e){ $ERR(e); }
                }

            })
        }
        function initByStudentModal(){
            if(!menu_modal)
                menu_modal = $QS("#byStudent_menu")

            let menu_trigger = $QS("#menu_button")
            menu_trigger.addEventListener('click', () => $CLASS(menu_modal, 'is-active', true) )
            
            $CLASS(menu_modal.querySelector('.byQuestion'), 'is-active', false)
            $CLASS(menu_modal.querySelector('.bySubmission'), 'is-active', true)

        }

        /* By Student Startup */
        initByStudentModal()
        fetchSubmissionsFromServer(master_query_pagination, master_specific_student)
    }

    /*
    function method_byQuestion(){

        var current_pagination = 0,
            pagination_limit = 100,
            current_questionID = 0,
            total_questions = 0,
            CURR_DATASET = [],
            QUESTION_IDS = [],
            paper = $QS('#paper');

        function scanForQuestionIds(){
            CURR_DATASET.forEach(submission => {
                JSONforEach(submission.paper, (row_keys, row_vals) => {
                    JSONforEach(row_vals, (card_keys, card_vals) => {
                        if(!QUESTION_IDS.includes(card_keys) && card_vals.type !== 'video' && card_vals.type !== 'button'){ QUESTION_IDS.push(card_keys) }
                    })
                })
            })
        }

        function getQuestion(questionID=0){
            current_pagination = 0;
            total_questions = 0;
            current_questionID = questionID;
            CURR_DATASET = []

            loadMoreQuestions(new_questions => {
                if(questionID == 0){ current_questionID = QUESTION_IDS[0] }
                displayQuestions(new_questions)
            })
        }

        function showQuestionLoading(){
            let A = `<div class="submission loadingEl">
                    <div class="header"></div>
                    <div class="main">
                        <div class="loading-1"></div>
                        <div class="loading-1"></div>
                    </div></div>`;
            paper.innerHTML += (A + A + A + A + A);
        }

        function removeQuestionLoading(){
            let els = $QSA('#paper .submission.loadingEl')
            els.forEach(e => e.remove())
        }

        function getCardFromPaperById(paper, card_id){
            let r = null
            JSONforEach(paper, (row_keys, row_vals) => {
                JSONforEach(row_vals, (card_keys, card_vals) => {
                    if(card_keys === card_id){ r = card_vals }
                })
            })
            return r;
        }

        function displayQuestions(items){
            items.forEach(item => submissionToDocument(item))
        }

        function submissionToDocument(submission){
            let submission_card = getCardFromPaperById(submission.paper, current_questionID)
            if(submission_card && (submission_card.type !== 'video' && submission_card.type !== 'button')){
                let question = document.createElement('div')
                question.className = "submission " + submission_card.type

                let header = document.createElement('div')
                header.className = "header"

                let nameBadge = document.createElement('div')
                nameBadge.className = "nameBadge"

                nameBadge.innerHTML = `<figure class="image is-48x48 is-rounded mr-2"><img src="${submission.user_image}"></figure>
                    <div class="titles">
                        <h1 class="title is-size-5 name wsnw has-text-white">${submission.user_name}</h1>
                        <h2 class="subtitle is-size-7 email wsnw has-text-white">${submission.user_email}</h2>
                    </div>`

                header.appendChild(nameBadge)

                if(submission_card.type !== 'multiline'){
                    let grading_buttons = document.createElement('div')
                    grading_buttons.className = "buttons are-small is-right"
                    grading_buttons.innerHTML = "<a class=\"button is-success\">test</a>"
                    header.appendChild(grading_buttons)
                }

                // TODO - Phase 2: Build out the body of the thing here...

                question.appendChild(header)

                paper.appendChild(question)
            }
        }

        function loadMoreQuestions(fn){
            showQuestionLoading()

            $GET(`/submissions/grader/getByQuestion/${SHEETID}?pagination=${current_pagination}&question=${current_questionID}`, (result, text) => {
                text = JSON.parse(text)

                current_pagination += 1;
                text.questions.forEach(q => CURR_DATASET.push(q))
                total_questions = text.total;

                try{ scanForQuestionIds() } catch(e){ $ERR(e); }
                //try{ loadPaper(text.sheets.paper) } catch(e){ $ERR(e); }
                //try{ loadToolbar(text.sheets) } catch(e){ $ERR(e); }

                removeQuestionLoading()
                
                if(fn){ fn(text.questions) } 
            })
        }

        getQuestion(0)
    }
    */

    /* Global Startup */
    var master_method = getParam('method') || 2,
        master_specific_student = getParam('student') || '',
        master_query_pagination = getParam('p') || 0

    if(master_method == 2){
        method_byStudent( (master_specific_student !== '') )
        $CLASS(document.body, 'bystudent', true)
    } 
    else { 
        method_byQuestion()
        $CLASS(document.body, 'byquestion', true)
    }
}