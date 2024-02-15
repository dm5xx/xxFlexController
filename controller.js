const easymidi = require('easymidi');
const deviceElement = require("./deviceelement.js");
const readXlsxFile = require('read-excel-file/node');

class controller {
    constructor(contName, mapfilename, masteremit) 
    {    
        this.Input = new easymidi.Input(contName);
        this.Output = new easymidi.Output(contName);
        this.MasterEmitter = masteremit;

        this.OldCalledElement = new deviceElement();
        this.CurrentCalledElement = new deviceElement();

        this.Elements = [];    
        this.Elements1 = [];    
        this.CurrentLayerName = "Elements";

        readXlsxFile('./public/'+mapfilename, { sheet: "midimap"}).then((rows) => {
            for(let a=0; a < rows.length; a++)
            {
                let item = rows[a];
                this["Elements"].push(new deviceElement(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], item[10], item[11]));
            }
        });

        readXlsxFile('./public/'+mapfilename, { sheet: "midimap2"}).then((rows) => {
            for(let a=0; a < rows.length; a++)
            {
                let item = rows[a];
                this["Elements1"].push(new deviceElement(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], item[10], item[11]));
            }

            setTimeout(() => this.switchLedGreen(), 2000);
        });

        this.Input.on('message', (msg) => {
            this.handle(msg);
        });

    }

    setCurrentLayer(layernr)
    {
        if(layernr==0)
            this.CurrentLayerName = "Elements";
        else
            this.CurrentLayerName = "Elements1";
    }

    closePorts()
    {
        this.Input.close();
        this.Output.close();
    }
}

module.exports = controller; 