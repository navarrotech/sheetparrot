/* Init error reporting as early as possible */

window.onerror = function (msg, source, lineNo, columnNo, error) {
    console.log("Error detected... Reporting now")
    let body = {
            msg,
            source,
            lineNo,
            columnNo,
            error:error&&error.stack?error.stack:error,
            screenX:screen.width,
            screenY:screen.height,
    }
    if(navigator && navigator.userAgent){
        body.userAgent = navigator.userAgent
    }
    try{
        // Opera 8.0+
        var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;

        // Firefox 1.0+
        var isFirefox = typeof InstallTrigger !== 'undefined';

        // Safari 3.0+ "[object HTMLElementConstructor]" 
        var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && window['safari'].pushNotification));

        // Internet Explorer 6-11
        var isIE = /*@cc_on!@*/false || !!document.documentMode;

        // Edge 20+
        var isEdge = !isIE && !!window.StyleMedia;

        // Chrome 1 - 79
        var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

        // Edge (based on chromium) detection
        var isEdgeChromium = isChrome && (navigator.userAgent.indexOf("Edg") != -1);

        // Blink engine detection
        var isBlink = (isChrome || isOpera) && !!window.CSS;

        if(isOpera){ body.browser = "Opera" }
        if(isFirefox){ body.browser = "Firefox" }
        if(isSafari){ body.browser = "Safari" }
        if(isIE){ body.browser = "Internet Explorer" }
        if(isEdge){ body.browser = "Edge" }
        if(isChrome){ body.browser = "Chrome" }
        if(isEdgeChromium){ body.browser = "Edge Chromium" }
        if(isBlink){ body.browser = "Blink" }
    }
    catch(e){ body.browser == "Unknown" }

    fetch(window.location.origin + '/log/localError', {
        method: 'POST',
        credentials: "same-origin",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
}

/* <---- Styling ----> */
    /* Typography */
function fancyCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}
function fancyNumber(str){ // Changes '50' into '50.00' or '1000000' into '1,000,000'
    return (str).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}
function formatStripeNumber(str='000'){
    str = String(str)
    if(str == ''){ str="000" }
    if(str.length == 1){ str = "00" + str }
    else if(str.length == 2){ str = "0" + str }

    if(str.startsWith('-'))
        return "-$" + str.slice(1, -2) + '.' + str.slice(-2)
    else
        return "$" + str.slice(0, -2) + '.' + str.slice(-2)
}
function numberToDoubleDigit(text){
    text = String(text)
    if(text.length === 1)
        text = '0' + text
    return text
}
function prettyPrintTimeBetweenTwoDates(then_date, now_date){
    let then = new Date(String(then_date)),
        now  = new Date(String(now_date)),
        mils = now.getTime() - then.getTime(),
        mins = Math.ceil( mils / (1000 * 60) ),
        hrs  = Math.ceil( mils / (1000 * 3600) ),
        days = Math.round( mils / (1000 * 3600 * 24) ),
        r = ''

        // If it was in the same day, within the minute
        if(days == 0 && mins <= 2){
            r = "one minute"
        }
        // If it was within the hour
        else if(days == 0 && mins >= 2 && mins < 60){
            r = mins + " minutes"
        }
        // If it was within the day
        else if(days == 0 && mins > 60){
            let mns = mins - 60
            if(mns % 60 != 0)
                r = Math.floor(mins / 60) + " hours and " + String(mns % 60) + " minutes"
            else
                r = Math.floor(mins / 60) + " hours"
        }
        // If it was yesterday
        else if(days == 1){
            r = "one day"
        }
        // If it's within the last month:
        else if(days >= 2 && days <= 30){
            r = days + " days"
            
            let leftover_hrs = hrs % 24,
                leftover_mins= mins % 60

            if(leftover_hrs !== 0 || leftover_mins == 0)
                r += ` and ${leftover_hrs} hours`
            else
                r += ` and ${leftover_mins} minutes`
        }
        // If it's longer than a month:
        else if(days > 30){
            r = Math.round(days / 30)
            r = (r == 1) ? "1 month" : r + " months"
        }
        // If it's longer than a year:
        else if(days > 365){
            r = Math.round(days / 365)
            r = (r == 1) ? "1 year" : r + " years"
        }
        return r;
}
function rgbToHex(cssRGBstring) {
    return `#${rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/).slice(1).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('')}`
}
function howLongAgo(then_date){
    let then = new Date(String(then_date)),
        now  = new Date(),
        mils = now.getTime() - then.getTime(),
        mins = Math.ceil( mils / (1000 * 60) ),
        hrs  = Math.ceil( mils / (1000 * 3600) ),
        days = Math.round( mils / (1000 * 3600 * 24) ),
        r = ''

        // If it was in the same day, within the minute
        if(days == 0 && mins <= 2){
            r = "one minute ago"
        }
        // If it was within the hour
        else if(days == 0 && mins >= 2 && mins < 60){
            r = mins + " minutes ago"
        }
        // If it was within the day
        else if(days == 0 && mins > 60){
            let mns = mins - 60
            r = Math.floor(mins / 60) + " hours ago"
        }
        // If it was yesterday
        else if(days == 1){
            r = "yesterday"
        }
        // If it's within the last month:
        else if(days >= 2 && days <= 30){
            r = days + " days ago"
        }
        // If it's longer than a month:
        else if(days > 30){
            r = Math.round(days / 30)
            r = (r == 1) ? "1 month ago" : r + " months ago"
        }
        // If it's longer than a year:
        else if(days > 365){
            r = Math.round(days / 365)
            r = (r == 1) ? "1 year ago" : r + " years ago"
        }
        return r;
}

