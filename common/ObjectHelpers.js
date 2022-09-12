import Sheet from './Sheet.js'

export const deleteMultipleSheets = (array_of_sheet_ids) => {

    return new Promise(acc => {
        let current_sheet;
    
        async function recursive(i){
            if(!array_of_sheet_ids[i]){ return; }
    
            current_sheet = new Sheet()

            await current_sheet.connect(array_of_sheet_ids[i])
            await current_sheet.delete()
    
            recursive(i+1)
        }
        recursive(0)
    
        acc()
    })
}