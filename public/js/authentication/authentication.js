var DEBUG = false;
class Authenticator{

    constructor({ type="teacher", auth="login", includeBox=true, isWhite=false, allowSwitching=false, redirect=true, subtitle="", prefill_email }={}){
        this.type = type;
        this.auth = auth;
        this.isWhite = isWhite; 
        this.redirect = "/dashboard";
        this.is_loading = false;
        this.step = this.auth == "login" ? "main" : "signup";
        this.onSuccess = () => {};
        this.redirect = redirect;
        this.subtitle = subtitle;
        this.allowSwitching = allowSwitching;
        this.includeBox = includeBox;

        this.elements = {
            _root:$(`<div class=""></div>`),
            title:$(`<h1 class="has-text-centered is-cera has-text-weight-bold ${isWhite?'has-text-white':''}"></h1>`),
            footer:$(`<div class="block has-text-centered"></div>`),

            google_actual: $(`<div id="google-signin"></div>`),
            google_double: $(`<a class="button is-google is-fullwidth abcRioButton abcRioButtonBlue"><div class="abcRioButtonIcon icon" style="padding:15px"><div style="width:18px;height:18px;" class="abcRioButtonSvgImageWithFallback abcRioButtonIconImage abcRioButtonIconImage18"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 48 48" class="abcRioButtonSvg"><g><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g></svg></div></div><span>${this.auth == 'login'?'Continue With Google':'Continue With Google'}</span></a>`),
            google_triple: $(`<a class="button is-google is-fullwidth abcRioButton abcRioButtonBlue"><div class="abcRioButtonIcon icon" style="padding:15px"><div style="width:18px;height:18px;" class="abcRioButtonSvgImageWithFallback abcRioButtonIconImage abcRioButtonIconImage18"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 48 48" class="abcRioButtonSvg"><g><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></g></svg></div></div><span>${this.auth == 'login'?'Continue With Google':'Continue With Google'}</span></a>`),
            google_field:  $(`<div class="field google-login" style="height:40px;"></div>`),
            google_button:$(`<a class="button is-loading is-fullwidth is-google"></a>`),

            facebook_field:$(`<div class="field facebook-login" style="height:40px;"></div>`),
            facebook_double:$(`<a class="button is-loading is-fullwidth is-facebook"><span class="icon"><i class="fab fa-facebook-square fa-2x"></i></span><span>${this.auth == 'login'?'Continue With Facebook':'Continue With Facebook'}</span></a>`),
            facebook:$(`<a class="button is-loading is-fullwidth is-facebook"><span class="icon"><i class="fab fa-facebook-square fa-2x"></i></span><span>${this.auth == 'login'?'Continue With Facebook':'Continue With Facebook'}</span></a>`),

            native_fields:$(`<div class="pb-4"></div>`),
            username:$(`<input class="input" name="email" type="email" placeholder="${this.auth=="login"?'Email':'Your Best Email'}" ${prefill_email?`value="${prefill_email}"`:''} autocomplete="email"/>`),
            password:$(`<input class="input" name="password" type="password" placeholder="Password" autocomplete="current-password"/>`),

            switcher:{
                login: $(`<li ${this.auth == 'login' ?`class="is-active"`:''}><a>Login</a></li>`),
                signup:$(`<li ${this.auth == 'signup'?`class="is-active"`:''}><a>Signup</a></li>`),
                parent:$(`<div class="tabs is-centered is-fullwidth px-4"><ul></ul></div>`)
            },

            first_name:  $(`<input class="input" name="first_name" type="text"     placeholder="First Name" autocomplete="given-name"  />`),
            last_name :  $(`<input class="input" name="last_name"  type="text"     placeholder="Last Name"  autocomplete="family-name" />`),
            new_password:$(`<input class="input" name="password"   type="password" placeholder="Password"   autocomplete="new-password"/>`),
            new_password_helper:$(`<p class="help is-hidden">Password must at least 8 characters long</p>`),
            
            next:{
                username:$(`<a class="button is-success is-fullwidth" disabled>Log in</a>`),
                password:$(`<a class="button is-success is-fullwidth" disabled>Log in</a>`),
                theauthy:$(`<a class="button is-success is-fullwidth" disabled>Log in</a>`),
                signup  :$(`<a class="button is-success is-fullwidth" disabled id="signup">Get Started</a>`)
            },

            goBack:[
                $(`<a></a>`), // Verify Password
                $(`<a></a>`), // Verify Google
                $(`<a></a>`), // Verify Facebook
                $(`<a></a>`)  // Verify 2FA
            ],

            windows:{
                main:$(`<div class="window verifyMain is-active"></div>`),
                verifyGoogle:  $(`<div class="window verifyGoogle"></div>`),
                verifyFacebook:$(`<div class="window verifyFacebook"></div>`),
                verifyPassword:$(`<div class="window verifyPassword"></div>`),
                verify2Factor: $(`<div class="window verify2FA"></div>`)
            }
        }
    }
    render(){

        if(getParam('email')){ this.elements.username.val(getParam('email')) }

        this.activeWindow = this.elements.windows.main;

        //this.changeType(this.type);

        $('body').append(`<div id="fb-root"></div>`)
        $('body').append(this.elements.google_actual)

        // Setting up 2FA
        this.verifyInputs = new VerificationInputs();

        // Appending everything together
        this.elements._root.append( // Title
            $(`<div class="${this.auth=="login"?'block':''}"></div>`).append(this.elements.title)
        )
        this.elements.google_field.append( // Google field
            this.elements.google_loading,
            this.elements.google_double
        )
        this.elements.facebook_field.append( // Facebook field
            this.elements.facebook
        )
        this.elements.windows.main.append( // Google + Facebook buttons
            $(`<div class="block"></div>`)
            .append(
                this.elements.google_field,
                this.elements.facebook_field
            )
        )
        this.elements.windows.main.append( // 'Or' block
            `<div class="block"><div class="is-divider" data-content="OR"></div></div>`
        )
        this.changeAuth(this.auth, false);

        // Native fields
        if(this.auth == "login"){
            let email_field = $(`<div class="block"><div class="field"><p class="control has-icons-left"><span class="icon is-small is-left"><i class="fas fa-envelope"></i></span></p></div></div>`)
            email_field.find('.control').prepend(this.elements.username)
            this.elements.native_fields.append( // Username ("email")
                email_field
            )
            this.elements.native_fields.append( // "first next button"
                $(`<div class="block"></div>`).append(this.elements.next.username)
            )
        }
        else{
            let email_field = $(`<div class="block"></div>`)

            let first_name = $(`<div class="field"><p class="control is-expanded has-icons-left"></p></div>`),
                last_name  = $(`<div class="field"><p class="control is-expanded has-icons-left"></p></div>`)

            first_name.find('p.control').append(this.elements.first_name).append(`<span class="icon is-small is-left"><i class="fas fa-user"></i></span>`)
            last_name.find('p.control').append(this.elements.last_name).append(`<span class="icon is-small is-left"><i class="fas fa-user"></i></span>`)

            let new_password = $(`<div class="field"><p class="control is-expanded has-icons-left"></p></div>`)
            new_password.find('p.control')
                .append(this.elements.new_password)
                .append(`<span class="icon is-small is-left"><i class="fas fa-lock"></i></span>`)
            new_password.append(this.elements.new_password_helper)
            
            // First & Last Name
            email_field.append(
                $(`<div class="field is-horizontal"><div class="field-body"></div></div>`)
            )
            email_field.find('.field-body').append( first_name, last_name )
            // Email
            email_field.append(
                `<div class="field"><p class="control has-icons-left" id="emailInput"><span class="icon is-small is-left"><i class="fas fa-envelope"></i></span></p></div>`
            )
            email_field.find('#emailInput').prepend(this.elements.username)
            // Password
            email_field.append(new_password)

            this.elements.native_fields.append( // Username ("email")
                email_field
            )
            this.elements.native_fields.append( // "signup button" && legal
                $(`<div class="block"></div>`).append(this.elements.next.signup),
                `<p class="field has-text-centered is-size-7 legal pb-4">By signing up, you are agreeing to SheetParrot's<br> <a href="https://www.sheetparrot.com/terms-of-service" target="_blank">Terms of Service</a> and <a href="https://www.sheetparrot.com/privacy-policy" target="_blank">Privacy Policy</a>.</p>`
            )
        }

        if(this.allowSwitching){
            this.elements.switcher.parent.find('ul').append(
                this.elements.switcher.login,
                this.elements.switcher.signup
            )
            this.elements.windows.main.append(
                this.elements.switcher.parent
            )
        }
        this.elements.windows.main.append(this.elements.native_fields)
        

        this.elements.windows.verifyPassword.append( // Password window
            $(`<div class="block"><p class="field has-text-centered">Welcome back!<br></p></div>`).find('p.field').append(this.elements.goBack[0]),
            $(`<div class="field"><label class="label">Password</label><p class="control has-icons-left"><span class="icon is-small is-left"><i class="fas fa-lock"></i></span></p></div>`).find('.control').prepend(this.elements.password),
            `<a class="block has-text-right" style="width:100%; display:block;" href="${_DOMAIN}/reset-password">Forgot Password</a>`,
            $(`<div class="block"></div>`).append(this.elements.next.password)
        )
        this.elements.windows.verifyGoogle.append( // Google window
            $(`<div class="block"><p class="field has-text-centered">Please login with Google.<br></p></div>`).find('p.field').append(this.elements.goBack[1]),
            this.elements.google_triple
        )
        this.elements.windows.verifyFacebook.append( // Facebook window
            $(`<div class="block"><p class="field has-text-centered">Please login with Facebook.<br></p></div>`).find('p.field').append(this.elements.goBack[2]),
            this.elements.facebook_double
        )
        this.elements.windows.verify2Factor.append( // 2FA window
            `<div class="field"><p class="is-size-7 has-text-centered">An authentication code has been sent to your device. Please enter the code generated by your authenticator app to continue.</p></div>`,
            this.elements.goBack[3],
            this.verifyInputs.render(true),
            $(`<div class="block"></div>`).append(this.elements.next.theauthy)
        )

        this.elements._root.append( // Windows to root
            $(`<div class="loginWindow ${this.includeBox?'box':''}"></div>`).append(
                this.elements.windows.main,
                this.elements.windows.verifyGoogle,
                this.elements.windows.verifyFacebook,
                this.elements.windows.verifyPassword,
                this.elements.windows.verify2Factor
            )
        )

        this.elements._root.append(this.elements.footer) // Footer

        this.elements.goBack.forEach(b => b.click(() => this.window_main()))

        this.elements.facebook_double.click(() => this.elements.facebook.click())
        this.elements.google_double.click(() => this.elements.google_actual.find('.abcRioButton').click())
        this.elements.google_triple.click(() => this.elements.google_actual.find('.abcRioButton').click())

        // Google login script
        let onGAPIscriptLoad = () => {
            console.log("Google Authentication API Loaded")
            gapi.signin2.render('google-signin', {
                'scope': 'profile email',
                'width': 0,
                'height': 0,
                'longtitle': true,
                'theme': 'dark',
                onsuccess:async (googleUser) => {
                    let profile = googleUser.getBasicProfile(),
                    auth2 = gapi.auth2.getAuthInstance();
        
                    let v = await this.validate('google', {
                        'ID'   :profile.getId(),
                        'first':profile.getGivenName(),
                        'last' :profile.getFamilyName(),
                        'image':profile.getImageUrl(),
                        'email':profile.getEmail(),
                        'token':googleUser.getAuthResponse().id_token
                    })
                    await auth2.signOut()
                    if(v){ await this.finish() }
                },
                onfailure:console.log
            });
        
            $('#google-loader').addClass('is-hidden')
            $('#google_button_2').click(() => { this.elements.google_actual.trigger('click') })
        }
        if(typeof gapi != 'undefined' && gapi && gapi.signin2 && gapi.signin2.render){  onGAPIscriptLoad(); } else{ $.getScript(`https://apis.google.com/js/platform.js`, onGAPIscriptLoad) }
        
        // Facebook login script
        let onFBAPIscriptLoad = (req, res) => {
            console.log(`Facebook Authentication API loaded with status [${req.status}] as ["${res}"]`);
            if(req.status != 200){ console.error(req); return; }
            window.fbAsyncInit = () => {
                FB.init({
                    appId  : '452964956443024',
                    cookie : true,
                    xfbml  : true,
                    version: 'v12.0'
                });
                
                if(!_DOMAIN.includes('localhost')){ FB.AppEvents.logPageView(); }
        
                const loginFB  = function(){ return new Promise(function(acc){ FB.login(acc, { scope: 'public_profile,email' }) }) }
                const logoutFB = function(){ return new Promise(function(acc){ FB.logout(acc) }) }
        
                this.elements.facebook
                    .removeClass('is-loading')
                    .click(async () => {
                        let loginStatus = await loginFB();
                        this.elements.facebook.addClass('is-loading')
                        console.log("Login to FB method finished")
                        if(loginStatus.status == 'connected'){ 
                            let token = loginStatus.authResponse.accessToken;
                            let v = await this.validate('facebook', { token })
                            await logoutFB();
                            if(v){ await this.finish() }
                        }
                        else{
                            console.error('Not connected to Facebook! Status: ' + loginStatus.status)
                        }
                        console.log("User finished logging into Facebook")
                        this.elements.facebook.removeClass('is-loading')
                    })
                this.elements.facebook_double.removeClass('is-loading')
        
            };
            (function(d, s, id){
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) {return;}
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
        }
        if(window.fbAsyncInit && FB && FB.init){ onFBAPIscriptLoad({ status:200 }, "success"); }
        else{ $.ajax({ url:`https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v12.0&appId=945177056347446&autoLogAppEvents=1`, dataType:'script', scriptAttrs:{ nonce:'LXStBKMV' }, complete:onFBAPIscriptLoad, }) }

        // Input logic

        // Disable next button until input is given
        this.elements.username.on('input change click', () => this.checkNext())
        this.elements.password.on('input change click', () => this.checkNext())

        this.elements.first_name   .on('input change click', () => this.checkNext())
        this.elements.last_name    .on('input change click', () => this.checkNext())
        this.elements.new_password .on('input change click', () => this.checkNext())
        this.elements.new_password .on('input change click', () => this.elements.new_password_helper.toggleClass('is-hidden', (
            this.elements.new_password.val() && this.elements.new_password.val().length < 8)?false:true))

        document.addEventListener('keydown', (event) => {
            if(event.key == 'Enter'){
                if(this.elements.username.is(":focus")){ this.elements.next.username.click() }
                if(this.elements.password.is(":focus")){ this.elements.next.password.click() }
                if(this.elements.new_password.is(":focus")){ this.elements.next.signup.click() }
            }
        });

        // Next buttons
        this.verifyInputs.onFinished(async (code) => {
            if(
                await this.validate('native', {
                    email:this.elements.username.val(),
                    password:this.elements.password.val(),
                    code
                })
            ){ await this.finish(); return; }
            this.verifyInputs.promptRetry();
        })
        this.elements.next.username.click(async () => {
            if(this.elements.next.username.attr('disabled')){ return; }
            this.elements.next.username.addClass('is-loading')
            let v = await this.validate('native', { email:this.elements.username.val() });
            if(v){ await this.finish(); return; }
            setTimeout(() => this.elements.next.username.removeClass('is-loading'), 501)
        });
        this.elements.next.password.click(async () => {
            if(this.elements.next.password.attr('disabled')){ return; }
            this.elements.next.password.addClass('is-loading')
            let v = await this.validate('native', { email:this.elements.username.val(), password:this.elements.password.val() });
            if(v){ await this.finish(); return; }
            setTimeout(() => this.elements.next.password.removeClass('is-loading'), 501)
        });
        this.elements.next.theauthy.click(async () => {
            if(this.elements.next.theauthy.attr('disabled')){ return; }
            this.elements.next.theauthy.addClass('is-loading')
            let v = await this.validate('native', { email:this.elements.username.val(), password:this.elements.password.val(), code:this.verifyInputs.getCode() });
            if(v){ await this.finish(); return; }
            setTimeout(() => this.elements.next.theauthy.removeClass('is-loading'), 501)
        });
        this.elements.next.signup.click(async () => {
            if(this.elements.next.signup.attr('disabled')){ return; }
            this.elements.next.signup.addClass('is-loading')
            let body = {
                email:this.elements.username.val(),
                first_name:this.elements.first_name.val(),
                last_name:this.elements.last_name.val(),
                password:this.elements.new_password.val(),
            }

            let referrer = localStorage.getItem('sheetparrot_referrer')
            if(referrer){ body.referrer = referrer; }

            let v = await this.validate('native', body);
            if(v){ await this.finish(); return; }

            this.elements.next.signup.removeClass('is-loading')
        });

        // Switching between login & signup
        this.elements.switcher.login.click(() => {
            this.elements.switcher.login.addClass('is-active')
            this.elements.switcher.signup.removeClass('is-active')
            if(this.auth != 'login'){ this.changeAuth('login', true); this.step = "main"; }
        })
        this.elements.switcher.signup.click(() => {
            this.elements.switcher.login.removeClass('is-active')
            this.elements.switcher.signup.addClass('is-active')
            if(this.auth != 'signup'){ this.changeAuth('signup', true); this.step = "signup"; } 
        })

        if(!window.SheetParrot){ window.SheetParrot = {} }
        window.SheetParrot.Authenticator = this;

        setTimeout(() => this.fixWindowHeight(), 1)
    }
    
    checkNext(){
        let target, condition;

        if(this.step == "main"){
            target = this.elements.next.username;
            condition = this.elements.username.val()?true:false;
        }
        else if(this.step == "password"){
            target = this.elements.next.password;
            condition = this.elements.password.val()?true:false;
        }
        else if(this.step == "2FA"){
            target = this.elements.next.theauthy;
            condition = this.verifyInputs.getCode().length == 6;
        }
        else if(this.step == "signup"){
            target = this.elements.next.signup;
            condition = this.elements.username.val() && this.elements.first_name.val() && this.elements.last_name.val() && this.elements.new_password.val().length >= 8;
        }
        else if(this.step == "google" || this.step == "facebook"){
            target = this.elements.next.username;
            condition = true;
        }
        if(condition){ target.removeAttr('disabled') }
        else{ target.attr('disabled', 'true') }
    }
    window_main(){
        this.revealWindow(this.elements.windows.main)
        this.checkNext()
        this.step = "main";
        this.checkNext()
    }
    window_native(){
        this.elements.goBack[0].text(`Not ${this.first_name}?`)
        this.revealWindow(this.elements.windows.verifyPassword)
        this.checkNext()
        this.step = "password";
        this.checkNext()
    }
    window_facebook(){
        this.elements.goBack[1].text(`Not ${this.first_name}?`)
        this.revealWindow(this.elements.windows.verifyFacebook)
        this.checkNext()
        this.step = "facebook";
        this.checkNext()
    }
    window_google(){
        this.elements.goBack[2].text(`Not ${this.first_name}?`)
        this.revealWindow(this.elements.windows.verifyGoogle)
        this.checkNext()
        this.step = "google";
        this.checkNext()
    }
    window_2FA(){
        this.revealWindow(this.elements.windows.verifyGoogle)
        setTimeout(() => { this.verifyInputs.focus() }, 100)
        this.checkNext()
        this.step = "2FA";
        this.checkNext()
    }
    revealWindow(win){
        this.activeWindow.addClass('is-hiding')
        this.fixWindowHeight(win);
        win.addClass('is-active')
        setTimeout(() => {
            let previously_active = this.activeWindow
            previously_active.css('display', 'none').removeClass('is-hiding').removeClass('is-active')
            this.activeWindow = win;
            setTimeout(() => previously_active.css('display', ''), 501)
        }, 500)
    }
    fixWindowHeight(window){
        let height = window ? window.prop('scrollHeight') : this.activeWindow.prop('scrollHeight')
        ///this.elements._root.find('.loginWindow').css('min-height', height + 'px') // Snappy
        this.elements._root.find('.loginWindow').animate({'min-height':height+'px'},300) // Animated & Smooth
    }

    async validate(method, body, fn, override){
        if(this.is_loading){ return; } this.is_loading = true;
    
        let referrer = localStorage.getItem('sheetparrot_referrer'); if(referrer){ body.referrer = referrer; }
        
        body.type = this.type;
    
        console.log({
            url:`/${override?override:this.auth}/${method}`,
            body
        })

        let req = await $POST(`/${override?override:this.auth}/${method}`, body),
            res = await req.json();
        
        //console.log({ req, res })

        this.login_response = res;

        let { status } = req,
            success = false;
        
        if(status == 200){
            if(fn){ await fn(); }
            this.redirect = this.redirect == false ? false : (res && res.redirect ? res.redirect : '/dashboard')
            success = true;
        }
        // If their account is not found, and they tried to login with Google or Facebook, we create an account for them.
        else if(status == 207 && ['facebook', 'google'].includes(method)){
            console.log(`No account found, continue with ${method} -> Signing user up`)
            this.is_loading = false;
            return await this.validate(method, body, fn, 'signup');
        }
        else if(status == 202){
            console.log({res})
            if(res.use == 'native')  { this.first_name = res.first_name?res.first_name:'you'; this.window_native(); }
            if(res.use == 'facebook'){ this.window_facebook(); }
            if(res.use == 'google')  { this.window_google(); }
        }
        else if(status == 406){
            this.window_2FA();
        }
        else if(status == 412){
            toast(res.message || "The 6 digit code you have entered for two factor authentication is incorrect, please try again.", "danger", true, false);
            $('.verification_inputs input').val('')
            $('.verification_inputs input')[0].focus()
        }
        else{
            toast(res.message, "dark", true, false); console.log({ req, res }); 
        }
        this.is_loading = false
        return success;
    }
    async finish(){
        if(this.onSuccess){ await this.onSuccess(this.login_response || null); }

        try{
            let payload = {}
            /* Send the server any localstorage items */
            let visitedHistory = localStorage.getItem('visitedHistory')
            if(visitedHistory){
                payload['visitedHistory'] = JSON.parse(visitedHistory)
                localStorage.removeItem(visitedHistory)
            }
            // Put public sheet creator data here! :)

            $POST('/dashboard/processLocalUpdates', payload)
        } catch(e){ console.log(e); }

        console.log({ redirect:this.redirect })
        if(this.redirect && !DEBUG){ window.location.href = _DOMAIN + this.redirect }
    }
    changeAuth(newAuth, rerender=false){
        // Validation
        if(!newAuth){ newAuth = (this.auth == 'login')?'signup':'login'; } // Toggle statement
        if(!['login', 'signup'].includes(newAuth)){ throw new Error(`Unknown Auth Mode: [${newAuth}]`) } // Direct setter whitelist filter
        this.auth = newAuth;

        // Ensuring they go back to the main step
        if(!['main', 'signup'].includes(this.step)){ this.revealWindow(this.elements.windows.main) }

        this.changeType(this.type)

        // Update the google & facebook buttons
        this.elements.google_double.find('span').text(newAuth == 'login'?'Continue With Google':'Continue With Google')
        this.elements.google_triple.find('span').text(newAuth == 'login'?'Continue With Google':'Continue With Google')
        
        this.elements.facebook.find('span:not(.icon)').text(newAuth == 'login'?'Continue With Facebook':'Continue With Facebook')
        this.elements.facebook_double.find('span:not(.icon)').text(newAuth == 'login'?'Continue With Facebook':'Continue With Facebook')

        // Update input hints
        this.elements.username.attr("placeholder", newAuth=="login"?'Email':'Your Best Email')

        if(rerender){
            this.elements._root.html('')
            this.elements.windows.main.html('')
            this.elements.windows.verify2Factor.html('')
            this.elements.windows.verifyFacebook.html('')
            this.elements.windows.verifyGoogle.html('')
            this.elements.windows.verifyPassword.html('')
            this.elements.native_fields.html('')
            this.render();
        }

        this.fixWindowHeight();
    }
    changeType(newType){
        if(!['teacher', 'student', 'any'].includes(newType)){ throw new Error(`Unknown Auth Type: [${newType}]`) } // Direct setter whitelist filter
        this.type = newType;
        let auth = fancyCase(this.auth);
        let title = newType == 'teacher' 
            ? `Teacher ${auth}`
            : newType == 'student' 
                ? `Student ${auth}`
                : `SheetParrot ${auth}`
        
        let subtitle = this.subtitle?`<p class="subtitle is-size-7">${this.subtitle}</p>`:''
        if(this.auth == "login" || newType == "student"){
            this.elements.title.html(`<p class="title is-size-1 has-text-weight-bold ${this.isWhite?'has-text-white':''}">${title}</p>${subtitle}`);
        }
        else{
            this.elements.title.html(
                `<p class="title is-size-3 has-text-weight-bold">Signup For Free</p>${subtitle}`
            )
        }
    }
}