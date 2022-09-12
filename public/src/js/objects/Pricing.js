class Pricing {

    constructor(){
        this.plans = _ENV && _ENV == 'production' ? {
            free:{
                id:"",
                price:"",
                label:"Free"
            },
            professional: {
                id:'prod_LO2R9T8OMbWCQA',
                price:'price_1KqPpLLR9MjLBbZosrxaJmrS'
            }
        } : {
            free:{
                id:"",
                price:"",
                label:"Free"
            },
            professional:{
                id:"prod_KsN875m2kyP9rE",
                price:"price_1KqPqVLR9MjLBbZoT8f4dDVH"
            }
        }

        this.elements = {
            free:{
                container:$('#pricing_free'),
                button:$('#pricing_free .price-cta .button')
            },
            professional:{
                container:$('#pricing_professional'),
                button:$('#pricing_professional .price-cta .button')
            }
        }

        // Set action
        if(!AUTHORIZED){
            // Set text
            this.elements.free.button.html('<span class="icon"><i class="fas fa-check"></i></span><span>Get Started</span>')
            this.elements.professional.button.html('<span class="icon"><i class="fas fa-check"></i></span><span>Get Started</span>')

            // Set color
            this.elements.free.button.addClass('is-primary')
            this.elements.professional.button.addClass('is-primary')
            
            // Set action
            this.elements.free.button.attr('href', `${_DOMAIN}/signup`)
            this.elements.professional.button.attr('href', `${_DOMAIN}/signup`)
        }
        else{
            // Set text
            this.elements.free.button.html('<span>Downgrade Now</span><span class="icon"><i class="fas fa-arrow-down"></i></span>')
            this.elements.professional.button.html('<span>Upgrade Now</span><span class="icon"><i class="fas fa-arrow-right"></i></span>')

            // Set color
            this.elements.free.button.addClass('is-primary')
            this.elements.professional.button.addClass('is-primary')
            
            // Set action
            this.elements.free.button.attr('href', `${_DOMAIN}/billing?goto=cancel`)
            this.elements.professional.button.attr('href', `${_DOMAIN}/stripe/checkout?price=${this.plans.professional.price}`)

            // Whatever plan is active, set the button properly
            this.elements[_PLAN.toLowerCase()].button.html(`<span class="icon"><i class="fas fa-check"></i></span><span>Current Plan</span>`)
            this.elements[_PLAN.toLowerCase()].button.removeClass('is-primary')
            this.elements[_PLAN.toLowerCase()].button.addClass('is-dark is-outlined')
            this.elements[_PLAN.toLowerCase()].button.attr('disabled', 'true')
        }

        this.elements.free.button.removeClass('is-hidden')
        this.elements.professional.button.removeClass('is-hidden')
    }
}