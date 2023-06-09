const fetch = require('node-fetch');
const config = require('config');
const printersConfig = config.get("printers");

class Printer3d{
    static async getPrinterStatus(printername){
        let apiBase = this.getApiBase(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}/printer/objects/query?print_stats&display_status&heater_bed&extruder`);
        return await response.json();
    }
    
    static async getFileMetadata(printername, filename){
        let apiBase = this.getApiBase(printername);
        if (!apiBase || !filename) return null;
        
        const response = await fetch(`${apiBase}/server/files/metadata?filename=${filename}`);
        return await response.json();
    }

    static async getFile(printername, path){
        let apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;

        const response = await fetch(`${apiBase}/server/files/gcodes/${path}`);
        return response.status === 200 ? await response.blob() : null;
    }

    static async getCam(printername){
        let apiBase = this.getApiBase(printername);
        let camPort = this.getCamPort(printername);
        if (!apiBase) return null;

        const response = await fetch(`${apiBase}:${camPort}/snapshot`);
        let camblob = response.status === 200 ? await response.blob() : null;

        if (camblob)
            return await camblob.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer, "binary"));
        
        return null;
    }

    static async getThumbnail(printername, path){
        let apiBase = this.getApiBase(printername);
        if (!apiBase || !path) return null;
        
        let thumbnailBlob = await this.getFile(printername, path);
        
        if (!thumbnailBlob) return null;

        return await thumbnailBlob.arrayBuffer().then((arrayBuffer) => Buffer.from(arrayBuffer, "binary"));
    }
    
    static getApiBase(printername){
        switch (printername){
            case "anette":
                return printersConfig.anette.apibase
            case "plumbus":
                return printersConfig.plumbus.apibase;
            default:
                return null;
        }
    }

    static getCamPort(printername){
        switch (printername){
            case "anette":
                return printersConfig.anette.camPort
            case "plumbus":
                return printersConfig.plumbus.camPort;
            default:
                return null;
        }
    }
}

module.exports = Printer3d;