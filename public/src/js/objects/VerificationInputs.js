class VerificationInputs{
    constructor(callback){
        if(callback){ this.onFinished = callback }
        else{ this.onFinished = () => {} }
        this.code = { '0':'', '1':'', '2':'', '3':'', '4':'', '5':'' }
        this.element = $('<div></div>')
        this.notification = $(`<div class="block is-hidden"><div class="notification is-danger">That code is invalid or expired. Please try again.</div></div>`)
    }
    render(nofocus=false){
        let inputs = $(`<div class="verification_inputs"><div class="field has-addons has-addons-centered"></div><div class="field has-addons has-addons-centered"></div></div>`)

        inputs.find('.field:first-child').append( this.createInput('0') )
        inputs.find('.field:first-child').append( this.createInput('1') )
        inputs.find('.field:first-child').append( this.createInput('2') )

        inputs.find('.field:last-child ').append( this.createInput('3') )
        inputs.find('.field:last-child ').append( this.createInput('4') )
        inputs.find('.field:last-child ').append( this.createInput('5') )

        this.element.append(inputs);
        this.element.append(this.notification)

        if(!nofocus){ setTimeout(() => this.focus()) }

        return this.element;
    }
    onInput(){
        this.notification.addClass('is-hidden')
        let code = this.getCode();
        if(code.length == "6"){
            this.element.find('input').attr('disabled')
            this.onFinished(code);
        }
    }
    createInput(index){
        let input = $(`<input class="input" type="text" index="${index}" maxlength="1">`)

        input.on('input', () => { this.code[index] = input.val(); this.onInput(); })
        input.on('keydown', e => {
            if(e.key == "Backspace" && index != '0'){
                input.val(''); this.element.find(`input[index=${parseInt(index) - 1}]`).focus()
            }
            if((/[0-9]/gi).test(e.key) && index != '5'){
                setTimeout(() => {
                    this.element.find(`input[index=${parseInt(index) + 1}]`).focus()
                })
            }
        })

        let p = $(`<p class="control"></p>`)
        p.append(input)
        return p;
    }
    getCode(){
        return Object.values(this.code).join('')
    }
    focus(){
        this.element.find('input[index=0]').focus()
    }
    promptRetry(){
        this.code = { '0':'', '1':'', '2':'', '3':'', '4':'', '5':'' }
        this.element.find('input').val('').removeAttr('disabled')
        this.notification.removeClass('is-hidden')
        setTimeout(() => this.focus())
    }
}