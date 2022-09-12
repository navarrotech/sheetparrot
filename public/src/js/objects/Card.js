class Card{

    constructor(data={}, mode, autosave){
        this.data = data;
        this.type = data.type || "card";
        this.editor = data.editor
        this.parent = $(`<div class="tile is-parent"></div>`);

        if(autosave){ this.autosave = autosave } else{ this.autosave = null; }

        if(jQuery){ this.element = $(`<div class="tile is-child box type-${this.type}" id="${this.data.id}"></div>`) }
        else{ throw new Error("jQuery is required to render Card objects!") }

        this.mode = mode;
    }

    getData(){
        if(this.type == "multiline" || this.type == "dropdown"){
            this.data.options.forEach(c => {
                if(c.id){ delete c.id }
            })
        }

        return this.data;
    }
    create(type="card"){

        let data = {}

        switch(type){
            case "card":
                data = {
                    "subtitle": "Write your answer below",
                    "hint": "Your answer here..."
                }
                break;
            case "multichoice":
                data = {
                    subtitle: "Select an option below",
                    correct_answer: "0",
                    option_1: "Blue",
                    option_2: "No yellow!",
                    option_3: "I meant red!",
                    option_4: "None of the above"
                }
                break;
            case "dropdown":
                data = {
                    subtitle: "Select an option below",
                    label: "Select an option:",
                    options:[
                        { label: 'Option 1', value: 'Option 1', default: true  },
                        { label: 'Option 2', value: 'Option 2', default: false },
                        { label: 'Option 3', value: 'Option 3', default: false }
                    ],
                    correct_answer: "1"
                }
                break;
            case "multiline":
                data = {
                    subtitle: "Fill out the options below",
                    options:[
                        { "label":"Question #1", "correct":"" },
                        { "label":"Question #2", "correct":"" },
                        { "label":"Question #3", "correct":"" }
                    ]
                }
                break;
            case "button":
                data = {
                    subtitle:"Click the button below",
                    options:{
                        href:"",
                        label:"New Button",
                        target:"_blank",
                        color:"#42b1f9",
                        size:"normal"
                    }
                }
                break;
            case "video":
                data = {
                    subtitle: "Watch the video below",
                    video_key: "640469860", // The "Placeholder" video
                    video_type: "vimeo"
                }
                break;
            case "blank":
                data = {}
                break;
    
            default:
                data = {}
                throw new Error("Cannot create card of unknown card type: " + type)
        }

        data['id'] = `card_${crypto.randomUUID().slice(0,8)}`

        data.type = type;
        data.title = "New Question"

        this.data = data;
        this.type = type;

        return this;
    }
    renderFake(){
        this.element = $(`
        <div class="tile is-parent">
            <div class="tile is-child box fakeInput"></div>
        </div>`)
        return this.element
    }
    renderEditable(){
        this.element = $(`<div class="tile is-child box type-${this.type}" id="${this.data["id"]}"></div>`)

        if(this.type != "blank"){
            let titles = $('<div class="titles"></div>'),
                title = $(`<textarea class="title is-size-4 secretly-editable">${this.data.title}</textarea>`),
                subtitle = $(`<input class="subtitle is-size-6 secretly-editable" value="${this.data.subtitle}"/>`)

            let title_changer = new InvisibleEditor({
                css:{
                    "padding-top":"0.25em",
                    "padding-bottom":"0.5em",
                    "font-weight":"600",
                    "margin-bottom":".25rem",
                    "font-size":"1.25rem",
                    "line-height":"1.125"
                },
                element:title
            })
            title_changer.onChange(v => this.data.title = v)
            title_changer.attach()
    
            let subtitle_changer = new InvisibleEditor({
                css:{
                    "margin-top":"-0.8rem",
                    "margin-bottom":"1.55rem",
                    "font-size":"1rem"
                },
                element:subtitle
            })
            subtitle_changer.onChange(v => this.data.subtitle = v)
            subtitle_changer.attach()
            
            titles.append(title)
            titles.append(subtitle)
            this.element.append(titles)

            if(this.data.card_img){ this.addImage(this.data.card_img) }
        }

        let html = '',
            data = this.data;

        if(this.type == "card"){
            html = (`
                <div class="edit-question">
                    <div class="field">
                        <textarea class="textarea" placeholder="${data.hint?String(data.hint):''}" maxlength="2000"></textarea>
                    </div>
                </div>
            `)
            html = tighten(html)
            this.element.append(html)
        }
        else if (this.type == "multichoice"){
            let body = '',
                parent_uuid = crypto.randomUUID(),
                uuid

            for(let i=1;i<=4;i++){
                let option = data[`option_${i}`]
                if(!option){ console.log(`No option found for [${i}] in ${data['id']}`); return; }
                uuid = crypto.randomUUID()
                body += `<div class="control">
                    <input class="is-checkradio" id="radio_${uuid}" type="radio" name="radio_group_${parent_uuid}" data-type="option_${i}">
                    <label for="radio_${uuid}">
                        ${option}
                    </label>
                </div>`
            }
            html = (`<div class="edit-question"><div class=field">${body}</div></div>`)
            html = tighten(html)
            this.element.append($(html))
        }
        else if (this.type == "dropdown"){
            let body = `<div class="select"><select>`

            data.options.forEach((option, index) => {
                option.id = crypto.randomUUID()
                body += `
                <option id="${option.id}" value="${index}"}>
                    ${option.label}
                </option>`
            })
            
            body += '</select></div>'

            html = (`<div class="edit-question"><div class=field"><label class="label">${data.label?data.label:''}</label>${body}</div></div>`)
            html = tighten(html)
            this.element.append($(html))
        }
        else if (this.type == "multiline"){

            let body = ''

            data.options.forEach((question, index) => {
                body += `
                <div class="field multiline-item" data-index="${index}">
                    <label class="label is-hidden">
                        ${question.label}
                    </label>
                    <div class="control">
                        <input class="input" type="text" placeholder="${question.label}" maxlength="200">
                    </div>
                </div>`
            })

            html = (`<div class="edit-question"><div class=field">${body}</div></div>`)
            html = tighten(html)
            this.element.append($(html))
        }
        else if (this.type == "button"){

            html = (`
                <div class="edit-question">
                <div class=field">
                    <div class="buttons is-centered">
                        <a class="button is-rounded ${data.options.size ? 'is-' + data.options.size : ''}"
                            href="${data.options.href}"
                            style="
                                background:${data.options.color?data.options.color:'#42b1f9'};
                                color:rgb(${calculateColorlight(data.options.color?data.options.color:'#42b1f9')});
                            "
                            target="${data.options.target || '_blank'}"
                        >
                            <div class="icon is-small">
                                <i class="fas fa-external-link-square-alt"></i>
                            </div> 
                            <span>${data.options.label}</span>
                        </a>
                    </div>
                </div>
            </div>
            `)
            html = tighten(html)
            this.element.append($(html))
        }
        else if (this.type == "video"){

            let vp = new VideoParser({
                type:data.video_type,
                key:data.video_key
            })

            html = (`<div class="edit-question"><div class=field">
                <div class="image">
                    <iframe class="has-ratio" allowfullscreen="" src="${vp.getEmbed()}"></iframe>
                </div>
            </div></div>`)
            html = tighten(html)
            this.element.append($(html))
        }
        else if (this.type == "blank"){
            let add_card = $(`
                <div class="buttons is-centered">
                    <a class="button is-primary">
                        <span class="icon">
                            <i class="fas fa-plus"></i>
                        </span>
                        <span>Add Question</span>
                    </a>
                </div>
            `)

            this.element.click(() => {
                if(this.editor){ this.editor.showCardSelector(this) }
            })

            this.element.append(add_card)
        }
        else {
            throw new Error("Cannot render editable version of unknown card type: " + this.type)
        }

        this.parent.append(this.element)

        this.element.find('.edit-question').click(() => {
            if(this.editor){ this.editor.editCard(this) }
        })

        return this.parent;
    }
    replace(type='blank'){
        this.parent.html('')
        this.create(type)
        this.parent.append(
            this.renderEditable()
        )
    }

    renderGradable(){
        if(!this.data){ console.warn(this.data); throw new Error("Cannot render element with improper data!"); }

        let grade_class = this.data.grade && this.data.grade == 1?'is-success':this.data.grade && this.data.grade == -1?'is-danger':''
        if(!this.element)
            this.element = $(`<div class="tile is-child box type-${this.type}" id="${this.data["id"]}"></div>`)

        if(this.type == "blank"){
            this.element.removeClass('box')
            return $(`<div class="tile is-parent"></div>`).append(this.element);
        }

        if(['card', 'multichoice', 'dropdown'].includes(this.type)){
            this.element.addClass(grade_class)
        }

        let hasNoteBadge = $(`<div class="has-notes-badge ${this.data.note?'':'is-hidden'}"><span class="tag is-link">Has Notes</span></div>`)

        let promptForNote = (callback=()=>{}) => {
            let modal = $(`<div class="modal is-tiny is-active"><div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head"><p class="modal-card-title">Leave a note</p><button class="delete" action="close"></button></header>
                    <section class="modal-card-body">
                        <div class="field">
                            <p class="is-size-6 has-text-centered">Leave a note for your student to read when they are reviewing their graded work.</p>
                        </div>
                        <div class="field">
                            <p class="control"><textarea class="textarea is-fullwidth" maxlength="500">${this.data.note?this.data.note:''}</textarea></p>
                        </div>
                    </section>
                    <footer class="modal-card-foot buttons is-right"><a class="button is-success">Save Note</a></footer>
                </div>
            </div>`)
                .on('click', '[action=close]', () => modal.remove())
                .on('click', '.modal-background', () => modal.remove())
                .on('click', '.button.is-success', () => { callback(modal.find('textarea').val()); modal.remove(); })

            $('body').append(modal)
        }

        let graderToolbar = (options={}) => {
            let toolbar = $(`<div class="field has-addons px-auto is-justify-content-center grader-toolbar">
                <p class="control" data-tooltip="Mark as correct"><a class="button px-3 is-success"><span class="icon"><i class="fas fa-check"></i></span></a></p>
                <p class="control" data-tooltip="Reset Answers"><a class="button px-3 is-radiusless is-dark"><span class="icon"><i class="fas fa-sync"></i></span></a></p>
                <p class="control" data-tooltip="Mark as incorrect"><a class="button px-3 is-radiusless is-danger"><span class="icon"><i class="fas fa-times"></i></span></a></p>
                <p class="control" data-tooltip="Leave a note"><a class="button px-3 is-link"><span class="icon"><i class="far fa-note-sticky"></i></span></a></p>
            </div>`)

            let [ correct, reset, incorrect, note ] = [ toolbar.find('.button.is-success'), toolbar.find('.button.is-dark'), toolbar.find('.button.is-danger'), toolbar.find('.button.is-link'), ]

            let callback = async (element, body) => {
                correct.attr('disabled','true')
                reset.attr('disabled','true')
                incorrect.attr('disabled','true')
                note.attr('disabled','true')

                element.addClass('is-loading')

                element.removeAttr('disabled')

                if(options && this.type == 'multiline'){
                    body.multiline = options.index;
                }

                let request = await $POST(`/submission/edit?_id=${submissionid}`, body),
                    response = await request.json();
                
                element.removeClass('is-loading')

                correct.removeAttr('disabled','true')
                reset.removeAttr('disabled','true')
                incorrect.removeAttr('disabled','true')
                note.removeAttr('disabled','true')

                // Update the local paper object
                if(this.type == 'multiline'){
                    this.data.options[options.index].graded = true;
                    this.data.options[options.index].grade = body.value;
                }
                else{
                    this.data.graded = true;
                    this.data.grade = body.value;
                }

                if(recalculateProgressbar){ recalculateProgressbar(); }

                if(request.status != 200){
                    toast("Something went wrong trying to update that response, please try again.", 'danger', true, false)
                    console.error({ request, response }); return;
                }

                if(body.key == 'grade'){
                    if(options && this.type == 'multiline'){
                        options.callback(body.value)
                    }
                    else{
                        this.element.removeClass(['is-success', 'is-danger']);
                        this.element.addClass(body.value == 1 ? 'is-success':body.value == -1 ? 'is-danger' : '');
                    }
                }
            }

            correct.click(()   => { callback(correct,   { cardid:this.data['id'], key:'grade', value:1  }) })
            reset.click(()     => { callback(reset,     { cardid:this.data['id'], key:'grade', value:0  }) })
            incorrect.click(() => { callback(incorrect, { cardid:this.data['id'], key:'grade', value:-1 }) })
            note.click(()      => { promptForNote((value) => {
                callback(note, { cardid:this.data['id'], key:'note', value });
                hasNoteBadge.toggleClass('is-hidden', value?false:true);
            }) })

            return toolbar;
        }

        let data = this.data;

        let header = $(`
            <div class="field titles">
                <h1 class="title is-size-4">${this.data.title}</h1>
                <h2 class="subtitle is-size-6">${this.data.subtitle}</h2>
                ${ data.card_img?`<div class="card_image image "><img src="${data.card_img}"/></div>`:'' }
            </div>
        `)
        this.element.append(header);

        if(this.type == "card"){
            let el = $(`
                <div class="field">
                    <textarea class="textarea" readonly placeholder="${data.hint?String(data.hint):''}" maxlength="2000">${data.answer?data.answer:''}</textarea>
                </div>
            `)
            this.element.append(el);
            this.element.append( graderToolbar() )
        }
        else if (this.type == "multichoice"){
            let el = $(`<div class="field"></div>`)
            for(let i=1;i<=4;i++){
                if(data.answer && typeof data.answer == 'string'){ data.answer = parseInt(data.answer); }
                let option = data[`option_${i}`]
                if(!option){ console.log(`No option found for [${i}] in ${data['id']}`); return; }
                let item_body = $(`<div class="control">
                    <input class="is-checkradio" type="radio" value="${i}" data-type="option_${i}" ${data.answer == i?'checked':'disabled'}>
                    <label>${option}</label>
                </div>`)
                el.append(item_body)
            }
            this.element.append(el)
            this.element.append( graderToolbar() )
        }
        else if (this.type == "dropdown"){
            let body = $(`
                <div class="field">
                    <label class="label">${data.label?data.label:''}</label>
                    <div class="select is-fullwidth">
                        <select>
                            <option value="${data.answer}">${data.answer}</option>
                        </select>
                    </div>
                </div>
            `)

            this.element.append(body)
            this.element.append( graderToolbar() )
        }
        else if (this.type == "multiline"){

            let header = $(`<div class="field"></div>`)

            data.options.forEach((question, index) => {
                let el = $(`
                    <div class="field multiline-item" data-index="${index}">
                        <label class="label">${question.label}</label>
                        <div class="control">
                            <textarea class="textarea" type="text" placeholder="${question.label}" maxlength="200" readonly>${question.answer?question.answer:''}</textarea>
                        </div>
                    </div>
                `)
                if(question.graded && question.grade){
                    el.addClass(question.grade && question.grade == 1?'is-success':question.grade && question.grade == -1?'is-danger':'')
                }
                header.append(el)
                header.append( graderToolbar({ index, callback:(new_value) => {
                    el.removeClass([ 'is-success', 'is-danger' ])
                    el.addClass(new_value && new_value == 1?'is-success':new_value && new_value == -1?'is-danger':'')
                } }) )
                setTimeout(() => autoSizeTextarea(el.find('textarea')))
            })

            this.element.append(header)
        }
        else if (this.type == "button"){

            let btn = $(`
                <div class=field">
                    <div class="buttons is-centered mt-6">
                        <a class="button is-link is-rounded ${data.options.size?'is-'+data.options.size:'is-normal'}"
                            style="
                                background:${data.options.color?data.options.color:'#42b1f9'};
                                color:rgb(${calculateColorlight(data.options.color?data.options.color:'#42b1f9')});
                            "
                            disabled
                        >
                            <div class="icon is-small"><i class="fas fa-external-link-square-alt"></i></div> 
                            <span>${data.options.label}</span>
                        </a>
                    </div>
                </div>
            `)

            this.element.append(btn)
        }
        else if (this.type == "video"){

            let vp = new VideoParser({
                type:data.video_type,
                key:data.video_key
            })

            let image_field = $(`<div class=field is-disabled">
                <div class="image ">
                    <iframe class="has-ratio" allowfullscreen="" src="${vp.getEmbed()}"></iframe>
                </div>
            </div>`)

            this.element.append(image_field);

        }
        else {
            console.error("Cannot render editable version of unknown card type: " + this.type)
            return $(`<div></div>`);
        }

        this.element.append(hasNoteBadge)

        let parent = $(`<div class="tile is-parent"></div>`)
        parent.append(this.element)

        return parent;
    }
    renderNormal(){
        if(!this.data){ console.warn(this.data); throw new Error("Cannot render element with improper data!"); }

        if(!this.element)
            this.element = $(`<div class="tile is-child box type-${this.type}" id="${this.data["id"]}"></div>`)

        if(this.type == "blank"){
            this.element.removeClass('box')
            return $(`<div class="tile is-parent"></div>`).append(this.element);
        }

        let data = this.data;

        let header = $(`
            <div class="titles">
                <h1 class="title is-size-4">${this.data.title}</h1>
                <h2 class="subtitle is-size-6">${this.data.subtitle}</h2>
                ${ data.card_img?`<div class="card_image image "><img src="${data.card_img}"/></div>`:'' }
            </div>
        `)
        this.element.append(header);

        let autosave_key = this.autosave?`save_${this.autosave}`:null,
            autosave_data = {}, autosave_value = null;

        if(this.autosave){
            autosave_data = window.SheetParrot.DynamicCache.find(autosave_key) || {};
            autosave_value = autosave_data[this.data['id']] || {}
        }
        else{ autosave_data = {}; autosave_value = {}; }

        /*
        autosave_data --> : {
            '1234':{ val:'' }, // <-- autosave_value
            '1235':{ val:'' },
            '1236':{ val:'' },
        }*/

        let updateAutosave = (new_autosave_value) => {
            autosave_data[this.data['id']] = new_autosave_value;
            autosave_value = new_autosave_value;
            window.SheetParrot.DynamicCache.update(autosave_key, autosave_data)
        }

        if(this.type == "card"){
            let el = $(`
                <div class="field">
                    <textarea class="textarea" placeholder="${data.hint?String(data.hint):''}" maxlength="2000">${autosave_value && autosave_value.value?autosave_value.value:''}</textarea>
                </div>
            `)

            let TA = el.find('textarea')
            TA.on('input', () => {
                // Answer input
                this.data.answer = TA.val();

                // Autosave
                if(this.autosave){ updateAutosave({ val:TA.val() }) }
            })

            if(autosave_value && autosave_value.val){
                this.data.answer = autosave_value.val
                TA.val(autosave_value.val)
            }

            this.element.append(el);
        }
        else if (this.type == "multichoice"){
            let parent_uuid = crypto.randomUUID(),
                uuid

            let x = autosave_value && autosave_value.val ? autosave_value.val : 0;

            let el = $(`<div class=field"></div>`)
            for(let i=1;i<=4;i++){
                let option = data[`option_${i}`]
                if(!option){ console.log(`No option found for [${i}] in ${data['id']}`); return; }
                uuid = crypto.randomUUID()

                let item_body = $(`<div class="control">
                    <input class="is-checkradio" id="radio_${uuid}" type="radio" value="${i}" name="radio_group_${parent_uuid}" data-type="option_${i}" ${x==i?'checked':''}>
                    <label for="radio_${uuid}">
                        ${option}
                    </label>
                </div>`)
                el.append(item_body)
            }

            let TA = el.find('input')
                TA.change(event => {
                    let i = $(event.target).val()

                    // Answer
                    this.data.answer = i;
                    
                    // Autosave
                    if(this.autosave){
                        updateAutosave({ val:i })
                    }
                })

            if(autosave_value && autosave_value.val){
                this.data.answer = autosave_value.val
            }

            this.element.append(el)
        }
        else if (this.type == "dropdown"){
            let body = $(`
                <div class=field">
                    <label class="label">${data.label?data.label:''}</label>
                    <div class="select">
                        <select>
                            <option value="default">--</option>
                        </select>
                    </div>
                </div>
            `)

            let select = body.find('select')

            data.options.forEach((option, index) => {
                option.id = crypto.randomUUID()
                let el = $(`<option id="${option.id}" value="${index}">${option.label}</option>`)

                select.append(el)
            })

            // Load autosave
            if(autosave_value && autosave_value.val){ select.val(autosave_value.val); this.data.answer = autosave_value.val; }

            select.change(() => {
                let answer = select.val()
                
                // Autosave
                if(this.autosave){ updateAutosave({ val:answer }) }

                if(answer == 'default'){ return; }
                
                // Answer
                this.data.answer = answer;
            })

            this.element.append(body)
        }
        else if (this.type == "multiline"){

            let header = $(`<div class=field"></div>`)

            data.options.forEach((question, index) => {
                let el = $(`
                    <div class="field multiline-item" data-index="${index}">
                        <label class="label ${autosave_value && autosave_value[String(index)]?'':'is-hidden'}">${question.label}</label>
                        <div class="control">
                            <input class="input" type="text" placeholder="${question.label}" maxlength="200" ${autosave_value && autosave_value[String(index)]?`value="${autosave_value[String(index)]}"`:''}>
                        </div>
                    </div>
                `)
                
                let inp = el.find('input'),
                    lab = el.find('label')

                if(autosave_value && autosave_value[String(index)]){
                    question.answer = autosave_value[String(index)]
                }

                inp.on('input', () => {
                    // Label changing
                    lab.toggleClass('is-hidden', inp.val()?false:true)

                    // Answer
                    question.answer = inp.val() // <-- First way (better) of writing it
                    //this.data.options[index].answer = inp.val() // <-- Second way of writing it
                    if(this.autosave){
                        autosave_value[String(index)] = inp.val()
                        updateAutosave(autosave_value)
                    }
                })

                header.append(el)
            })

            this.element.append(header)
        }
        else if (this.type == "button"){

            let btn = $(`
                <div class=field">
                    <div class="buttons is-centered mt-6">
                        <a class="button is-link is-rounded ${data.options.size?'is-'+data.options.size:'is-normal'}"
                            href="${data.options.href}"
                            style="
                                background:${data.options.color?data.options.color:'#42b1f9'};
                                color:rgb(${calculateColorlight(data.options.color?data.options.color:'#42b1f9')});
                            "
                            target="${data.options.target || '_blank'}"
                        >
                            <div class="icon is-small"><i class="fas fa-external-link-square-alt"></i></div> 
                            <span>${data.options.label}</span>
                        </a>
                    </div>
                </div>
            `)

            btn.find('.button').click(() => this.data.clicks += 1)

            this.element.append(btn)
        }
        else if (this.type == "video"){

            let vp = new VideoParser({
                type:data.video_type,
                key:data.video_key
            })

            let image_field = $(`<div class=field">
                <div class="image ">
                    <iframe class="has-ratio" allowfullscreen="" src="${vp.getEmbed()}"></iframe>
                </div>
            </div>`)

            this.element.append(image_field);

        }
        else {
            throw new Error("Cannot render editable version of unknown card type: " + this.type)
        }

        let parent = $(`<div class="tile is-parent"></div>`)
        parent.append(this.element)

        return parent;
    }
    renderPastSubmission(){
        if(!this.data){ console.warn(this.data); throw new Error("Cannot render element with improper data!"); }

        let grade_class = this.data.grade && this.data.grade == 1?'is-success':this.data.grade && this.data.grade == -1?'is-danger':''

        if(!this.element)
            this.element = $(`<div class="tile is-child box" id="${this.data["id"]}"></div>`)

        if(['card', 'multichoice', 'dropdown'].includes(this.type)){
            this.element.addClass(grade_class)
        }

        let hasNoteBadge = $(`<div class="has-notes-badge ${this.data.note?'':'is-hidden'}"><span class="tag is-link">Has Notes</span></div>`)

        let data = this.data;
        let header = $(`
            <div class="titles">
                <h1 class="title is-size-4">${this.data.title || ''}</h1>
                <h2 class="subtitle is-size-6">${this.data.subtitle || ''}</h2>
                ${ data.card_img?`<div class="card_image image "><img src="${data.card_img}"/></div>`:'' }
            </div>
        `)
        this.element.append(header);

        if(this.type == "card"){
            let el = $(`
                <div class="field">
                    <textarea class="textarea" placeholder="${data.hint?String(data.hint):''}" maxlength="2000" readonly>${data.answer?data.answer:''}</textarea>
                </div>
            `)
            this.element.append(el);
        }
        else if (this.type == "multichoice"){
            let parent_uuid = crypto.randomUUID(),
                uuid

            let el = $(`<div class=field"></div>`)
            for(let i=1;i<=4;i++){
                let option = data[`option_${i}`]
                if(!option){ console.log(`No option found for [${i}] in ${data['id']}`); return; }
                uuid = crypto.randomUUID()

                let item_body = $(`<div class="control">
                    <input class="is-checkradio" id="radio_${uuid}" type="radio" name="radio_group_${parent_uuid}" data-type="option_${i}" ${data.answer && data.answer == String(i)?'checked':'disabled'}>
                    <label for="radio_${uuid}">${option}</label>
                </div>`)
                el.append(item_body)
            }
            this.element.append(el)
        }
        else if (this.type == "dropdown"){
            let body = $(`
                <div class=field">
                    <label class="label">${data.label?data.label:''}</label>
                    <div class="select">
                        <select>
                            <option selected>${data.options[data.answer]?data.options[data.answer].label:'--'}</option>
                        </select>
                    </div>
                </div>
            `)

            this.element.append(body)
        }
        else if (this.type == "multiline"){

            let header = $(`<div class=field"></div>`)

            data.options.forEach((question, index) => {
                let el = $(`
                    <div class="field multiline-item" data-index="${index}">
                        <label class="label">${question.label}</label>
                        <div class="control">
                            <input class="input" type="text" placeholder="${question.label}" readonly value="${question.answer?question.answer:''}">
                        </div>
                    </div>
                `)

                header.append(el)
            })

            this.element.append(header)
        }
        else if (this.type == "button"){

            let btn = $(`
                <div class=field">
                    <div class="buttons is-centered mt-6">
                        <a class="button is-link is-rounded is-disabled ${data.options.size?'is-'+data.options.size:'is-normal'}"
                            href="${data.options.href}"
                            style="
                                background:${data.options.color?data.options.color:'#42b1f9'};
                                color:rgb(${calculateColorlight(data.options.color?data.options.color:'#42b1f9')});
                            "
                            target="${data.options.target || '_blank'}"
                        >
                            <div class="icon is-small">
                                <i class="fas fa-external-link-square-alt"></i>
                            </div> 
                            <span>${data.options.label}</span>
                        </a>
                    </div>
                </div>
            `)

            btn.find('.button').click(() => this.data.clicks += 1)

            this.element.append(btn)
        }
        else if (this.type == "video"){

            let vp = new VideoParser({
                type:data.video_type,
                key:data.video_key
            })

            let image_field = $(`<div class=field">
                <div class="image ">
                    <iframe class="has-ratio" allowfullscreen="" src="${vp.getEmbed()}"></iframe>
                </div>
            </div>`)

            this.element.append(image_field);

        }
        else if (this.type == "blank"){
            this.element.removeClass('box')
        }
        else {
            throw new Error("Cannot render editable version of unknown card type: " + this.type)
        }

        hasNoteBadge.click(() => {
            $('body').append(
                 $(`<div class="modal is-active">
                        <div class="modal-background" action="close"></div>
                        <div class="modal-card">
                            <header class="modal-card-head">
                                <p class="modal-card-title">Note</p>
                                <button class="delete" action="close"></button>
                            </header>
                            <section class="modal-card-body">
                                <label class="label">A note was left about your response:</label>
                                <div class="content"><p>${this.data.note || ''}</p></div>
                            </section>
                            <footer class="modal-card-foot buttons is-right">
                                <a class="button is-light" action="close">Cancel</a>
                            </footer>
                        </div>
                    </div>`).on('click', '[action=close]', () => modal.remove())
            );
        })

        if(this.data.note){ this.element.append(hasNoteBadge) }

        let parent = $(`<div class="tile is-parent"></div>`)
        parent.append(this.element)

        return parent;
    }
    addImage(url){
        if(this.mode != 'editable'){ throw new Error("Attempting to add an editable image to a non-editable sheet!"); }

        this.data.card_img = url;

        let image = $(`<div class="card_image image ">
            <img src="${url}"/>
            <div class="absolutely-centered">
                <div class="field has-addons">
                    <div class="control">
                        <button class="button is-dark" type="button" action="change-image">
                            <span class="icon"><i class="fas fa-sync-alt"></i></span>
                            <span>Change image</span>
                        </button>
                    </div>
                    <div class="control">
                        <button class="button is-danger" type="button" action="remove-image">
                            <span class="icon"><i class="fas fa-trash-alt"></i></span>
                        </button>
                    </div>
                </div>
            </div>
        </div>`)

        let image_change_button = image.find('.button[action=change-image]'),
            image_remove_button = image.find('.button[action=remove-image]')

        image_change_button.click(() => {
            if(!window.photoLibrary){ window.photoLibrary = new PhotoLibrary() }
            window.photoLibrary.onSelect((U) => {
                if(!url){
                    image.remove();
                    delete this.data.card_img;
                    return;
                }
                image.find('img').attr('src', U)
                this.data.card_img = U;
            })
            window.photoLibrary.render()
        })

        image_remove_button.click(() => {
            delete this.data.card_img
            image.remove()
        })

        this.element.find('.titles').append(image)
    }
    render(){
        if(this.mode == "editable")
            return this.renderEditable()
        else if(this.mode == "grading")
            return this.renderGradable()
        else if(this.mode == "fake")
            return this.renderFake()
        else if(this.mode == "submission")
            return this.renderPastSubmission()
        else
            return this.renderNormal()
    }

};