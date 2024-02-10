const { Radio } = require('flexradio-js/Radio');

class xxFlexRadio extends Radio{
    constructor(ip, port) 
    {
        super({ip: ip, port: port});

        this.IP = ip;
        this.Port = port;

        this.Slice0 = {};
        this.Slice1 = {};
        this.DisplayPan = {};

        this.CWFilter = [50,100,250,400,500,800,1000,3000];
        this.Filter = [1200,1800,2100,2400,2700,2900,3300,4000,6000];
        this.PanBW = [0.005, 0.010, 0.050, 0.100, 0.250];
 
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

                        if(this.Slice0.mode != "CW")
                        {
                            if(this.Filter.indexOf(this.Slice0.filter_hi-this.Slice0.filter_lo) > -1)
                            {
                                this.Slice0.InitFilterBW = this.Slice0.filter_hi-this.Slice0.filter_lo;
                            }
                        }
                    }
                    else if(status.topic == "slice/1")
                    {
                        this.Slice1 = { ...this.Slice1, ...status.payload};
                    }
                    else if(status.topic.startsWith("display/pan/"))
                    {
                        let arr = status.topic.split("/");
                        this.DisplayPan = { ...this.DisplayPan, ...status.payload };
                        this.DisplayPan.StreamId = arr[2];
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
        this.fire("sub pan all");
    }

    fire(cmd)
    {
        this.send(cmd, function(response) {
            //console.log('recevied response: ' + JSON.stringify(response));
        });
    }
}

module.exports = xxFlexRadio; 