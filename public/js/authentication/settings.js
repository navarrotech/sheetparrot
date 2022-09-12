!async function(){

    var GET_SETTINGS = await $GET('/settings/me'),
        PREFERENCES = await GET_SETTINGS.json(),
        root = $('#root').html(''),
        sidebar = $('#sidebar');

    async function setup2FA(callingEl){
        let modal = $(`
            <div class="modal is-small is-active">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">
                            ${ PREFERENCES.twofactor.enabled ? 'Setup 2 factor authentication' : 'Update an authenticator app' }
                        </p>
                        <button class="delete" action="close"></button>
                    </header>
                    <section class="modal-card-body"></section>
                    <footer class="modal-card-foot buttons is-right">
                        ${ PREFERENCES.twofactor.enabled ? `<a class="button is-danger" action="remove">Disable two factor</a>` : '' }
                        <a class="button" action="close">Cancel</a>
                        <a class="button is-primary" action="submit">Continue</a>
                    </footer>
                </div>
            </div>
        `)
        modal.find('.modal-background').click(() => modal.remove())
        modal.find('[action=close]').click(() => modal.remove())

        $('body').append(modal)

        let submit = modal.find('[action=submit]'),
            remove = modal.find('[action=remove]')
            modalBody = modal.find('.modal-card-body'),
            secret = "";

        let QRparent = $(`<div class="block is-flex is-justify-content-center"><div class="loader is-medium"></div></div>`)

        modalBody.append(`
            <div class="block">
                <p class="is-size-7 has-text-centered">
                    Download the free <a href="https://support.google.com/accounts/bin/answer.py?hl=en&answer=1066447" target="_blank">Google Authenticator app</a> or <a href="https://authy.com/download/" target="_blank">Authy App</a> add a new account, then scan this barcode to set up your account.
                </p>
            </div>
        `)
        modalBody.append(QRparent)

        let manual_field = $(`
            <div class="block">
                <div class="control has-icons-left is-clickable" data-tooltip="Click to copy to clipboard!">
                    <span class="icon is-small is-left"><i class="far fa-copy"></i></span>
                    <input class="input is-clickable" type="text" value="" readonly/>
                </div>
            </div>
        `)
        modalBody.append(manual_field)
        
        let manual_field_input = manual_field.find('input')
            .click(() => {
                let control = manual_field.find('.control')

                navigator.clipboard.writeText(secret);
                manual_field_input.addClass('is-success');
                control.attr('data-tooltip', 'Copied to clipboard!');
                
                setTimeout(() => { manual_field_input.removeClass('is-success'); control.attr('data-tooltip', 'Click to copy to clipboard!'); }, 1500)
            })

        let getQR = await $GET('/2FA/getMyQR'),
            text = await getQR.text();

        QRparent.find('.loader').remove();
        new QRCode(QRparent.get()[0], { text, width: 240, height: 240, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H })

        secret = new URL(text).searchParams.get('secret')
        manual_field_input.val(secret)

        remove.click(async () => {
            remove.addClass('is-loading')
            let result = await $POST('/2FA/removeMy2FA', {})

            if(result.status == 200){
                callingEl.find('span:not(.icon)').text("Enable Two Factor")
                modal.remove();
                PREFERENCES.twofactor.enabled = false;
                PREFERENCES.twofactor.secret = null;
                toast("Successfully removed two factor authentication from your account", "success", true)
            }
            else{
                toast("Something went wrong, please try again later.", "danger", true)
            }
        })

        submit.click(() => {
            modalBody.html('')
            modal.find('.modal-card-foot').html('')
            modalBody.append(`
                <div class="block">
                    <p class="is-size-7 has-text-centered">Please enter your 6-digit authentication code from your authentication app.</p>
                </div>
                <div class="block">
                    <p class="is-size-5 has-text-centered icon-text">
                        <span class="icon"><i class="fas fa-user"></i></span>
                        <span>${PREFERENCES.email}</span>
                    </p>
                </div>
            `)

            let verify = new VerificationInputs(async (code) => {
                let saveResult = await $POST('/2FA/saveMy2FA', { code })
                if(saveResult.status == "201"){
                    modal.remove();
                    callingEl.find('span:not(.icon)').text("Update Two Factor");
                    PREFERENCES.twofactor.enabled = true;
                    PREFERENCES.twofactor.secret = secret;
                    toast("Successfully updated 2 factor authentication to your account!", "success", true)
                    fireconfetti()
                    return;
                }
                verify.promptRetry();
            });
            modalBody.append( verify.render() )
        })

    }
    function changePassword(){
        let modal = $(`
            <div class="modal is-active is-small">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">Change Your Password</p>
                        <button class="delete" aria-label="close" action="close"></button>
                    </header>
                    <section class="modal-card-body">
                        <div class="field">
                            <label class="label">Current Password</label>
                            <div class="control has-icons-left">
                                <input class="input" type="password" maxlength="32" name="password_0" placeholder="Current password">
                                <span class="icon is-small is-left"><i class="fas fa-lock"></i></span>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">New Password</label>
                            <div class="control has-icons-left">
                                <input class="input" type="password" autocomplete="new-password" maxlength="32" name="password_1" placeholder="New password">
                                <span class="icon is-small is-left"><i class="fas fa-lock"></i></span>
                            </div>
                        </div>
                        <div class="field">
                            <label class="label">Confirm Password</label>
                            <div class="control has-icons-left">
                                <input class="input" type="password" autocomplete="new-password" maxlength="32" name="password_2" placeholder="Confirm password">
                                <span class="icon is-small is-left"><i class="fas fa-lock"></i></span>
                            </div>
                        </div>
                        <div class="field">
                            <div id="notifier"></div>
                        </div>
                    </section>
                    <footer class="modal-card-foot buttons is-right">
                        <a class="button" action="close">Cancel</a>
                        <a class="button is-primary" disabled="true">Update</a>
                    </footer>
                </div>
            </div>
        `)

        modal.find('.modal-background').click(() => modal.remove())
        modal.find('[action=close]').click(() => modal.remove())

        let notifier = modal.find('#notifier').removeAttr('id'),
            pass_current = modal.find('input[name=password_0]'),
            pass_new_1   = modal.find('input[name=password_1]'),
            pass_new_2   = modal.find('input[name=password_2]'),
            submit       = modal.find('.button.is-primary'),
            loading      = false;

        pass_current.on('input change', () => checkFilled())
        pass_new_1.on  ('input change', () => checkFilled())
        pass_new_2.on  ('input change', () => checkFilled())

        function checkFilled(){
            if(!pass_current.val() || !pass_new_1.val() || !pass_new_2.val() || (pass_new_1.val() != pass_new_2.val())){ submit.attr('disabled', 'true'); return false; }
            submit.removeAttr('disabled'); return true;
        }

        submit.click(async () => {
            if(!checkFilled()){ return; }
            if(loading){ return; } loading = true;

            submit.addClass('is-loading')

            let body = {
                current:pass_current.val(),
                password:pass_new_1.val(),
            }

            let res = await $POST('/settings/password', body)

            if(res.status == 200){
                modal.remove();
                toast("Successfully updated your password!", "success", true, false);
                return;
            }
            
            let response = await res.json(),
                message = response.message || ''

            let notification = $(`
                <div class="notification is-primary">
                    <button class="delete"></button>
                </div>
            `)

            notification.find('.delete').click(() => notification.remove())
            notifier.append(notification)

            pass_current.val('')
            pass_new_1.val('')
            pass_new_2.val('')
        })

        $('body').append(modal)
    }
    async function updateProfilePicture(upload_button, profile_picture){

        if (!window.FileReader || !upload_button.prop('files')){ toast("Your browser does not support selecting a profile picture.", 'warning', true, true); return; }

        let file = upload_button.prop('files')[0]
        if(!file){ return; }

        if(file.size >= 1048576 * 5){ toast("The file you have chosen is larger than 5mb! Please upload a smaller photo.", 'info', true, false); return; }
        if(!['image/png', 'image/jpeg'].includes(file.type)){ toast("Please upload a .jpg or .png image as your profile picture!", 'info', true, false); return; }

        profile_picture.html(`<div class="loader is-medium"></div>`)

        let formData = new FormData(); formData.append('image',file);

        let res = await fetch(`${_DOMAIN}/upload/profile`, { method: 'POST', body: formData })

        var reader = new FileReader();
        reader.onload = function (e) {
            profile_picture.html(`<img class="is-rounded" src="${e.target.result}"/>`)
            $('.nav2 .dropdown-trigger .image.is-48x48 img.is-rounded').attr('src', e.target.result)
        }
        reader.readAsDataURL(file)

        if(res.status != 200){
            let j = await res.json();
            toast(j.message, "danger", true, false);
            return;
        }
        toast("Successfully uploaded your new profile picture!", "success", true, false)
    }

    function render(){

        //////// MAIN ////////

        let name_fields = $(`
            <div class="field is-horizontal">
                <div class="field-body">
                    <div class="field">
                        <label class="label">First Name</label>
                        <p class="control is-expanded has-icons-left">
                            <input class="input" type="text" name="first" placeholder="First Name" value="${PREFERENCES.first_name}">
                            <span class="icon is-small is-left"><i class="fas fa-user"></i></span>
                        </p>
                    </div>
                    <div class="field">
                        <label class="label">Last Name</label>
                        <p class="control is-expanded has-icons-left">
                            <input class="input" type="text" name="last"  placeholder="Last Name"  value="${PREFERENCES.last_name}">
                            <span class="icon is-small is-left"><i class="fas fa-user"></i></span>
                        </p>
                    </div>
                </div>
            </div>
        `)

        let first_name_field = name_fields.find('input[name=first]')
        first_name_field.on('input', () => PREFERENCES.first_name = first_name_field.val())

        let last_name_field = name_fields.find( 'input[name=last]')
        last_name_field.on( 'input', () => PREFERENCES.last_name  = last_name_field.val() )

        root.append(name_fields)

        let account_type_field = $(`<div>
            <label class="label">I am a: </label>
            <div class="field is-horizontal">
                <div class="field-body"><div class="field is-narrow"><div class="control">
                    <div class="select is-fullwidth"><select>
                        <option value="student" ${PREFERENCES.type == 'student'?'selected':''}>Student</option>
                        <option value="teacher" ${PREFERENCES.type == 'teacher'?'selected':''}>Teacher</option>
                    </select></div>
            </div></div></div></div>
        </div>`)
            .on('change', 'select', (event) => {
                let selectedInput = $(event.target)
                PREFERENCES.type = selectedInput.val() ? selectedInput.val() : selectedInput.find(":selected").text()
            })

        root.append(account_type_field)

        root.append('<div class="is-divider" data-content="Sheet Defaults"></div>')

        //// Theme Defaults ////

        let themes = ['#1F3A8A','#920e13','#bb4db1','#cf8a2f','#cf8a2f','#fff7ba','#2d9c4c','#1c6829','#009fa5','#553270','#616772','#1E1E24']

        let custom_picker = $(`<a class="button"><span class="icon"><i class="fa fa-palette"></i></span></a>`),
            theme_picker_parent = $(`<div class="block"><label class="label">Default Sheet Theme</label></div>`),
            theme_picker = $(`<div class="theme_picker"></div>`)

        themes.forEach(hex => {
            let el = $(`<a class="button" style="background:${hex};"></a>`)
            el.click(() => { PREFERENCES.interface.theme = hex; custom_picker.css({ 'background':'', 'border-color':'', 'color':'' }) })
            theme_picker.append(el) 
        })

        if(!themes.includes(PREFERENCES.interface.theme)){ custom_picker.css({ 'background':PREFERENCES.interface.theme, 'border-color':PREFERENCES.interface.theme, 'color':`rgb(${calculateColorlight(PREFERENCES.interface.theme)})` }); }
        let picker = new Picker({ 
            alpha:false,
            popup:'bottom',
            editorFormat:'hex',
            parent:custom_picker.get()[0]
        });
        picker.onChange = (color) => {
            let hex = String(color.hex).substring(0, 7);
            PREFERENCES.interface.theme = hex;
            custom_picker.css({
                'background':hex,
                'border-color':hex,
                'color':`rgb(${calculateColorlight(hex)})`
            })
        }
        theme_picker.append(custom_picker)

        theme_picker_parent.append(theme_picker)
        root.append(theme_picker_parent)

        //// Thank you message ////

        let thank_you = $(`
            <div class="block">
                <label class="label">Default "thank you message" after sheets are submitted</label>
                <div class="control">
                    <textarea class="textarea" maxlength="120" placeholder="Default sheet success message">${PREFERENCES.interface.onSubmit}</textarea>
                </div>
            </div>
        `).on('input', 'textarea', () => { PREFERENCES.interface.onSubmit = thankYou.find('textarea').value() })
        root.append(thank_you)

        root.append('<div class="is-divider" data-content="Email Notifications"></div>');

        // NOTIFICATIONS

        function notificationToggle(title, key, tooltip){
            let field = $(`
                <div class="field is-horizontal">
                    <label class="label" ${tooltip?`data-tooltip="${tooltip}"`:''}>${title}</label>
                    <div class="field" style="margin-left:auto">
                        <p class="control"><label class="switch">
                        <input type="checkbox" ${ PREFERENCES.notifications[key] ? 'checked' : '' }>
                        <span class="slider is-success"></span></label></p>
                    </div>
                </div>
            `).on('change', 'input', e => { PREFERENCES.notifications[key] = e.target.checked })
            return field;
        }

        let notifications = $(`<div class="block px-4"></div>`)

        notifications.append(
            notificationToggle(
                "Login Notification",
                "login",
                "Get updated when your account is logged into."
            )
        )
        notifications.append(
            notificationToggle(
                "SheetParrot Updates",
                "updates",
                "Be notified with new updates and features with SheetParrot!"
            )
        )
        notifications.append(
            notificationToggle(
                "Newsletters",
                "marketing",
                "Learn about new trends and modern education."
            )
        )
        notifications.append(
            notificationToggle(
                "New Submissions",
                "submissions",
                "Get notified when a students submits a worksheet"
            )
        )

        root.append(notifications)


        let save    = $(`<a class="button is-primary"><span>Save Changes</span><span class="icon"><i class="fas fa-check"></i></span></a>`);
        let buttons = $(`<div class="buttons is-right"></div>`);

        let is_saving = false;
        save.click(async () => {
            if(is_saving || !PREFERENCES){ return; }
            is_saving = true;
            save.addClass('is-loading')

            await $POST('/settings/save', PREFERENCES);

            save.removeClass('is-loading')
            toast("Successfully updated your account's settings", 'success', true);
            fireconfetti();
            is_saving = false;
        })

        buttons.append(save)
        root.append(buttons);


        //////// SIDEBAR ////////

        let profile_picture = $(`
            <div class="block">
                <figure class="image is-centered is-128x128 is-clickable">
                    <img class="is-rounded" src="${PREFERENCES.profile_picture}"/>
                </figure>
            </div>
            <div class="block">
                <p class="is-size-7 has-text-centered mb-2">Select a profile photo <br>(Optional, must be less than 5mb)</p>
                <div class="file is-small is-centered">
                    <label class="file-label">
                        <input class="file-input" type="file" id="profile_picture_upload" accept="image/jpeg, image/png">
                        <span class="file-cta">
                            <span class="file-icon">
                            <i class="fas fa-upload"></i>
                            </span>
                            <span class="file-label">Upload Profile Photo</span>
                        </span>
                    </label>
                </div>
            </div>
        `).on('click', '.image', () => profile_picture.find('.file-input').click())

        let file_chooser = profile_picture.find('.file-input')
        file_chooser.change(() => updateProfilePicture(file_chooser, profile_picture.find('figure.image')))

        sidebar.append(profile_picture)

        let menu = $(`
            <aside class="menu">
                <p class="menu-label">General</p>
                <ul class="menu-list" id="general"></ul>
                <p class="menu-label">Billing</p>
                <ul class="menu-list">
                    <li><a href="${_DOMAIN}/billing">
                        <span class="icon"><i class="fas fa-money-check-alt"></i></span>
                        <span>Manage Plan</span>
                    </a></li>
                </ul>
                <p class="menu-label">Security</p>
                <ul class="menu-list" id="security"></ul>
            </aside>
        `)

        function scrollTo(element, fromElement){
            $([document.documentElement, document.body]).animate({
                scrollTop: element.offset().top
            }, 2000);
        }
        //// GENERAL ////

        let scrollToGeneral = $(`
            <li><a>
                <span class="icon"><i class="fas fa-user"></i></span>
                <span>Account</span>
            </a></li>
        `).click(() => scrollTo(name_fields, scrollToGeneral))
        menu.find('#general').append(scrollToGeneral)

        let scrollToDefaults = $(`
            <li><a>
                <span class="icon"><i class="fas fa-file-alt"></i></span>
                <span>Sheet defaults</span>
            </a></li>
        `).click(() => scrollTo(name_fields, scrollToDefaults))
        menu.find('#general').append(scrollToDefaults)

        let scrollToNotifications = $(`
            <li><a>
                <span class="icon"><i class="fas fa-envelope-open-text"></i></span>
                <span>Notifications</span>
            </a></li>
        `).click(() => scrollTo(name_fields, scrollToNotifications))
        menu.find('#general').append(scrollToNotifications)
        
        //// SECURITY ////

        let password_changer = $(`
            <li><a>
                    <span class="icon"><i class="fas fa-key"></i></span>
                    <span>Change Password</span>
            </a></li>
        `).click(() => changePassword())
        menu.find('#security').append(password_changer)

        let twoFactor_changer = $(`
            <li><a>
                <span class="icon"><svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="shield-alt" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="svg-inline--fa fa-shield-alt fa-w-16"><path fill="currentColor" d="M256 409.6V100l-142.9 59.5c8.4 116.2 65.2 202.6 142.9 250.1zM466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 91.1 16 108.6 16 128c0 198.5 114.5 335.7 221.5 380.3 11.8 4.9 25.1 4.9 36.9 0C360.1 472.6 496 349.3 496 128c0-19.4-11.7-36.9-29.5-44.3zM256 464C158.5 423.4 64 297.3 64 128l192-80 192 80c0 173.8-98.4 297-192 336z" class=""></path></svg></span>
                <span>${PREFERENCES.twofactor.enabled ? 'Update Two Factor' : 'Enable Two Factor'}</span>
            </a></li>
        `).click(() => setup2FA(twoFactor_changer))
        menu.find('#security').append(twoFactor_changer)

        sidebar.append(menu);
    }

    render();

}();