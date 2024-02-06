const easymidi = require('easymidi');
const deviceElement = require("./deviceelement.js");

class controller {
    constructor(contName, mapfilename, masteremit) 
    {    
        this.Input = new easymidi.Input(contName);
        this.Output = new easymidi.Output(contName);
        this.MasterEmitter = masteremit;

        this.OldCalledElement = new deviceElement();
        this.CurrentCalledElement = new deviceElement();

        let lines = require('fs').readFileSync("public/"+mapfilename, 'utf-8').split('\r\n');
        this.Elements = [];

        for(let a=0; a < lines.length; a++)
        {
            let item = lines[a].split(";");
            this.Elements.push(new deviceElement(item[1], item[2], item[0], item[3], item[4], item[5], item[6], item[7], item[8]));
        }

        this.Input.on('message', (msg) => {
            this.handle(msg);
        });
    }
}

module.exports = controller; 