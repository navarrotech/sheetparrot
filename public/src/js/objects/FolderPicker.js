class FolderPicker{
    
    constructor(params){
        this.events = { select:[] }
        if(params.parent){ this.parent = params.parent; }
        if(params.blacklist){ this.blacklist = params.blacklist; } else { this.blacklist = [] }
        if(params.title){ this.title = params.title } else { this.title = "Select Folder" }
        if(params.showSheets){ this.showSheets = true; }
    }

    show(startingFolder){
        if(!this.parent){ throw new Error("Cannot render FolderPicker without a parent element!"); }
        this.element = document.createElement('div')
        this.element.className = "modal is-active folderPicker"
        this.element.id = "folderPicker"

        this.element.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <section class="modal-card-body">
                    <nav class="breadcrumb has-arrows-separator is-hidden" aria-label="breadcrumbs"><ul></ul></nav>
                    <nav class="panel is-primary">
                        <p class="panel-heading"><span>${this.title}</span>&nbsp;&quot;<span class="PWD"></span>&quot;</p>
                        <a class="panel-block is-loading">
                            <div class="loader is-medium"></div>
                        </a>
                        <div class="dynamic"></div>
                    </nav>
                </section>
                <footer class="modal-card-foot buttons is-right">
                    <a class="button" aria-label="close">Cancel</a>
                    <a class="button is-success selector" disabled="true">Select Folder</a>
                </footer>
            </div>
        `

        this.loader = this.element.querySelector('.panel-block.is-loading')
        this.content = this.element.querySelector('.dynamic')
        this.breadcrumbs_root = this.element.querySelector('nav.breadcrumb')
        this.PWD_title = this.element.querySelector('.PWD')

        this.select_button = this.element.querySelector('footer a.button.selector')
        this.select_button.addEventListener('click', () => {
            if(this.selected_block && !this._emitted_selected){
                this._emitted_selected = true;
                this._emit('select', this.selected_block);
                this.close()
            }
        })

        this.parent.appendChild(this.element)

        initModal('folderPicker', () => this.close())

        this._refreshPanel(startingFolder)
    }

    async _refreshPanel(folder){
        $CLASS(this.loader, 'is-hidden', false)
        this.breadcrumbs_root.innerHTML = "<ul></ul>"
        this.content.innerHTML = ""

        let result = await this._getFolder(folder)
        if(result.status != 200){ console.error(result); return; }

        let text = await result.text();
        text = JSON.parse(text)

        if(text.folder.path != "root"){

            let folder = document.createElement('a')
            folder.className = "panel-block no-select"
            folder.innerHTML = `<span class="panel-icon"><i class="fas fa-arrow-left" aria-hidden="true"></i></span>Go Back`

            folder.addEventListener('click', () => {
                let last = text.folder.pathids
                last = last.split('.')
                last = last[last.length-1]

                let last_name = text.folder.path
                last_name = last_name.split('.')
                last_name = last_name[last_name.length-2]

                this.selected_block = { _id:last, name:last_name }
                this.select_button.removeAttribute('disabled')
                this._refreshPanel(last)
            })
            this.content.appendChild(folder)
        }
        else{
            this.PWD_title.innerText = "My Sheets"
        }

        text.subfolders.forEach(subfolder => {
            let item = document.createElement('a')
            item.className = "panel-block no-select"
            item.innerHTML = `<span class="panel-icon"><i class="fas fa-folder" aria-hidden="true"></i></span>${subfolder.name}`

            if(this.blacklist.includes(subfolder._id)){
                item.classList.add('is-disabled')
                this.content.appendChild(item)
            }
            else{
                item.addEventListener('click', () => {
                    let currently_active = this.element.querySelector('.panel-block.is-active')
                    if(currently_active){ $CLASS(currently_active, 'is-active', false) }
                    this.selected_block = subfolder
                    this.select_button.removeAttribute('disabled')
                    this.PWD_title.innerText = subfolder.name
                    $CLASS(item, 'is-active', true)
                });
                item.addEventListener('dblclick', () => {
                    this.selected_block = subfolder
                    this.select_button.removeAttribute('disabled')
                    this.PWD_title.innerText = subfolder.name
                    //this.selected_block = null
                    //this.select_button.setAttribute('disabled', 'true')
                    this._refreshPanel(subfolder._id)
                });

                this.content.appendChild(item)
            }
        });

        if(text.subfolders.length == 0 && !(this.showSheets && text.content && text.content.length)){
            let item = document.createElement('p')
            item.className = "panel-block is-centered has-text-grey"
            item.innerHTML = `Empty folder (no other items)`
            this.content.appendChild(item)
        }

        if(this.showSheets && text.content && text.content.length){
            text.content.forEach(sheet => {
                let item = document.createElement('p')
                item.className = "panel-block has-text-grey"
                item.innerHTML = `<span class="panel-icon"><i class="far fa-file-alt" aria-hidden="true"></i></span>${sheet.sheetname}`
                this.content.appendChild(item)
            })
        }
        
        if(text.folder){
            this._createBreadcrumbs(text.folder.path, text.folder.pathids)
        }

        $CLASS(this.loader, 'is-hidden', true)
    }

    _createBreadcrumbs(path, pathids){
        path    = path.split('.')
        pathids = pathids.split('.')

        this.breadcrumbs_root.innerHTML = "<ul></ul>"
        let breadcrumbs_inner = this.breadcrumbs_root.querySelector('ul')

        if(path.length <= 1){ return; }
        path.forEach((destination, iteration) => {
            let crumb = document.createElement('li')

            if(iteration == 0){
                crumb.innerHTML = `<a class="crumb"><span class="icon"><i class="fas fa-home"></i></span><span>My Sheets</span></a>`
                crumb.addEventListener('click', () => { this._refreshPanel("root"); })
            }
            else if(iteration != path.length-1){
                crumb.innerHTML = `<a class="crumb">${destination}</a>`
                crumb.addEventListener('click', () => { this._refreshPanel(pathids[iteration]); })
            }
            else{
                crumb.className = "is-active"
                crumb.innerHTML = `<p class="crumb" aria-current="page">${destination}</p>`
            }

            breadcrumbs_inner.appendChild(crumb)
        })
        $CLASS(this.breadcrumbs_root, 'is-hidden', false)
    }

    _getFolder(folder, fn){
        let folder_query = (!folder || folder == "root") ? '' : 'f='+folder,
            showSheets = (this.showSheets) ? '' : 'view=folders',
            query = '?' + folder_query + (showSheets ? '&' + showSheets : '')

        //let query = (!folder || folder == "root") ? '?view=folders' : '?view=folders&f='+folder
        return $GET('/sheets/v2/list'+query)
    }

    close(){
        if(!this.element){return;}
        this.element.remove()
    }

    on(action, callback){ if(this.events[action]){ this.events[action].push(callback); } }

    _emit(action, data={}){
        if(!this.events[action]){ throw new Error("_emitter cannot find event: " + action); }
        this.events[action].forEach(fn => fn(data))
    }

};