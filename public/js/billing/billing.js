!async function(){
    var elements = {
        _root:$(`#content`)
    }
    
    var req = await $GET('/billing/v2/data'),
        res = await req.json();

    if(true || req.status != 200){ console.error({req,res}); }

    async function cancelAccount(fn=()=>{}){

        let modal, cancelButton, cancel_at_period_end, feedback, can_continue = false;
            status_text = $('.account_status'), renewal_text = $('.time_till_renewal'), onFinish=()=>{};

        let end_date = res.stripe.subscription.current_period_end * 1000;
    
        if(res.stripe.subscription && res.stripe.subscription.status == 'active'){
            modal = $(`<div class="modal is-active">
                <div class="modal-background" action="close"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">Cancel Account</p>
                        <button class="delete" aria-label="close" action="close"></button>
                    </header>
                    <section class="modal-card-body">
                        <div class="block">
                            <div class="columns has-text-centered">
                                <div class="column">
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/sheets.svg"/>
                                        </figure>
                                        <h1>All Sheets</h1>
                                    </div>
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/students.svg"/>
                                        </figure>
                                        <h1>All Student Submissions</h1>
                                    </div>
                                </div>
                                <div class="column">
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/graded.svg"/>
                                        </figure>
                                        <h1>All Graded Sheets</h1>
                                    </div>
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/photo-library.svg"/>
                                        </figure>
                                        <h1>All Uploaded Photos</h1>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="block is-size-6 has-text-centered">
                            <p class="field"><b>All of your sheets and data will be permanently deleted</b> when you are downgraded to a free account on ${moment(end_date).format('MMM Do, YYYY')}.</p>
                            <p class="field">To prevent loss of information you'll need to keep your subscription active!</p>
                        </div>
                    </section>
                    <footer class="modal-card-foot buttons is-right">
                        <a class="button" action="close">Nevermind</a>
                        <a class="button is-danger" data-action="step2">Cancel account</a>
                        <a class="button is-danger is-hidden" data-action="cancel" disabled="true">Cancel account</a>
                    </footer>
                </div>
            </div>`);

            cancel_at_period_end = true;
            cancelButton = modal.find('[data-action=cancel]');

            let gotostep2 = modal.find('.modal-card-foot [data-action=step2]')
            gotostep2.click(() => {
                gotostep2.remove();
                cancelButton.removeClass('is-hidden')
                modal.find('.modal-card-body').html(`
                <div class="block">
                    <div class="field">
                        <h1 class="title is-size-2 has-text-centered">Before you go...</h1>
                        <h2 class="subtitle is-size-3 has-text-centered">Will you help us improve? We read every response.</h2>
                    </div>
                    <div class="field">
                        <div class="control"><textarea class="textarea" placeholder="What could we have done better?" maxlength="2000" id="reason"></textarea></div>
                        <p class="help has-text-right has-text-centered-mobile">A response is required to continue to cancel.</p>
                    </div>
                </div>`);

                let feedback_textarea = modal.find('textarea#reason')
                feedback_textarea.on('input click', () => {
                    feedback = feedback_textarea.val()
                    can_continue = (feedback && feedback.length >= 10);
                    if(feedback && feedback.length >= 10){ cancelButton.removeAttr('disabled') }
                    else{ cancelButton.attr('disabled', 'true') }
                })
            })

            onFinish = () => {
                modal.find('.modal-card-body').html(`<div class="block">
                    <div class="block">
                        <h1 class="title is-size-2 has-text-centered">We're sorry to see you go...</h1>
                        <h2 class="subtitle is-size-3 has-text-centered">Thank you for being a part of SheetParrot.</h2>
                    </div>
                    <div class="block has-text-centered">
                        <p class="field">Currently your plan is scheduled to end ${moment(end_date).fromNow()}. Until then, feel free to continue using SheetParrot until with all of your paid benefits.</p>
                        <p class="field"><b>After ${moment(end_date).format('MMMM Do')}</b> your account will be automatically set to the free plan.</p>
                    </div>
                </div>`)
                modal.find('.modal-card-foot').html(`<a class="button is-primary" href="${_DOMAIN}/dashboard">
                    <span>Back to dashboard</span>
                </a>
                <a class="button is-light" href="${_DOMAIN}/logout">
                    <span>Logout</span>
                </a>`)
                //toast(`Successfully cancelled your account.<br>You can still use your account until ${moment(message.last_day).format('dddd MMM Do')}.`, "success", true, true)
                status_text.find('h1').text('Cancelling')
                status_text.find('a').text('Undo Cancellation')
                renewal_text.find('span:first-child').text("Time Before Cancellation")
                renewal_text.find('span:last-child').text("Cancels " + moment(end_date).format('MMMM Do YYYY'))
            }

        }
        else{
            modal = $(`<div class="modal is-active">
                <div class="modal-background" action="close"></div>
                <div class="modal-card">
                    <header class="modal-card-head twobox">
                        <div>
                            <p class="modal-card-title has-text-weight-bold">Re-activate Account</p>
                            <h1 class="subtitle is-size-5 has-text-centered">Your account is set to cancel on ${moment(end_date).format('MMMM Do YYYY')}</h1>
                        </div>
                        <button class="delete" aria-label="close" action="close"></button>
                    </header>
                    <section class="modal-card-body">
                        <div class="block">
                            <div class="columns has-text-centered">
                                <div class="column">
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/sheets.svg"/>
                                        </figure>
                                        <h1>All Sheets</h1>
                                    </div>
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/students.svg"/>
                                        </figure>
                                        <h1>All Linked Student Data</h1>
                                    </div>
                                </div>
                                <div class="column">
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/graded.svg"/>
                                        </figure>
                                        <h1>All Submissions</h1>
                                    </div>
                                    <div class="box">
                                        <figure class="image is-64x64 is-centered mb-4">
                                            <img src="${_DOMAIN}/images/icons/photo-library.svg"/>
                                        </figure>
                                        <h1>All Uploaded Photos</h1>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="block is-size-6 has-text-centered">
                            <p class="field">After ${moment(end_date).format('MMMM Do')} <b>all of the above will be permanently deleted.</b></p>
                            <p class="field">By clicking undo, your work will not be deleted and your billing will renew as if the cancellation never happened.</p>
                        </div>
                    </section>
                    <footer class="modal-card-foot buttons is-right">
                        <a class="button is-success">Undo cancellation</a>
                    </footer>
                </div>
            </div>`);

            cancel_at_period_end = false;
            cancelButton = modal.find('.modal-card-foot .button.is-success');
            can_continue = true;
            onFinish = () => {
                modal.remove();
                status_text.find('h1').text('Active')
                status_text.find('a').text('Cancel Account')
                renewal_text.find('span:first-child').text("Time Before Renewal")
                renewal_text.find('span:last-child').text("Renews " + moment(end_date).format('MMMM Do YYYY'))
                toast(`Successfully re-activated your account, welcome back to SheetParrot ${res.first_name}!`, "success", true, true)
                fireconfetti();
            }
        }
        
        cancelButton.click(async () => {
            if(!can_continue){ return; }
            cancelButton.addClass('is-loading')
            let body = { cancel_at_period_end }
            if(feedback){ body.feedback = feedback; }

            let post = await $POST('/billing/update', body),
                message = await post.json();

            onFinish();
            if(post.status != 200){ return console.log({ post, message }); }

            req = await $GET('/billing/v2/data'), res = await req.json();
            loadMain();
        })

        modal.on('click', '[action=close]', () => modal.remove())
    
        $('body').append(modal)
    }

    async function loadMain(){

        let container = $(`
        <div class="block container is-max-widescreen is-bottom">

            <div class="field is-grouped is-vcentered">
                <span class="icon mr-2">
                    <i class="fas fa-credit-card fa-lg"></i>
                </span>
                <h1 class="title">Billing Settings</h1>
            </div>

            <div class="billing-splash">
                <div class="billing-logo-holder shadow20">
                    <figure class="image is-96x96">
                        <img src="${_DOMAIN}/images/logo.svg"/>
                    </figure>
                </div>
            </div>
            <div class="block box billing-titles">
                <h1 class="title is-size-2 has-text-centered is-capitalized">SheetParrot <b>${res.plan}</b> Plan</h1>
            </div>
            <div class="block columns is-vcentered has-text-centered">
                <div class="column">
                    <div class="box time_till_renewal">
                        <span>Time Before ${ res.stripe.subscription.status == 'active'?'Renewal':'Cancellation' }</span>
                        <h1 class="is-size-1 has-text-weight-bold is-capitalized">${ moment.duration(res.stripe.subscription.current_period_end).humanize() }</h1>
                        <span>${res.stripe.subscription.status == 'active'?'Renews':'Cancels'} ${moment(res.stripe.subscription.current_period_end*1000).format('MMMM Do YYYY')}</span>
                    </div>
                </div>
                <div class="column">
                    <div class="box monthly_payment">
                        <span>Monthly Payment</span>
                        <h1 class="is-size-1 has-text-weight-bold">$${fancyNumber(res.stripe.subscription.plan.amount / 100)}</h1>
                        <a href="${_DOMAIN}/billing/plans">See Plans</a>
                    </div>
                </div>
                <div class="column">
                    <div class="box account_status">
                        <span>Status</span>
                        <h1 class="is-size-1 has-text-weight-bold is-capitalized">${res.stripe.subscription.status}</h1>
                        ${ res.stripe.subscription == 'failed'?
                            `<a href="${_DOMAIN}/billing/failedPayment">Fix Failed Payment</a>`: res.stripe.subscription.status == 'cancelling'?
                            `<a data-action="cancel">Undo Cancellation</a>`:
                            `<a data-action="cancel">Cancel Account</a>`
                        }
                    </div>
                </div>
                <div class="column">
                    <div class="box last_amount_paid">
                        <span>Last Amount Paid</span>
                        <h1 class="is-size-1 has-text-weight-bold">$${fancyNumber(res.stripe.invoice.amount_paid / 100)}</h1>
                        <a href="${res.stripe.invoice.hosted_invoice_url}" target="_blank">View Invoice</a>
                    </div>
                </div>
            </div>
            <div class="block" id="dynamic"></div>
            <div class="block buttons is-centered">
                <a class="button is-normal is-primary is-fullwidth-mobile" href="${_DOMAIN}/billing/plans">
                    <span class="icon"><i class="fas fa-sync-alt"></i></span>
                    <span>Change Plan</span>
                </a>
                <a class="button is-normal is-primary is-fullwidth-mobile" href="${_DOMAIN}/stripe/portal">
                    <span class="icon"><i class="fas fa-credit-card"></i></span>
                    <span>Change Payment Method</span>
                </a>
                ${
                    res.stripe.subscription.status == 'cancelling' ?  
                    `<a class="button is-normal is-success is-fullwidth-mobile" data-action="cancel">
                        <span class="icon"><i class="fas fa-undo"></i></span>
                        <span>Undo Cancellation</span>
                    </a>` : 
                    `<a data-action="cancel" class="button is-normal is-danger is-outlined is-fullwidth-mobile">
                        <span class="icon"><i class="fas fa-exclamation-triangle"></i></span>
                        <span>Cancel Account</span>
                    </a>`
                }
            </div>
            <div class="box">
                <div class="is-divider" data-content="Subscription"></div>

                <div class="columns">
                    <div class="column">
                        <div class="is-size-6">
                            <div class="twobox">
                                <p>Subscription Started</p>
                                <p>${moment(res.stripe.subscription.start_date * 1000).format('MMMM Do YYYY')}</p>
                            </div>
                            <div class="twobox">
                                <p>Current Period Start</p>
                                <p>${moment(res.stripe.subscription.current_period_start * 1000).format('MMMM Do YYYY')}</p>
                            </div>
                            <div class="twobox">
                                <p>Current Period End</p>
                                <p>${moment(res.stripe.subscription.current_period_end * 1000).format('MMMM Do YYYY')}</p>
                            </div>
                        </div>
                    </div>
                    <div class="column">
                        <div class="is-size-6">
                            <div class="twobox">
                                <p>Plan</p>
                                <p class="is-capitalized">${res.plan}</p>
                            </div>
                            <div class="twobox">
                                <p>Status</p>
                                <p class="is-capitalized">${res.stripe.subscription.status}</p>
                            </div>
                            <div class="twobox">
                                <p>Interval</p>
                                <p class="is-capitalized">${res.stripe.subscription.plan.interval}ly</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${
                    res.stripe.primaryPaymentMethod ? `<div class="is-divider" data-content="Payment Method"></div>
                    <div class="columns">
                        <div class="column">
                            <div class="is-size-6">
                                <div class="twobox">
                                    <p>Billing Address</p>
                                    <p>${res.stripe.primaryPaymentMethod.billing_details.address.line1}</p>
                                </div>
                                <div class="twobox">
                                    <p></p>
                                    <p>${res.stripe.primaryPaymentMethod.billing_details.address.line2}</p>
                                </div>
                                <div class="twobox">
                                    <p></p>
                                    <p>${
                                        res.stripe.primaryPaymentMethod.billing_details.address.state ? res.stripe.primaryPaymentMethod.billing_details.address.state + ' &bullet; ' : ''
                                    } ${
                                        res.stripe.primaryPaymentMethod.billing_details.address.city ? res.stripe.primaryPaymentMethod.billing_details.address.city + ' &bullet; ' : ''
                                    } ${
                                        res.stripe.primaryPaymentMethod.billing_details.address.country ? res.stripe.primaryPaymentMethod.billing_details.address.country : ''
                                    }</p>
                                </div>
                                <div class="twobox">
                                    <p>Postal Code</p>
                                    <p>${res.stripe.primaryPaymentMethod.billing_details.address.postal_code}</p>
                                </div>
                            </div>
                        </div>
                        <div class="column">
                            <div class="is-size-6">
                                <div class="twobox">
                                    <p>Card</p>
                                    <p class="is-capitalized">${res.stripe.primaryPaymentMethod.card.brand} ending in ${res.stripe.primaryPaymentMethod.card.last4}</p>
                                </div>
                                <div class="twobox">
                                    <p>Card Expires</p>
                                    <p class="is-capitalized">${res.stripe.primaryPaymentMethod.card.exp_month}/${res.stripe.primaryPaymentMethod.card.exp_year}</p>
                                </div>
                                <div class="twobox">
                                    <p>Change Card</p>
                                    <a href="${_DOMAIN}/stripe/portal">Update Payment Method</a>
                                </div>
                            </div>
                        </div>
                    </div>` : ''
                }

                <div class="is-divider" data-content="From Your Latest Invoice"></div>

                <div class="columns">
                    <div class="column">
                        <div class="is-size-6">
                            <div class="twobox">
                                <p>Amount Due</p>
                                <p class="is-capitalized">$${fancyNumber(res.stripe.invoice.amount_due / 100)}</p>
                            </div>
                            <div class="twobox">
                                <p>Amount Paid</p>
                                <p class="is-capitalized">$${fancyNumber(res.stripe.invoice.amount_paid / 100)}</p>
                            </div>
                            <div class="twobox">
                                <p>Total</p>
                                <p class="is-capitalized">$${fancyNumber(res.stripe.invoice.total / 100)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="column">
                        <div class="is-size-6">
                            <div class="twobox">
                                <p>Paid On:</p>
                                <p>${moment(res.stripe.invoice.status_transitions.paid_at * 1000).format('MMMM Do YYYY')}</p>
                            </div>
                            <div class="twobox">
                                <p>Invoice number</p>
                                <p>${res.stripe.invoice.number}</p>
                            </div>
                            <div class="twobox">
                                <p>More Information</p>
                                <a href="${res.stripe.invoice.invoice_pdf}" target="_blank">Download Invoice</a>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>`)
        
        let cancel_buttons = container.find(`[data-action="cancel"]`)
        cancel_buttons.removeAttr('data-action')
        cancel_buttons.click(() => { cancelAccount(() => {}) })

        elements._root.html("")
        elements._root.append(container);
    }

    //  && res.stripe.subscription.status != 'canceled'
    if(res.stripe.subscription){ loadMain(); } else { window.location.href = _DOMAIN + "/billing/plans" }

    let goto = getParam('goto')
    if(goto){
        if(goto == 'cancel'){ cancelAccount() }
        if(goto == '1'){ toast("Thank you for your purchase! Your account has now been upgraded to the professional plan.", "success", true, true) }
    }

}();