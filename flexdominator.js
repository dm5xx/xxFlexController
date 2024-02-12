class flexDominator {
    constructor(masterEmit, defcon) 
    {
        this.NotValidModes = defcon.NotValidModes;
        this.NotValidSteps = defcon.NotValidSteps;
        this.Emitter = masterEmit;
    }

    xmit(elm, flx)
    {

        let sl = this.getRequestedSlice(elm);
        this.Emitter.emit("cptt", sl, elm.State);
        //return "xmit "+elm.State;
    }

    modes(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        let n_mode = this.#getNext(flx["Slice"+sl].mode, flx["Slice"+sl].mode_list, this.NotValidModes);

        return "slice s "+ sl + " mode=" + n_mode;
    }

    #getNext(mode, modelist, notlist = null)
    {
        let cur_idx = modelist.indexOf(mode);
        cur_idx++;

        if(cur_idx == modelist.length)
            cur_idx = 0;

        if(notlist != null)
        {
            while(notlist.indexOf(modelist[cur_idx]) > -1)
            {
                cur_idx++;
    
                if(cur_idx == modelist.length)
                    cur_idx = 0;
            }    
        }

        return modelist[cur_idx];
    }

    #hundret27to100Converter(value127)
    {
        return Math.round(value127*0.7874);
    }

    #Spreader(state, factor, middle = 64)
    {
        let realstate = state-middle; 
        return Math.round(realstate*factor);
    }

    rit(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);


        let ritfac = 70
        if(flx["Slice"+sl].mode == "CW")
            ritfac=7;

        let getRealRit = this.#Spreader(elm.State, ritfac)

        if(getRealRit == 0 )
            return "slice s "+ sl + " rit_on=01 rit_freq=0";

        return "slice s "+ sl + " rit_on=1 rit_freq=" + this.#Spreader(elm.State, ritfac);
    }

    volume(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        //audio client id slice 0 gain 10
        return "audio client "+ flx.client_handle + " slice " + sl + " gain " + this.#hundret27to100Converter(elm.State);
    }

    agc(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        return "slice s "+ sl + " agc_threshold=" + elm.State;
    }

    vfo(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(elm.State == 1)
        {
            flx["Slice"+sl].RF_frequency= flx["Slice"+sl].RF_frequency+flx["Slice"+sl].step*0.000001;
        }
        else
        {
            flx["Slice"+sl].RF_frequency= flx["Slice"+sl].RF_frequency-flx["Slice"+sl].step*0.000001;
        }
        return "slice tune "+ sl + " " + flx["Slice"+sl].RF_frequency;
        // flx.RF_frequency
    }

    steps(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);
        flx["Slice"+sl].step = this.#getNext(flx["Slice"+sl].step, flx["Slice"+sl].step_list, this.NotValidSteps);

        return "slice s "+ sl + " step=" + flx["Slice"+sl].step;
    }

    filters(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let fildif = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo;
        if(flx["Slice"+sl].mode=="CW")
        {
            let n_fil = this.#getNext(fildif, flx.CWFilter, null)

            let half = n_fil/2;
            flx["Slice"+sl].filter_lo= -half;
            flx["Slice"+sl].filter_hi= half;

        }
        else
        {
            let n_fil = this.#getNext(fildif, flx.Filter, null);

            flx["Slice"+sl].filter_hi= flx["Slice"+sl].filter_lo+n_fil;
        }

        flx["Slice"+sl].InitFilterBW = flx["Slice"+sl].filter_hi-flx["Slice"+sl].filter_lo;

        return "filt "+sl+" "+ flx["Slice"+sl].filter_lo +" "+flx["Slice"+sl].filter_hi;
    }

    toggleRXANT(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        let antNum = 1;
        let rxnum = "A";

        if(sl == 1)
        {
            antNum = 2;
            rxnum = "B";    
        }

        if(flx["Slice"+sl].rxant == flx["Slice"+sl].txant)
            flx["Slice"+sl].rxant = "RX_"+rxnum;
        else
            flx["Slice"+sl].rxant = flx["Slice"+sl].txant;

        return "slice s "+ sl + " rxant=" + flx["Slice"+sl].rxant;
    }

    toggleTXANT(elm, flx)
    {
        let sl = this.getRequestedSlice(elm);

        if(flx["Slice"+sl].txant == "ANT1")
            flx["Slice"+sl].txant = "ANT2";
        else
            flx["Slice"+sl].txant = "ANT1";

        return "slice s "+ sl + " txant=" + flx["Slice"+sl].txant;
    }

    panBW(elm, flx)
    {
        if(flx.PanBW.indexOf(flx["DisplayPan"].bandwidth) == -1)
        {
            flx["DisplayPan"].bandwidth = flx.PanBW[flx.PanBW.length-1];
        }

        let n_bw = this.#getNext(flx["DisplayPan"].bandwidth, flx.PanBW, null);
        flx["DisplayPan"].bandwidth = n_bw;

        let sl = this.getRequestedSlice(elm);

        setTimeout(() => this.Emitter.emit("ct", flx["Slice"+sl].RF_frequency), 1000);
        return "display panf s "+ flx["DisplayPan"].StreamId + " bandwidth=" + flx["DisplayPan"].bandwidth;
    }

    fadePan(elm, flx)
    {
        let val = this.#Spreader(this.#hundret27to100Converter(elm.State), 1, 50);

        let cv = (50+val);

        if(cv < 50)
        {
            return "audio client "+ flx.client_handle + " slice 0 pan " + cv;
        }
        return "audio client "+ flx.client_handle + " slice 1 pan " + cv;
    }

    freeFilter(elm, flx)
    {

        let sl = this.getRequestedSlice(elm);
        let val = (this.#hundret27to100Converter(elm.State));

        let fildif = flx["Slice"+sl].InitFilterBW;
        let newval = 0; 
        let neloval = 0; 

        if(flx["Slice"+sl].mode=="USB")
        {
            if(val<50)
            {
                newval= flx["Slice"+sl].filter_lo + flx["Slice"+sl].filter_hi-(((50-val)*2/100)*fildif);
            }
            else if(val==50)
            {
                newval= flx["Slice"+sl].filter_lo + fildif;
            }
            else{
                newval= flx["Slice"+sl].filter_lo + flx["Slice"+sl].filter_hi+(((val-50)*2/100)*fildif);
            }    
            return "filt "+sl+" "+ flx["Slice"+sl].filter_lo +" "+newval;
        }
        else if(flx["Slice"+sl].mode=="LSB")
        {
            if(val<50)
            {
                newval= flx["Slice"+sl].filter_lo + (((50-val)*2/100)*fildif) -100;
            }
            else if(val==50)
            {
                newval= flx["Slice"+sl].filter_hi - fildif;
            }
            else{
                newval= flx["Slice"+sl].filter_lo - (((val-50)*2/100)*fildif);
            }    
            return "filt "+sl+" "+ newval +" "+flx["Slice"+sl].filter_hi;
        }
        else if(flx["Slice"+sl].mode=="CW")
        {
            let half = fildif/2;
            if(val<50)
            {
                neloval=-1*half-((val-50)*2/100)*half;
                newval=half+((val-50)*2/100)*half;
            }
            else if(val==50)
            {
                neloval= -1*half;
                newval= half;
            }
            else
            {
                neloval=-1*half-((val-50)*2/100)*half;
                newval=half+((val-50)*2/100)*half;
            }    
            return "filt "+sl+" "+ neloval +" "+newval;
        }
    }

    monitor(elm, flx)
    {
        return "transmit s mon="+elm.State;
    }

    setdefault(elm, flx)
    {
        this.Emitter.emit("def", flx.Slice0.RF_frequency, flx.Slice0.mode);
    }

    getRequestedSlice(elm)
    {
        if(elm.Part == "B")
            return 1;
        return 0;
    }
}

module.exports = flexDominator; 