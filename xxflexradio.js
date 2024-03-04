const { Radio } = require('flexradio-js/Radio');

const cp = require('child_process');

class xxFlexRadio extends Radio{
    constructor(ip, port, defconf, emitt) 
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

        this.MasterEmitter = emitt;
 
        this.on('connected', function() {
            console.log('connected to radio');
            this.MasterEmitter.emit("connected");
            setTimeout(() => this.fire("sub client all"),2000);
        });

        if(defconf.StationName === undefined || defconf.StationName == "")
            this.Station = process.env.COMPUTERNAME; 
        else
            this.Station = defconf.StationName; 
        
        this.ClientHandle = "";
        this.SliceNumbs = [];
        this.IsInit = false;
        this.initTemp = [];

        this.on('status', function(status) {
            // capture asynchronous status messages
            //console.log('received status: ' + JSON.stringify(status));
            if(status.payload !== undefined)
            {
                try {

                    if(!this.IsInit)
                    {
                        if(!status.topic.startsWith("client"))
                        {
                            this.initTemp.push(status);
                            return;    
                        }
                        else
                        {
                            if(status.payload.station == this.Station)
                            {
                                let cvalarr = status.topic.split("/");
                                this.ClientHandle = cvalarr[1];

                                let dot = this.initTemp.filter((elm) => elm.payload.client_handle == this.ClientHandle && elm.topic.startsWith("slice")).sort((a, b) => a.payload.RF_frequency - b.payload.RF_frequency);
                                let cnt =0;

                                dot.forEach(element => {

                                    if(element.type=="status" && element.topic.startsWith("slice/"))
                                    {
                                        let svalue = parseInt(element.topic.split("/")[1]);

                                        if(!this.SliceNumbs.includes(svalue) && this.SliceNumbs.length<2)
                                        {
                                            this.SliceNumbs.push(svalue);
                                            this["execSlice"+cnt](element.payload);
                                            cnt++;
                                        }                                        
                                    }
                                });
                                this.IsInit = true;
                                this.initTemp = [];
                                console.log("Initialize successful. The System is ready to use. Have fun!");
                            }
                        }
                    }
                    
                    if(status.payload.client_handle !== undefined && status.payload.client_handle != this.ClientHandle)
                        return;

                    let reqSlice = status.topic.split("/");

                    if(status.client === undefined || status.client != this.ClientHandle)
                    {   
                        if(status.client === undefined)
                            return;

                        if(reqSlice[0] == "slice" && !this.SliceNumbs.includes(parseInt(reqSlice[1])))
                            return;
                    }

                    if(reqSlice[0] == "slice")
                    {
                        if(!this.SliceNumbs.includes(parseInt(reqSlice[1])))
                        {
                            if(this.SliceNumbs.length<2)
                                this.SliceNumbs.push(parseInt(reqSlice[1]));
                        }
                    }

                    if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[0])
                    {
                        this.execSlice0(status.payload);
                    }
                    else if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[1])
                    {
                        this.execSlice1(status.payload);

                    }
                }
                catch(err)
                {
                    console.log("Whats else: " + status + "but crashed..");
                }
            }
        });
                
        this.on('error', function(error) {
            console.log("Error: "+error.error+" - Trying to reconnect!");
            setTimeout(() => this.connect(), 3000);

            this.MasterEmitter.emit("error");
        });

        this.on('close', function() {
            console.log("Closed!");
            setTimeout(() => this.connect(), 3000);
            this.MasterEmitter.emit("error");
        });


        this.connect();
        this.fire("sub slice all");
        this.fire("sub pan all");
    }

    execSlice0(payload)
    {
        if(payload.active==0 && payload.in_use ==0)
        {
            this.SliceNumbs = this.SliceNumbs.splice(0,1);
            return;
        }

        let dd = this.fire("slice list");

        this.Slice0 = { ...this.Slice0, ...payload};

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

    execSlice1(payload)
    {
        if(payload.active==0 && payload.in_use ==0)
        {
            this.SliceNumbs = this.SliceNumbs.splice(1,1);
            return;
        }

        this.Slice1 = { ...this.Slice1, ...payload};

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

    fire(cmd)
    {
        if(cmd == null) 
           return;

        this.send(cmd, function(res) {
            //console.log('recevied response: ' + JSON.stringify(response));
        });
    }

    getSliceList()
    {
        this.send("slice list", (res) => {
            this.MasterEmitter.emit("responseList", res);
            //console.log('recevied response: ' + JSON.stringify(response));
        });        
    }
}

module.exports = xxFlexRadio; 