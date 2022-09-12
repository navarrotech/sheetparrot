class VideoParser{

    constructor({ type, key }={ type:'vimeo', key:'640469860' }){ // Placeholder video
        this.type = (type) ? type : ''
        this.key  = (key)  ? key  : ''
    }

    getLink(){
        if(this.type == "youtube"){
            return `https://www.youtube.com/watch?v=${this.key}`;
        }
        if(this.type == "vimeo"){
            return `https://vimeo.com/${this.key}`
        }
        return '';
    }

    getEmbed(){
        let DNT = false; // Do not track settings
        if(localStorage && localStorage.getItem('cookie_analytics_disabled') == 'true'){ DNT = true; }
        if(this.type == "youtube"){
            return `https://www.${DNT?'youtube-nocookie':'youtube'}.com/embed/${this.key}`
        }
        if(this.type == "vimeo"){
            return `https://player.vimeo.com/video/${this.key}?badge=0&amp;autopause=0&amp;player_id=0&amp;` + (DNT?'&amp;dnt=true':'');
        }
        return '';
    }
    
    getIframe(){
        if(this.type == "youtube"){
            return `<iframe class="has-ratio" src="${this.getEmbed()}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        }
        if(this.type == "vimeo"){
            return `<iframe class="has-ratio" src="${this.getEmbed()}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
        }
        return '';
    }

    parse(link=''){

        link = link.trim()

        this.key  = ''
        this.type = ''

        if(link && link.match(/vimeo\.com/)){
            this.type = "vimeo";
            this.key  = (link.match(/\/[0-9]{9}/gm) || ' ')[0].substring(1)
        }

        if(link && link.match(/youtube\.com|youtu\.be/)){
            this.type = "youtube"
            this.key  = (link.match(/[=\/][0-9a-zA-Z_-]{11}/gm) || ' ')[0].substring(1)
        }

        if(link && this.key){
            return {
                success:true,
                type:this.type,
                key:this.key,
                iframe:this.getIframe(),
                embed:this.getEmbed(),
                link:this.getLink()
            };
        }
        else{
            this.type = '';
            this.key = '';
            return { 
                success:false,
                type:'',
                key:'',
                iframe:'',
                embed:'',
                link:''
            }
        }
    }

};