const fetch = require('node-fetch');
const config = require('config');
const printer3dConfig = config.get("printer3d");
const apiBase = printer3dConfig.apibase;

class Printer3d{
    static async getPrinterStatus(){
        const response = await fetch(`${apiBase}/printer/objects/query?print_stats&display_status&heater_bed&extruder`);
        return await response.json();
    }
    
    static async getFileMetadata(filename){
        if (!filename) return undefined;
        
        const response = await fetch(`${apiBase}/server/files/metadata?filename=${filename}`);
        return await response.json();
    }

    static async getFile(path){
        if (!path) return undefined;

        const response = await fetch(`${apiBase}/server/files/gcodes/${path}`);
        return response.status === 200 ? await response.blob() : null;
    }

    static async getThumbnail(path){
        if (!path) return undefined;
        
        let thumbnailBlob = await this.getFile(path);
        if (!thumbnailBlob) return null;

        return await thumbnailBlob.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer, "binary"));
    }
}

module.exports = Printer3d;