// USAGE: $(Q)uery (S)elector (A)ll, and $(Q)uery (S)elector
var $QSA = function(selector){
    let A = document.querySelectorAll(selector)
    if(!A)
        $ERR("Unable to find any elements that match: " + selector)
    return A
}
var $QS = function(selector){
    let A = document.querySelector(selector)
    if(!A)
        $ERR("Unable to find element: " + selector)
    return A
}
// Advanced error reporting can be built out through this
var $ERR = function(message){
    console.log("[WARNING] " + message)
    if(typeof message === "object"){
        console.log("[NEW ERROR]")
        console.error(message)
    }
}
// Sends a standard JSON fetch promise to server and returns text response.
var $POST = function(request_path, data, callback){
    if(!request_path.startsWith('/')){ request_path = '/' + request_path }

    return new Promise(async (resolve, reject) => {
        let result = await fetch(window.location.origin + request_path, {
            method: 'POST',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        if(result.status == 500){ try{ toast(`Internal Server Error. Something went wrong on our end. We've already been notified and should have this fixed soon! Feel free to <a href="${_DOMAIN}/support" target="_blank">reach out to us and provide more details here.</a>`, "danger", true, true) } catch(e){ console.error(e) } }
        let text;
        if(callback){
            text = await result.text();
            callback(result, text);
            return;
        } 
        else{
            resolve(result);
        }
    })
    .catch(err => {
        console.error(err);
        if(callback){ callback({ status:501 }, "Internal server error." ) }
    })
} // Usage: $POST('/api/test', {}, (result, text) => {})

var $GET = async function(request_path, callback){
    if(!request_path.startsWith('/')){ request_path = '/' + request_path }
    
    return new Promise(async (resolve, reject) => {
        let result = await fetch(window.location.origin + request_path, {
            method: 'GET',
            credentials: "same-origin",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        let text;
        if(callback){
            text = await result.text()
            callback(result, text);
            return;
        }
        else{
            resolve(result);
        }
    })
    .catch(err => {
        console.error(err);
        if(callback){ callback({ status:501 }, "Internal server error." ) }
    })

} // Usage: $GET('/api/test', {}, (result, text) => {})

// USAGE: Sets a class of an element
// ("#myID", "classList-Item", true)
// Either a node element or a string selector can be passed into el, and node element is returned.
var $CLASS = function(el, cls, ison){
    if(typeof el === "string")
        el = $QS(el)

    if(el && cls){
        if(ison === true)
            el.classList.add(cls)
        else if(ison === false)
            el.classList.remove(cls)
        else
            el.classList.toggle(cls)
    }
    return el
}

/* <---- Data ----> */
    /* Cookies */
function setCookie(cname, cvalue, exdays) {
  let d = new Date(), expires = "";
  if(exdays !== 0){
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    expires = "expires="+ d.toUTCString() + ";";
  }

  // Format cvalue to be compatible with document cookie
  // Illegal chars: =,;

  if(typeof cvalue == 'string'){

  cvalue = cvalue.replaceAll('=',  '{{&#61}}')
  cvalue = cvalue.replaceAll(',',  '{{&#44}}')
  cvalue = cvalue.replaceAll('\'', '{{&#34}}')
  cvalue = cvalue.replaceAll('\"', '{{&#39}}')
  cvalue = cvalue.replaceAll(';',  '{{&#59}}')

  }
  document.cookie = cname + "=" + cvalue + ";" + expires + "path=/;secure;samesite=strict;";
}
function deleteCookie(cname) {
  document.cookie = cname + "=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/";
}
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
        let f = c.substring(name.length, c.length);
        
        if(typeof cvalue == 'string'){
            f = f.replaceAll('{{&#61}}', '=' )
            f = f.replaceAll('{{&#44}}', ',' )
            f = f.replaceAll('{{&#39}}', '\"')
            f = f.replaceAll('{{&#34}}', '\'')
            f = f.replaceAll('{{&#59}}', ';' )
        }
        
        return f;
    }
  }
  return "";
}
/* <---- Colorlight ---> */
function calculateColorlight(hexColor){
    var color = (hexColor.charAt(0) === '#') ? hexColor.substring(1, 7) : hexColor;

    var r = parseInt(color.substring(0, 2), 16); // hexToR
    var g = parseInt(color.substring(2, 4), 16); // hexToG
    var b = parseInt(color.substring(4, 6), 16); // hexToB

    var uicolors = [r / 255, g / 255, b / 255];
    var c = uicolors.map((col) => {
        if (col <= 0.03928) { return col / 12.92; }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    var L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return (L > 0.6) ? "0,0,0" : "255,255,255";
}
/* <---- Messaging ---> */
function toast(message, color="link", islight, stayup=false, message_stayup_time=7500){
    console.log("[TOAST] " + message)

    let toast = $QS('.toast'),
        hermes = $QS('.toast #hermes')

    if(!toast){ console.error("CANNOT TOAST: .toast ELEMENT NOT PRESENT"); return document.createElement('div'); }

    $CLASS(toast, "is-active", true)

    let msg = displayMessage(message, color + ' is-spawning', islight)

    let progressbar = document.createElement('div'),
        progress_chunk = document.createElement('div')

    if(!stayup){

        progress_chunk.style.width = "100%"
        progress_chunk.style.transitionDuration = message_stayup_time + "ms"

        progressbar.className = "multi-progress"
        progress_chunk.className = "chunk is-dynamic"
        progressbar.appendChild(progress_chunk)

        msg.appendChild(progressbar)

        setTimeout(function(){ if(hermes.childElementCount == 0){ $CLASS(toast, 'is-active', false); } }, message_stayup_time + 1000)
        
        setTimeout(function(){

            $CLASS(msg, 'is-spawning', true);
            setTimeout(() => { msg.remove(); }, 650);

        }, message_stayup_time)
    }
    setTimeout(() => {
        $CLASS(msg, 'is-spawning', false)
        progress_chunk.style.width = "0%"
    }, 50)

    return msg
}

function removeFromArray(array, val){
    const index = array.indexOf(val);
    if (index > -1) { array.splice(index, 1); }
}

    /* Parameters */
function getParam(param){
    let urly = new URLSearchParams( window.location.search );
    return urly.get(param) || undefined
}
function resetURL(set_to){
    /* Reset URL at the top */
    window.history.pushState("", "", set_to);
}

/* <---- Form Validation ----> */
    /* In-depth validation */
function validate(selector){
    let A = $QS(selector), validity = false
    if(A && A.type === "email"){
        if (A && (A.value.length >= 3) && (A.value.includes("@")) )
             validity = true
        else{
            makeInputInvalid(A)
            validity = false
        }
    } else if(A){
        if (A && (A.value.length >= 3) )
             validity = true
        else{
            makeInputInvalid(A)
            validity = false
        }
    }
    return validity
}
function makeInputInvalid(el){
    $CLASS(el, "is-danger", true)
    
    let handler = function(event){
        $CLASS(event.target, "is-danger", false)
        event.target.removeEventListener('click', handler)
    }
    el.addEventListener('click', handler)
}

/* <---- Pagination ----> */
function paginate(paginator_list_element, total_size, page_limit, current_page, onclickFn){
    try{
        paginator_list_element.innerHTML = ""
        current_page = parseInt(current_page)
        let total_pages;
        if(total_size != 0 && (total_pages = (Math.ceil(total_size / page_limit))) !== 1 ){ // If there's only one page, don't show the pagination

            let add_link = function(number=1, iscurrent=false){
                let A = document.createElement('li')
                if(iscurrent){
                    A.innerHTML = "<a class=\"pagination-link is-current\">"+String(number + 1)+"</a>"
                }
                else {
                    A.innerHTML = "<a class=\"pagination-link\">"+String(number + 1)+"</a>"
                    A.addEventListener('click', () => onclickFn(number))
                }
                paginator_list_element.appendChild(A)
            }
            let add_ellipsis = function(){
                let A = document.createElement('li')
                A.innerHTML = "<span class=\"pagination-ellipsis\">&hellip;</span>"
                paginator_list_element.appendChild(A)
            }

            // First Page
            if( ((current_page - 1) >= 1) ){ // -1 >= 1 = false
                add_link(0, false)
                add_ellipsis()
            }

            // Previous page
            if((current_page - 1) >= 0 ){
                add_link((current_page - 1), false)
            }
            
            // Current page
            add_link(current_page, true)

            // Next page
            if((current_page + 1) < total_pages){
                add_link((current_page + 1), false)
            }
            // Last page
            if( !((current_page + 1) >= total_pages) && !((current_page + 2) >= total_pages) ){
                add_ellipsis()
                add_link((total_pages - 1), false)
            }
            
        }
        if(paginator_list_element.classList.contains('is-hidden'))
            paginator_list_element.classList.remove('is-hidden')
    } catch(e){ $ERR(e) }
}

/* <---- Client Messaging ----> */
    /* Messaging to client */
function displayMessage(message, type='info', isdark=false){
    let E = $QS("#hermes")
    if(E){
        let letter = document.createElement("div")
        
        /* Add style necessary */
        letter.className = 'block notification mb-4 is-' + type + (isdark ? '' : ' is-light')
        
        /* Set the message content */
        letter.innerHTML = message;
        
        /* Close button */
        let close = document.createElement("button")
        close.className = "delete"
        close.addEventListener('click', function(event){
            letter.remove()
            let toast = document.querySelector('.toast')
            if(toast && E.childElementCount == 0){
                $CLASS(toast, 'is-active', false)
            }
        });
        
        letter.appendChild(close)
        
        E.appendChild(letter)
        E.style.display = "block"

        return letter;
    } else {
        $ERR('HERMES NOTIFICATION BOX NOT FOUND!')
    }
}
function clearAllMessages(){
    let E = $QS('#hermes')
    if(E){
        E.innerHTML = ''
    }
    else {
        $ERR('HERMES NOTIFICATION BOX NOT FOUND!')
    }
}

/* <----- Confetti :D -----> */
function fireconfetti(){
    try{
        let count =200;
        let defaults = { origin: { y: 0.7 } };

        function fire(particleRatio, opts) {
          confetti(Object.assign({}, defaults, opts, {
            particleCount: Math.floor(count * particleRatio)
          }));
        }

        fire(0.25, { spread: 26, startVelocity: 55 });
        fire(0.2, { spread: 60 });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
        fire(0.1, { spread: 120, startVelocity: 45 });
    } catch(e){
        $ERR("Unable to fire confetti. Is it added in the header?")
    }
}

/* <---- Bulma.io ----> */
function initDropdowns(primary_query='.dropdown'){
    let dropdowns = document.querySelectorAll(primary_query)
    dropdowns.forEach(dropdown => {
        initDropdown(dropdown)
    })
}
function initDropdown(dropdown, onClose){

        /* Add an event listener for each dropdown on page */
        let trigger = dropdown.querySelector(".dropdown-trigger"),
            handler = function(event){
            
                dropdown.classList.toggle("is-active")
                
                /* Listen to if we need to close it */
                let handler = function(event){
                    if(!dropdown.contains( event.target )){
                        dropdown.classList.remove("is-active")
                        document.removeEventListener('click', handler)
                        if(onClose){ onClose(); }
                    }
                }
                document.addEventListener('click', handler)
            }
            
        trigger.addEventListener('click', handler)
}
function initModal(modalID, onclose){
    let modal = document.querySelector('#' + modalID)
    if(modal){
        
        /* Add a listener to the background */
        let bkg = modal.querySelector(".modal-background")
        if(bkg){
            bkg.addEventListener('click', () => {modal.classList.remove("is-active"); if(onclose) {onclose()}})
        }
        
        /* Add a listener to the close button */
        let close = modal.querySelectorAll("button"),
            close2 = modal.querySelectorAll("a")

        if(close){
            close.forEach(btn => {
                if(btn.getAttribute("aria-label") === "close")
                    btn.addEventListener('click', () => {modal.classList.remove("is-active"); if(onclose) {onclose()}})
            })
        }
        if(close2){
            close2.forEach(btn => {
                if(btn.getAttribute("aria-label") === "close")
                    btn.addEventListener('click', () => {modal.classList.remove("is-active"); if(onclose) {onclose()}})
            })
        }
        
    }
}
function establishReferrer(){

    if(localStorage && localStorage.getItem('cookie_analytics_disabled') == 'true'){ return 'disabled'; }

    let existing_ref = localStorage.getItem('sheetparrot_referrer'),
        ref = document.referrer,
        official_referrer = getParam('referrer')

    if(existing_ref || official_referrer){ console.log("Existing Referrer Found: " + existing_ref); ref=existing_ref; }
    else{
        let utm_campaign = getParam('utm_campaign'),
            ref_param = getParam('ref'),
            affiliate = getParam('afmc') || getParam('affiliate')

        if(ref){
            let part_1 = (affiliate) ? 'affiliate_' + affiliate + '_' : (utm_campaign) ? 'utm_campaign_' + utm_campaign + '_' : (ref_param) ? 'ref_' + ref_param + '_' : '' 

            let url = new URL(ref)
            if(url && url.origin){
                // Social Media checks
                if(url.origin.includes("youtube")){ ref = "YouTube" }
                else if(url.origin.includes("facebook")){ ref = "Facebook" }
                else if(url.origin.includes("medium")){ ref = "Medium" + url.pathname }
                else if(url.origin.includes("twitter")){ ref = "Twitter" }
                else if(url.origin.includes("instagram")){ ref = "Instagram" }
                
                // Internal blogs check
                else if(url.origin.includes("blog.sheetparrot.com")){ ref = "Our Blog" }
                else if(url.origin.includes("www.sheetparrot.com")){ ref = "Self" }
                // Search engine checks
                else if(url.origin.includes("google")){ ref = "Google Search" }
                else if(url.origin.includes("yahoo")){  ref = "Yahoo Search"  }
                else if(url.origin.includes("bing")){   ref = "Bing Search"   }
            }

            ref = part_1 + ref
        }
        else {
            if(utm_campaign){ ref = 'utm_campaign_' + utm_campaign }
            else if(affiliate){ ref = 'affiliate_' + affiliate }
            else if(ref_param){ ref = 'ref_' + ref_param }
            else{ ref = "direct" }
        }
        localStorage.setItem("sheetparrot_referrer", ref)
    }

    return ref;
}
function initHamburger(){
    let trigger = document.querySelector(".navbar-burger")
    let menu = document.querySelector(".hamburger-menu")
    if(trigger && menu){
        trigger.addEventListener('click', () => menu.classList.toggle('is-block'))
    }
}
function showLoading(message, size="large"){
    let wrapper = document.createElement("div")
    wrapper.id = "loader-wrapper"
    wrapper.innerHTML = "<div class=\"loader is-overlay " + size + "\">"

    let text;
    if(message){
        text = document.createElement('p')
        text.className = "loader-overlay-text"
        text.innerHTML = message
        wrapper.appendChild(text)
    }

    let body = $QS('body')

    body.insertBefore(wrapper, body.firstElementChild)
}
function JSONforEach(obj, fn){
    if(typeof obj !== 'object'){ throw new Error("Given object is not a object") }
    try{
        let len = Object.keys(obj)
        let iteration; for(iteration=0; iteration<len.length; iteration++){
            let key = len[iteration], value = obj[len[iteration]]
            fn(key, value, iteration)
        }
    } catch(e){ console.error(e) }
}

function hideLoading(){
    try{
        $QS('#loader-wrapper').remove()
    } catch(e){  }
}

function tighten(t){
    t = t.trim()
    t = t.replaceAll('\n','')
    t = t.replace(/^\s+|\s+$|\s+(?=\s)/g, '')
    return t;
}

function onDocumentLoad(fn){
    if ( document.readyState === "complete" || (document.readyState !== "loading" && !document.documentElement.doScroll)) { fn() } 
    else { document.addEventListener("DOMContentLoaded", fn); }
}
function initTextAreaLimit(TA){
    let newHelper = document.createElement('p')
    newHelper.className = 'help textarea--textleft'
    let maxLen = parseInt(TA.getAttribute('maxlength') || 0)
    if(maxLen){
        TA.addEventListener('input', () => {
            if(TA.value.length !== 0)
                newHelper.innerHTML = String(maxLen - TA.value.length) + ' / ' + String(maxLen)
            else
                newHelper.innerHTML = ''
        })
    }
    TA.parentNode.insertBefore(newHelper, TA.nextElementSibling)
}
function initTextAreaLimits(){
    let textareas = $QSA('textarea:not(.nohelper):not(.is-hidden)')
    textareas.forEach(TA => { initTextAreaLimit(TA); })
}
  
function simplify(text){
    text = String(text)

    text = text.replaceAll('&quot;'  ,"\"")
    text = text.replaceAll('&#096;'  ,"\'")
    text = text.replaceAll('&amp;'   ,"&")
    text = text.replaceAll('&equals;',`=`)
    text = text.replaceAll('&lt;'    ,`<`)
    text = text.replaceAll('&gt;'    ,`>`)

    return text;
}

function loginRequired(feature_message="Access to this feature requires a free account with SheetParrot."){
    let modal = $(`
        <div class="modal is-active is-tiny">
            <div class="modal-background"></div>
            <div class="modal-content">
                <div class="box has-text-centered">
                    <div class="block">
                        <h1 class="title">Login or Signup</h1>
                    </div>
                    <div class="block">
                        <p>
                            ${feature_message}
                        </p>
                    </div>
                    <div class="block">
                        <div class="buttons is-centered">
                            <a class="button is-primary is-normal" href="${_DOMAIN}/login?redirect=${encodeURI(window.location.href)}">
                                <span>Login</span>
                            </a>
                            <a class="button is-primary is-normal is-outlined" href="${_DOMAIN}/signup?redirect=${encodeURI(window.location.href)}">
                                <span>Signup</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `)

    modal.find('.modal-background').click(() => { modal.remove(); })

    $('body').append(modal);
}

function localStorageSize(){
    var _lsTotal=0, _xLen, _x;
    for(_x in localStorage){
        if(!localStorage.hasOwnProperty(_x)){continue;}
        _xLen = ((localStorage[_x].length + _x.length)* 2);_lsTotal+=_xLen;
    };
    return ((_lsTotal / 1024).toFixed(3));
}

function autoSizeTextarea(element){
    element.css({ 'min-height':'unset', 'overflow-y':'hidden' })
    element.outerHeight(38).outerHeight(element.prop('scrollHeight'));
    element.on('input', () => element.outerHeight(38).outerHeight(element.prop('scrollHeight')))
    return;
    if(element instanceof jQuery){ element = element.get()[0] }
    element.setAttribute("style", "height:" + (element.scrollHeight) + "px;overflow-y:hidden;min-height:unset;");
    element.addEventListener("input", () => { element.style.height = "auto"; element.style.height = (element.scrollHeight) + "px"; }, false);
}
function cookieBanner(){
    if(localStorage && localStorage.getItem('accepted_cookiebanner') == 'true'){ return; }
    let banner = $("<div class=\"cookie-banner\"><div class=\"notification\">"
    +"<div class=\"twobox container is-max-widescreen is-centered\">"
    +"<p class=\"mb-4 has-text-centered-mobile\">Like all other sites on the web, SheetParrot uses cookies! By clicking “Allow All” you agree to the storing of cookies on your device to enhance site navigation, analyze site usage, and assist in our marketing efforts. <a href=\""+_DOMAIN+"/cookies\" target=\"_blank\">Cookie Policy</a></p>"
    +"<div class=\"buttons is-centered\"><a class=\"button is-normal disallow\">Disable All</a><a class=\"button is-normal is-primary allow\">Allow Cookies</a></div>"
    +"<button class=\"delete\"></button>"
    +"</div>"
    +"</div></div>")
    banner.on('click', '.delete', () => {
        localStorage && localStorage.setItem('accepted_cookiebanner', true)
        banner.remove();
        $('body').removeClass("cookie-banner-active")
    })
    banner.on('click', '.allow', () => {
        banner.remove(); 
        $('body').removeClass("cookie-banner-active")
        localStorage && localStorage.setItem('accepted_cookiebanner', true)
    })
    banner.on('click', '.disallow', () => {
        localStorage && localStorage.setItem('cookie_marketing_disabled', 'true')
        localStorage && localStorage.setItem('cookie_analytics_disabled', 'true')
        localStorage && localStorage.setItem('accepted_cookiebanner', true)
        banner.remove();
        $('body').removeClass("cookie-banner-active")
    })

    $('body').append(banner)
    $('body').addClass("cookie-banner-active")
}

function promptToUpgrade(){
    console.log("prompting to upgrade now!")
    // <script src="https://player.vimeo.com/api/player.js"></script>
    let modal = $(`<div class="modal is-active">
        <div class="modal-background" action="close"></div>
            <div class="modal-card">
            <header class="modal-card-head">
                <p class="modal-card-title has-text-weight-bold">Unlock Pro Features Now For Just $15!</p>
                <button class="delete" aria-label="close" action="close"></button>
            </header>
            <section class="modal-card-body">
                <!--<figure class="image is-16by9">
                    <iframe src="https://player.vimeo.com/video/640469860?h=fe6cabcf49&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;" title="Video Placeholder"></iframe>
                </figure>-->
                <div class="content">
                    <p>
                        Take advantage of everything SheetParrot has to offer with our upgraded features.
                    </p>
                    <p>
                        <b>Here's what you get when you upgrade to the next plan:</b>
                    </p>
                    <ul>
                        <li>
                            Create Unlimited Sheets
                        </li>
                        <li>
                            Upload &amp; Add photos to questions
                        </li>
                        <li>
                            Unlock all question types
                        </li>
                        <li>
                        Use your school's logo and title on sheets
                        </li>
                    </ul>
                    <p>
                        Get the most out of sheetparrot, help save the planet by going paperless, and be a part of the future of education!
                    </p>
                    <p>
                        All for a rate you'll love. It's a win win for everybody.
                    </p>
                    <p>
                        Click the upgrade button now, and start your plan today.
                    </p>
                </div>
            </section>
            <footer class="modal-card-foot buttons is-right">
                <a class="button" action="close">Cancel</a>
                <a class="button is-primary" href="${_DOMAIN}/stripe/checkout">Upgrade now</a>
            </footer>
        </div>
    </div>`)
    modal.on('click', '[action=close]', () => { modal.remove(); })
    $('body').append(modal)
}

if(!crypto){ crypto = {} }
if(!crypto.randomUUID){
    crypto.randomUUID = function(){
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }
}

onDocumentLoad(function(){
    initDropdowns()
    initHamburger()
    initTextAreaLimits()
    if(!window.SheetParrot){ window.SheetParrot = {} }
    window.SheetParrot.DynamicCache = new DynamicCache();
});