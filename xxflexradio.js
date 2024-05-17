const { Radio } = require('flexradio-js/Radio');
const cp = require('child_process');

class xxFlexRadio extends Radio{
    constructor(con, defconf, emitt) 
    {
        super({ip: con.FlexIP, port: con.FlexPort});

        this.IP = con.FlexIP;
        this.ConfigX = con;

        this.Port = con.FlexPort;

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
            //this.fire("sub client all");
            setTimeout(() => { 
                this.fire("sub client all");
                if(this.SmartSDRClientID !== undefined && this.SmartSDRClientID != "")
                {
                    this.fire("client bind client_id="+this.SmartSDRClientID);
                    console.log("Following SmartSDR with id "+this.SmartSDRClientID);
                }
                else
                {
                    console.log("PTT-Control in multiflex might not work propperly.");
                }
                this.fire("sub radio all");
            },2000);
        });

        if(this.ConfigX.StationName === undefined || this.ConfigX.StationName == "")
            this.Station = process.env.COMPUTERNAME.replace(String.fromCharCode(32), String.fromCharCode(127)); 
        else
            this.Station = this.ConfigX.StationName.replace(String.fromCharCode(32), String.fromCharCode(127)); 
        
        if(this.ConfigX.SmartSDRClientID !== undefined || this.ConfigX.SmartSDRClientID != "")
            this.SmartSDRClientID = this.ConfigX.SmartSDRClientID; 
        
        this.ClientHandle = "";
        this.SliceNumbs = [];
        this.IsInit = false;
        this.initTemp = [];

        this.on('status', function(status) {
            // capture asynchronous status messages
            //console.log('received status: ' + JSON.stringify(status));
            clearTimeout(this.TimeOutId);
            
            if(!this.IsInit)
            {
                this.InitTimeout = this.startInitTimeout();

                if(status.payload !== undefined)
                {
                    this.initTemp.push(status);
                }
                return;
            }

            try
            {
                if(status.topic.startsWith("slice/"))
                {
                    let reqSlice = status.topic.split("/");

                    // check if the status msg is meant for us
                    if((status.client !== undefined && status.client == this.ClientHandle) || (this.status.payload.client_handle !== undefined && this.status.payload.client_handle == this.ClientHandle) )
                    {
                        // check if its a new slice num for us...
                        let svalue = parseInt(reqSlice[1]);
                        if(!this.SliceNumbs.includes(svalue) && this.SliceNumbs.length<2)
                        {
                            this.SliceNumbs.push(svalue);
                        }                                        

                        if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[0])
                        {
                            this.execSlice0(status.payload);                            
                            // check if slice is active or not... remove/add to numslices array
                            if(status.payload.in_use !== undefined)
                                this.handleActiveStateOfSlice(0);
                        }
                        else if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[1])
                        {
                            this.execSlice1(status.payload);
                            // check if slice is active or not... remove/add to numslices array
                            if(status.payload.in_use !== undefined)
                                this.handleActiveStateOfSlice(1);
                        }
                    }
                }
                else
                {
                    if(this.SmartSDRClientID !== undefined && this.SmartSDRClientID == "" && status.payload.station !== undefined && status.payload.station == this.Station)
                    {
                      this.SmartSDRClientID = status.payload.client_id;
                      console.log("Looking for your SmartSDR-Client-ID! client_id="+status.payload.client_id);
                      console.log("If you want to use Multiflex with propper PTT-Control, please add \"SmartSDRClientID\": "+status.payload.client_id+" to default.json. See manual!");
                      console.log("If you dont add this, multiflex will work, but there might be PTT-Controller-Issues");
                      this.fire("unsub radio all");
                    }
                }
            }
            catch(err)
            {
                //console.log("Whats else: " + status + "but crashed..");

                if(status.topic.startsWith("slice/") && status.payload.RF_frequency !== undefined)
                {
                    let reqSlice = status.topic.split("/");

                    let svalue = parseInt(reqSlice[1]);
                    if(this.SliceNumbs.includes(svalue))
                    {
                        if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[0])
                        {
                            this.execSlice0(status.payload);                            
                            // check if slice is active or not... remove/add to numslices array
                            if(status.payload.in_use !== undefined)
                                this.handleActiveStateOfSlice(0);
                        }
                        else if(this.IsInit && status.topic == "slice/"+this.SliceNumbs[1])
                        {
                            this.execSlice1(status.payload);
                            // check if slice is active or not... remove/add to numslices array
                            if(status.payload.in_use !== undefined)
                                this.handleActiveStateOfSlice(1);
                        }
                    }
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
        this.fire("sub radio all");
    }

    handleActiveStateOfSlice(ab)
    {
        if(ab==0)
        {
            if(this.Slice0.in_use==0)
            {
                this.SliceNumbs.splice(0, 1);
                Object.assign(this.Slice0, this.Slice1);
            }
            return;
        }

        if(ab==1)
        {
            if(this.Slice1.in_use==0)
            {
                this.SliceNumbs.splice(1, 1);
                Object.assign(this.Slice1, this.Slice0);
            }
            return;
        }
    }

    startInitTimeout() {
        return setTimeout(() => {
            console.log('Filling init data.. Hold on...');
            this.execInitMsg();
        }, 3000);
    }

    execSlice0(payload)
    {
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
        if(cmd == null || cmd.includes("undefined") || cmd.includes("NaN")) 
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

    execInitMsg()
    {
        if((this.ClientHandle == "" || !this.IsInit))
        {
            if(this.ClientHandle == "")
            {
                let determineClientHandle = this.initTemp.filter((elm) => elm.topic.startsWith("client/") && elm.payload.station == this.Station);

                if(determineClientHandle.length>0)
                {
                    let cvalarr = determineClientHandle[0].topic.split("/");
                    this.ClientHandle = cvalarr[1];
                }
            }

            if(this.HerculesHandle == undefined || this.HerculesHandle == "")
            {
                this.HerculesHandle = this.initTemp[0].client;
            }
            

            let dot = this.initTemp.filter((elm) => elm.payload.client_handle == this.ClientHandle && elm.topic.startsWith("slice")) //.sort((a, b) => a.payload.RF_frequency - b.payload.RF_frequency);
            if(dot.length>1)
                dot.sort((a, b) => a.payload.RF_frequency - b.payload.RF_frequency);

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

module.exports = xxFlexRadio; 