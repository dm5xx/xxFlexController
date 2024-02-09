const { Radio } = require('flexradio-js/Radio');

class xxFlexRadio extends Radio{
    constructor(ip, port) 
    {
        super({ip: ip, port: port});

        this.IP = ip;
        this.Port = port;

        this.Slice0 = {};
        this.Slice1 = {};
 
        this.on('connected', function() {
            console.log('connected to radio');
        });

        this.on('status', function(status) {
            // capture asynchronous status messages
            //console.log('received status: ' + JSON.stringify(status));
            if(status.payload !== undefined)
            {
                try {

                    if(status.topic == "slice/0")
                    {
                        this.Slice0 = { ...this.Slice0, ...status.payload};
                    }
                    else if(status.topic == "slice/1")
                    {
                        this.Slice1 = { ...this.Slice1, ...status.payload};
                    }
                }
                catch(err)
                {
                    console.log("Whats else: " + status);
                }
            }
        });
        
        // radio.on('meter', function(meter) {
        //     // capture asynchronous/realtime meter data, need to `sub meter` to get these
        //     console.log('received meters: ' + JSON.stringify(meter));
        // });
        
        this.on('error', function(error) {
            console.log(error);
        });

        this.on('close', function() {
            console.log("Closed!");
        });


        this.connect();
        //setTimeout(() => this.fire("ddd"), 5000);
        this.fire("sub slice all");
    }

    fire(cmd)
    {
        this.send(cmd, function(response) {
            //console.log('recevied response: ' + JSON.stringify(response));
        });
    }
}

module.exports = xxFlexRadio; 