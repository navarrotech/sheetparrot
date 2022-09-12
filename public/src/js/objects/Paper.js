var select_index = null;
class Paper{

    /* 
     * this.parent  = parent element that this element is a child of
     * this.element = root paper element
     * this.sheet   = database objects
     * this.paper   = paper data
     * this.cards   = array of all question cards
     */

    constructor(params={}){ 
        if(params.paper) { this.paper = params.paper  }
        if(params.sheet) { this.sheet = params.sheet  }
        if(params.parent){ this.parent = params.parent }
        if(params.autosave){ this.autosave = params.autosave; }
        if(params.disable_submit){ this.disable_submit = true; } else { this.disable_submit = false; }
        this.cards = []
        this.mode = params.mode ? params.mode : "default"
        this.elements = {
            paper:$(`<div class="paper ${(this.mode == "editable")?'is-editor':''}"></div>`),
            add_row:'<div class="tile is-ancestor"></div>'
        }
        if(this.mode == "editable"){
            let editor = new Editor(this)
            this.editor = editor
            window.editor = editor;
        }
        if(params.meta){ this.meta = params.meta; }
    }

    isAttached(){ return (this.parent)?true:false }

    isConnected(){ return (this.paper)?true:false }

    setData(paperObj){ this.paper = paperObj }

