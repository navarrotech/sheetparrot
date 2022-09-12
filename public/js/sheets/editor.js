var PAPER,
    SHEET = {},
    IS_PUBLIC_EDITOR = !_ID?true:false;

let _SAVE = $('[action=save]'),
    _PREVIEW = $('[action=preview]'),
    _ROOT = $('#root')

var unsavedChanges = false; 

let autosave_key = 'SP_publicEditor'
function clearPublicAutosave(){
    localStorage.removeItem(autosave_key)
    return true;
}
function savePublicAutosave(){
    localStorage.setItem(autosave_key, JSON.stringify(SHEET))
    return true;
}
function reloadPublicAutosave(){
    let s = localStorage.getItem(autosave_key)
    if(s){ return JSON.parse(s); }
    return null;
}

async function save(){
    _SAVE.addClass('is-loading')

    let req, res,
        color_status = 'is-success',
        icon_status = `<span class="icon"><i class="fa fa-check"></i></span>`;

    if(IS_PUBLIC_EDITOR){
        if(AUTHORIZED){
            // Create a new worksheet for them
            req = await $POST('/sheets/create', {})
            res = await req.json();

            if(req.status != 200){ console.error({ req, res }); return; }

            // Save their work!
            let edit_req = await $POST(`/sheet/v2/save?sheetid=${res.sheetid}`, PAPER.gatherSheet()),
                edit_res = await edit_req.json();

            if(edit_req.status != 200){ console.error({ edit_req, edit_res }); return; }

            await clearPublicAutosave();

            window.location.href = `${_DOMAIN}/sheet/v2/edit?sheetid=${res.sheetid}`;
            return;
        }
        else{
            console.log("Rendering signup modal now...")
            new Authenticator({
                type:"any",
                auth:"signup",
                subtitle:"Create a free account to save this worksheet.",
                allowSwitching:true,
                includeBox:false,
                redirect:false
            }).render()
            
            let modal = $(`<div class="modal is-active"><div class="modal-background" action="close"></div><div class="modal-card" style="max-width:400px;"><section class="modal-card-body px-0 is-rounded"></section></div></div>`)
                .on('click', '[action=close]', () => { modal.remove(); window.SheetParrot.Authenticator.onSuccess = () => {} })
    
            modal.find('.modal-card-body').append(window.SheetParrot.Authenticator.elements._root)
            window.SheetParrot.Authenticator.onSuccess = async () => {
                AUTHORIZED = true; 
                let req = await $POST('/sheets/create', {}),
                    res = await req.json();
    
                if(req.status != 200){ console.error({ req, res }); return; }
    
                // Save their work!
                let edit_req = await $POST(`/sheet/v2/save?sheetid=${res.sheetid}`, PAPER.gatherSheet()),
                    edit_res = await edit_req.json();
    
                if(edit_req.status != 200){ console.error({ edit_req, edit_res }); return; }
    
                await clearPublicAutosave();
                
                window.location.href = `${_DOMAIN}/dashboard` //`${_DOMAIN}/sheet/v2/edit?sheetid=${res.sheetid}`;
                return;
            }

            color_status = 'is-warning'
            icon_status = `<span class="icon"><i class="fa fa-exclamation"></i></span>`
    
            $('body').append(modal)
        }
    }
    else{
        req = await $POST(`/sheet/v2/save?sheetid=${_ID}`, PAPER.gatherSheet())
        res = await req.json()

        if(req.status != 200){ console.log({req, res}) }
    }

    _SAVE.removeClass('is-loading')
    _SAVE.addClass(color_status)
    _SAVE.removeClass('is-primary')
    _SAVE.html(icon_status)

    setTimeout(() => {
        _SAVE.removeClass(color_status)
        _SAVE.addClass('is-primary')
        _SAVE.html("<span class=\"icon\"><i class=\"fa fa-save\"></i></span><span>Save</span>")
    }, 800)

    unsavedChanges = false;
}
async function onChange(){
    await savePublicAutosave();
    unsavedChanges = true;
}

_SAVE.click(save)
if(_ID){ _PREVIEW.attr('href', `${_DOMAIN}/sheet/${_ID}`).attr('target', '_blank'); }
else{ _PREVIEW.find('.icon').html('<i class="fas fa-expand-alt"></i>') }

