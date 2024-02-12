const { Radio } = require('flexradio-js/Radio');

class xxFlexRadio extends Radio{
    constructor(ip, port, defconf) 
    {
        super({ip: ip, port: port});

        this.IP = ip;
        this.Port = port;

        this.Slice0 = {};
        this.Slice1 = {};
        this.DisplayPan = {};

        this.CWFilter = defconf.CWFilter;
        this.Filter = defconf.Filter;
        this.PanBW = defconf.PanBW;
 
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
                        else
                        {
                            if(this.CWFilter.indexOf(this.Slice0.filter_hi-this.Slice0.filter_lo) > -1)
                            {
                                this.Slice0.InitFilterBW = this.Slice0.filter_hi-this.Slice0.filter_lo;
                            }
                        }
                    }
                    else if(status.topic == "slice/1")
                    {
                        this.Slice1 = { ...this.Slice1, ...status.payload};

                        if(this.Slice1.mode != "CW")
                        {
                            if(this.Filter.indexOf(this.Slice1.filter_hi-this.Slice1.filter_lo) > -1)
                            {
                                this.Slice1.InitFilterBW = this.Slice1.filter_hi-this.Slice1.filter_lo;
                            }
                        }
                        else
                        {
                            if(this.CWFilter.indexOf(this.Slice1.filter_hi-this.Slice1.filter_lo) > -1)
                            {
                                this.Slice1.InitFilterBW = this.Slice1.filter_hi-this.Slice1.filter_lo;
                            }
                        }
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
                
        this.on('error', function(error) {
            console.log("Error: "+error.error+" - Trying to reconnect!");
            setTimeout(() => this.connect(), 3000);
        });

        this.on('close', function() {
            console.log("Closed!");
            setTimeout(() => this.connect(), 3000);
        });


        this.connect();
        //setTimeout(() => this.fire("ddd"), 5000);
        this.fire("sub slice all");
        this.fire("sub pan all");
    }

    fire(cmd)
    {
        if(cmd == null) 
           return;
        this.send(cmd, function(response) {
            //console.log('recevied response: ' + JSON.stringify(response));
        });
    }
}

module.exports = xxFlexRadio; 