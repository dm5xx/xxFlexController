const { Radio } = require('flexradio-js/Radio');
const os = require('os');
const cp = require('child_process');
const log = require("./logger.js");

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

        // Local MultiFlex: only follow SmartSDR/AetherSDR on THIS PC (by discovery IP / host / station)
        this.localIpv4s = this.collectLocalIpv4s();
        this.localHostname = (os.hostname() || "").toLowerCase();
        this.computerName = (process.env.COMPUTERNAME || os.hostname() || "");
        this.discoveryByHandle = {}; // normalized handle -> { ip, host, program, station }
 
        this.on('connected', function() {
            log.info('connected to radio');
            this.MasterEmitter.emit("connected");
            setTimeout(() => { 
                this.fire("sub client all");
                if(this.GuiFixedID !== undefined && this.GuiFixedID != "")
                {
                    this.bindToGuiClient(this.GuiFixedID, this.GuiProgram || "fixed");
                }
                else
                {
                    log.info("Local GUI auto-select: waiting for SmartSDR/AetherSDR on this PC ("+[...this.localIpv4s].join(", ")+")...");
                }
                this.fire("sub radio all");
            },2000);
        });

        if(this.ConfigX.StationName === undefined || this.ConfigX.StationName == "")
            this.Station = this.computerName.replace(String.fromCharCode(32), String.fromCharCode(127)); 
        else
            this.Station = this.ConfigX.StationName.replace(String.fromCharCode(32), String.fromCharCode(127)); 
        
        // Optional overrides only — empty = full auto (local GUI discovery)
        this.GuiFixedID = "";
        if(this.ConfigX.GuiClientID !== undefined && this.ConfigX.GuiClientID != "")
            this.GuiFixedID = this.ConfigX.GuiClientID;

        this.ConfiguredSmartSDRClientID = (this.ConfigX.SmartSDRClientID !== undefined) ? this.ConfigX.SmartSDRClientID : "";
        this.ConfiguredAetherSDRClientID = (this.ConfigX.AetherSDRClientID !== undefined) ? this.ConfigX.AetherSDRClientID : "";

        this.KnownGuiClients = [];
        if(this.ConfiguredSmartSDRClientID != "")
            this.KnownGuiClients.push({ id: this.ConfiguredSmartSDRClientID, label: "SmartSDR" });
        if(this.ConfiguredAetherSDRClientID != "")
            this.KnownGuiClients.push({ id: this.ConfiguredAetherSDRClientID, label: "AetherSDR" });

        this.GuiProgram = "";
        if(this.ConfigX.GuiProgram !== undefined && this.ConfigX.GuiProgram != "")
            this.GuiProgram = this.ConfigX.GuiProgram;

        this.GuiClientID = this.GuiFixedID;
        this.SmartSDRClientID = this.GuiClientID;
        this.ActiveGuiLabel = "";

        this.ClientHandle = "";
        this.SliceNumbs = [];
        this.IsInit = false;
        this.initTemp = [];
        this.pendingGuiResync = false;

        this.startDiscoveryListener();

        this.on('status', function(status) {
            // capture asynchronous status messages
            //console.log('received status: ' + JSON.stringify(status));
            clearTimeout(this.TimeOutId);

            // Always watch GUI clients (even during slice init) for MultiFlex bind + handle
            this.handleGuiClientStatus(status);
            
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
                    this.applySliceStatus(status);
                }
            }
            catch(err)
            {
                if(status.topic.startsWith("slice/") && status.payload !== undefined && status.payload.RF_frequency !== undefined)
                {
                    this.applySliceStatus(status);
                }
            }
        });
                
        this.on('error', function(error) {
            log.error("Error: "+error.error+" - Trying to reconnect!");
            setTimeout(() => this.connect(), 3000);

            this.MasterEmitter.emit("error");
        });

        this.on('close', function() {
            log.warn("Closed!");
            setTimeout(() => this.connect(), 3000);
            this.MasterEmitter.emit("error");
        });


        this.connect();
        this.fire("sub slice all");
        this.fire("sub pan all");
        this.fire("sub radio all");
    }

    startDiscoveryListener()
    {
        try
        {
            const { discovery_listener } = require('flexradio-js/DiscoveryListener');
            const dl = discovery_listener();
            dl.on('discovery', (msg) => {
                if(msg === undefined || msg.payload === undefined)
                    return;
                // Only care about our configured radio
                if(msg.payload.ip !== undefined && this.IP !== undefined && String(msg.payload.ip) != String(this.IP))
                    return;
                this.ingestDiscoveryGuiClients(msg.payload);
            });
            log.debug("Flex discovery listening for local GUI clients (gui_client_ips)…");
        }
        catch(err)
        {
            log.warn("Flex discovery unavailable ("+err.message+") — using station/host fallback for local GUI");
        }
    }

    collectLocalIpv4s()
    {
        let ips = new Set();
        let ifaces = os.networkInterfaces();
        Object.keys(ifaces).forEach((name) => {
            (ifaces[name] || []).forEach((addr) => {
                let family = addr.family;
                if(family === "IPv4" || family === 4)
                {
                    if(!addr.internal)
                        ips.add(addr.address);
                }
            });
        });
        return ips;
    }

    splitDiscoveryList(value)
    {
        if(value === undefined || value === null || value === 0 || value === "0" || value === "")
            return [];
        if(Array.isArray(value))
            return value.map((v) => String(v).trim()).filter((v) => v !== "");
        return String(value).split(",").map((v) => v.trim()).filter((v) => v !== "");
    }

    normalizeHandle(handle)
    {
        if(handle === undefined || handle === null)
            return "";
        return String(handle).toLowerCase().replace(/^0x/, "");
    }

    ingestDiscoveryGuiClients(payload)
    {
        let ips = this.splitDiscoveryList(payload.gui_client_ips);
        let hosts = this.splitDiscoveryList(payload.gui_client_hosts);
        let programs = this.splitDiscoveryList(payload.gui_client_programs);
        let stations = this.splitDiscoveryList(payload.gui_client_stations);
        let handles = this.splitDiscoveryList(payload.gui_client_handles);
        let n = Math.max(handles.length, ips.length, programs.length);
        for(let i=0; i < n; i++)
        {
            let handle = handles[i];
            if(handle === undefined || handle == "")
                continue;
            this.discoveryByHandle[this.normalizeHandle(handle)] = {
                ip: ips[i],
                host: hosts[i],
                program: programs[i],
                station: stations[i]
            };
        }
    }

    isGuiProgram(program)
    {
        if(program === undefined || program == "")
            return false;
        let p = String(program).toLowerCase();
        return p.indexOf("aether") >= 0 || p.indexOf("smartsdr") >= 0;
    }

    isLocalIp(ip)
    {
        if(ip === undefined || ip == null || ip == "")
            return false;
        let s = String(ip).trim();
        if(this.localIpv4s.has(s))
            return true;
        for(let local of this.localIpv4s)
        {
            if(s.indexOf(local) >= 0)
                return true;
        }
        return false;
    }

    hostLooksLocal(host)
    {
        if(host === undefined || host == "")
            return false;
        let h = String(host).toLowerCase().split(".")[0];
        if(h == this.localHostname || h == String(this.computerName).toLowerCase())
            return true;
        return false;
    }

    stationLooksLocal(station)
    {
        if(station === undefined || station == "")
            return false;
        let s = String(station);
        let cn = this.computerName;
        if(cn == "")
            return false;
        let cnDel = cn.replace(String.fromCharCode(32), String.fromCharCode(127));
        if(s == cnDel || s == this.Station)
            return true;
        // Station often embeds PC name
        if(s.toLowerCase().indexOf(String(cn).toLowerCase()) >= 0)
            return true;
        if(s.toLowerCase().indexOf(this.localHostname) >= 0)
            return true;
        return false;
    }

    discoveryEntryForStatus(status)
    {
        if(status === undefined || status.topic === undefined || !status.topic.startsWith("client/"))
            return null;
        let handle = status.topic.split("/")[1];
        return this.discoveryByHandle[this.normalizeHandle(handle)] || null;
    }

    isLocalGuiClient(status)
    {
        if(status === undefined || status.payload === undefined)
            return false;

        let payload = status.payload;
        let disc = this.discoveryEntryForStatus(status);
        let program = payload.program || (disc ? disc.program : undefined);

        if(!this.isGuiProgram(program))
            return false;

        if(this.GuiProgram !== undefined && this.GuiProgram != "")
        {
            if(!this.programMatches(program, this.GuiProgram))
                return false;
        }

        // 1) Discovery IP on this machine (best MultiFlex filter)
        if(disc && this.isLocalIp(disc.ip))
            return true;
        // 2) Status payload IP if present
        if(payload.ip !== undefined && this.isLocalIp(payload.ip))
            return true;
        // 3) Hostname from discovery
        if(disc && this.hostLooksLocal(disc.host))
            return true;
        // 4) Station name contains this PC name (fallback if discovery late/missing)
        if(this.stationLooksLocal(payload.station) || (disc && this.stationLooksLocal(disc.station)))
            return true;

        return false;
    }

    handleGuiClientStatus(status)
    {
        if(status === undefined || status.payload === undefined)
            return;

        let payload = status.payload;
        let id = payload.client_id;

        // Capture radio handle of the GUI we follow (needed for slice ownership / VFO etc.)
        if(id !== undefined && id != "" && this.GuiClientID != "" && id == this.GuiClientID)
            this.adoptGuiClientHandle(status);

        // Fixed override: never auto-switch, but handle above still applies
        if(this.GuiFixedID !== undefined && this.GuiFixedID != "")
            return;

        if(this.isClientDisconnected(status))
        {
            if(id !== undefined && id != "" && this.GuiClientID == id)
            {
                log.info("Local GUI offline ("+(this.ActiveGuiLabel || id)+") — waiting for SmartSDR/AetherSDR on this PC...");
                this.clearActiveGuiBind();
            }
            return;
        }

        if(id === undefined || id == "")
            return;

        // Never follow remote MultiFlex GUIs
        if(!this.isLocalGuiClient(status))
            return;

        let known = this.matchKnownGuiClient(payload);
        let label = known ? known.label : (payload.program || "GUI");

        // Optional allow-list: if user configured specific IDs, only those (still local-only above)
        if(this.KnownGuiClients.length > 0 && !known)
        {
            // Still allow local auto if configured IDs are stale — match by program of known labels
            let prog = String(payload.program || "").toLowerCase();
            let labelHit = this.KnownGuiClients.find((k) => prog.indexOf(k.label.toLowerCase()) >= 0);
            if(!labelHit)
                return;
            label = labelHit.label;
        }

        if(this.GuiClientID != "" && this.GuiClientID != id)
        {
            if(this.GuiProgram !== undefined && this.GuiProgram != "")
            {
                if(this.programMatches(payload.program, this.GuiProgram))
                {
                    this.bindToGuiClient(id, label);
                    this.adoptGuiClientHandle(status);
                }
                return;
            }
            // Keep current local GUI until it disconnects
            return;
        }

        this.bindToGuiClient(id, label);
        this.adoptGuiClientHandle(status);
    }

    adoptGuiClientHandle(status)
    {
        if(status === undefined || status.topic === undefined)
            return;
        if(!status.topic.startsWith("client/"))
            return;

        let handle = status.topic.split("/")[1];
        if(handle === undefined || handle == "")
            return;

        if(status.payload !== undefined && status.payload.station !== undefined && status.payload.station != "")
            this.Station = status.payload.station;

        if(this.ClientHandle == handle)
            return;

        this.ClientHandle = handle;
        log.info("Using GUI client handle "+handle+" for slices ("+(this.ActiveGuiLabel || this.GuiClientID)+")");
        this.scheduleSliceResync();
    }

    sliceBelongsToGui(status)
    {
        if(this.ClientHandle === undefined || this.ClientHandle == "")
            return false;
        if(status.client !== undefined && String(status.client) == String(this.ClientHandle))
            return true;
        if(status.payload !== undefined && status.payload.client_handle !== undefined
            && String(status.payload.client_handle) == String(this.ClientHandle))
            return true;
        return false;
    }

    applySliceStatus(status)
    {
        if(!this.sliceBelongsToGui(status))
            return;

        let reqSlice = status.topic.split("/");
        let svalue = parseInt(reqSlice[1]);
        if(isNaN(svalue))
            return;

        if(!this.SliceNumbs.includes(svalue) && this.SliceNumbs.length < 2)
            this.SliceNumbs.push(svalue);

        if(this.SliceNumbs.length > 0 && status.topic == "slice/"+this.SliceNumbs[0])
        {
            this.execSlice0(status.payload);
            if(status.payload.in_use !== undefined)
                this.handleActiveStateOfSlice(0);
        }
        else if(this.SliceNumbs.length > 1 && status.topic == "slice/"+this.SliceNumbs[1])
        {
            this.execSlice1(status.payload);
            if(status.payload.in_use !== undefined)
                this.handleActiveStateOfSlice(1);
        }

        if(this.pendingGuiResync && this.SliceNumbs.length > 0 && this.Slice0.RF_frequency !== undefined)
        {
            this.pendingGuiResync = false;
            log.info("Slices synced for GUI: "+this.SliceNumbs.join(",")+" freq="+this.Slice0.RF_frequency);
        }
    }

    scheduleSliceResync()
    {
        this.pendingGuiResync = true;
        this.SliceNumbs = [];
        this.Slice0 = {};
        this.Slice1 = {};
        this.fire("sub slice all");
        this.fire("sub pan all");
    }

    isClientDisconnected(status)
    {
        let p = status.payload;
        if(p === undefined)
            return false;
        if(p.disconnected !== undefined && (p.disconnected == 1 || p.disconnected === true || p.disconnected == "1"))
            return true;
        if(typeof p.status === "string" && p.status.toLowerCase().indexOf("disconnect") >= 0)
            return true;
        if(typeof status.topic === "string" && status.topic.toLowerCase().indexOf("disconnect") >= 0)
            return true;
        // Raw flex status often uses "connected" keyword; absence after a connect is handled by new statuses
        if(p.connected !== undefined && (p.connected == 0 || p.connected === false || p.connected == "0"))
            return true;
        return false;
    }

    matchKnownGuiClient(payload)
    {
        if(payload === undefined || payload.client_id === undefined)
            return null;

        for(let i=0; i < this.KnownGuiClients.length; i++)
        {
            if(this.KnownGuiClients[i].id == payload.client_id)
                return this.KnownGuiClients[i];
        }

        // Also match by program name if IDs differ after GUI reinstall but GuiProgram / labels help
        if(payload.program !== undefined)
        {
            let prog = String(payload.program).toLowerCase();
            for(let i=0; i < this.KnownGuiClients.length; i++)
            {
                let label = this.KnownGuiClients[i].label.toLowerCase();
                if(prog.indexOf(label) >= 0 || (label == "smartsdr" && prog.indexOf("smartsdr") >= 0))
                {
                    // Prefer configured GUI programs even if StationName != GUI station
                    return { id: payload.client_id, label: this.KnownGuiClients[i].label };
                }
            }
        }
        return null;
    }

    programMatches(program, wanted)
    {
        if(program === undefined || wanted === undefined || wanted == "")
            return false;
        return String(program).toLowerCase().indexOf(String(wanted).toLowerCase()) >= 0;
    }

    bindToGuiClient(clientId, label)
    {
        if(clientId === undefined || clientId == "")
            return;
        if(this.GuiClientID == clientId)
            return;

        this.GuiClientID = clientId;
        this.SmartSDRClientID = clientId;
        this.ActiveGuiLabel = label || "";
        this.fire("client bind client_id="+clientId);
        log.info("Following GUI client"+(label ? (" ("+label+")") : "")+" with id "+clientId);
        // Slice ownership follows the GUI handle (adoptGuiClientHandle); force refresh
        this.scheduleSliceResync();
    }

    clearActiveGuiBind()
    {
        this.GuiClientID = "";
        this.SmartSDRClientID = "";
        this.ActiveGuiLabel = "";
        this.ClientHandle = "";
        this.SliceNumbs = [];
        this.Slice0 = {};
        this.Slice1 = {};
        this.pendingGuiResync = false;
    }

    matchesGuiClientDiscovery(payload)
    {
        if(this.GuiClientID !== undefined && this.GuiClientID != "")
            return false;
        if(payload === undefined || payload.station === undefined || payload.client_id === undefined)
            return false;
        if(payload.station != this.Station)
            return false;
        if(this.GuiProgram !== undefined && this.GuiProgram != "")
        {
            if(payload.program === undefined)
                return true;
            if(!this.programMatches(payload.program, this.GuiProgram))
                return false;
        }
        return true;
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
            log.debug('Filling init data.. Hold on...');
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
                // Prefer local SmartSDR/AetherSDR (same PC), then bound id, then station name
                let determineClientHandle = this.initTemp.filter((elm) =>
                    elm.topic !== undefined && elm.topic.startsWith("client/")
                    && elm.payload !== undefined && this.isLocalGuiClient(elm));

                if(determineClientHandle.length == 0)
                {
                    determineClientHandle = this.initTemp.filter((elm) => {
                        if(elm.topic === undefined || !elm.topic.startsWith("client/") || elm.payload === undefined)
                            return false;
                        if(this.GuiClientID != "" && elm.payload.client_id == this.GuiClientID)
                            return true;
                        return false;
                    });
                }

                if(determineClientHandle.length == 0)
                {
                    determineClientHandle = this.initTemp.filter((elm) =>
                        elm.topic !== undefined && elm.topic.startsWith("client/")
                        && elm.payload !== undefined && elm.payload.station == this.Station
                        && this.isGuiProgram(elm.payload.program));
                }

                if(determineClientHandle.length>0)
                {
                    let cvalarr = determineClientHandle[0].topic.split("/");
                    this.ClientHandle = cvalarr[1];
                    if(determineClientHandle[0].payload.client_id !== undefined && this.GuiClientID == "")
                    {
                        let p = determineClientHandle[0].payload;
                        let known = this.matchKnownGuiClient(p);
                        this.bindToGuiClient(p.client_id, known ? known.label : (p.program || "GUI"));
                    }
                    if(determineClientHandle[0].payload.station !== undefined)
                        this.Station = determineClientHandle[0].payload.station;
                }
            }

            if(this.HerculesHandle == undefined || this.HerculesHandle == "")
            {
                if(this.initTemp.length > 0)
                    this.HerculesHandle = this.initTemp[0].client;
            }
            

            let dot = this.initTemp.filter((elm) =>
                elm.payload !== undefined
                && elm.payload.client_handle == this.ClientHandle
                && elm.topic !== undefined
                && elm.topic.startsWith("slice"));
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
            if(this.ClientHandle == "" || this.SliceNumbs.length == 0)
            {
                log.info("Initialize: no GUI slices yet (ClientHandle="+this.ClientHandle+"). Waiting for AetherSDR/SmartSDR client status…");
                this.pendingGuiResync = true;
            }
            else
            {
                log.info("Initialize successful. GUI handle="+this.ClientHandle+" slices="+this.SliceNumbs.join(",")+". Have fun!");
            }
        }
    }
}

module.exports = xxFlexRadio; 