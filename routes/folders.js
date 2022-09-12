import Folder from '#objects/Folders.js'
import Sheet  from '#objects/Sheet.js'

const limits = {
    folder_name_length:30
}

export default function(app, { authorization, tools, database, sendgrid }){

    app.use('/api/folders', authorization, async (req, res, next) => {
        try{
        folder_id = req.query.f || req.body.id
        if(folder_id){
            let folder = new Folder()
            await folder.connect(folder_id, req.session.user._id)
            req.folder = folder
        }
        } catch(err){ database.logInternalError({ req, res, err }); }
        next();
    })
    app.post('/api/folders/delete', async (req, res) => {
        try{
            if(!req.folder || !req.folder.isConnected()){ res.sendStatus(400); return; }

            await req.folder.delete()

            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/api/folders/move', async (req, res) => {
        try{
            let newParentId = req.body.id;
            if(!newParentId || !req.folder || !req.folder.isConnected()){ res.sendStatus(400); return; }

            let status = await req.folder.moveFolder(newParentId)
            res.sendStatus(status)
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/api/folders/create', async (req, res) => {
        try{
            let folder_name   = req.body.folder_name,
                folder_parent = req.body.folder_parent || "root",
                folder_path   = "root",
                folder_pathids= "root"

            folder_name.replaceAll('.',  '')
            folder_name.replaceAll('\"', '')

            if(folder_parent != "root"){
                let parent = await database.dynamic_call({collection:'folders', method:'findOne', query:{ _id:folder_parent, owner:req.session.user._id }})
                if(!parent){ res.sendStatus(404); return; }
                folder_path = parent.path + "." + folder_name
                folder_pathids = parent.pathids + "." + folder_parent
            }
            else{
                folder_path = "root." + folder_name
            }

            let new_folder = new Folder()
            await new_folder.create(folder_name, folder_path, folder_pathids, req.session.user._id, folder_parent)

            res.status(200)
            res.send(new_folder.data._id)
        } catch(err){ database.logInternalError({ req, res, err }) }
    })
    app.post('/api/folders/rename', async (req, res) => {
        try{
            let name = String(req.body.name || "New Folder").substring(0, limits.folder_name_length);
            if(!name || !req.folder || !req.folder.isConnected()){ res.sendStatus(400); return; }

            await req.folder.rename(name)
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err}) }
    })
    app.post('/api/folders/changeColor', async (req, res) => {
        try{
            let color = req.body.color;
            if(!color || !req.folder || !req.folder.isConnected()){ res.sendStatus(400); return; }

            await req.folder.setColor(color);
            res.sendStatus(200);
        } catch(err){ database.logInternalError({ req, res, err, is_page:true }) }
    })

}