_PREVIEW.click(() => {
    if(_ID){ return true; }
    let superModal = $(`
            <div class="modal is-superModal is-active wait-animation">
                <div class="modal-background" style="opacity:0;"></div>
                <div class="modal-content">
                    <div class="box">
                        <div class="twobox is-spaced">
                            <div class="buttons mb-0">
                                <a class="button is-dark" action="close">
                                    <span class="icon">
                                        <i class="fas fa-xmark"></i>
                                    </span>
                                    <span>
                                        Close
                                    </span>
                                </a>
                            </div>
                            <div class="buttons is-right mb-0">
                                ${_ID?
                                `<a class="button is-light" action="openlink" href="${_DOMAIN}/sheet/${_ID}" target="_blank">
                                    <span class="icon">
                                        <i class="fas fa-external-link-alt"></i>
                                    </span>
                                    <span>
                                        Open in new tab
                                    </span>
                                </a>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `),
        preview_container = $(`<div></div>`)

    let preview_paper = new Paper({
        parent:preview_container,
        sheet:PAPER.sheet,
        paper:PAPER.gatherPaper(),
        mode:"normal"
    })

    superModal.find('.modal-content .box').append(preview_container)
    superModal.find('.button[action="close"]').click(() => {
        superModal.find('.modal-background').animate({ opacity:'0' })
        superModal.removeClass('animation-active');
        setTimeout(() => { superModal.remove() }, 600)
    })
    superModal.find('.modal-background').click(() => {
        superModal.find('.modal-background').animate({ opacity:'0' })
        superModal.removeClass('animation-active');
        setTimeout(() => { superModal.remove() }, 600)
    })
    preview_paper.render()

    $('body').append(superModal)
    superModal.ready(() => {
        superModal.find('.modal-background').animate({ opacity:'1' })
        superModal.addClass('animation-active')
    })
})

async function refresh(){

    if(_ID){
        let req = await $GET('/sheet/v2/get?sheetid='+_ID)
            SHEET = await req.json();
    }

    if(!SHEET || !Object.keys(SHEET).length){
        SHEET = reloadPublicAutosave()?reloadPublicAutosave():{
            "sheet_password": "",
            "sheetname": "New Sheet",
            "privacy": "public",
            "headline": "My new worksheet",
            "subheadline": "Click to edit the subtitle",
            "due_date": {
                "enabled": false,
                "date": 1641534830102,
                "allow_late_submissions": false
            },
            "video": {
                "enabled": false,
                "key": "",
                "type": ""
            },
            "theme": {
                "layout":"splash-standard",
                "logo":_DOMAIN + "/images/logo.svg",
                "background": "#1F3A8A",
                "layout":"splash-standard"
            },
            "paper": [
                [
                    {
                        "type": "multichoice",
                        "id": "card_" + crypto.randomUUID().slice(0,8),
                        "title": "Your question here",
                        "subtitle": "Select an option below",
                        "option_1": "Option 1",
                        "option_2": "Option 2",
                        "option_3": "Option 3",
                        "option_4": "Option 4",
                    },
                    {
                        "type": "multichoice",
                        "id": "card_" + crypto.randomUUID().slice(0,8),
                        "title": "Your question here",
                        "subtitle": "Select an option below",
                        "option_1": "Option 1",
                        "option_2": "Option 2",
                        "option_3": "Option 3",
                        "option_4": "Option 4",
                    },
                    {
                        "type": "video",
                        "id": "card_" + crypto.randomUUID().slice(0,8),
                        "title": "This video will teach you more!",
                        "subtitle": "Watch the video below",
                        "video_type": "vimeo",
                        "video_key": "640486262"
                    }
                ],
            ],
            "submission": {
                "message": "Thank you for your submitting your work! Once your work is graded, you can view it in your dashboard."
            },
            "stats": {
                "views":1,
                "uniques":1,
                "submissions":0,
                "graded_submissions":0
            },
            "history": [
                {
                    "who": _EMAIL?_EMAIL:'You',
                    "what": "Created Sheet",
                    "when": new Date()
                }
            ]
        }
    }

    $('.editor').html("")

    PAPER = new Paper({
        parent:$('.editor'),
        sheet:SHEET,
        paper:SHEET.paper,
        mode:"editable"
    });

    PAPER.render()

}

refresh();