import moment from 'moment'

export default function(app, { authorization, tools, database, sendgrid }){

    const home_middleware = async (req, res, next) => {

        /* <-- Statistics --> */ 
        let $inc = {}, $set = {},
            whitelist = ['home', 'support', 'pricing', 'demo', 'create'],
            url = (req.url == '/') ? 'home' : (req.url || '').slice(1).replaceAll('/', '_'),
            visits_url = (whitelist.includes(url)) ? 'norm_visits.' + url + '.clicks' : 'misc_visits.' + url + '.clicks',
            //unique_url = (whitelist.includes(url)) ? 'norm_visits.' + url + '.uniques' : 'misc_visits.' + url + '.uniques',
            last_visit = (whitelist.includes(url)) ? 'norm_visits.' + url + '.last' : 'misc_visits.' + url + '.last'
            //unique = !(req.cookies && req.cookies['visited_' + url] && String(req.cookies['visited_' + url]) == 'true')

        // Hard code in Google Ad detection
        if(req.url.includes('?glid')){
            url = 'GOOGLE_ADS'
            visits_url = 'norm_visits.GOOGLE_ADS.clicks'
            unique_url = 'norm_visits.GOOGLE_ADS.uniques'
            last_visit = 'norm_visits.GOOGLE_ADS.last'
        }

        $inc[visits_url] = 1;
        $set[last_visit] = moment().format('dddd, MMM Do [at] h:mm a')

        //if(unique){ $inc[unique_url] = 1 }
        //res.cookie('visited_' + url, 'true', { maxAge:1000*60*60*24, httpOnly:true })

        database.dynamic_call({
            collection:'global',
            method:'updateOne',
            query:{ type:'constant' },
            actions:{ $inc, $set }
        });

        if(req.session && req.session.user && req.session.user.email && req.authorized){
            req.lexicon.user = req.session.user;
        }

        next();
    }

    app.get('/', home_middleware, (req, res) => res.render(process.env.NODE_ENV == 'production'?'home/home':'./home/home', req.lexicon))

    app.get('/home', home_middleware, (req, res) => res.redirect('/'))
    app.get('/support', home_middleware, (req, res) => res.render('./home/support', req.lexicon))
    app.get('/pricing', home_middleware, (req, res) => res.render('./home/pricing', req.lexicon))
    app.get('/create', home_middleware, (req, res) => {
        try{
            req.lexicon.default_brand = req.authorized ? req.session.user.preferences.interface.default_brand : ''
            req.lexicon.default_logo = req.authorized ? req.session.user.preferences.interface.default_logo : ''
            res.render('sheets/editor_demo', req.lexicon)
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

}