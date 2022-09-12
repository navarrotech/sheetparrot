(async function(){

    /* Dragging */
    var mouse_is_dragging = false,
        origin_x,
        origin_y,
        current_x,
        current_y,
        dragging_item,
        dragging_parent,
        dragging_data = {};

    function resetFromDrag(){
        if(!mouse_is_dragging){ return; }
        mouse_is_dragging = false;
        origin_x = null;
        origin_y = null;
        dragging_data = {}
        
        if(dragging_item){ dragging_item.remove() }

        $CLASS(dragging_parent, 'is-disabled', false)
        $CLASS(document.body, 'something-is-dragging', false)

        dragging_item = null;
        dragging_parent = null;

        window.getSelection().removeAllRanges()
    }

    function showDrag(){
        if(mouse_is_dragging){
            //dragging_item.style.cssText = `transform:translate(${current_x}px,${current_y}px)!important;`
            dragging_item.style.cssText = `position:absolute;left:${current_x}px;top:${current_y}px!important;`
        }
    }

    document.onmousemove = (event) => {
        if(mouse_is_dragging){ 
            current_x = event.pageX + 3 - origin_x
            current_y = event.pageY + 3 - origin_y
            window.requestAnimationFrame(() => { showDrag() })
        }
    }

    document.onmouseup = resetFromDrag;

    var selectedSheetId,
        current_folder = getParam('f') || "root",
        loading = $QS('.loading_gif'),
        parent  = $QS('#parent'),
        header_items = $QS('#header_items'),
        no_worksheets_message = $QS("#no_worksheets"),
        breadcrumbs_root = $QS('nav.breadcrumb'),
        subfolders_root = $QS('#subfolders')

    function createSubfolder(subfolder, insertFirst=false){
        let folder_element = document.createElement('div')
        let folder_color = subfolder.color || 'blue'
        
        folder_element.className = "folder is-" + folder_color

        let anchor = document.createElement('a')
        anchor.className = "folder-clickable icon-text"
        anchor.innerHTML = `<span class="icon"><i class="fas fa-folder"></i></span><span class="folder_name"></span>`
        anchor.href = `${_DOMAIN}/sheets?f=${subfolder._id}`

        let dropdown = document.createElement('div')
        dropdown.className = "dropdown is-right"
        dropdown.innerHTML = `
            <div class="dropdown-trigger">
                <a class="button is-rounded" aria-haspopup="true" aria-controls="dropdown-menu">
                    <span class="icon is-small">
                        <i class="fas fa-ellipsis-v" aria-hidden="true"></i>
                    </span>
                </a>
            </div>
            <div class="dropdown-menu" role="menu">
                <div class="dropdown-content">
                    <a class="dropdown-item renamer">
                        <span class="icon"><i class="fas fa-file-signature"></i></span>
                        <span>Rename</span>
                    </a>
                    <a class="dropdown-item mover">
                        <span class="icon"><i class="fas fa-folder-open"></i></span>
                        <span>Move</span>
                    </a>
                    <hr class="dropdown-divider">
                    <div class="dropdown-item">
                        <span class="icon"><i class="fas fa-palette"></i></span>
                        <span>Folder Color:</span>
                        <div class="colorselectors mt-3">
                            <a class="colorselector is-red" value="red"></a>
                            <a class="colorselector is-orange" value="orange"></a>
                            <a class="colorselector is-yellow" value="yellow"></a>
                            <a class="colorselector is-green" value="green"></a>
                            <a class="colorselector is-forest" value="forest"></a>
                            <a class="colorselector is-cyan" value="cyan"></a>
                            <a class="colorselector is-blue" value="blue"></a>
                            <a class="colorselector is-purple" value="purple"></a>
                            <a class="colorselector is-pink" value="pink"></a>
                            <a class="colorselector is-white" value="white"></a>
                            <a class="colorselector is-grey" value="grey"></a>
                            <a class="colorselector is-black" value="black"></a>
                        </div>
                    </div>
                    <hr class="dropdown-divider">
                    <a class="dropdown-item is-danger deleter">
                        <span class="icon"><i class="far fa-trash-alt"></i></span>
                        <span>Delete</span>
                    </a>
                </div>
            </div>`
        initDropdown(dropdown, () => $CLASS(folder_element, 'is-active', false))
        let trigger = dropdown.querySelector('.dropdown-trigger .button')
        trigger.addEventListener('click', () => $CLASS(folder_element, 'is-active', true))

        let dropdown_rename = dropdown.querySelector('.renamer'),
            dropdown_move   = dropdown.querySelector('.mover'),
            dropdown_delete = dropdown.querySelector('.deleter'),
            colorselectors  = dropdown.querySelectorAll('.colorselectors .colorselector'),
            el_folder_name  =   anchor.querySelector('span.folder_name')

        colorselectors.forEach(color => {
            color.addEventListener('click', async () => {
                let chosen = color.getAttribute('value')
                folder_element.className = "folder is-" + chosen
                let colorChangeResult = await $POST('/api/folders/changeColor?f=' + subfolder._id, { color:chosen })
                if(colorChangeResult.status != 200){ console.error(colorChangeResult); }
                console.log(colorChangeResult)
            })
        })

        el_folder_name.innerText = subfolder.name

        /* Dropdown menu actions */
        dropdown_rename.addEventListener('click', () => {
            console.log("Showing rename field")
            $CLASS(el_folder_name, 'is-hidden', true)
            let rm = anchor.href, original_name = el_folder_name.innerText;
            anchor.href = ""

            let text_input = document.createElement('input')
            text_input.className = "invisibleEditor"
            text_input.setAttribute('maxlength', '30')
            text_input.value = el_folder_name.innerText;

            text_input.addEventListener('blur', async () => {
                console.log("Hiding rename field")
                text_input.remove()
                $CLASS(el_folder_name, 'is-hidden', false)
                anchor.href = rm;

                let new_name = el_folder_name.innerText
                if(!new_name || new_name == ""){ toast("Please enter a valid folder name!", "warning", true, true); el_folder_name.innerText = original_name; return; }
                new_name = new_name.substring(0, 30);
                let body = { name:new_name }
                let result = await $POST(`/api/folders/rename?f=${subfolder._id}`, body)
                if(result.status != 200){ console.error(result); }
            })
            text_input.addEventListener('input', () => { el_folder_name.innerText = text_input.value; })
            text_input.addEventListener('keydown', (event) => { if(event.key == "Enter"){ text_input.blur(); } })

            el_folder_name.parentElement.insertBefore(text_input, el_folder_name)
            $CLASS(dropdown, 'is-active', false)
            text_input.focus()
        })
        dropdown_delete.addEventListener('click', async () => {
            if(confirm("Are you sure you want to delete this folder and all contents inside of it? This CANNOT be undone!")){
                $POST(`/api/folders/delete?f=${subfolder._id}`, {}, (delete_result) => {
                    if(delete_result.status != 200){ console.error(delete_result); }
                })
                console.log("Removed folder from view")
                folder_element.remove();
            }
        })
        dropdown_move.addEventListener('click', () => {
            let folderPickerParent = $QS('#folderParent')
            let folderPicker = new FolderPicker({
                parent:folderPickerParent,
                blacklist:[subfolder._id],
                title:`Move "${subfolder.name}" to`
            })
            folderPicker.on('select', async (data) => {
                let body = { id:data._id }
                await $POST('/api/folders/move?f=' + subfolder._id, body)
                console.log("folder picker has selected, removing folder from view.")
                folder_element.remove()
                toast("Moved the folder \"" + subfolder.name + "\" to \"" + data.name + "\"", "success", true)
            })

            folderPicker.show(current_folder)
        })

        /* Drag and drop */
        folder_element.onmouseenter = (event) => {
            if(mouse_is_dragging){
                $CLASS(folder_element, 'is-active', true)
            }
        }
        folder_element.onmouseleave = (event) => {
            if(mouse_is_dragging){
                $CLASS(folder_element, 'is-active', false)
            }
        }
        folder_element.onmouseup = (event) => {
            if(mouse_is_dragging && dragging_item && dragging_data._id){
                // Move it into the new folder! :)
                let tomovesheetid = dragging_data._id,
                    sheetname = dragging_data.sheetname,
                    foldername = subfolder.name,
                    move_body = { sheets:[tomovesheetid], folderid:subfolder._id }

                $POST('/sheets/v2/moveToFolder', move_body, (moveResult, moveText) => {
                    if(moveResult.status!=200){ console.error(moveResult); }
                    else{ toast("Moved the sheet " + sheetname + " to " + foldername, "success", true) }
                })

                console.log("Removing parent of draggable item from view")
                dragging_parent.remove();
                resetFromDrag();

                $CLASS(folder_element, 'is-active', false)
            }
        }

        folder_element.appendChild(anchor)
        folder_element.appendChild(dropdown)

        if(insertFirst){ subfolders_root.insertBefore(folder_element, subfolders_root.querySelector('.folder:first-child')) }
        else{ subfolders_root.appendChild(folder_element) }

        return folder_element;
    }

    async function refresh(){

        // Resetting
        $CLASS(header_items, 'is-hidden', true)
        if(loading){ $CLASS(loading, 'is-hidden', false); }
        $CLASS(breadcrumbs_root, 'is-hidden', true)
        subfolders_root.innerHTML = ""
        parent.innerHTML = ""

        // Beginning query

        let request_query = '/sheets/v2/list'
        if(current_folder != "root"){ request_query+="?f="+current_folder }

        let request = await $GET(request_query),
            text    = await request.text()

        if(text){ text = JSON.parse(text); }

        /*if((!text || !text.content || !text.content.length) && (!text.subfolders || !text.subfolders.length) && current_folder == "root"){
            console.log("Resetting view, showing default no_worksheets_found message")
            loading.remove();
            header_items.remove();
            $CLASS(no_worksheets_message, 'is-hidden', false);
            return;
        }*/

        function renderAddButton(){
            let new_box = document.createElement('div')
            new_box.className = "parrotTile box createNewButton is-centered has-text-centered"


            new_box.addEventListener('click', () => createNewSheet())
            new_box.innerHTML = `<div class="icon mt-4"><i class="fas fa-plus-circle fa-2x"></i></div><div class="mt-4"><h1>New Sheet</h1></div>`

            return new_box
        }
        function renderTemplate(data){
            let item = document.createElement('div')
            item.className = "draggable_wrapper";
            item.id = data._id

            let last_mod_date = prettyPrintTimeBetweenTwoDates(new Date(data.last_modified), new Date())

            let second_line = data.stats && data.stats.submissions ?
                `${data.stats.submissions} submission${data.stats.submissions==1?'':'s'}`
                : `Created ${moment(data.history[0].when).fromNow()}`

            item.innerHTML = 
            `<div class="clickableSheet parrotTile is-centered is-column box p-0">
                <div class="is-relative">
                    <div class="privacyBadge ${data.privacy}">${data.privacy}</div>
                    <a class="sheetWindowPreview" href="${_DOMAIN}/sheets/view/${data._id}"></a>
                </div>
                <div class="pt-4 pb-0 pr-3 pl-3 titles">
                    <p class="title master_headline has-text-weight-normal is-size-6">${data.sheetname}</p>
                    <p class="subtitle has-text-grey is-size-7">${second_line}</p>
                </div>
                <div class="buttons is-right pt-3 pb-3">
                    <a class="button is-white is-rounded pl-2 pr-2" href="${_DOMAIN}/sheets/view/${data._id}" data-tooltip="View details">
                        <span class="icon"><i class="fas fa-eye"></i></span>
                    </a>
                    <a class="button is-white is-rounded pl-2 pr-2 copier" data-tooltip="Copy Link">
                        <span class="icon"><i class="fas fa-link"></i></span>
                    </a>
                    <div class="dropdown is-right" style="width:fit-content;">
                        <div class="dropdown-trigger">
                            <a class="button is-white is-rounded pl-2 pr-2" aria-haspopup="true" aria-controls="dropdown-menu" data-tooltip="Actions">
                                <span class="icon is-small"><i class="fas fa-ellipsis-v"></i></span>
                            </a>
                        </div>
                        <div class="dropdown-menu"  role="menu">
                            <div class="dropdown-content">
                                <a class="dropdown-item" href="${_DOMAIN}/sheet/${data._id}" target="_blank">
                                    <span class="icon"><i class="fas fa-external-link-alt"></i></span>
                                    <span>Preview</span>
                                </a>
                                <a class="dropdown-item" href="${_DOMAIN}/sheets/view/${data._id}">
                                    <span class="icon"><i class="fas fa-eye"></i></span>
                                    <span>View Details</span>
                                </a>
                                <hr class="dropdown-divider">
                                <a class="dropdown-item renamer">
                                    <span class="icon"><i class="fas fa-file-signature"></i></span>
                                    <span>Rename</span>
                                </a>
                                <a class="dropdown-item" href="${_DOMAIN}/sheet/v2/edit?sheetid=${data._id}">
                                    <span class="icon"><i class="fas fa-pen-fancy"></i></span>
                                    <span>Edit Sheet</span>
                                </a>
                                <a class="dropdown-item mover">
                                    <span class="icon"><i class="fas fa-folder-open"></i></span>
                                    <span>Move to folder</span>
                                </a>
                                <hr class="dropdown-divider">
                                <a class="dropdown-item is-danger deleter">
                                    <span class="icon"><i class="fas fa-trash-alt"></i></span>
                                    <span>Delete</span>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`

            let preview = item.querySelector('.sheetWindowPreview')
            preview = $(preview)

            /* Create the sheet and the paper object to preview in the "mini-icon" window */            
            let paper = new Paper({
                    sheet:data,
                    paper:data.paper,
                    parent:preview,
                    mode:'fake',
                    include:{
                        paper:true,
                        header:false,
                        splash:true
                    }
                })
                paper.render()

            let copy_button   = item.querySelector('.copier'),
                delete_button = item.querySelector('.deleter'),
                title         = item.querySelector('.titles .master_headline'),
                rename_button = item.querySelector('.renamer'),
                dropdown_menu = item.querySelector('.dropdown'),
                move_button   = item.querySelector('.mover')
            
            /* Initialize the dropdown menu */
            initDropdown(dropdown_menu, () => $CLASS(item, 'is-active', false))
            dropdown_menu.addEventListener('click', () => $CLASS(item, 'is-active', true))

            /* Initialize the copy button */
            copy_button.addEventListener('click', async () => {
                await navigator.clipboard.writeText(`${_DOMAIN}/sheet/${data._id}`);
                toast("Copied share link to your clipboard!", 'success', true)
            })

            /* Initialize the "move to folder" button */
            move_button.addEventListener('click', async () => {
                let folderPickerParent = $QS('#folderParent'),
                    sheetname = data.sheetname

                let folderPicker = new FolderPicker({
                    parent:folderPickerParent,
                    showSheets:true,
                    title:`Move "${sheetname}" to`
                })
                folderPicker.on('select', async (picked) => {
                    let body = { sheets:[data._id], folderid:picked._id }
                    if(picked._id == current_folder){ return; }

                    let moveResult = await $POST('/sheets/v2/moveToFolder', body)
                    if(moveResult.status != 200){ console.error(moveResult); }
                    console.log("Sheet marked as moved, removing from view")

                    item.remove()
                    toast("Moved the sheet \"" + sheetname + "\" to \"" + picked.name + "\"", "success", true)
                })

                folderPicker.show(current_folder)

            })

            /* Initialize the delete button */
            delete_button.addEventListener('click', async () => {
                let confirmModal   = $QS('#confirmDelete'),
                    sheetname_slot = $QS('#confirmDeleteSheetName')

                sheetname_slot.innerText = String(data.sheetname)

                selectedSheetId = data._id

                $CLASS(confirmModal, 'is-active', true)
            })

            /* Initialize the renaming ability */
            let renameThis = function(){
                $CLASS(title, 'is-hidden', true)
                
                let rename_field = document.createElement('input')
                rename_field.className = "invisibleEditor"
                rename_field.value = title.innerText
                rename_field.setAttribute('maxlength', '30')
                title.parentElement.insertBefore(rename_field, title)

                let original_name = title.innerText;

                rename_field.addEventListener('blur', async () => {
                    rename_field.remove();
                    $CLASS(title, 'is-hidden', false);

                    let sheetname = title.innerText
                    if(!sheetname || sheetname == ""){ toast("Please enter a valid sheet name!", "warning", true, true); title.innerText = original_name; return; }
                    sheetname = sheetname.substring(0, 30);
                    let body = {
                        sheetname,
                        sheetid:data._id
                    }

                    let result = await $POST('/sheet/v2/settings', body)
                    if(result.status != 200){ console.error(result); }
                })
                rename_field.addEventListener('input', () => title.innerText = rename_field.value)
                rename_field.addEventListener('keydown', (event) => { if(event.key == "Enter"){ rename_field.blur(); } })

                rename_field.focus()
            }

            rename_button.addEventListener('click', () => {
                renameThis();
                $CLASS(dropdown_menu, 'is-active', false)
            })
            title.addEventListener('dblclick', renameThis)

            /* Drag and drop */

            let draggable_wrapper = item.querySelector('.parrotTile'),
                has_stopped_dragging = false;
                
            draggable_wrapper.onmousedown = (event) => {
                has_stopped_dragging = true;
                setTimeout(() => {
                    if(has_stopped_dragging && !dragging_item){
                        mouse_is_dragging = true;
    
                        //let rect = draggable_wrapper.getBoundingClientRect();
                        origin_x = 0 //rect.left //(event.clientX - rect.left) //event.pageX //- (event.clientX - rect.left) - 3;
                        origin_y = 0 //rect.top //(event.clientY - rect.top) //event.pageY //- (event.clientY - rect.top) - 3;
                        
                        let drag_preview = document.createElement('div')
                        drag_preview.innerHTML = `
                        <div class="p-3 box" style="width:fit-content;pointer-events:none!important;">
                            <p class="title has-text-weight-normal is-size-6">${data.sheetname}</p>
                            <p class="subtitle has-text-grey is-size-7">${second_line}</p>
                        </div>
                        `
                        document.body.appendChild(drag_preview)

                        dragging_item = drag_preview;
                        dragging_parent = item;
                        dragging_data = { sheetid:data._id, sheetname:data.sheetname }
                        $CLASS(dragging_item, 'is-dragging-now', true)
                        $CLASS(dragging_parent, 'is-disabled', true)
                        $CLASS(document.body, 'something-is-dragging', true)
                    }
                }, 100)
            }
            draggable_wrapper.onmouseup = (event) => { has_stopped_dragging = false; }

            return item;
        }

        /* Primary functionality */
        parent.appendChild( renderAddButton() )
        text.content.forEach(sheet => parent.appendChild( renderTemplate(sheet) ))

        $CLASS(loading, 'is-hidden', true)
        $CLASS(header_items, 'is-hidden', false)

        /* Setting up the subfolders */
        if(text.subfolders && text.subfolders.length){
            text.subfolders.forEach(subfolder => createSubfolder(subfolder))
        }

        /* Setting up the main folder */
        if(text.folder && text.folder.path){
            let folder = text.folder;
            if(current_folder != "root"){ current_folder = folder._id; }
    
            breadcrumbs_root.innerHTML = "<ul></ul>"
            let breadcrumbs_inner = breadcrumbs_root.querySelector('ul')

            let dests   = folder.path.split('.'),
                pathids = folder.pathids.split('.')
            if(dests.length <= 1){ return; }
            dests.forEach((destination, iteration) => {
                let crumb = document.createElement('li'),
                    innerCrumb,
                    can_drag_to = false;

                if(iteration == 0){
                    crumb.innerHTML = `<a class="crumb" href="${_DOMAIN}/sheets"><span class="icon"><i class="fas fa-home"></i></span><span>My Sheets</span></a>`
                    innerCrumb = crumb.querySelector('a')
                    can_drag_to = true
                }
                else if(iteration != dests.length-1){
                    crumb.innerHTML = `<a class="crumb" href="${_DOMAIN}/sheets?f=${pathids[iteration]}">${destination}</a>`
                    innerCrumb = crumb.querySelector('a')
                    can_drag_to = true
                }
                else{
                    crumb.className = "is-active"
                    crumb.innerHTML = `<p class="crumb" aria-current="page">${destination}</p>`
                    innerCrumb = crumb.querySelector('p')
                }

                

                crumb.onmouseenter = (event) => {
                    if(mouse_is_dragging && can_drag_to){ $CLASS(innerCrumb, 'is-highlighted', true) }
                }
                crumb.onmouseleave = (event) => {
                    if(mouse_is_dragging && can_drag_to){ $CLASS(innerCrumb, 'is-highlighted', false) }
                }
                crumb.onmouseup = (event) => {
                    if(mouse_is_dragging && dragging_item && dragging_data._id && can_drag_to){

                        // Move it into the new folder! :)
                        let sheetname = dragging_data.sheetname,
                            move_body = { sheets:[dragging_data._id], folderid:pathids[iteration] }
                        $POST('/sheets/v2/moveToFolder', move_body, (moveResult, moveText) => {
                            if(moveResult.status!=200){ console.error(moveResult); }
                            else{ toast("Moved the sheet \"" + sheetname + "\" to \"" + destination + "\"", "success", true) }
                        })

                        dragging_parent.remove();
                        resetFromDrag();

                        $CLASS(innerCrumb, 'is-highlighted', false)
                    }
                }

                breadcrumbs_inner.appendChild(crumb)
            })
            $CLASS(breadcrumbs_root, 'is-hidden', false)
        }

        // If empty and NOT the root...
        if((!text || !text.content || !text.content.length) && (!text.subfolders || !text.subfolders.length)){
            loading.remove();
            //parent.appendChild( renderAddButton() )
        }
    }
    await refresh()

    /* Post-page initialization */
    async function createNewFolder(){
        let body = {
            folder_name:"New Folder",
            folder_parent:current_folder
        }
        let folder_result = await $POST('/api/folders/create', body),
            folder_id = await folder_result.text()
        if(folder_result.status == 200){
            let newF = createSubfolder({ _id:folder_id, name:"New Folder", color:"blue" }, true)
            let renamer = newF.querySelector('.dropdown .renamer')
            if(renamer){renamer.click()}
        }
        else{
            console.error(result)
        }
    }

    /* Delete Sheet Popup */
    let initDeletePopup = function(){
        let confirmModal   = $QS('#confirmDelete'),
        delete_button  = confirmModal.querySelector(".delete_button")

        let is_deleting = false;
        delete_button.addEventListener('click', async () => {
            if(!is_deleting){
                is_deleting = true
                $CLASS(delete_button, 'is-loading', true)
                $POST('/sheet/v2/delete/', { sheetid:selectedSheetId }, async (result, text) => {
                    is_deleting = false
                    $CLASS(delete_button, 'is-loading', false)
                    $CLASS(confirmModal, 'is-active', false)

                    if(result.status == 200){
                        let sheet_item = document.getElementById(selectedSheetId)
                        if(sheet_item){ sheet_item.remove(); }
                        else{ await refresh() }
                    }
                    else {
                        toast("Something went wrong trying to delete that sheet. Please try again later!", 'danger', true, true)
                    }
                })
            }
        })
    }
    initDeletePopup();

    /* Create Sheet Button */
    let isCreatingSheet=false;
    async function createNewSheet(btn){
        if(isCreatingSheet){return;}
        isCreatingSheet = true;
        if(btn && btn.classList.contains('button')){ $CLASS(btn, 'is-loading', true) } else { showLoading(); }
        let result = await $POST('/sheets/create', { sheet_name:"New Sheet", folder_id:current_folder }),
            { url } = await result.json();

        if(result.status == 402){
            $CLASS('#payment_modal', 'is-active', true)
        }
        else if(result.status == 200){
            window.location.href = url;
            return;
        }
        else{
            toast("Something went wrong trying to create your sheet. Please try again later.", "danger", true, true);
            console.error(result)
        }

        isCreatingSheet = false;
        if(btn && btn.classList.contains('button')){ $CLASS(btn, 'is-loading', false) } else { hideLoading(); }
    }
    let all_create_buttons = $QSA('[data-action=create-new]')
    all_create_buttons.forEach(create_button => create_button.addEventListener('click', async () => await createNewSheet(create_button)))

    let all_folder_buttons = $QSA('[data-action=create-folder]')
    all_folder_buttons.forEach(create_button => create_button.addEventListener('click', async () => await createNewFolder()))

    /* Check parameters */
    let status = getCookie('status')
    if(status && status == 'sheet_not_found'){
        toast("The sheet you're looking for cannot be found.", "warning", true, true); deleteCookie('status')
    }

    /* Developer tool: Refresh */
    let refresh_button = $QS('#refresh')
    if(refresh_button){refresh_button.addEventListener('click',async()=>await refresh());}
})();