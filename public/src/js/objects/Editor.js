class Editor{
    
    constructor(paper_obj){
        this.element = $(`<div class="editor-panel"></div>`)
        this.parent = $('<div class="sidebar"></div>')

        this.paper = paper_obj

        let bkg = $('<div class="sidebar-bkg"></div>')
        bkg.click(() => { this.hide() })
        
        this.parent.append(bkg)
        this.parent.append(this.element)

        $('body').append(this.parent);

        $(document).on('keyup', event => {
            let key = event.originalEvent.key
            if(this.active && key == "Escape"){ this.hide() }
        })

        this.toolbar = $('#edit_tools');
        if(this.toolbar){ this.createToolbar(); }

        this.unsavedChanges = false;
        window.addEventListener("beforeunload", function (e) {
            if(!this.unsavedChanges){ return; }
            let confirmationMessage = 'You may have unsaved changes. Are you sure you want to exit?';
        
            (e || window.event).returnValue = confirmationMessage; //Gecko + IE
            return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
        });
    }

    createToolbar(){
        if(_ID){
            this.toolbar.append($(`
                <a class="button is-dark is-outlined" href="${_DOMAIN}/sheets/view/${_ID}">
                    <span class="icon">
                        <i class="fas fa-sign-out-alt"></i>
                    </span>
                    <span>
                        Exit
                    </span>
                </a>
            `))
        }
        
        this.toolbar.append($(`
            <a class="button is-dark">
                <span class="icon"><i class="fas fa-cog"></i></span>
                <span>Settings</span>
            </a>
        `).click(() => { this.showSettingsChanger() }));

        this.toolbar.append( $(`
        <a class="button is-dark">
            <span class="icon"><i class="fas fa-palette"></i></span>
            <span>Theme</span>
        </a>`).click(() => this.showThemeChanger()));

        this.toolbar.append($(`
        <a class="button is-dark">
            <span class="icon"><i class="fas fa-video"></i></span>
            <span>Video</span>
        </a>`).click(() => { this.showVideoChanger(); }));
    }

    hide(){
        this.element.html("")
        if(this.selected_card){
            this.selected_card.element.removeClass('is-selected')
            this.selected_card = null;
        }
        this.parent.removeClass('is-active')
        $('.sheet').removeClass('spotlight-selected')
        $('body').removeClass('spotlight-sidebar')
        $('html').css('overflow','')


        this.active = false;
    }

    show(){
        if(this.selected_card){
            this.selected_card.element.addClass('is-selected')
        }
        $('.sheet').addClass('spotlight-selected')
        this.parent.addClass('is-active')
        $('body').addClass('spotlight-sidebar')
        $('html').css('overflow','hidden')

        this.active = true;
    }

    createBoundSwitch(options={}, fn=()=>{}){
        let field = $(`
            <div class="field">
                <div class="twobox is-spaced">
                    <label class="label mb-0">${options.label || ' '}</label>
                    <label class="switch">
                        <input type="checkbox" ${options.checked?'checked':''}>
                        <span class="slider round is-primary"></span>
                    </label>
                </div>
            </div>
        `)

        let cb = field.find('input')
        cb.change(() => fn(cb.prop('checked')))

        return field;
    }
    createBoundColorpicker(options={}, fn=()=>{}){
        /*
            {
                label:"Button color:",
                value:"#eb2428",
                style:""
            }
        */
        let field = $(`
            ${options.label?`<label class="label">${options.label || ""}</label>`:''}
            <div class="field has-addons ${options.style || ''}">
                <div class="control">
                    <input class="input" style="width:85px;" value="${options.value || "#42b1f9"}" placeholder="" readonly/>
                </div>
                <div class="control is-expanded">
                    <div class="colorDisplay" style="background:${options.value || '#42b1f9'};"></div>
                </div>
            </div>
        `)

        let visibleColor = field.find('.colorDisplay'),
            display_input = field.find('input[readonly]')

        new Picker({
            parent:visibleColor.get()[0],
            color:options.value || '#42b1f9',
            alpha:false,
            editorFormat:'hex',
            cancelButton:false,
            popup:'bottom',
            onChange:color => {
                let hex = color.hex.slice(0,-2),
                    colorlight = calculateColorlight(hex)

                visibleColor.css('background', hex);
                display_input.val(hex)
                fn({ hex, colorlight });

                this.unsavedChanges = true;
            }
        });

        return field
    }
    createBoundDropdown(options={}, fn=()=>{}){
        let opts = ''
        // [ { text:"", value:"", default:true } ]
        options.options.forEach(o => {
            opts += `
                <option ${(o.default)?'selected':''} value="${o.value}">${o.text}</option>
            `
        })
        let field = $(`<div class="field">
            ${options.label?`<label class="label">${options.label || ""}</label>`:''}
                <div class="control ${options.style?options.style:''}">
                    <div class="select" style="width:100%">
                        <select style="width:100%;">${opts}</select>
                    </div>
                </div>
            </div>
        `)

        let select = field.find('select')
        select.change(() => { fn(select.val()); this.unsavedChanges = true; })

        return field;
    }
    createBoundInput(options={}, fn=()=>{}){
        let field = $(`
            ${options.label?`<label class="label">${options.label || ""}</label>`:''}
            <div class="field ${options.canDelete?'has-addons':''}">
                <p class="control ${options.style || ''}">
                    <input class="input" value="${options.value || ""}" placeholder="${options.placeholder || ""}"/>
                </p>
                ${options.help?`<p class="help">${options.help}</p>`:''}
                ${options.canDelete?`
                    <a class="button is-danger">
                        <span class="icon">
                            <i class="fas fa-trash-alt"></i>
                        </span>
                    </a>
                `:''}
            </div>
        `)

        let input = field.find('input')
        input.on('input', () => { fn(input.val()); this.unsavedChanges = true; })

        if(options.canDelete && options.onDelete){
            let delete_button = field.find('a.button.is-danger')
            delete_button.click(() => { options.onDelete(); this.unsavedChanges = true; })
        }

        return field;
    }
    createBoundButtonGroup(options={}){
        /*
            {
                label:"",
                toggleGroup:true,
                buttons:[
                    { callback:fn(), icon:"fas fa-plus", label:"", value:"", selected:true }
                ],
                onChange: callback(fn)
            }
        */

        let parent = $(`
            <div class="twobox is-spaced mb-3">
                ${options.label?`<label class="label">${options.label}</label>`:''}
            </div>
        `)

        let field = $(`<div class="field has-addons"></div>`)

        let selected_btn = null;
        options.buttons.forEach(btn_opts => {
            let button = $(`
                <a class="button ${btn_opts.selected?'is-primary':''}">
                    ${ btn_opts.icon  ? `<span class="icon"><i class="${btn_opts.icon}"></i></span>` : '' }
                    ${ btn_opts.label ? `<span>${btn_opts.label}</span>` : '' }
                </a>
            `)

            if(options.toggleGroup && btn_opts.selected){ selected_btn = button }

            button.click(() => {
                if(options.toggleGroup){
                    if(selected_btn){ selected_btn.removeClass('is-primary') }
                    button.addClass('is-primary')
                    selected_btn = button
                }
                if(btn_opts.callback){ btn_opts.callback(btn_opts.value); this.unsavedChanges = true; }
                if(options.onChange){  options.onChange(btn_opts.value);  this.unsavedChanges = true; }
            })

            let button_parent = $(`<div class="control"></div>`)
            button_parent.append(button)

            field.append(button_parent)
        })

        parent.append(field)

        return parent;
    }
    createMobileCloseButton(){
        let c = $(`
        <a class="field button is-dark is-fullwidth-mobile is-hidden-tablet">
            <span class="icon">
                <i class="fas fa-reply"></i>
            </span>
            <span>Go Back</span>
        </a>`)
        c.click(() => this.hide())
        return c;
    }

    showCardSelector(card){
        if(!card || !(card instanceof Card)){ throw new Error("Cannot select a card without a proper card object!"); }
        this.element.html("")
        
        if(this.selected_card && this.selected_card != card){ this.hide() }

        let data = card.data;

        // Header
        let header = $(`
            <div class="hero is-colorful mb-2">
                <div class="hero-body" style="padding-top:2rem!important;padding-bottom:2rem!important;">
                    <h1 class="title has-text-white is-size-3 mb-0">Add Question</h1>
                </div>
            </div>
        `)
        this.element.append(header)

        function selectCard({ icon=`<i class="fas fa-plus"></i>`, label, onclick=()=>{} }){
            let a = $(`
                <a class="button is-dark is-normal is-outlined is-fullwidth has-text-left px-3">
                    <span class="icon">${icon}</span>
                    <span>${label}</span>
                </a>
            `)
            a.click(() => { onclick(); })

            let parent = $(`<div class="field"></div>`)
            parent.append(a);

            return parent;
        }

        let body = $('<div class="p-4"></div>')

        let section_interactables = $(`<div class="columns"></div>`),
            column_a = $(`<div class="column is-half"></div>`),
            column_b = $(`<div class="column is-half"></div>`)

        body.append(`
            <div class="px-2">
                <h1 class="title is-size-5 mb-0">Student Input</h1>
                <hr class="mt-3 mb-4">
            </div>
        `)

        let singleInputCard = selectCard({
            label:"Text Input",
            icon:`<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M5.763 17H20V5H4v13.385L5.763 17zm.692 2L2 22.5V4a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.455z"></path></g></svg>`,
            onclick:() => {
                if(_PLAN == 'free'){
                    promptToUpgrade();
                    this.hide();
                    return;
                }
                this.hide(); card.replace("card");
            } 
        })

        let multiInputCard = selectCard({
            label:"Multi Text Input",
            icon:`<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M5.455 15L1 18.5V3a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v12H5.455zm-.692-2H16V4H3v10.385L4.763 13zM8 17h10.237L20 18.385V8h1a1 1 0 0 1 1 1v13.5L17.545 19H9a1 1 0 0 1-1-1v-1z"></path></g></svg>`,
            onclick:() => {
                if(_PLAN == 'free'){
                    promptToUpgrade();
                    this.hide();
                    return;
                }
                this.hide(); card.replace("multiline");
            }
        })

        if(_PLAN == 'free'){
            singleInputCard.addClass('is-relative')
            singleInputCard.find('.button').addClass('candisable is-disabled is-clickable')
            singleInputCard.prepend(
                `<p class="upgrade-badge is-floating is-right-corner no-hover"><span class="icon is-small">
                <svg xmlns="http://www.w3.org/2000/svg" fill="white" width="86.82" height="86.48" viewBox="0 0 86.82 86.48"><path d="M18.08,17.26,26.93,1.07a2.06,2.06,0,0,1,3.62,0L39.4,17.26a2.15,2.15,0,0,0,.82.82L56.4,26.93a2.06,2.06,0,0,1,0,3.62L40.22,39.4a2.15,2.15,0,0,0-.82.82L30.55,56.4a2.06,2.06,0,0,1-3.62,0L18.08,40.22a2.15,2.15,0,0,0-.82-.82L1.07,30.55a2.06,2.06,0,0,1,0-3.62l16.19-8.85A2.15,2.15,0,0,0,18.08,17.26Z"/><path d="M59.3,52.74l6.21-11.35a1.4,1.4,0,0,1,2.46,0l6.21,11.35a1.37,1.37,0,0,0,.56.56l11.35,6.21a1.4,1.4,0,0,1,0,2.46L74.74,68.18a1.37,1.37,0,0,0-.56.56L68,80.09a1.4,1.4,0,0,1-2.46,0L59.3,68.74a1.37,1.37,0,0,0-.56-.56L47.39,62a1.4,1.4,0,0,1,0-2.46L58.74,53.3A1.37,1.37,0,0,0,59.3,52.74Z"/><path d="M8.51,66.89l3.87-7.08a1.55,1.55,0,0,1,2.72,0L19,66.89a1.54,1.54,0,0,0,.62.62l7.08,3.87a1.55,1.55,0,0,1,0,2.72L19.59,78a1.54,1.54,0,0,0-.62.62L15.1,85.67a1.55,1.55,0,0,1-2.72,0L8.51,78.59A1.54,1.54,0,0,0,7.89,78L.81,74.1a1.55,1.55,0,0,1,0-2.72l7.08-3.87A1.54,1.54,0,0,0,8.51,66.89Z"/></svg>
                </span><span>Pro</span></p>`
            )
            multiInputCard.addClass('is-relative')
            multiInputCard.find('.button').addClass('candisable is-disabled is-clickable')
            multiInputCard.prepend(
                `<p class="upgrade-badge is-floating is-right-corner no-hover"><span class="icon is-small">
                <svg xmlns="http://www.w3.org/2000/svg" fill="white" width="86.82" height="86.48" viewBox="0 0 86.82 86.48"><path d="M18.08,17.26,26.93,1.07a2.06,2.06,0,0,1,3.62,0L39.4,17.26a2.15,2.15,0,0,0,.82.82L56.4,26.93a2.06,2.06,0,0,1,0,3.62L40.22,39.4a2.15,2.15,0,0,0-.82.82L30.55,56.4a2.06,2.06,0,0,1-3.62,0L18.08,40.22a2.15,2.15,0,0,0-.82-.82L1.07,30.55a2.06,2.06,0,0,1,0-3.62l16.19-8.85A2.15,2.15,0,0,0,18.08,17.26Z"/><path d="M59.3,52.74l6.21-11.35a1.4,1.4,0,0,1,2.46,0l6.21,11.35a1.37,1.37,0,0,0,.56.56l11.35,6.21a1.4,1.4,0,0,1,0,2.46L74.74,68.18a1.37,1.37,0,0,0-.56.56L68,80.09a1.4,1.4,0,0,1-2.46,0L59.3,68.74a1.37,1.37,0,0,0-.56-.56L47.39,62a1.4,1.4,0,0,1,0-2.46L58.74,53.3A1.37,1.37,0,0,0,59.3,52.74Z"/><path d="M8.51,66.89l3.87-7.08a1.55,1.55,0,0,1,2.72,0L19,66.89a1.54,1.54,0,0,0,.62.62l7.08,3.87a1.55,1.55,0,0,1,0,2.72L19.59,78a1.54,1.54,0,0,0-.62.62L15.1,85.67a1.55,1.55,0,0,1-2.72,0L8.51,78.59A1.54,1.54,0,0,0,7.89,78L.81,74.1a1.55,1.55,0,0,1,0-2.72l7.08-3.87A1.54,1.54,0,0,0,8.51,66.89Z"/></svg>
                </span><span>Pro</span></p>`
            )
        }

        column_a.append(singleInputCard)
        column_b.append(multiInputCard)

        section_interactables.append(column_a);
        section_interactables.append(column_b);
        body.append(section_interactables)

        let section_standard = $(`<div class="columns"></div>`),
            column_a_standard = $(`<div class="column is-half"></div>`),
            column_b_standard = $(`<div class="column is-half"></div>`)

        body.append(`
            <div class="px-2">
                <h1 class="title is-size-5 mb-0">Standard</h1>
                <hr class="mt-3 mb-4">
            </div>
        `)

        column_a_standard.append(
            selectCard({
                label:"Multiple Choice",
                icon:`<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 24 24" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><g><path fill="none" d="M0 0h24v24H0z"></path><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-3a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"></path></g></svg>`,
                onclick:() => { this.hide(); card.replace("multichoice"); } 
            })
        )
        column_b_standard.append(
            selectCard({
                label:"Dropdown",
                icon:`<i class="fas fa-caret-square-down"></i>`,
                onclick:() => { this.hide(); card.replace("dropdown"); }
            })
        )

        section_standard.append(column_a_standard);
        section_standard.append(column_b_standard);
        body.append(section_standard)

        let section_viewables = $(`<div class="columns"></div>`),
            column_a_viewables = $(`<div class="column is-half"></div>`),
            column_b_viewables = $(`<div class="column is-half"></div>`)

        body.append(`
            <div class="px-2">
                <h1 class="title is-size-5 mb-0">Media</h1>
                <hr class="mt-3 mb-4">
            </div>
        `)

        column_a_viewables.append(
            selectCard({
                label:"Button",
                icon:`<i class="fas fa-mouse-pointer"></i>`,
                onclick:() => { this.hide(); card.replace("button"); }
            })
        )
        column_b_viewables.append(
            selectCard({
                label:"Video",
                icon:`<i class="fas fa-video"></i>`,
                onclick:() => { this.hide(); card.replace("video"); }
            })
        )

        section_viewables.append(column_a_viewables);
        section_viewables.append(column_b_viewables);
        body.append(section_viewables)

        this.element.append(body)

        this.selected_card = card;

        this.show()
    }

    showVideoChanger(){
        this.element.html("")

        let splashVideo = $('.sheet .splash--video')

        // Header
        let header = $(`
            <div class="hero is-colorful mb-2">
                <div class="hero-body" style="padding-top:2rem!important;padding-bottom:2rem!important;">
                    <h1 class="title has-text-white is-size-3 mb-0">
                        Edit Main Video
                    </h1>
                </div>
            </div>
        `)
        this.element.append(header)

        let body = $('<div class="px-4 pb-4 pt-0"></div>'),
        header_toolbar = $('<div class="twobox is-spaced mb-4"></div>')
    
        body.append(header_toolbar)

        let vp = new VideoParser({ key:this.paper.sheet.video.key, type:this.paper.sheet.video.type });
        let ifr = vp.getIframe();
        let preview_pane = $(`<div class="field"></div>`)
        if(ifr){
            preview_pane.html(`
                <label class="label">Video Preview:</label>
                <figure class="image is-16by9">
                    ${ifr}
                </figure>
            `)
        }

        let url_label = $(`<label class="label">Video Link:</label>`)
        let url = this.createBoundInput({
            label:" ",
            value:this.paper.sheet.video.enabled?vp.getLink():''
        }, v => {
            let e = vp.parse(v)
            if(e.success){
                preview_pane.html(`
                    <label class="label">Video Preview:</label>
                    <figure class="image is-16by9">
                        ${e.iframe}
                    </figure>
                `)
                this.paper.sheet.video.key = e.key;
                this.paper.sheet.video.type = e.type;

                splashVideo.find('.image.is-16by9').html(e.iframe)
            }
            else{
                preview_pane.html(`
                <article class="message is-danger">
                    <div class="message-body">
                        Please enter a valid link!
                        <br>(Youtube or Vimeo supported)
                    </div>
                </article>
                `)
                this.paper.sheet.video.key = '';
                this.paper.sheet.video.type = '';

                splashVideo.find('.image.is-16by9').html(`<img src="${_DOMAIN}/images/video_placeholder.gif">`)
            }
        })

        if(!this.paper.sheet.video.enabled){
            url.addClass('is-disabled')
            url_label.addClass('is-disabled')
            preview_pane.addClass('is-disabled')
        }

        let videoEnabler = this.createBoundSwitch({
            label:"Enable page video",
            checked:this.paper.sheet.video.enabled
        }, checked => {
            this.paper.sheet.video.enabled = checked
            if(checked){
                url.removeClass('is-disabled')
                url_label.removeClass('is-disabled')
                preview_pane.removeClass('is-disabled')

                splashVideo.removeClass('is-disabled')
            }
            else{
                url.addClass('is-disabled')
                url_label.addClass('is-disabled')
                preview_pane.addClass('is-disabled')

                splashVideo.addClass('is-disabled')
            }
        })

        body.append(videoEnabler)
        body.append(url_label)
        body.append(url)
        body.append(preview_pane)
        
        this.element.append(body)
        header_toolbar.append( this.createMobileCloseButton() )
        
        this.show()
    }
    showSettingsChanger(){
        
        this.element.html("")

        // Header
        let header = $(`
            <div class="hero is-colorful mb-2">
                <div class="hero-body" style="padding-top:2rem!important;padding-bottom:2rem!important;">
                    <h1 class="title has-text-white is-size-3 mb-0">
                        Sheet Settings
                    </h1>
                </div>
            </div>
        `)
        this.element.append(header)

        let body = $('<div class="px-4 pb-4 pt-0"></div>'),
        header_toolbar = $('<div class="twobox is-spaced mb-4"></div>')
    
        body.append(header_toolbar)

        let sheetname = this.createBoundInput({
            label:`Sheet Name:`,
            help:`(For your reference only, not visible to anyone else)`,
            placeholder:"Enter a name",
            value:this.paper.sheet.sheetname
        }, v => {
            this.paper.sheet.sheetname = v;
        })

        body.append(sheetname);

        let messages = {
            "private":"This sheet is only visible to you.",
            "password":"Your students will be asked to enter a password before they can view the sheet.",
            "public":"Anyone on the web can access this page.",
        }

        let sheet_password = this.createBoundInput({
            label:"Sheet Password:",
            placeholder:"Enter a password",
            value:this.paper.sheet.sheet_password
        }, v => {
            this.paper.sheet.sheet_password = v;
        })

        let privacy_message = $(`
            <div class="field message is-info">
                <div class="message-body">
                    ${ messages[this.paper.sheet.privacy] }
                </div>
            </div>
        `)

        sheet_password.toggleClass('is-hidden', !(this.paper.sheet.privacy == 'password'))

        let privacy = this.createBoundDropdown({
            label:"Sheet Privacy:",
            options:[
                { text:"Private", value:"private", default:(this.paper.sheet.privacy == 'private')?true:false },
                { text:"Password Protected", value:"password", default:(this.paper.sheet.privacy == 'password')?true:false },
                { text:"Public", value:"public", default:(this.paper.sheet.privacy == 'public')?true:false }
            ]
        }, v => {
            this.paper.sheet.privacy = v;
            sheet_password.toggleClass('is-hidden', !(v == 'password'))
            privacy_message.find('.message-body').html(messages[v])
        })

        body.append(privacy);
        body.append(sheet_password)
        body.append(privacy_message)

        body.append(`<div class="is-divider" data-content="Due Date"></div>`)

        let date_enabled = (this.paper.sheet.due_date.enabled)

        let startDate = date_enabled ? 
            moment(this.paper.sheet.due_date.date).toDate()
            : moment().add('1', 'hour').subtract(moment().format('mm'), 'minutes').toDate();

        let date_fields = $(`
        <div class="field ${date_enabled?'':'is-disabled'}">
            <div class="field is-horizontal sheet-date mb-0">
                <div class="field-body">
                    <div class="field" style="width:0px;" data-type="date">
                        <p class="control is-expanded"><input class="input" type="date" name="date"/></p>
                    </div>
                    <div class="field" style="width:0px;" data-type="time">
                        <p class="control is-expanded"><input class="input" type="date" name="time"/></p>
                    </div>
                </div>
            </div>
            <p class="help">
                The timezone is set to your local time
            </p>
        </div>`);

        let date_picker = date_fields.find('input[name=date]').get()[0],
            time_picker = date_fields.find('input[name=time]').get()[0]

        let setTheTime = (time, type) => {
            time = moment(time);
            let m = moment(this.paper.sheet.due_date.date)
            if(type == "time"){ m.hour(time.hour()); m.minute(time.minute()); m.second(0); m.millisecond(0); }
            if(type == "date"){ m.year(time.year()); m.month(time.month()); m.date(time.date()); }
            this.paper.sheet.due_date.date = m.toISOString()
        }

        bulmaCalendar.attach(date_picker, {
            displayMode:'dialog',
            type: 'date',
            color: 'primary',
            isRange: false,
            validateLabel:'Save',
            allowSameDayRange: true,
            lang: 'en-US',
            closeOnSelect:false,
            startDate,
            start:startDate,
            endDate: undefined,
            date: startDate,
            minDate: new Date(),
            maxDate: null,
            enableMonthSwitch: true,
            displayYearsCount: 5,
            minuteSteps:15,
        })
        date_picker.bulmaCalendar.on('validate', ({ timeStamp }) => { setTheTime(timeStamp, 'date') })
        // Prevent opening dialog if due_date disabled
        date_picker.bulmaCalendar.on('show', (event) => { if(!date_enabled){ date_picker.bulmaCalendar.hide() } })

        bulmaCalendar.attach(time_picker, {
            displayMode:'dialog',
            type: 'time',
            color: 'primary',
            validateLabel:'Save',
            closeOnSelect:false,
            start:startDate
        })
        time_picker.bulmaCalendar.on('validate', ({ timeStamp }) => { setTheTime(timeStamp, 'time') })
        // Prevent opening dialog if due_date disabled
        time_picker.bulmaCalendar.on('show', (event) => { if(!date_enabled){ time_picker.bulmaCalendar.hide() } })

        let due_date_toggle = this.createBoundSwitch({
            label:"Enable Due Date",
            checked:this.paper.sheet.due_date.enabled
        }, checked => {
            this.paper.sheet.due_date.enabled = checked;
            date_enabled = checked;
            date_fields.toggleClass('is-disabled', !checked)
        })

        body.append(due_date_toggle)
        body.append(date_fields)

        /* Preload all timezones from --> https://momentjs.com/timezone/
        let zone_picker = this.createBoundDropdown({
            label:`Due Date Timezone`,
            options:[
                { text:"America/Denver",   value:"DEN" },
                { text:"America/Mountain", value:"MST", default:true }
            ]
        })*/

        //body.append(`<div class="is-divider" data-content="Other"></div>`)

        this.element.append(body)
        header_toolbar.append( this.createMobileCloseButton() )
        
        this.show()
    }
    showThemeChanger(){
        this.element.html("")

        // Header
        let header = $(`
            <div class="hero is-colorful mb-2">
                <div class="hero-body" style="padding-top:2rem!important;padding-bottom:2rem!important;">
                    <h1 class="title has-text-white is-size-3 mb-0">
                        Change Theme
                    </h1>
                </div>
            </div>
        `)
        this.element.append(header)

        let body = $('<div class="p-4"></div>'),
        header_toolbar = $('<div class="twobox is-spaced mb-4"></div>')
    
        body.append(header_toolbar)

        body.append(`
            <div>
                <h1 class="title is-size-5 mb-0">
                    Layout
                </h1>
                <hr class="mt-3 mb-4">
            </div>
        `)

        let splash = $('.sheet .section.splash')
        let layout = this.createBoundButtonGroup({
            label:" ",
            toggleGroup:true,
            buttons:[
                {
                    icon:"fas fa-arrows-alt-h",
                    label:"Side by side",
                    value:"splash-standard",
                    selected:(this.paper.sheet.theme.layout == "splash-standard")?true:false
                },
                {
                    icon:"fas fa-arrows-alt-v",
                    label:"Stacked",
                    value:"splash-stacked",
                    selected:(this.paper.sheet.theme.layout == "splash-stacked")?true:false
                }
            ],
            onChange:v => {
                this.paper.sheet.theme.layout = v;
                splash
                    .removeClass('splash-stacked')
                    .removeClass('splash-standard')
                    .addClass(v)
            }
        })

        body.append(layout)

        body.append(`
            <div>
                <h1 class="title is-size-5 mb-0">
                    Background Color
                </h1>
                <hr class="mt-3 mb-4">
            </div>
        `)

        let splash_title = splash.find('.title.invisibleEditor'),
            splash_subti = splash.find('.subtitle.invisibleEditor')

        let foundColor = null;

        let callback = ({ hex, colorlight }) => {
            // Set check
            if(foundColor){ foundColor.css('color', 'transparent') }

            splash
                .css("background", hex)
                .css("color", `rgb(${colorlight})`)

            splash_title.css("color", `rgb(${colorlight})`)
            splash_subti.css("color", `rgb(${colorlight})`)

            this.paper.sheet.theme.background = hex
        }

        let createBoundColorTile = (color) => {
            let f = $(`<a class="button" style="background:${color}; width:14%; margin:0 auto 4px 4px; color:transparent;"><span class="icon"><i class="fas fa-check"></i></span></a>`);

            // Checked by default?
            if(this.paper.sheet.theme.background == color){
                f.css("color", "white"); foundColor = f;
            }

            f.click(() => {
                f.css('color', 'white'); foundColor = f;
                
                // Update the sheet
                callback({ hex:color, colorlight:calculateColorlight(color) })
            })

            return f;
        }

        let colortiles_A = $(`<div></div>`),
            colortiles_B = $(`<div></div>`)

        colortiles_A.append( createBoundColorTile('#920e13') )
        colortiles_A.append( createBoundColorTile('#bb4db1') )
        colortiles_A.append( createBoundColorTile('#cf8a2f') )
        colortiles_A.append( createBoundColorTile('#fff7ba') )
        colortiles_A.append( createBoundColorTile('#2d9c4c') )
        colortiles_A.append( createBoundColorTile('#1c6829') )
        colortiles_B.append( createBoundColorTile('#009fa5') )
        colortiles_B.append( createBoundColorTile('#1F3A8A') )
        colortiles_B.append( createBoundColorTile('#553270') )
        colortiles_B.append( createBoundColorTile('#bbbbbd') )
        colortiles_B.append( createBoundColorTile('#616772') )
        colortiles_B.append( createBoundColorTile('#1E1E24') )

        body.append(colortiles_A)
        body.append(colortiles_B)

        let splash_color = this.createBoundColorpicker({
            label:"Custom Color:",
            value:this.paper.sheet.theme.background
        }, callback)

        if(!foundColor){
            // Put check mark over splash_color "custom color" button?
        }

        body.append(splash_color)

        body.append('<div class="is-divider" data-content="Branding"></div>')

        let logo_chooser = $(`<div class="block is-relative">
            <div class="field">
                <label class="label">Change logo on worksheet</label>
                <p class="control">
                    <div class="file is-normal is-boxed has-name" style="font-size:0.9em;">
                        <label class="file-label" style="width:100%;">
                            <span class="file-cta">
                                <figure class="image is-96x96 is-centered">
                                    <img src="${this.paper.sheet.theme.logo}"/>
                                </figure>
                            </span>
                            <div class="buttons is-fullwidth m-0 has-addons">
                                <a class="button is-primary is-normal is-fullwidth m-0 pickNew" style="border-radius:0 0 4px 4px;">
                                    <span class="file-icon">
                                        <i class="fas fa-upload"></i>
                                    </span>
                                    <span class="file-label">
                                        Select a new image
                                    </span>
                                </a>
                                ${
                                    this.paper.sheet.theme.logo == _DOMAIN + '/images/logo.svg' ? '' :
                                    `<a class="button is-danger is-normal is-fullwidth m-0 resetButton">
                                        <span class="icon">
                                            <i class="fas fa-trash-alt"></i>
                                        </span>
                                        <span>Reset To Default</span>
                                    </a>`
                                }
                                <a class="button is-info is-light is-normal is-fullwidth m-0 setDefaultLogo ${this.paper.sheet.theme.logo == default_logo ? 'is-hidden' : ''}">
                                    <span class="icon">
                                        <i class="fas fa-hammer"></i>
                                    </span>
                                    <span>Set As Default</span>
                                </a>
                            </div>
                        </label>
                    </div>
                </p>
            </div>
        </div>`)

        if(_PLAN != 'free'){

            let file_chooser = logo_chooser.find('input'),
            file_chooser_button_A = logo_chooser.find('.file.is-normal .file-cta'),
            file_chooser_button_B = logo_chooser.find('.file.is-normal .button.pickNew'),
            file_chooser_reset = logo_chooser.find('.file.is-normal .button.resetButton'),
            file_chooser_setDefault = logo_chooser.find('.file.is-normal .button.setDefaultLogo')

        let f = () => {
            this.hide();
            if(!window.photoLibrary){ window.photoLibrary = new PhotoLibrary() }
            window.photoLibrary.onSelect((url) => {
                this.paper.sheet.theme.logo = url;
                this.showThemeChanger();
            })
            window.photoLibrary.render()
        }

        file_chooser_button_A.click(f)
        file_chooser_button_B.click(f)

        file_chooser_reset.click(() => {
            let url = _DOMAIN + '/images/logo.svg'
            this.paper.sheet.theme.logo = url
            logo_chooser.find('figure.image img').attr('src', url);
            file_chooser_reset.remove()
            file_chooser_setDefault.removeClass('is-hidden')
        })

        file_chooser_setDefault.click(async () => {
            file_chooser_setDefault.addClass('is-loading')
            let p = await $POST('/setDefault/logo', { value:this.paper.sheet.theme.logo })
            default_logo = this.paper.sheet.theme.logo
            if(p.status != 200){ console.log({ failed_request:p }) }
            file_chooser_setDefault.addClass('is-hidden');
            file_chooser_setDefault.removeClass('is-loading')
        })
        
        // <input class="file-input" type="file" name="resume">
        /*
        file_chooser.on('change', async () => {
            showLoading("Please wait while we upload your image.")
            let file = file_chooser.prop('files')[0]
            let upload = await PhotoLibrary.oneShotUpload(file, 'logo')
            hideLoading();

            if(!upload.success && upload.message){ toast(upload.message, 'danger', true, false); }
    
            this.paper.sheet.theme.logo = upload.url;
            logo_chooser.find('figure.image img').attr('src', upload.url);
        })*/
        }
        else{
            logo_chooser.click(() => promptToUpgrade())
            logo_chooser.find('.field').addClass('candisable is-disabled is-clickable')
            logo_chooser.prepend(
                `<p class="upgrade-badge is-floating is-right"><span class="icon is-small">
                <svg xmlns="http://www.w3.org/2000/svg" fill="white" width="86.82" height="86.48" viewBox="0 0 86.82 86.48"><path d="M18.08,17.26,26.93,1.07a2.06,2.06,0,0,1,3.62,0L39.4,17.26a2.15,2.15,0,0,0,.82.82L56.4,26.93a2.06,2.06,0,0,1,0,3.62L40.22,39.4a2.15,2.15,0,0,0-.82.82L30.55,56.4a2.06,2.06,0,0,1-3.62,0L18.08,40.22a2.15,2.15,0,0,0-.82-.82L1.07,30.55a2.06,2.06,0,0,1,0-3.62l16.19-8.85A2.15,2.15,0,0,0,18.08,17.26Z"/><path d="M59.3,52.74l6.21-11.35a1.4,1.4,0,0,1,2.46,0l6.21,11.35a1.37,1.37,0,0,0,.56.56l11.35,6.21a1.4,1.4,0,0,1,0,2.46L74.74,68.18a1.37,1.37,0,0,0-.56.56L68,80.09a1.4,1.4,0,0,1-2.46,0L59.3,68.74a1.37,1.37,0,0,0-.56-.56L47.39,62a1.4,1.4,0,0,1,0-2.46L58.74,53.3A1.37,1.37,0,0,0,59.3,52.74Z"/><path d="M8.51,66.89l3.87-7.08a1.55,1.55,0,0,1,2.72,0L19,66.89a1.54,1.54,0,0,0,.62.62l7.08,3.87a1.55,1.55,0,0,1,0,2.72L19.59,78a1.54,1.54,0,0,0-.62.62L15.1,85.67a1.55,1.55,0,0,1-2.72,0L8.51,78.59A1.54,1.54,0,0,0,7.89,78L.81,74.1a1.55,1.55,0,0,1,0-2.72l7.08-3.87A1.54,1.54,0,0,0,8.51,66.89Z"/></svg>
                </span><span>Pro</span></p>`
            )
        }

        body.append(logo_chooser)

        let brand_name_holder = $(`<div class="field is-relative"></div>`)

        let brand_name_setDefault = $(`<a class="help has-text-right is-hidden">Set As Default?</a>`)
        if(this.paper.sheet.theme.title != default_brand){ brand_name_setDefault.removeClass('is-hidden') }

        let brand_name = this.createBoundInput({
            label:"Worksheet Brand Title",
            value:this.paper.sheet.theme.title,
            placeholder:"Your organization's name"
        }, text => {
            if(_PLAN == 'free'){ return; }
            this.paper.sheet.theme.title = text;
            brand_name_setDefault.removeClass('is-hidden')
        })

        if(_PLAN != 'free'){
            if(this.paper.sheet.theme.title != default_brand){ brand_name_setDefault.removeClass('is-hidden') }

            brand_name_setDefault.click(async () => {
                brand_name_setDefault.addClass('is-loading')
                let p = await $POST('/setDefault/brandTitle', { value:this.paper.sheet.theme.title })
                default_brand = this.paper.sheet.theme.title
                if(p.status != 200){ console.log({ failed_request:p }) }
                brand_name_setDefault.addClass('is-hidden');
                brand_name_setDefault.removeClass('is-loading')
            })
        }
        else{
            brand_name.click(() => { this.hide(); promptToUpgrade(); })
            brand_name.addClass('candisable is-disabled is-clickable')
            brand_name_holder.prepend(
                `<p class="upgrade-badge is-floating is-right"><span class="icon is-small">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="white" width="86.82" height="86.48" viewBox="0 0 86.82 86.48"><path d="M18.08,17.26,26.93,1.07a2.06,2.06,0,0,1,3.62,0L39.4,17.26a2.15,2.15,0,0,0,.82.82L56.4,26.93a2.06,2.06,0,0,1,0,3.62L40.22,39.4a2.15,2.15,0,0,0-.82.82L30.55,56.4a2.06,2.06,0,0,1-3.62,0L18.08,40.22a2.15,2.15,0,0,0-.82-.82L1.07,30.55a2.06,2.06,0,0,1,0-3.62l16.19-8.85A2.15,2.15,0,0,0,18.08,17.26Z"/><path d="M59.3,52.74l6.21-11.35a1.4,1.4,0,0,1,2.46,0l6.21,11.35a1.37,1.37,0,0,0,.56.56l11.35,6.21a1.4,1.4,0,0,1,0,2.46L74.74,68.18a1.37,1.37,0,0,0-.56.56L68,80.09a1.4,1.4,0,0,1-2.46,0L59.3,68.74a1.37,1.37,0,0,0-.56-.56L47.39,62a1.4,1.4,0,0,1,0-2.46L58.74,53.3A1.37,1.37,0,0,0,59.3,52.74Z"/><path d="M8.51,66.89l3.87-7.08a1.55,1.55,0,0,1,2.72,0L19,66.89a1.54,1.54,0,0,0,.62.62l7.08,3.87a1.55,1.55,0,0,1,0,2.72L19.59,78a1.54,1.54,0,0,0-.62.62L15.1,85.67a1.55,1.55,0,0,1-2.72,0L8.51,78.59A1.54,1.54,0,0,0,7.89,78L.81,74.1a1.55,1.55,0,0,1,0-2.72l7.08-3.87A1.54,1.54,0,0,0,8.51,66.89Z"/></svg>
                </span><span>Pro</span></p>`
            )
        }

        brand_name_holder.append(brand_name)

        body.append(brand_name_holder)
        body.append(brand_name_setDefault)

        this.element.append(body)
        
        header_toolbar.append( this.createMobileCloseButton() )
        
        this.show()
    }

    editCard(card){
        if(!card || !(card instanceof Card)){ throw new Error("Cannot editCard without a proper card object!"); }
        this.element.html("")
        
        if(this.selected_card && this.selected_card != card){ this.hide() }

        let data = card.data;

        // Header
        let header = $(`
            <div class="hero is-colorful">
                <div class="hero-body">
                    <h1 class="title is-size-3 mb-0 has-text-white">Edit Question</h1>
                </div>
            </div>
        `)
        this.element.append(header)

        let body = $('<div class="p-4"></div>'),
            header_toolbar = $('<div class="twobox is-spaced mb-4"></div>')
        
        body.append(header_toolbar)
        this.element.append(body)

        // Partially global code
        
        // Images
        let photo_chooser_parent = $(`<div class="field has-addons is-fullwidth-mobile"></div>`)
        let photo_chooser = $(`
            <a class="button is-dark is-fullwidth-mobile">
                <span class="icon">
                    <i class="${ data.card_img ? 'fas fa-sync-alt' : 'fas fa-photo-video' }"></i>
                </span>
                <span>
                    ${data.card_img ? 'Change image' : 'Add image'}
                </span>
            </a>
        `)
        if(['card', 'multiline', 'multichoice', 'dropdown'].includes(data.type)){
            if(_PLAN == 'free'){
                photo_chooser.attr("disabled", "true")
                photo_chooser.addClass('is-clickable')
                photo_chooser_parent.addClass('is-relative')
                photo_chooser_parent.prepend(
                    `<p class="upgrade-badge is-floating is-right-corner no-hover is-tiny"><span class="icon is-small">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="white" width="86.82" height="86.48" viewBox="0 0 86.82 86.48"><path d="M18.08,17.26,26.93,1.07a2.06,2.06,0,0,1,3.62,0L39.4,17.26a2.15,2.15,0,0,0,.82.82L56.4,26.93a2.06,2.06,0,0,1,0,3.62L40.22,39.4a2.15,2.15,0,0,0-.82.82L30.55,56.4a2.06,2.06,0,0,1-3.62,0L18.08,40.22a2.15,2.15,0,0,0-.82-.82L1.07,30.55a2.06,2.06,0,0,1,0-3.62l16.19-8.85A2.15,2.15,0,0,0,18.08,17.26Z"/><path d="M59.3,52.74l6.21-11.35a1.4,1.4,0,0,1,2.46,0l6.21,11.35a1.37,1.37,0,0,0,.56.56l11.35,6.21a1.4,1.4,0,0,1,0,2.46L74.74,68.18a1.37,1.37,0,0,0-.56.56L68,80.09a1.4,1.4,0,0,1-2.46,0L59.3,68.74a1.37,1.37,0,0,0-.56-.56L47.39,62a1.4,1.4,0,0,1,0-2.46L58.74,53.3A1.37,1.37,0,0,0,59.3,52.74Z"/><path d="M8.51,66.89l3.87-7.08a1.55,1.55,0,0,1,2.72,0L19,66.89a1.54,1.54,0,0,0,.62.62l7.08,3.87a1.55,1.55,0,0,1,0,2.72L19.59,78a1.54,1.54,0,0,0-.62.62L15.1,85.67a1.55,1.55,0,0,1-2.72,0L8.51,78.59A1.54,1.54,0,0,0,7.89,78L.81,74.1a1.55,1.55,0,0,1,0-2.72l7.08-3.87A1.54,1.54,0,0,0,8.51,66.89Z"/></svg>
                    </span><span>Pro</span></p>`
                )
            }
            photo_chooser.click(() => {
                if(_PLAN == 'free'){
                    promptToUpgrade();
                    this.hide()
                    return;
                }
                this.hide()
                if(!window.photoLibrary){
                    window.photoLibrary = new PhotoLibrary()
                }
                window.photoLibrary.onSelect((url) => { card.addImage(url) })
                window.photoLibrary.render()
            })
        }
        else{
            //photo_chooser.attr('disabled', "true")
            photo_chooser = $('<div></div>')
        }

        photo_chooser_parent.append(photo_chooser)
        header_toolbar.append(photo_chooser_parent)

        // Card specific code
        if(data.type == 'card'){
            let hint = this.createBoundInput({
                label:"Answer Hint",
                value:card.data.hint,
                placeholder:"Hint what you want them to do"
            }, v => { card.data.hint = v; card.element.find('textarea').attr('placeholder', v) })
            
            body.append(hint)
        }
        if(data.type == 'multiline'){
            card.data.options.forEach((question, index) => {
                let sub_question, sub_answer;
                card.data.options[index].id = crypto.randomUUID();

                sub_question = this.createBoundInput({
                    label:`Question #${index+1}`,
                    value:card.data.options[index].label,
                    placeholder:`Question #${index+1}`,
                    style:"is-expanded",
                    canDelete:true,
                    onDelete:() => {
                        let question_index = card.data.options.findIndex(c => c.id == card.data.options[index].id)

                        if(question_index >= 0){
                            card.element.find(`.multiline-item[data-index=${index}]`).remove()
                            card.data.options.splice(question_index, 1)
                            sub_question.remove()
                            //sub_answer.remove()
                        }
                    }
                }, v => {
                    card.data.options[index].label = v;
                    card.element.find(`.multiline-item[data-index=${index}] input`).attr('placeholder', v)
                })

                sub_answer = this.createBoundInput({
                    label:'',
                    value:card.data.options[index].correct,
                    placeholder:`Correct answer (optional)`,
                    style:"indented-1"
                }, v => {
                    card.data.options[index].correct = v;
                })
                
                body.append(sub_question)
                //body.append(sub_answer)
            });

            let buttons = $('<div class="buttons pt-4"></div>')

            let add_button = $(`
                <a class="button is-info is-outlined is-fullwidth">
                    <span class="icon">
                        <i class="fas fa-plus"></i>
                    </span>
                    <span>Add Item</span>
                </a>
            `)

            add_button.click(() => {
                let index = card.data.options.length;

                let new_card = {
                    id:crypto.randomUUID(),
                    label:`Question #${index + 1}`,
                    correct:""
                }
                card.data.options.push(new_card)

                let sub_question, sub_answer;
                sub_question = this.createBoundInput({
                    label:`Question #${index + 1}`,
                    value:new_card.label,
                    placeholder:`Question #${index + 1}`,
                    style:"is-expanded",
                    canDelete:true,
                    onDelete:() => {
                        let question_index = card.data.options.findIndex(c => c.id == new_card.id)

                        if(question_index >= 0){
                            card.element.find(`.multiline-item[data-index=${index}]`).remove()
                            card.data.options.splice(question_index, 1)
                            sub_question.remove()
                            //sub_answer.remove()
                        }
                    }
                }, v => {
                    card.data.options[index].label = v;
                    card.element.find(`.multiline-item[data-index=${index}] input`).attr('placeholder', v)
                })

                sub_answer = this.createBoundInput({
                    label:'',
                    value:card.data.options[index].correct,
                    placeholder:`Correct answer (optional)`,
                    style:"indented-1"
                }, v => {
                    card.data.options[index].correct = v;
                })

                let new_line_item = $(`
                    <div class="field multiline-item" data-index="${index}">
                        <label class="label is-hidden"> Branch #1 </label>
                            <div class="control">
                            <input class="input" type="text" placeholder="Branch #${index + 1}" maxlength="200">
                        </div>
                    </div>
                `)

                card.element.find('.edit-question>div').append(new_line_item);
                
                sub_question.insertBefore(buttons)
                //sub_answer.insertBefore(buttons)
            })

            buttons.append(add_button)

            body.append(buttons)
        }
        if(data.type == 'multichoice'){
            for(let i=1;i<=4;i++){
                if(!card.data[`option_${i}`]){ continue; }
                let option = this.createBoundInput({
                    label:`Option ${i}`,
                    value:card.data[`option_${i}`],
                    placeholder:`Option ${i}`,
                }, v => {
                    card.element.find(`input[data-type=option_${i}]`).next().text(v);
                    card.data[`option_${i}`] = v;
                })

                body.append(option)
            }


        }
        if(data.type == 'dropdown'){

            let label = this.createBoundInput({
                    label:'Dropdown Label:',
                    value:card.data.label,
                    placeholder:`Select an option below`,
                }, v => {
                    card.data.label = v;
                    card.element.find('.label').text(v)
                })
            body.append(label);

            let createDropdown = (choice, index) => {
                //console.log({ choice, index })
                let question = this.createBoundInput({
                    label:`Option #${index+1}`,
                    value:choice.label,
                    placeholder:`Option #${index+1}`,
                    style:"is-expanded",
                    canDelete:true,
                    onDelete:() => {
                        let question_index = card.data.options.findIndex(c => c.id == choice.id)

                        if(question_index >= 0){
                            card.element.find(`option#${choice.id}`).remove()
                            card.data.options.splice(question_index, 1)
                            question.remove()
                        }
                    }
                }, v => {
                    card.data.options[index].label = v;
                    card.element.find(`option#${choice.id}`).text(v)
                })
                return question
            }

            card.data.options.forEach((choice, index) => {
                let q = createDropdown(choice, index)
                body.append(q)
            })

            let buttons = $(`<div class="buttons"></div>`)
            let add_button = $(`
                <a class="button is-info is-outlined is-fullwidth">
                    <span class="icon">
                        <i class="fas fa-plus"></i>
                    </span>
                    <span>Add Item</span>
                </a>
            `)

            add_button.click(() => {

                let theIndex = card.data.options.length

                let new_index = {
                    label:`Option ${theIndex}`,
                    value:`Option ${theIndex}`,
                    default:false,
                    id:crypto.randomUUID()
                }
                card.data.options.push(new_index)

                let el = $(`
                    <option id="${new_index.id}" value="${theIndex}">
                        Option ${theIndex}
                    </option>
                `)
                card.element.find('select').append(el)

                let q = createDropdown(new_index, theIndex - 1)
                q.insertBefore(buttons)
            })

            buttons.append(add_button)

            body.append(buttons)

        }
        if(data.type == 'button'){

            let size_picker = this.createBoundButtonGroup({
                label:"Button size",
                toggleGroup:true,
                buttons:[
                    { value:"small",  label:"Small",  selected:card.data.options.size == "small"  ?true:false },
                    { value:"normal", label:"Normal", selected:card.data.options.size == "normal" ?true:false  },
                    { value:"large",  label:"Large",  selected:card.data.options.size == "large"  ?true:false }
                ],
                onChange:v => {
                    card.data.options.size = v;
                    card.element.find('.button')
                        .removeClass('is-small')
                        .removeClass('is-normal')
                        .removeClass('is-large')
                        .addClass(`is-${v}`)
                }
            })
            body.append(size_picker)

            let text = this.createBoundInput({
                    label:'Button text',
                    value:card.data.options.label,
                    placeholder:`Button text`,
                }, v => {
                    card.data.options.label = v;
                    card.element.find('.button span:not(.icon)').text(v);
                })
            body.append(text);

            let href = this.createBoundInput({
                    label:'Button link',
                    value:card.data.options.href,
                    placeholder:`https://google.com/`,
                }, v => {
                    card.data.options.href = v;
                })
            body.append(href);

            let button = card.element.find('.button')
            let color = this.createBoundColorpicker({
                label:"Button color:",
                value:card.data.options.color
            }, ({ hex, colorlight }) => {
                button
                    .css('background', hex)
                    .css('color', `rgb(${colorlight})`)
                card.data.options.color = hex;
            })
            body.append(color);

            let target = this.createBoundDropdown({
                    label:'Link behavior:',
                    options:[
                        { text:"Open link in the same tab", value:"_self" },
                        { text:"Open link in a new tab", value:"_blank", default:true }
                    ]
                },
                v => {
                    card.data.options.target = v;
                })
            body.append(target);

        }
        if(data.type == 'video'){
            let vpg = new VideoParser({ key:card.data.video_key, type:card.data.video_type })
            //console.log(vpg.getEmbed())
            let figure = $('<figure class="image is-16by9"></figure>'),
                iframe = $(vpg.getIframe())
            //console.log({ key:card.data.video_key, type:card.data.type }) // https://www.youtube.com/watch?v=JfVOs4VSpmA&ab_channel=SonyPicturesEntertainment
            figure.append(iframe)
            
            let url = this.createBoundInput({
                label:"YouTube or Vimeo link",
                value:vpg.getLink(),
                placeholder:"Video URL"
            }, v => {
                let vp = new VideoParser(),
                    keys = vp.parse(v)
                if(keys && keys.success){
                    card.data.video_type = keys.type;
                    card.data.video_key = keys.key;
                    card.element.find('iframe').attr('src', keys.embed)
                    iframe.attr('src', keys.embed)
                }
                else{
                    card.data.video_type = "";
                    card.data.video_key = "";
                    card.element.find('iframe').attr('src', '')
                    iframe.attr('src', '')
                }
            })
            
            body.append(url)
            
            body.append( `<label class="label mt-4">Preview video:</label>` )
            body.append(figure)
        }

        let remove_self_button = $(`
            <a class="field button is-dark is-fullwidth-mobile">
                <span class="icon">
                    <i class="fas fa-trash-alt"></i>
                </span>
                <span>Remove</span>
            </a>
        `)

        remove_self_button.click(() => {
            if(!confirm("Are you sure you want to delete this question?")){ return; }

            this.hide();
            card.replace('blank');
        })

        header_toolbar.append(remove_self_button)

        header_toolbar.append( this.createMobileCloseButton() )

        this.selected_card = card;
        this.show()
    }
};