    render(){
        if(!this.isAttached()){ throw new Error("You must attach a parent to the sheet before you can render!"); }
        this.parent.html('')

        this.elements.root = $(`<div class="sheet is-${this.mode}"></div>`)

        if(this.mode == 'grader' && this.data.grade.finished){ this.elements.root.addClass('is-finished') }

        if(this.sheet){
            this.elements.root.append( this.renderSplash() )
        }
        
        // Submission 'your final grade' banner
        if(this.mode == 'submission'){
            // Ensure the proper metadata has been passed through
            if(this.meta && this.meta.submission){
                let subm = this.meta.submission
                // Ensure the progress is calculated
                if(!subm.grade){
                    let p = this.getProgress();
                    subm.grade = {
                        graded:p.graded || 0,
                        correct:p.correct || 0,
                        total:p.total,
                        percentage:p.grade_over_total,
                        finished:false
                    }
                }

                subm.grade.incorrect = Math.abs(subm.grade.correct - subm.grade.graded)
                
                let [ incorrect, correct ] = [
                    Math.round(((subm.grade.incorrect) / subm.grade.total) * 100),
                    Math.round((subm.grade.correct / subm.grade.total) * 100)
                ]

                // Create the banner
                let banner = $(`<div class="container is-max-desktop box block gradeBanner">
                    <div class="twobox">
                        <div class="halfbox">
                            ${
                                subm.grade.finished ? (`<p class="is-size-7">Final Grade:</p>
                                <h1 class="mb-2" style="line-height:1;">
                                    <b>
                                        <span class="superTitle percent">${subm.grade.percentage?subm.grade.percentage + '%':'--'}</span>
                                        <span class="superTitle is-size-2 letter">${subm.grade.percentage?'(' + Paper.getGradeLetter(subm.grade.percentage) + ')':''}</span>
                                    </b>
                                </h1>
                                <div class="multi-progress" style="max-width:260px; overflow:visible;">
                                    <div class="chunk is-success has-tooltip-bottom" style="width:${correct}%;"></div>
                                    <div class="chunk is-danger has-tooltip-bottom" style="width:${incorrect}%;"></div>
                                </div>`) : (`
                                    <h1 style="line-height:1;">
                                        <b>
                                            <span class="is-size-4 percent">Grading In Progress...</span>
                                        </b>
                                    </h1>
                                `)
                            }
                            
                        </div>
                        <div class="halfbox">
                            <p>
                                <b>Time Taken:</b>
                                <span>${fancyCase(moment.duration(subm.time, 's').humanize())}</span>
                            </p>
                            <p>
                                <b>Submitted:</b>
                                <span>${moment(subm.created).format('MMM Do [at] h:mma')}</span>
                            </p>
                        </div>
                    </div>
                </div>`);

                this.elements.root.append(banner)
            }
            else{ console.error("Cannot add submission without proper metadata!") }
        }
        
        if(this.paper){
            this.elements.root.append( this.renderPaper() );
        }

        this.parent.append(this.elements.root);
        return this.parent;
    }
    renderSplash(){
        if(!this.isAttached()){ throw new Error("You must attach a parent to the sheet before you can render!"); }

        if(this.mode == "editable"){

            this.elements.splash = $(`
                <section
                    class="section splash ${this.sheet.theme.layout}"
                    style="
                        background:${this.sheet.theme.background};
                        color:rgb(${calculateColorlight(this.sheet.theme.background)});
                    ">
                    <div class="container is-fullhd">
                        <div class="columns is-vcentered">
                            <div class="column">
                                <textarea class="title editLight has-text-centered-mobile" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.headline}</textarea>
                                <textarea class="subtitle editLight has-text-centered-mobile" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.subheadline}</textarea>
                            </div>
                        </div>
                    </div>
                </section>
            `)

            let video_column = this.elements.splash.find('.columns'),
                video;

            if(this.sheet.video.key && this.sheet.video.type){
                let vp = new VideoParser({
                    key:this.sheet.video.key,
                    type:this.sheet.video.type
                });
                video = $(`<div class="column is-5"><div class="splash--video ${ !this.sheet.video.enabled?'is-disabled':''}"><div class="image is-16by9">${vp.getIframe()}</div></div></div>`)
                video_column.append(video)
            }
            else{
                video = $(`<div class="column is-5"><div class="splash--video ${ !this.sheet.video.enabled?'is-disabled':''}"><div class="image is-16by9"><img src="${_DOMAIN}/images/video_placeholder.gif"/></div></div></div>`)
                video_column.append(video)
            }

            video.find('.splash--video').click(() => { this.editor.showVideoChanger(); })

            // Now to establish "editing tools"

            let title = this.elements.splash.find('.title'),
                subtitle = this.elements.splash.find('.subtitle')

            let title_changer = new InvisibleEditor({
                css:{
                    "padding-top":"5px",
                    "padding-bottom":"10px",
                    "font-weight":"600",
                },
                element:title
            })
            title_changer.onChange(v => this.sheet.headline = v)
            title_changer.attach()

            let subtitle_changer = new InvisibleEditor({
                css:{
                    "margin-top":"-1.5rem"
                },
                element:subtitle
            })
            subtitle_changer.onChange(v => this.sheet.subheadline = v)
            subtitle_changer.attach()

        }
        else if(this.mode == "fake"){
            this.elements.splash = $(`
                <section
                    class="section splash"
                    style="
                        background:${this.sheet.theme.background};
                        color:rgb(${calculateColorlight(this.sheet.theme.background)});
                    ">
                    <div class="container is-fullhd">
                        <div class="columns is-vcentered">
                            <div class="column">
                                <h1 class="title" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.headline}</h1>
                                <h2 class="subtitle" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.subheadline}</h2>
                            </div>
                        </div>
                    </div>
                </section>
            `)

            if(this.sheet && this.sheet.video && this.sheet.video.enabled){
                this.elements.splash.find('.columns').append(
                    $(`<div class="column is-5"><div class="fakeVideo"></div></div>`)
                )
            }
        }
        else if (this.mode == "submission"){
            
            this.elements.splash = $(`
                <section
                    class="section splash"
                    style="
                        background:${this.sheet.theme.background};
                        color:rgb(${calculateColorlight(this.sheet.theme.background)});
                    ">
                    <div class="container is-fullhd">
                        <div class="columns is-vcentered">
                            <div class="column">
                                <div class="block titles">
                                    <h1 class="title" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.headline}</h1>
                                    <h2 class="subtitle" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.subheadline}</h2>
                                </div>
                                <div class="block buttons">
                                    <a class="button ${calculateColorlight(this.sheet.theme.background)=='255,255,255'?'is-light':'is-dark'}" href="${_DOMAIN}/dashboard">
                                        <span class="icon"><i class="fas fa-arrow-left"></i></span>
                                        <span>Back to dashboard</span>
                                    </a>
                                </div>
                            </div>
                        </div> 
                    </div>
                </section>
                `)

                let video_column = this.elements.splash.find('.columns')

                if(this.sheet && this.sheet.video && this.sheet.video.enabled && this.sheet.video.key && this.sheet.video.type){
                    let vp = new VideoParser({
                        key:this.sheet.video.key,
                        type:this.sheet.video.type
                    });
                    video_column.append(
                        $(`<div class="column is-5"><div class="splash--video"><div class="image is-16by9">${vp.getIframe()}</div></div></div>`)
                    )
                }

            return this.elements.splash;
        } else {
            
            //let profile_picture = (this.sheet && this.sheet.author && this.sheet.author.profile_picture) ? this.sheet.author.profile_picture : '';
            /* <div class="author">
                ${ (profile_picture && !profile_picture.includes('/images/logo.svg')) ?
                    `<figure class="image is-32x32 is-rounded mr-2"><img src="${profile_picture}"/></figure>` : ''
                }
                <p class="is-size-6">${this.sheet && this.sheet.author && this.sheet.author.name?this.sheet.author.name:''}</p>
            </div> */

            this.elements.splash = $(`
                <section
                    class="section splash ${this.sheet.theme.layout}"
                    style="
                        background:${this.sheet.theme.background};
                        color:rgb(${calculateColorlight(this.sheet.theme.background)});
                    ">
                    <div class="container is-fullhd">
                        <div class="columns is-vcentered">
                            <div class="column">
                                <div class="block titles">
                                    <h1 class="title has-text-centered-mobile" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.headline}</h1>
                                    <h2 class="subtitle has-text-weight-normal has-text-centered-mobile" style="color:rgb(${calculateColorlight(this.sheet.theme.background)});">${this.sheet.subheadline}</h2>
                                </div>
                                <div class="block buttons is-centered-mobile">
                                    <div ${this.disable_submit?`data-tooltip="You are the owner of this sheet, it cannot be submitted by you."`:''}>
                                        <a class="button ${calculateColorlight(this.sheet.theme.background)=='255,255,255'?'is-light':'is-dark'}" ${this.disable_submit?'disabled':'action="submit"'}>
                                            <span class="icon"><i class="far fa-paper-plane"></i></span>
                                            <span>Submit Work</span>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div> 
                    </div>
                </section>
            `)

            let video_column = this.elements.splash.find('.columns')

            if(this.sheet && this.sheet.video && this.sheet.video.enabled && this.sheet.video.key && this.sheet.video.type){
                let vp = new VideoParser({
                    key:this.sheet.video.key,
                    type:this.sheet.video.type
                });
                video_column.append(
                    $(`<div class="column is-5"><div class="splash--video"><div class="image is-16by9">${vp.getIframe()}</div></div></div>`)
                )
            }
        }

        return this.elements.splash;
    }
    renderPaper(){
        if(!this.isAttached()){ throw new Error("You must attach a parent to the sheet before you can render!"); }
        this.elements.paper.html("")
        this.cards = []

        // Add row button
        if(this.mode == "editable" && this.editor){
            this.elements.add_row = $(`
                <div class="tile is-ancestor">
                    <div class="tile is-parent">
                        <div class="tile is-child add-row">
                            <div class="buttons is-centered">
                                <a class="button is-primary">
                                    <span class="icon">
                                        <i class="fas fa-plus"></i>
                                    </span>
                                    <span>Add Row</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `)

            this.elements.add_row.find('.button').click(() => { this.addRow(null) })

            this.elements.paper.append(this.elements.add_row);
        }

        // Add each row
        this.forEachRow(row_val => {
            this.addRow(row_val)
        })

        return this.elements.paper
    }
    forEachQuestion(fn){
        let iteration = 0
        this.forEachCard(value => {
            if(value.type !== 'video' && value.type !== 'button' && value.type !== 'multiline'){
                iteration += 1
                fn(value, iteration)
            }
            else if (value.type == 'multiline'){
                JSONforEach(value.multiline_data, (option_key, option_vals) => {
                    iteration += 1
                    fn(option_key, option_vals, iteration)
                })
            }
        })
    }
    forEachCard(fn){
        this.forEachRow(v => v.forEach(fn))
    }
    forEachRow(fn){
        if(!this.isConnected()){ return; }
        this.paper.forEach(fn);
    }
    getCardById(id){
        let card = null;
        this.forEachCard((key, value) => { if(key == id){ card=value } })
        return card;
    }
    gatherPaper(){
        let paper = [];
        if(!this.cards.length){ return paper; }

        this.cards.forEach(row => {
            let rows = []
            row.forEach(card => rows.push( card.getData() ))
            paper.push(rows)
        })
        return paper;
    }
    addRow(row){
        let row_element = $(`<div class="tile is-ancestor" data-row="${this.cards.length}"></div>`),
            cards_row = []

        if(!row){
            row = []
            for(let i=0;i<3;i++){
                let d = new Card();
                d.create('blank')
                row.push(d.getData())
            }
        }

        row.forEach(card => {
            // Create the question card
            let question = new Card(card, this.mode, this.autosave)
            if(this.editor){ question.editor = this.editor }
            cards_row.push(question)

            // Rendering the card
            let c = question.render()
            row_element.append(c)
        })
        this.cards.push(cards_row)

        if(this.elements.add_row && this.mode == "editable"){
            let delete_row_button = $(`<div>
                <a class="button is-info is-small is-rowDeleteButton"><span class="icon"><i class="fas fa-trash-alt"></i></span></a>
            </div>`)
            delete_row_button.click(() => {
                //if(!confirm('Are you sure you wish to delete that row?')){ return; }
                let row_index = parseInt(row_element.attr('data-row'));
                let removed = this.cards.splice(row_index, 1)
                console.log({ removed, row_index })
                row_element.remove();
                delete_row_button.remove();
                // reset all "data-row" attributes
                $('.paper .tile.is-ancestor').each(function( index ) {
                    $( this ).attr('data-row', index)
                })
            })
            row_element.prepend(delete_row_button)
            row_element.insertBefore(this.elements.add_row)
        }
        else{
            this.elements.paper.append(row_element);
        }
    }
    gatherSheet(){
        if(!this.sheet){ throw new Error("Cannot gather sheet when sheet does not exist!") }
        this.sheet.paper = this.gatherPaper();
        return this.sheet;
    }
    getProgress(){
        let response;
        if(this.mode == "normal"){
            response = {
                total:0,
                answered:0,
                unanswered:0
            }
            this.cards.forEach(row => {
                row.forEach(card => {
                    let d = card.getData();
                    if(['card', 'multichoice', 'dropdown'].includes(d.type)){
                        response.total += 1;
                        if(d.answer){ response.answered += 1; }
                        else{ response.unanswered += 1; }
                    }
                    if(['multiline'].includes(d.type)){
                        d.options.forEach(question => {
                            response.total += 1;
                            if(question.answer){ response.answered += 1; }
                            else{ response.unanswered += 1; }
                        })
                    }
                })
            })

            response['percent']  = Math.round((response.answered / response.total) * 100)
            response['finished'] = (response.percent == 100)
        }
        if(this.mode == "grading" || this.mode == 'submission'){
            response = {
                total:0,
                graded:0,
                correct:0,
                incorrect:0
            }
            this.forEachCard(card => {
                if(['card', 'multichoice', 'dropdown'].includes(card.type)){
                    response.total += 1;
                    if(card.graded){ response.graded += 1; }
                    if(card.grade == 1){ response.correct += 1; }
                    else if(card.grade == -1){ response.incorrect += 1; }
                }
                if(['multiline'].includes(card.type)){
                    card.options.forEach(question => {
                        response.total += 1;
                        if(question.graded){ response.graded += 1; }
                        if(question.grade == 1){ response.correct += 1; }
                        else if(question.grade == -1){ response.incorrect += 1; }
                    })
                }
            })
            
            response['grade_over_total']  = Math.round((response.correct / response.total)  * 10000) / 100
            response['grade_over_graded'] = Math.round((response.correct / response.graded) * 10000) / 100
            response['grading_progress']  = Math.round((response.graded  / response.total)  * 10000) / 100
            response['incorrect_over_total']  = Math.round((response.incorrect / response.total)  * 10000) / 100

            response['letter'] = Paper.getGradeLetter(response.grade_over_total);
        }
        /*
            total: 6
            graded: 6
            correct: 3
            incorrect: 3
            grade_over_graded: 5
            grade_over_total: 5
            grading_progress: 10
            incorrect_over_total: 50
            letter: "F-"
        */
        console.log({ getProgress:response })
        return response;
    }

    static getGradeLetter(grade){
        let letter = '', modifier = ''
            
        if(grade % 10 >= 7 || grade == 100){ modifier = '+' }
        else if(grade % 10 >= 3){ modifier = '' }
        else{ modifier = '-' }

        if(grade >= 90){ letter = 'A' }
        else if(grade >= 80){ letter = 'B' }
        else if(grade >= 70){ letter = 'C' }
        else if(grade >= 60){ letter = 'D' }
        else if(grade >= 50){ letter = 'F'; modifier = ''; }
        else { letter = 'F'; modifier = '-' }

        return letter + modifier;
    }

};