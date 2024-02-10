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

        readXlsxFile('./public/'+mapfilename).then((rows) => {
            this.Elements = [];    
            for(let a=0; a < rows.length; a++)
            {
                let item = rows[a];
                this.Elements.push(new deviceElement(item[0], item[1], item[2], item[3], item[4], item[5], item[6], item[7], item[8], item[9], item[10], item[11]));
            }    
        }
        );

        this.Input.on('message', (msg) => {
            this.handle(msg);
        });
    }
}

module.exports = controller; 