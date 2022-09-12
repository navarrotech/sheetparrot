import { database } from '../utility.js'
import { deleteMultipleSheets } from './ObjectHelpers.js'

export default class Folder {

    /*
     * this.data = raw folder data from database
     */

    constructor(existing_data){ if(existing_data){this.data=existing_data} }

    async connect(folderId, owner){
        let _id;
        try{ _id = folderId; } catch(e){ return false; }
        this.data = await database.dynamic_call({
            collection:'folders',
            method:'findOne',
            query:{ _id:folderId, owner }
        })
        return this.isConnected()
    }
    isConnected(){return (this.data)?true:false;}

    async create(name, path, pathids, owner, parentFolder){

        // Filtering out illegal characters
        name = name.replaceAll('.', '')
        name = name.replaceAll('\"', '')

        async function createUniqueId(){
            let _id = database.uuid()
    
            // Make sure it's unique!
            let existing = await database.dynamic_call({
                collection:'folders',
                method:'findOne',
                query:{ _id }
            })
    
            if(!existing){ return _id }
            else{ return (await createUniqueId()) }
        }

        let template = {
            _id:await createUniqueId(),
            created:new Date(),
            modified:new Date(),
            owner,
            name,
            path,
            pathids,
            color:'blue',
            parentFolder,
            sheets:[],
            subfolders:[],
            privacy:"private",
            whitelist:[]
        }
        await database.dynamic_call({
            collection:'folders',
            method:'insertOne',
            query:template
        })
        // Update the parent folder :)
        if(parentFolder != "root"){
            await database.dynamic_call({
                collection:'folders',
                method:'updateOne',
                query:{ _id:parentFolder, owner },
                actions:{
                    $push:{ subfolders:{ _id:template._id, name } }
                }
            })
        }
        this.data = template

        return template;
    }

    async moveToRoot(){
        // Update the child to the new parent
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id:this.data._id },
            actions:{
                $set:{
                    path:'root.' + this.data.name,
                    parentFolder:'root',
                    pathids:'root',
                    modified:new Date()
                }
            }
        })
        // Update the previous parent to remove the child! ("FROM")
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ "subfolders._id":this.data._id },
            actions:{
                $pull:{ subfolders:{ _id:this.data._id } }
            }
        })
        this.path = 'root.' + this.data.name;
        this.parentFolder = 'root';
        this.pathids = 'root';
        this.modified = new Date()

        return 200;
    }

    async moveFolder(newFolderId){
        if(!newFolderId){ console.log("No new folder ID given to move folder to!"); return 400; }
        let new_folder = await database.dynamic_call({
            collection:'folders',
            method:'findOne',
            query:{ _id:newFolderId }
        })
        if(newFolderId == "root"){ await this.moveToRoot(); return 200; }
        if(!new_folder){ console.log(`Attempted to move folder [${this.data._id}] to [${newFolderId}], but it doesn't exist!`); return 404; }
        // Update the child to the new parent
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id:this.data._id },
            actions:{
                $set:{
                    path:new_folder.path + '.' + this.data.name,
                    parentFolder:newFolderId,
                    pathids:new_folder.pathids + '.' + newFolderId,
                    modified:new Date()
                }
            }
        })
        // Update the previous parent to remove the child! ("FROM")
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ "subfolders._id":this.data._id },
            actions:{
                $pull:{ subfolders:{ _id:this.data._id } }
            }
        })
        // Update the new parent with the child ("TO")
        await database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id:newFolderId },
            actions:{ $push:{ subfolders:{_id:this.data._id,name:this.data.name,color:this.data.color||"blue"} } }
        })
        this.path = new_folder.path + '.' + this.data.name;
        this.parentFolder = newFolderId;
        this.pathids = new_folder.pathids + '.' + newFolderId;
        this.modified = new Date()

        return 200;
    }
    async rename(name){
        let $set = {};

        // Filtering out illegal characters
        name = name.replaceAll('.', '')
        name = name.replaceAll('\"', '')

        // Name
        $set["name"] = name
        this.data.name = name
        // Path
        let path = this.data.path.split('.')
        path[path.length-1] = name
        path = path.join('.')
        $set["path"] = path

        let _id = this.data._id;
        let c1 = database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id },
            actions:{ $set }
        })
        let c2 = database.dynamic_call({
            collection:'folders',
            method:'updateMany',
            query:{ "subfolders._id":_id },
            actions:{
                $set:{ "subfolders.$.name":name }
            }
        })

        return Promise.all([c1, c2])
    }
    async delete(){

        let folders_to_delete = [
            this.data._id
        ]

        this.data.subfolders.forEach(s => folders_to_delete.push(s._id))
        
        async function recursive(){
            if(!folders_to_delete.length){ return; }

            let folder_id = folders_to_delete[0]
            if(!folder_id){ recursive(); return; }

            let folder = await database.dynamic_call({
                collection:'folders', method:'findOne', query:{ _id:folder_id }
            })
            if(folder){
                if(folder.sheets && folder.sheets.length){
                    await deleteMultipleSheets(folder.sheets)
                }
                folder.subfolders.forEach(s => folders_to_delete.push(s._id))
                await database.dynamic_call({ collection:'folders', method:'deleteOne', query:{ _id:folder_id } })
            }
            folders_to_delete.shift()

            recursive();
        }

        if(folders_to_delete.length){ recursive() }
        delete this.data
    }
    async setColor(new_color){
        let whitelist = ['red','pink','orange','yellow','green','forest','cyan','blue','purple','white','black','grey'];

        if(!whitelist.includes(new_color)){ new_color = 'blue' }

        let _id = this.data._id;
        // Update self
        let c1 = database.dynamic_call({
            collection:'folders',
            method:'updateOne',
            query:{ _id },
            actions:{ $set:{ color:new_color } }
        })
        // Update subfolders
        let c2 = database.dynamic_call({
            collection:'folders',
            method:'updateMany',
            query:{ "subfolders._id":_id },
            actions:{
                $set:{ "subfolders.$.color":new_color }
            }
        })
    }

}