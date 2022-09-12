class DynamicCache{

    /*
        this.cache = [] master array object
        STRUCTURE: [
            {
                key:'123456'
                expires:new Date() + days,
                data:{ ... }
            }
        ]
    */

    constructor(){
        this.establish();
    }
    establish(){
        if(this.cache){ return true; }
        // Setup this.cache
        if(!this.getRoot()){ this.cache = []; this.setRoot(); }
        // Check for any expired tokens
        let expired = []
        this.cache.forEach((item, item_index) => { if(moment(item.expires).isBefore()){ expired.push(item_index) } })
        if(expired.length){
            expired.reverse().forEach(i => this.remove(i)); // Remove from end to start!
            console.log("Removing expired keys:"); console.log(expired)
        }
        // Check if "too many" limit is reached
        let limit = 150;
        if(this.cache.length >= limit){ this.cache.splice(limit) }
    }
    setRoot(){ localStorage.setItem('sp_dynamic', JSON.stringify(this.cache?this.cache:[])); }
    getRoot(){ return localStorage.getItem('sp_dynamic')?(this.cache = JSON.parse(localStorage.getItem('sp_dynamic'))):null }
    remove(i){
        let c; this.establish();
        if(jQuery.type(i) == 'number'){ this.cache.splice(i,1); return; }
        if(jQuery.type(i) == 'string'){ this.cache = this.cache.filter(c => c.key != i); return; }
        throw new Error(`Cannot remove dynamic cache item using key/index [${i}]! Must be type number/integer!`)
    }
    find(i,raw=false){
        let c; this.establish();
        if(jQuery.type(i) == 'number'){ c = this.cache[i]; if(raw){ return c; }; return c?c.data:undefined }
        if(jQuery.type(i) == 'function'){ c = this.cache.find(i); if(raw){ return c; }; return c?c.data:undefined }
        if(jQuery.type(i) == 'string'){ c = this.cache.find(e => e.key == i); if(raw){ return c; }; return c?c.data:undefined }
        throw new Error(`DynamicCache was given type [${jQuery.type(i)}] for [${i}]`);
    }
    length(){ this.establish(); return this.cache.length; }
    insert({ expires_in_days=7, data={}, key=genid }={}){
        this.establish();
        let expires = new moment().add(expires_in_days, 'days').toISOString();

        let doc = {
            key,
            expires,
            data
        }
        this.cache.push(doc)
        this.setRoot();

        return doc;
    }
    update(key, new_data, upsert=true){
        let k = this.find(key, true)
        if(!k){ this.insert({ key, data:new_data }) }
        console.log({ key, k })
        if(k && k.data){
            let index = this.cache.findIndex(e => e.key == k.key)
            this.cache[index].data = new_data
            this.setRoot();
        }
        return false;
    }
    genid(){
        let t = "", p = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz";
        for (let i = 0; i < 11; i++){ t += p.charAt(Math.floor(Math.random() * p.length)) }
        return this.find(t)?this.genid():t;
    }
    forEach(fn){ this.cache.forEach((e,i) => fn(e.data,i)); }
    print(){ console.log({ cache:this.cache }) }
}