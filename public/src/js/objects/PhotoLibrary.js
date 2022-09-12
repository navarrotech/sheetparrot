class PhotoLibrary{

    constructor(parameters={}){
        // Array of acceptable mimetypes
        this.fileTypes = parameters.fileTypes ? parameters.fileTypes : ['image/png','image/jpeg','image/gif'];
        this.callback = () => {};
        this.images = []
        this.elements = {
            root:$('<div class="imageLibrary"></div>'),
            content:$('<div class="block library"></div>'),
            notifications:$('<div class="block notifications"></div>'),
            tabs:$(`<div class="tabs mb-0"></div>`),
            toolbar:$('<div class="is-relative is-hidden"><div class="floating-toolbar box"><div class="buttons is-right"></div></div></div>'),
            loader:$(`<progress class="progress is-small is-primary mb-0 is-invisible" max="100"></progress>`),
            hiddenInput:$(`<input class="is-hidden" type="file" name="image" accept="${this.fileTypes.join(',')}"/>`),
            loadMore:$(`<div class="is-picker is-addmore is-clickable"><a class="button is-primary"><span>Load More</span></a></div>`)
        }
        this.page = 0
        this.pagination_limit = 30
        this.selected = null
        this.active_view = 'photos';
    }

    showLoading(){
        this.elements.loader.removeClass('is-invisible')
        this.elements.root.addClass('is-loading')
    }
    hideLoading(){
        this.elements.loader.addClass('is-invisible')
        this.elements.root.removeClass('is-loading')
    }
    close(){
        this.elements.root.remove()
        this.elements.root.html('')
        $('html').css({'overflow':''})
    }
    displayError(message){
        this.elements.notifications.html('')
        console.log('[ERROR FROM PHOTOLIBRARY]')
        console.log(message)
        let notification = $(`<div class="notification is-danger"><button class="delete"></button>${message}</div>`)
            .on('click', '.delete', (e) => { notification.remove(); })
        this.elements.notifications.append(notification)
        this.hideLoading()
    }
    select(url){
        $('html').css('overflow', '')
        this.callback(url)
        this.close()
    }
    async deleteSelected(){
        if(!this.selected || !this.selected.url){ return; }
        if(!confirm("Are you sure you want to delete this image? This can't be undone.")){ return; }

        let request = await $POST('/deleteMyPhoto', { url:this.selected.url }),
            result = await request.json();

        if(request.status != 200){ this.displayError(result.message) }

        this.selected.image.remove()
        this.selected = null;
    }
    renderImageToLibrary(url, prepend=false){
        if(this.active_view != 'photos'){ return; }

        let image = $(`<figure class="image is-picker" data-url="${url}"><img src="${url}"/></figure>`)

        image.dblclick(() => { this.select(url) })
        image.click(() => {
            if(this.selected && this.selected.image){ this.selected.image.removeClass('is-selected') }
            if(this.selected && this.selected.image == image){ this.select(url); return; }

            image.addClass('is-selected')
            this.elements.toolbar.removeClass('is-hidden')
            this.selected = { image, url }
        })

        this.elements.tabs.find('[goto=photos]').removeClass('is-hidden')
        if(prepend){
            this.elements.content.prepend(image)
        }
        else{
            this.elements.content.append(image)
        }
        this.elements.content.append(this.elements.loadMore)
        this.elements.loadMore.toggleClass('is-hidden', (this.pagination_limit * (this.page + 1) >= this.images.length))
    }
    async loadContent(refresh_from_server=true){
        this.showLoading();
        if(!this.images || refresh_from_server){
            let result = await $GET(`/myPhotos`)
            if(result.redirected || result.status == 401){
                if(window.editor){ window.editor.hide() }
                loginRequired("A SheetParrot account is required to add photos to your worksheets! To continue please signup or login to your account.");
                return;
            }
            let response = await result.json()
            if(result.status != 200){ this.displayError("Something went wrong trying to get your previous uploads!"); return; }
            this.images = response;
            //this.images.reverse()
            this.page = 0;
        }
        //this.images = this.images.slice(0, this.pagination_limit)

        this.elements.content.html("")
        setTimeout(() => this.hideLoading(), 1000)

        if(!this.images || !this.images.length){
            this.elements.tabs.find('[goto=photos]').addClass('is-hidden')
            return;
        }

        this.loadNextChunk();
    }
    async loadNextChunk(){
        console.log("Loading next chunk!")
        let image, start = (this.page * this.pagination_limit);
        for(let i=start;i<(this.pagination_limit + start);i++){
            image = this.images[i]; if(image){ this.renderImageToLibrary(image) }
        }
        this.page += 1;
    }
    async addFile(file){
        this.showLoading()
        
        let upload = await PhotoLibrary.oneShotUpload(file, 'library')
        if(!upload.success){ if(upload.message){ this.displayError(upload.message); } return; }

        this.hideLoading();
 
        this.images.unshift(upload.url)
        this.renderImageToLibrary(upload.url, true)
        this.elements.tabs.find('li[data-goto=photos]').click()
        //await this.loadContent(false)
    }
    async openFileChooser(){
        this.elements.hiddenInput.click()
    }
    render(){
        this.page = 0;
        if(this.pagination_limit * (this.page + 1) < this.images.length){
            this.elements.loadMore.removeClass('is-hidden')
        }
        let modal = $('<div class="modal is-active"></div>')

        let background = $('<div class="modal-background"></div>'),
            container  = $('<div class="modal-content"></div>')

        // On close
        background.click(() => this.close())

        modal.append(background)
        modal.append(container)

        container.append(this.elements.loader);

        let subcontainer = $(`<div class="box"></div>`)
        container.append(subcontainer)

        let upload_btn = $(`
            <a class="button is-primary">
                <span class="icon">
                    <i class="fas fa-upload"></i>
                </span>
                <span>Upload Image</span>
            </a>
        `)
        upload_btn.click(() => this.openFileChooser())

        this.elements.tabs.html(`<ul><li data-goto="url"><a>Add From URL</a></li><li data-goto="photos" class="is-active"><a>My Photos</a></li><li data-goto="upload"><a>Upload</a></li></ul>`)

        let header = $(`<div><h1 class="title is-size-1 has-text-weight-bold mb-0">Photo Library</h1><div class="twobox is-centered is-spaced"><div class="buttons is-right"></div></div></div>`)

        header.find('.buttons').append(upload_btn)
        header.find('.twobox').prepend(this.elements.tabs)

        subcontainer.append(header);
        subcontainer.append(this.elements.notifications);

        let goto_all = this.elements.tabs.find('ul li'),
            goto_url = this.elements.tabs.find(`ul li[data-goto=url]`),
            goto_pic = this.elements.tabs.find(`ul li[data-goto=photos]`),
            goto_upl = this.elements.tabs.find(`ul li[data-goto=upload]`)

        let GT = (u,s) => { goto_all.removeClass('is-active'); u.addClass('is-active'); this.active_view = s; }

        goto_url.click(() => {
            GT(goto_url,'url');
            this.elements.content.html('')
            this.elements.toolbar.find('.buttons').html('')
            this.elements.toolbar.addClass('is-hidden')

            let container = $(`<div class="fullscreenUrl">
                <div class="block">
                    <div class="field has-addons">
                        <p class="control is-expanded">
                            <input class="input" type="text" placeholder="Paste an image URL here">
                        </p>
                        <p class="control">
                            <a class="button is-primary" action="lookup">
                                <span class="icon"><i class="fas fa-search"></i></span>
                                <span>Lookup</span>
                            </a>
                        </p>
                    </div>
                </div>
                <div class="block">
                    <figure class="image imagePreview is-centered"><img alt/></figure>
                </div>
            </div>`)
            
            let actions = $(`<div class="floating-toolbar" style="right:30px; bottom:56px;">
                <div class="buttons">
                    <a class="button is-primary is-normal" disabled="true">
                        <span>Select</span>
                    </a>
                </div>
            </div>`)

            let add = actions.find('.button.is-primary'),
                allow = false;

            let input = container.find('input'),
                preview = container.find('figure img'),
                button = container.find('.button[action=lookup]');

            function showPreview(){
                add.attr('disabled', 'true')
                allow = false
                preview.attr('src', input.val())
            }
            preview.on('load error', () => {
                if(preview.prop('naturalHeight') !== 0){ add.removeAttr('disabled'); allow = true; }
                else{ add.attr('disabled', 'true'); allow = false; }
            })

            add.click(async () => {
                if(!allow){ return; }
                allow = false;
                add.addClass('is-loading')
                let url = input.val();

                let request = await $POST('/addImage', { url }),
                    result = await request.json();

                if(request.status != 200){ console.log({request,result}); if(result.message){ this.displayError(result.message) } }

                this.images = this.images.filter(a => a != url)
                this.images.unshift(url)
                goto_pic.click();

                add.removeClass('is-loading')
                input.val('')
                preview.attr('src', '')
            })

            input.on('input', () => showPreview())
            button.on('click', () => {
                button.addClass('is-loading')
                preview.addClass('is-invisible')
                add.addClass('is-invisible');
                setTimeout(() => {
                    button.removeClass('is-loading');
                    preview.removeClass('is-invisible');
                    add.removeClass('is-invisible');
                }, 500);
                showPreview();
            })

            this.elements.content.append(container)
            this.elements.content.append(actions)
        })
        goto_pic.click(() => {
            this.page = 0;
            GT(goto_pic,'photos');
            this.loadContent(false);
            this.elements.loadMore.click(() => { this.loadNextChunk(); })

            this.elements.toolbar.find('.buttons').html('')
            this.elements.toolbar.addClass('is-hidden')
            this.elements.toolbar.find('.buttons').append(
                $(`<a class="button is-danger"><span class="icon"><i class="fas fa-trash-alt"></i></span><span>Remove</span></a>`)
                    .on('click', () => this.deleteSelected())
            )
            this.elements.toolbar.find('.buttons').append(
                $(`<a class="button is-primary"><span class="icon"><i class="fas fa-check-square"></i></span><span>Select</span></a>`)
                    .on('click', () => this.select(this.selected.url))
            )
        })
        goto_upl.click(() => {
            GT(goto_upl,'upload');
            this.elements.content.html(`<div class="fullscreenUpload">
                <div class="fullscreenUpload-wrapper">
                    <div class="block has-text-centered">
                        <h1 class="is-size-3 has-text-weight-bold whiteOnDrag">Drag a file here</h1>
                    </div>
                    <figure class="block image is-centered is-clickable uploadImage" action="file">
                        <!--<img src="${_DOMAIN}/images/upload.svg" alt/>-->
                        <svg class="white-on-drag" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 530.87 339.74"><defs><style>.d{fill:url(#c);}.e{fill:none;stroke:url(#b);stroke-linecap:round;stroke-miterlimit:10;stroke-width:20px;}</style><linearGradient id="b" x1="58.44" y1="376.86" x2="472.43" y2="-37.12" gradientTransform="matrix(1, 0, 0, 1, 0, 0)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5481c2"/><stop offset=".12" stop-color="#5a7cbe"/><stop offset=".28" stop-color="#6b6eb4"/><stop offset=".47" stop-color="#8757a3"/><stop offset=".48" stop-color="#8956a3"/><stop offset=".63" stop-color="#b04e80"/><stop offset=".79" stop-color="#d24862"/><stop offset=".91" stop-color="#e74550"/><stop offset="1" stop-color="#ef444a"/></linearGradient><linearGradient id="c" x1="216.07" y1="204.78" x2="314.79" y2="106.06" gradientTransform="matrix(1, 0, 0, 1, 0, 0)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5481c2"/><stop offset=".05" stop-color="#5c79bc"/><stop offset=".21" stop-color="#7566ae"/><stop offset=".36" stop-color="#835aa6"/><stop offset=".48" stop-color="#8956a3"/><stop offset=".6" stop-color="#8c55a0"/><stop offset=".7" stop-color="#965397"/><stop offset=".79" stop-color="#a75088"/><stop offset=".88" stop-color="#bf4c73"/><stop offset=".96" stop-color="#dd4758"/><stop offset="1" stop-color="#ef444a"/></linearGradient></defs><path class="e" d="M360.5,10h133.97c14.58,0,26.4,11.82,26.4,26.4V303.34c0,14.58-11.82,26.4-26.4,26.4H36.4c-14.58,0-26.4-11.82-26.4-26.4V36.4c0-14.58,11.82-26.4,26.4-26.4H164.45"/><path class="d" d="M306.4,138.33h-28.14v97.65c0,7.08-5.75,12.83-12.83,12.83s-12.83-5.75-12.83-12.58v-97.9h-28.14c-9.41,0-15.3-8.09-10.59-14.56l20.48-28.14,20.48-28.14c4.71-6.47,16.49-6.47,21.2,0l20.48,28.14,20.48,28.14c4.71,6.47-1.18,14.56-10.59,14.56Z"/></svg>
                    </figure>
                    <div class="block has-text-centered is-size-7 has-text-grey"><p>OR</p></div>
                    <div class="block buttons is-centered">
                        <a class="button is-primary is-normal" action="file">
                            <span class="icon">
                                <i class="fas fa-upload"></i>
                            </span>
                            <span>Select A File</span>
                        </a>
                    </div>
                    <div class="block has-text-grey has-text-centered">
                        <p>(Must be smaller than 5mb)</p>
                    </div>
                </div>
            </div>`)
                .on('click', '[action=file]', () => this.elements.hiddenInput.click())
        })

        this.elements.toolbar.find('.buttons').append(
            $(`<a class="button is-danger"><span class="icon"><i class="fas fa-trash-alt"></i></span><span>Remove</span></a>`)
                .on('click', () => this.deleteSelected())
        )
        this.elements.toolbar.find('.buttons').append(
            $(`<a class="button is-primary"><span class="icon"><i class="fas fa-check-square"></i></span><span>Select</span></a>`)
                .on('click', () => this.select(this.selected.url))
        )

        let last_drag = null;
        subcontainer.on('dragenter dragover', (event) => {
            event.preventDefault();
            if(this.active_view != 'upload'){ goto_upl.click() }
            subcontainer.addClass('is-dragndrop')
            if(last_drag){ clearTimeout(last_drag) }
            last_drag = setTimeout(() => { subcontainer.removeClass('is-dragndrop') }, 1000)
        })
        subcontainer.on('dragleave', (event) => {
            event.preventDefault();
            subcontainer.removeClass('is-dragndrop')
        })

        subcontainer.on('dragend drop', async (event) => {
            subcontainer.removeClass('is-dragndrop')

            event.preventDefault()
            event.stopPropagation()

            let dt = event.originalEvent.dataTransfer
            if(!dt){ return; }

            let files = dt.files
            if(!files || !files[0]){ return; }

            this.showLoading()

            let uploads = [], promises = [];
            for(let i=0;i<files.length;i++){ 
                promises.push(
                    new Promise(async (acc, rej) => {
                        let upload = await PhotoLibrary.oneShotUpload(files[i], 'library')
                        uploads.push(upload)
                        if(upload.success){ this.renderImageToLibrary(upload.url); this.images.unshift(upload.url); }
                        else{ console.error(upload.message); }
                        acc()
                    })
                )
            }
            
            await Promise.all(promises)

            let total_failed = 0;
            uploads.forEach(u => { if(!u.success){ total_failed += 1 } })

            if(total_failed != 0){
                if(uploads.length == 1){ this.displayError(uploads[0].message); }
                else{ this.displayError(`Could not upload ${total_failed} image${total_failed == 1 ?'':'s'}, due to file size, file type, or another issue. Please upload each image individually to get more details.`); }
            }
            
            this.hideLoading()
            if(uploads.length != total_failed){
                goto_pic.click()
            }
        })

        // Load more
        this.elements.loadMore.click(() => { this.loadNextChunk(); })
        
        // Loading the majority of the content
        this.loadContent()
        subcontainer.append(this.elements.content)

        // Appending the final things together
        subcontainer.append(this.elements.toolbar)
        
        this.elements.hiddenInput.change(() => {
            let files = this.elements.hiddenInput.prop('files');
            if(files && files.length){ this.addFile(files[0]) }
        })
        subcontainer.append(this.elements.hiddenInput)

        this.elements.root.append(modal)
        $('body').append(this.elements.root)
        $('html').css('overflow', 'hidden')
    }

    static async oneShotUpload(file, path){
        let r = {
            success:false,
            status:0,
            url:'',
            message:''
        }
        if(!(window.FileReader && window.Blob)){
            r.message = "Your browser does not support uploading images! Please update or change your browser and try again."; return r;
        }
        //let file = file_input.files[0];
        if(!file || !file.size){
            console.warn("Cannot add file to Library: File not acceptable!"); return r;
        }
        let sizeLimit = (path == 'profile' || path == 'library')?5:3;
        if(file.size >= 1048576 * sizeLimit){
            r.message = `The file you have chosen is larger than ${sizeLimit} megabytes! Please upload a smaller image.`; return r;
        }
        if(!['image/png','image/jpeg','image/gif'].includes(file.type)){
            r.message = "Please upload a PNG, JPG, or GIF image!"; return r;
        }
        let body = new FormData()
        body.append('image', file)

        if(!['library', 'logo', 'profile'].includes(path)){
            throw new Error(`Cannot upload path [${path}] as it's type is unacceptable!`)
        }

        let result   = await fetch(`${_DOMAIN}/upload/${path}`, { method:'POST', body })
        let response = await result.json()

        return {
            success:(result.status == 200),
            status:result.status,
            url:response.url,
            message:response.message
        };
    }

    onSelect(fn=()=>{}){ this.callback = fn; }
};