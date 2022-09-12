
class InvisibleEditor{

    constructor(options){
        this.target = options.element
        if(!this.target){ throw new Error("Cannot create InvisibleEditor onto null parent element!") }
        if(!this.target instanceof jQuery){ this.target = $(this.target); }

        this.options = options;

        let tag = String(this.target.prop("tagName")).toLowerCase()
        this.type = (tag == 'input' || tag == 'textarea') ? this.type = 'input' : this.type = 'text'
        this.tag = tag

        this.callback = (val) => {}
        this.value = ""
    }

    attach(){

        if(this.type == "text"){
            this.target.addClass('is-secretlyEditable')

            let new_input = $(`<textarea class="invisibleEditor" ${this.options.textLimit?`maxlength="${this.options.textLimit}"`:''}>${this.target.text()}</textarea>`)
            new_input.on('blur', () => {
                this.target.removeClass('is-hidden')
                if(callback){ callback(new_input.val()) }
                new_input.remove()
            })
    
            if(this.options.css){ new_input.css(this.options.css) }
    
            this.target.addClass('is-hidden')
            new_input.insertAfter(this.target)
    
            new_input.focus()
            new_input.select()
        }
        else if(this.type == "input"){
            if(!this.target.hasClass('invisibleEditor')){ this.target.addClass('invisibleEditor') }
            if(this.options.css){ this.target.css(this.options.css) }
            this.target.on('input', () => this.callback(this.target.val()))

            if(this.tag == "textarea"){
                this.target.attr('rows', '1')
                this.target.ready(() => {
                    this.target.css("height", ""); 
                    this.target.css("height", this.target.prop('scrollHeight') + "px");
                })
                $(window).on('resize', () => {
                    this.target.css("height", ""); 
                    this.target.css("height", this.target.prop('scrollHeight') + "px");
                });
                this.target.on('input', () => {
                    this.target.css("height", ""); 
                    this.target.css("height", this.target.prop('scrollHeight') + "px");
                })

            }
        }
        
    }

    onChange(fn=() => {}){
        this.callback = fn;
    }

};